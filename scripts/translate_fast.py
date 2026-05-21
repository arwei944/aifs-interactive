#!/usr/bin/env python3
"""
高速批量翻译 Markdown 课程文件（英文 → 中文）v3 — 极速版。

核心优化：
  1. 双引擎轮换（sogou 0.48s + youdao 0.84s），分散限流风险
  2. 整文件合并翻译（每文件仅 1-3 次 API 调用，而非逐段几十次）
  3. 高并发（10 线程），引擎轮换避免单引擎限流
  4. 零 sleep（靠多引擎分散请求）
  5. 每 10 分钟自动 git push 同步到 GitHub

用法:
  python3 scripts/translate_fast.py [--all] [--phase N] [--lesson XX-YY] [--force] [--workers N] [--sync-interval SECONDS]
"""

import os, re, sys, time, json, argparse, threading, subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ===== 配置 =====
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
LESSONS_DIR = PROJECT_DIR / "public" / "content" / "lessons"
PROGRESS_FILE = PROJECT_DIR / "data" / "runtime" / "translate-progress.json"
PUBLIC_PROGRESS_FILE = PROJECT_DIR / "data" / "runtime" / "translate-progress.json"
PUBLIC_LOG_FILE = PROJECT_DIR / "data" / "runtime" / "translate-log.json"
WORKERS_DIR = PROJECT_DIR / "data" / "runtime" / "workers"
MAX_SEGMENT = 4500  # 单次翻译最大字符数

# 翻译引擎（sogou 有乱码问题，只用 youdao）
ENGINES = ["youdao"]
engine_counter = threading.Lock()
engine_index = [0]

def get_engine():
    """线程安全地轮换翻译引擎"""
    with engine_counter:
        eng = ENGINES[engine_index[0] % len(ENGINES)]
        engine_index[0] += 1
        return eng


# ===== 正则 =====
CODE_BLOCK_RE = re.compile(r'^(`{3,}\S*)$', re.MULTILINE)
INLINE_CODE_RE = re.compile(r'`[^`\n]+`')
IMAGE_RE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
LINK_RE = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

# 不翻译的行模式
SKIP_LINE_PATTERNS = [
    re.compile(r'^\s*```'),
    re.compile(r'^\s*\|.*\|\s*$'),
    re.compile(r'^\s*---+\s*$'),
    re.compile(r'^\s*$'),
    re.compile(r'^\s*[-*+]\s*$'),
    re.compile(r'^\s*\d+\.\s*$'),
]

META_FIELDS = {"Type", "Languages", "Language", "Time", "Prerequisites"}


# ===== 进度管理 =====
progress_lock = threading.Lock()
file_lock_path = PROJECT_DIR / "data" / "runtime" / ".progress.lock"

def _file_lock():
    """跨进程文件锁（简单实现）"""
    import fcntl
    return fcntl

def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"translated": [], "failed": [], "last_file": None, "log": [], "start_time": None}


def save_progress(progress):
    """跨进程安全保存：先读取最新文件，合并后再写入"""
    with progress_lock:
        # 1. 读取磁盘上的最新进度（可能被其他进程更新了）
        try:
            with open(PROGRESS_FILE) as f:
                disk_progress = json.load(f)
        except:
            disk_progress = {"translated": [], "failed": [], "log": [], "start_time": None}

        # 2. 合并：取磁盘和内存的并集
        disk_translated = set(disk_progress.get("translated", []))
        mem_translated = set(progress.get("translated", []))
        merged_translated = list(disk_translated | mem_translated)

        disk_failed = set(disk_progress.get("failed", []))
        mem_failed = set(progress.get("failed", []))
        merged_failed = list((disk_failed | mem_failed) - disk_translated - mem_translated)

        # 3. 合并日志（取时间戳最新的 500 条）
        disk_log = disk_progress.get("log", [])
        mem_log = progress.get("log", [])
        all_log = {entry.get("file", ""): entry for entry in disk_log + mem_log}
        merged_log = sorted(all_log.values(), key=lambda x: x.get("time", 0), reverse=True)[:500]

        # 4. 保留最早的 start_time
        start_time = progress.get("start_time") or disk_progress.get("start_time")
        last_file = progress.get("last_file") or disk_progress.get("last_file")

        merged = {
            "translated": merged_translated,
            "failed": merged_failed,
            "log": merged_log,
            "start_time": start_time,
            "last_file": last_file,
        }

        # 5. 原子写入（先写临时文件，再重命名）
        tmp_file = PROGRESS_FILE.with_suffix(".tmp")
        with open(tmp_file, "w") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        tmp_file.replace(PROGRESS_FILE)

        # 6. 同步到 public（已废弃，但保留兼容）
        try:
            with open(PUBLIC_PROGRESS_FILE, "w") as f:
                json.dump(merged, f, indent=2, ensure_ascii=False)
            with open(PUBLIC_LOG_FILE, "w") as f:
                json.dump({"log": merged.get("log", [])}, f, indent=2, ensure_ascii=False)
        except:
            pass

        # 7. 更新内存中的 progress 对象
        progress["translated"] = merged_translated
        progress["failed"] = merged_failed
        progress["log"] = merged_log


# ===== 翻译核心 =====
def translate_text(text, engine=None):
    """翻译一段纯文本，自动重试和引擎切换"""
    import translators as ts
    if engine is None:
        engine = get_engine()

    for attempt in range(3):
        try:
            result = ts.translate_text(text, from_lang='en', to_lang='zh', translator=engine)
            if result and result.strip():
                return result
            raise ValueError("空结果")
        except Exception as e:
            if attempt < 2:
                engine = get_engine()
                time.sleep(0.3 * (attempt + 1))
            else:
                return text
    return text


def extract_protected(text):
    """提取行内代码、图片、链接，替换为占位符"""
    placeholders = {}
    counter = [0]

    def _rep(match):
        key = f"\x00Z{counter[0]}\x00"
        placeholders[key] = match.group(0)
        counter[0] += 1
        return key

    text = INLINE_CODE_RE.sub(_rep, text)
    text = IMAGE_RE.sub(_rep, text)
    text = LINK_RE.sub(_rep, text)
    return text, placeholders


def restore_protected(text, placeholders):
    for key, value in placeholders.items():
        text = text.replace(key, value)
    return text


def is_meta_line(line):
    m = re.match(r'^\*\*(\w[\w\s]*?):\*\*\s*(.+)$', line)
    return m and m.group(1).strip() in META_FIELDS


def is_code_block_line(line):
    stripped = line.strip()
    return (stripped.startswith('```') and (stripped.rstrip('`') == '' or
            (len(stripped) > 3 and not stripped[3:].strip())))


def translate_file(filepath, progress, force=False):
    """翻译单个 Markdown 文件 — 整文件批量策略"""
    fname = filepath.name

    with progress_lock:
        if fname in progress["translated"] and not force:
            return "skipped"

    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()

        if not lines:
            return "empty"

        # ===== 第一步：将文件拆分为"可翻译段落"和"不可翻译行" =====
        segments = []       # [(start_line_idx, text_lines), ...]  需要翻译的段落
        fixed_lines = {}    # {line_idx: line_content}  不翻译的行

        in_code_block = False
        current_segment = []  # 当前段落的行索引和内容

        def flush_segment():
            nonlocal current_segment
            if current_segment:
                segments.append(current_segment[:])
                current_segment = []

        for i, line in enumerate(lines):
            stripped = line.rstrip('\n')

            if is_code_block_line(stripped):
                flush_segment()
                in_code_block = not in_code_block
                fixed_lines[i] = stripped
                continue

            if in_code_block:
                fixed_lines[i] = stripped
                continue

            if not stripped.strip():
                flush_segment()
                fixed_lines[i] = ""
                continue

            if re.match(r'^\s*\|', stripped):
                flush_segment()
                fixed_lines[i] = stripped
                continue

            if re.match(r'^\s*---+\s*$', stripped):
                flush_segment()
                fixed_lines[i] = stripped
                continue

            if is_meta_line(stripped):
                flush_segment()
                fixed_lines[i] = stripped
                continue

            # 列表项、引用块、标题 — 保留前缀，内容加入段落翻译
            list_match = re.match(r'^(\s*(?:[-*+]|\d+\.)\s*)(.*)$', stripped)
            quote_match = re.match(r'^(\s*>\s*)(.*)$', stripped)
            heading_match = re.match(r'^(#{1,6}\s+)(.*)$', stripped)

            if list_match or quote_match or heading_match:
                flush_segment()
                # 单独作为一段翻译（保留前缀）
                segments.append([(i, stripped)])
                continue

            # 普通文本行 — 加入当前段落
            current_segment.append((i, stripped))

        flush_segment()

        if not segments:
            return "empty"

        # ===== 第二步：批量翻译每个段落 =====
        translated_map = {}  # {line_idx: translated_content}

        for seg in segments:
            # 提取纯文本内容
            line_indices = [item[0] for item in seg]
            raw_texts = [item[1] for item in seg]

            # 处理单行特殊行（列表、引用、标题）
            if len(seg) == 1 and (list_match := re.match(r'^(\s*(?:[-*+]|\d+\.)\s*)(.*)$', raw_texts[0])):
                prefix = list_match.group(1)
                content = list_match.group(2)
                if content.strip():
                    content, ph = extract_protected(content)
                    translated = translate_text(content)
                    translated = restore_protected(translated, ph)
                    translated_map[line_indices[0]] = prefix + translated
                else:
                    translated_map[line_indices[0]] = raw_texts[0]
                continue

            if len(seg) == 1 and (quote_match := re.match(r'^(\s*>\s*)(.*)$', raw_texts[0])):
                prefix = quote_match.group(1)
                content = quote_match.group(2)
                if content.strip():
                    content, ph = extract_protected(content)
                    translated = translate_text(content)
                    translated = restore_protected(translated, ph)
                    translated_map[line_indices[0]] = prefix + translated
                else:
                    translated_map[line_indices[0]] = raw_texts[0]
                continue

            if len(seg) == 1 and (heading_match := re.match(r'^(#{1,6}\s+)(.*)$', raw_texts[0])):
                prefix = heading_match.group(1)
                title_text = heading_match.group(2)
                title_text, ph = extract_protected(title_text)
                translated = translate_text(title_text)
                translated = restore_protected(translated, ph)
                translated_map[line_indices[0]] = prefix + translated
                continue

            # 多行普通文本 — 合并翻译
            combined = "\n".join(raw_texts)
            combined, ph = extract_protected(combined)

            # 如果太长，分段
            if len(combined) > MAX_SEGMENT:
                # 按段落（空行分隔）拆分
                parts = combined.split("\n\n")
                translated_parts = []
                current_chunk = []
                current_len = 0

                for part in parts:
                    if current_len + len(part) > MAX_SEGMENT and current_chunk:
                        chunk = "\n\n".join(current_chunk)
                        translated_parts.append(translate_text(chunk))
                        current_chunk = []
                        current_len = 0
                    current_chunk.append(part)
                    current_len += len(part) + 2

                if current_chunk:
                    chunk = "\n\n".join(current_chunk)
                    translated_parts.append(translate_text(chunk))

                translated = "\n\n".join(translated_parts)
            else:
                translated = translate_text(combined)

            translated = restore_protected(translated, ph)

            # 拆回行
            t_lines = translated.split("\n")
            while len(t_lines) < len(line_indices):
                t_lines.append("")
            t_lines = t_lines[:len(line_indices)]

            for idx, t_line in zip(line_indices, t_lines):
                translated_map[idx] = t_line

        # ===== 第三步：重组文件 =====
        result_lines = []
        for i in range(len(lines)):
            if i in translated_map:
                result_lines.append(translated_map[i])
            elif i in fixed_lines:
                result_lines.append(fixed_lines[i])
            else:
                result_lines.append(lines[i].rstrip('\n'))

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(result_lines))

        with progress_lock:
            progress["translated"].append(fname)
            progress["last_file"] = fname
            if fname in progress["failed"]:
                progress["failed"].remove(fname)
            if "log" not in progress:
                progress["log"] = []
            progress["log"].append({"file": fname, "status": "ok", "time": time.time()})
        save_progress(progress)
        return "ok"

    except Exception as e:
        print(f"\n  ❌ 文件错误 {fname}: {e}")
        with progress_lock:
            progress["failed"].append(fname)
            if "log" not in progress:
                progress["log"] = []
            progress["log"].append({"file": fname, "status": "error", "msg": str(e), "time": time.time()})
        save_progress(progress)
        return "error"


# ===== Git 同步 =====
def git_sync():
    """git add + commit + push"""
    try:
        subprocess.run(["git", "add", "-A"], cwd=PROJECT_DIR, capture_output=True, timeout=30)
        result = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=PROJECT_DIR, capture_output=True, timeout=10
        )
        if result.returncode == 0:
            print(f"  📭 [{time.strftime('%H:%M:%S')}] 无变更，跳过同步")
            return

        msg = f"🔄 翻译进度同步 - {time.strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=PROJECT_DIR, capture_output=True, timeout=30
        )
        result = subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=PROJECT_DIR, capture_output=True, timeout=60
        )
        if result.returncode == 0:
            print(f"  ✅ [{time.strftime('%H:%M:%S')}] Git push 成功")
        else:
            stderr = result.stderr.decode(errors='replace')
            print(f"  ⚠️ [{time.strftime('%H:%M:%S')}] Git push 失败: {stderr[:200]}")
    except Exception as e:
        print(f"  ⚠️ [{time.strftime('%H:%M:%S')}] Git 同步异常: {e}")


def sync_loop(interval_seconds, stop_event):
    """定时同步线程"""
    while not stop_event.is_set():
        stop_event.wait(interval_seconds)
        if not stop_event.is_set():
            git_sync()


# ===== 主函数 =====
def main():
    parser = argparse.ArgumentParser(description="高速批量翻译 Markdown 课程 (EN→ZH) v3")
    parser.add_argument("--all", action="store_true", help="翻译所有文件")
    parser.add_argument("--phase", type=int, help="只翻译指定阶段 (0-19)")
    parser.add_argument("--phase-range", type=str, help="阶段范围 (如 '5-9' 或 '10,11,12')")
    parser.add_argument("--lesson", type=str, help="只翻译指定课程 (如 03-04)")
    parser.add_argument("--force", action="store_true", help="强制重新翻译")
    parser.add_argument("--workers", type=int, default=10, help="并发线程数 (默认 10)")
    parser.add_argument("--sync-interval", type=int, default=600, help="Git 同步间隔秒数 (默认 600=10分钟)")
    parser.add_argument("--limit", type=int, default=0, help="限制翻译文件数 (0=不限)")
    parser.add_argument("--dry-run", action="store_true", help="只统计不翻译")
    parser.add_argument("--worker-id", type=str, default="main", help="工作进程 ID (用于多进程并行)")
    parser.add_argument("--no-sync", action="store_true", help="禁用 git 自动同步 (由主进程负责)")
    args = parser.parse_args()

    if not args.all and not args.phase and not args.phase_range and not args.lesson:
        args.all = True

    # 测试翻译服务
    import translators as ts
    print("🔍 测试翻译引擎...")
    try:
        t0 = time.time()
        result = ts.translate_text("Hello World", from_lang='en', to_lang='zh', translator='youdao')
        dt = time.time() - t0
        print(f"  ✅ youdao: 'Hello World' → '{result}' ({dt:.2f}s)")
    except Exception as e:
        print(f"  ❌ youdao: {e}")
        return 1

    progress = load_progress()
    if not progress.get("start_time"):
        progress["start_time"] = time.time()
        save_progress(progress)

    md_files = sorted(LESSONS_DIR.glob("*.md"))
    print(f"\n📂 找到 {len(md_files)} 个 Markdown 文件")

    if args.lesson:
        md_files = [f for f in md_files if f.stem == args.lesson]
    elif args.phase is not None:
        prefix = f"{args.phase:02d}-"
        md_files = [f for f in md_files if f.stem.startswith(prefix)]
    elif args.phase_range:
        # 解析阶段范围: '5-9' 或 '10,11,12' 或 '5-7,10,12-14'
        phases_to_translate = set()
        for part in args.phase_range.split(','):
            part = part.strip()
            if '-' in part:
                start, end = part.split('-', 1)
                phases_to_translate.update(range(int(start), int(end) + 1))
            else:
                phases_to_translate.add(int(part))
        md_files = [f for f in md_files if int(f.stem[:2]) in phases_to_translate]

    if args.limit > 0:
        md_files = md_files[:args.limit]

    if args.dry_run:
        total_chars = sum(f.stat().st_size for f in md_files)
        already = sum(1 for f in md_files if f.name in progress["translated"])
        print(f"📊 总计: {len(md_files)} 文件, {total_chars:,} 字符")
        print(f"✅ 已翻译: {already}, ⏳ 待翻译: {len(md_files) - already}")
        return 0

    # 过滤已翻译
    to_translate = [f for f in md_files if f.name not in progress["translated"] or args.force]
    already_done = len(md_files) - len(to_translate)

    # Worker 状态文件
    worker_id = args.worker_id
    WORKERS_DIR.mkdir(parents=True, exist_ok=True)
    worker_state_file = WORKERS_DIR / f"{worker_id}.json"

    def write_worker_state(completed_count, total_count, current_file, status_text):
        try:
            state = {
                "id": worker_id,
                "completed": completed_count,
                "total": total_count,
                "current_file": current_file,
                "status": status_text,
                "last_update": time.time(),
                "start_time": start_time,
                "phase_range": args.phase_range or (f"phase-{args.phase}" if args.phase else "all"),
            }
            with open(worker_state_file, "w") as f:
                json.dump(state, f, ensure_ascii=False)
        except:
            pass

    def clear_worker_state():
        try:
            if worker_state_file.exists():
                worker_state_file.unlink()
        except:
            pass

    print(f"\n🚀 开始高速翻译！[{worker_id}]")
    print(f"  📊 总计: {len(md_files)} | ✅ 已完成: {already_done} | ⏳ 待翻译: {len(to_translate)}")
    print(f"  🔧 并发: {args.workers} 线程 | 🔄 引擎: youdao")
    if not args.no_sync:
        print(f"  📤 Git 同步间隔: {args.sync_interval}s ({args.sync_interval // 60} 分钟)")
    else:
        print(f"  📤 Git 同步: 已禁用（由主进程负责）")
    print()

    if not to_translate:
        print("🎉 所有文件已翻译完成！")
        if not args.no_sync:
            git_sync()
        clear_worker_state()
        return 0

    write_worker_state(0, len(to_translate), "", "running")

    # 启动定时同步线程（仅主进程）
    stop_sync = threading.Event()
    if not args.no_sync and args.sync_interval > 0:
        sync_thread = threading.Thread(target=sync_loop, args=(args.sync_interval, stop_sync), daemon=True)
        sync_thread.start()

    # 并发翻译
    stats = {"ok": 0, "skipped": 0, "error": 0, "empty": 0}
    start_time = time.time()
    completed = [0]  # 用列表以便在闭包中修改
    print_lock = threading.Lock()

    def do_translate(f):
        status = translate_file(f, progress, args.force)
        with print_lock:
            completed[0] += 1
            elapsed = time.time() - start_time
            speed = completed[0] / elapsed if elapsed > 0 else 0
            remaining = (len(to_translate) - completed[0]) / speed if speed > 0 else 0

            icon = {"ok": "✅", "skipped": "⏭️", "error": "❌", "empty": "📭"}[status]
            total_done = already_done + completed[0]
            print(f"  {icon} [{worker_id}] [{total_done}/{len(md_files)}] {f.name} "
                  f"({completed[0] * 100 // len(to_translate)}% | "
                  f"{speed:.1f} 文件/s | ETA {remaining:.0f}s)")
            write_worker_state(completed[0], len(to_translate), f.name,
                             "running" if completed[0] < len(to_translate) else "done")
        return status

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(do_translate, f): f for f in to_translate}
        for future in as_completed(futures):
            status = future.result()
            stats[status] += 1

    # 停止同步线程并做最后一次同步
    stop_sync.set()
    print(f"\n{'='*50}")
    elapsed = time.time() - start_time
    print(f"🎉 翻译完成！[{worker_id}]")
    print(f"  ✅ 成功: {stats['ok']}  ❌ 失败: {stats['error']}  📭 空: {stats['empty']}")
    print(f"  ⏱️ 耗时: {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"  🚀 速度: {stats['ok']/elapsed:.1f} 文件/s" if elapsed > 0 else "")

    write_worker_state(completed[0], len(to_translate), "", "done")

    # 最终同步（仅主进程）
    if not args.no_sync:
        print(f"\n📤 执行最终 Git 同步...")
        git_sync()
    else:
        clear_worker_state()

    if stats["error"] > 0:
        print(f"\n⚠️ 失败文件可使用 --force 重新翻译")


if __name__ == "__main__":
    main()
