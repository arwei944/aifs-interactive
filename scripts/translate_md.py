#!/usr/bin/env python3
"""
批量翻译 Markdown 课程文件（英文 → 中文）。
使用 translators 库的 youdao 引擎（免费，无需 API key）。

核心策略：逐行处理，只翻译纯文本行，完全保留 Markdown 语法行。

用法:
  python scripts/translate_md.py [--all] [--phase N] [--lesson XX-YY] [--dry-run] [--force]
  python scripts/translate_md.py --titles-only   # 只翻译 phases.ts 中的标题
"""

import os, re, sys, time, json, argparse
from pathlib import Path

# ===== 配置 =====
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
LESSONS_DIR = PROJECT_DIR / "public" / "content" / "lessons"
PROGRESS_FILE = PROJECT_DIR / ".translate_progress.json"
MAX_SEGMENT = 4000

# 正则
CODE_BLOCK_RE = re.compile(r'^(`{3,}\S*)$', re.MULTILINE)
INLINE_CODE_RE = re.compile(r'`[^`\n]+`')
IMAGE_RE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
BOLD_RE = re.compile(r'\*\*([^*]+)\*\*')
ITALIC_RE = re.compile(r'(?<!\*)\*([^*]+)\*(?!\*)')

# 不翻译的行模式（整行匹配则跳过）
SKIP_LINE_PATTERNS = [
    re.compile(r'^\s*```'),           # 代码块开始/结束
    re.compile(r'^\s*\|.*\|\s*$'),    # 表格行
    re.compile(r'^\s*---+\s*$'),      # 分隔线
    re.compile(r'^\s*$',),            # 空行
    re.compile(r'^\s*>'),             # 引用块标记（翻译内容但保留 >）
    re.compile(r'^\s*[-*+]\s*$'),     # 空列表项
    re.compile(r'^\s*\d+\.\s*$'),     # 空编号列表
]

# 元数据字段（不翻译值）
META_FIELDS = {"Type", "Languages", "Language", "Time", "Prerequisites"}


def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"translated": [], "failed": [], "last_file": None}


def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


def is_code_block_line(line):
    """判断是否是代码块标记行"""
    stripped = line.strip()
    return stripped.startswith('```') and stripped.rstrip('`') == '' or \
           stripped.startswith('```') and len(stripped) > 3 and not stripped[3:].strip()


def extract_inline_protected(text):
    """提取行内代码和图片，替换为占位符"""
    placeholders = {}
    counter = [0]

    def _rep(match):
        key = f"\x00Z{counter[0]}\x00"
        placeholders[key] = match.group(0)
        counter[0] += 1
        return key

    text = INLINE_CODE_RE.sub(_rep, text)
    text = IMAGE_RE.sub(_rep, text)
    return text, placeholders


def restore_inline(text, placeholders):
    for key, value in placeholders.items():
        text = text.replace(key, value)
    return text


def is_meta_line(line):
    """判断是否是元数据行（**Type:** Build 等）"""
    m = re.match(r'^\*\*(\w[\w\s]*?):\*\*\s*(.+)$', line)
    if m and m.group(1).strip() in META_FIELDS:
        return True
    return False


def translate_segment(text):
    """使用 youdao 翻译一段纯文本"""
    import translators as ts
    for attempt in range(3):
        try:
            result = ts.translate_text(text, from_lang='en', to_lang='zh', translator='youdao')
            if result and result.strip():
                return result
            raise ValueError("空结果")
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return text
    return text


def translate_file(filepath, progress, force=False):
    """翻译单个 Markdown 文件 — 逐行处理"""
    fname = filepath.name

    if fname in progress["translated"] and not force:
        return "skipped"

    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()

        if not lines:
            return "empty"

        result_lines = []
        in_code_block = False
        text_buffer = []  # 缓存需要翻译的连续文本行
        buffer_line_nums = []  # 对应行号

        def flush_buffer():
            """翻译并输出缓冲区中的文本"""
            nonlocal text_buffer, buffer_line_nums
            if not text_buffer:
                return

            # 合并文本，用换行连接
            combined = "\n".join(text_buffer)

            # 提取行内保护元素
            combined, placeholders = extract_inline_protected(combined)

            # 分段翻译
            paragraphs = combined.split("\n\n")
            translated_parts = []

            for para in paragraphs:
                if not para.strip():
                    translated_parts.append(para)
                    continue

                # 如果段落太长，按行分割
                if len(para) > MAX_SEGMENT:
                    sub_lines = para.split("\n")
                    sub_translated = []
                    sub_buffer = []
                    for sl in sub_lines:
                        sub_buffer.append(sl)
                        if len("\n".join(sub_buffer)) > MAX_SEGMENT:
                            chunk = "\n".join(sub_buffer[:-1])
                            if chunk.strip():
                                sub_translated.append(translate_segment(chunk))
                                time.sleep(0.5)
                            sub_buffer = [sub_buffer[-1]]
                    if sub_buffer:
                        chunk = "\n".join(sub_buffer)
                        if chunk.strip():
                            sub_translated.append(translate_segment(chunk))
                            time.sleep(0.5)
                    translated_parts.append("\n".join(sub_translated))
                else:
                    translated_parts.append(translate_segment(para))
                    time.sleep(0.5)

            translated = "\n\n".join(translated_parts)

            # 恢复行内保护元素
            translated = restore_inline(translated, placeholders)

            # 拆回行
            t_lines = translated.split("\n")

            # 确保行数匹配（不足则补空行，多余则截断）
            while len(t_lines) < len(text_buffer):
                t_lines.append("")
            t_lines = t_lines[:len(text_buffer)]

            result_lines.extend(t_lines)
            text_buffer = []
            buffer_line_nums = []

        for line in lines:
            stripped = line.rstrip('\n')

            # 代码块标记
            if is_code_block_line(stripped):
                flush_buffer()
                in_code_block = not in_code_block
                result_lines.append(stripped)
                continue

            # 代码块内部 — 不翻译
            if in_code_block:
                result_lines.append(stripped)
                continue

            # 空行 — 刷新缓冲区
            if not stripped.strip():
                flush_buffer()
                result_lines.append("")
                continue

            # 表格行 — 不翻译
            if re.match(r'^\s*\|', stripped):
                flush_buffer()
                result_lines.append(stripped)
                continue

            # 分隔线 — 不翻译
            if re.match(r'^\s*---+\s*$', stripped):
                flush_buffer()
                result_lines.append(stripped)
                continue

            # 元数据行 — 不翻译
            if is_meta_line(stripped):
                flush_buffer()
                result_lines.append(stripped)
                continue

            # 列表项 — 保留标记，翻译内容
            list_match = re.match(r'^(\s*(?:[-*+]|\d+\.)\s*)(.*)$', stripped)
            if list_match:
                flush_buffer()
                prefix = list_match.group(1)
                content = list_match.group(2)
                if content.strip():
                    content, ph = extract_inline_protected(content)
                    translated = translate_segment(content)
                    translated = restore_inline(translated, ph)
                    result_lines.append(prefix + translated)
                    time.sleep(0.3)
                else:
                    result_lines.append(stripped)
                continue

            # 引用块行 — 保留 > 前缀，翻译内容
            quote_match = re.match(r'^(\s*>\s*)(.*)$', stripped)
            if quote_match:
                flush_buffer()
                prefix = quote_match.group(1)
                content = quote_match.group(2)
                if content.strip():
                    content, ph = extract_inline_protected(content)
                    translated = translate_segment(content)
                    translated = restore_inline(translated, ph)
                    result_lines.append(prefix + translated)
                    time.sleep(0.5)
                else:
                    result_lines.append(stripped)
                continue

            # 标题行 — 保留 # 前缀，翻译标题文本
            heading_match = re.match(r'^(#{1,6}\s+)(.*)$', stripped)
            if heading_match:
                flush_buffer()
                prefix = heading_match.group(1)
                title_text = heading_match.group(2)
                # 标题中可能有加粗等格式
                title_text, ph = extract_inline_protected(title_text)
                translated = translate_segment(title_text)
                translated = restore_inline(translated, ph)
                result_lines.append(prefix + translated)
                time.sleep(0.3)
                continue

            # 普通文本行 — 加入缓冲区
            text_buffer.append(stripped)

        # 刷新剩余缓冲区
        flush_buffer()

        # 写回
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(result_lines))

        progress["translated"].append(fname)
        progress["last_file"] = fname
        if fname in progress["failed"]:
            progress["failed"].remove(fname)
        save_progress(progress)
        return "ok"

    except Exception as e:
        print(f"\n  ❌ 文件错误 {fname}: {e}")
        progress["failed"].append(fname)
        save_progress(progress)
        return "error"


def main():
    parser = argparse.ArgumentParser(description="批量翻译 Markdown 课程 (EN→ZH)")
    parser.add_argument("--all", action="store_true", help="翻译所有文件")
    parser.add_argument("--phase", type=int, help="只翻译指定阶段 (0-19)")
    parser.add_argument("--lesson", type=str, help="只翻译指定课程 (如 03-04)")
    parser.add_argument("--dry-run", action="store_true", help="只统计不翻译")
    parser.add_argument("--force", action="store_true", help="强制重新翻译")
    parser.add_argument("--titles-only", action="store_true", help="只翻译 phases.ts 中的标题")
    parser.add_argument("--limit", type=int, default=0, help="限制翻译文件数 (0=不限)")
    args = parser.parse_args()

    if not args.all and not args.phase and not args.lesson and not args.titles_only:
        args.all = True

    import translators as ts
    try:
        test = ts.translate_text("Hello World", from_lang='en', to_lang='zh', translator='youdao')
        print(f"✅ 翻译服务可用: 'Hello World' → '{test}'")
    except Exception as e:
        print(f"❌ 翻译服务不可用: {e}")
        return 1

    progress = load_progress()

    if args.titles_only:
        print("\n📝 翻译 phases.ts 中的标题...")
        phases_file = PROJECT_DIR / "src" / "data" / "phases.ts"
        if not phases_file.exists():
            print("❌ 找不到 phases.ts")
            return 1

        with open(phases_file, encoding="utf-8") as f:
            content = f.read()

        title_pattern = re.compile(r"title:\s*'([^']+)'")
        titles = list(set(title_pattern.findall(content)))
        print(f"  找到 {len(titles)} 个唯一标题")

        translated_map = {}
        for i, title in enumerate(titles):
            cn = translate_segment(title)
            translated_map[title] = cn
            print(f"  [{i+1}/{len(titles)}] {title[:50]} → {cn[:50]}")
            time.sleep(0.3)

        for en, cn in translated_map.items():
            content = content.replace(f"title: '{en}'", f"title: '{cn}'")

        with open(phases_file, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"\n✅ 标题翻译完成！共 {len(translated_map)} 个")
        return 0

    md_files = sorted(LESSONS_DIR.glob("*.md"))
    print(f"📂 找到 {len(md_files)} 个 Markdown 文件")

    if args.lesson:
        md_files = [f for f in md_files if f.stem == args.lesson]
    elif args.phase is not None:
        prefix = f"{args.phase:02d}-"
        md_files = [f for f in md_files if f.stem.startswith(prefix)]

    if args.limit > 0:
        md_files = md_files[:args.limit]

    if args.dry_run:
        total_chars = sum(f.stat().st_size for f in md_files)
        already = sum(1 for f in md_files if f.name in progress["translated"])
        print(f"📊 总计: {len(md_files)} 文件, {total_chars:,} 字符")
        print(f"✅ 已翻译: {already}, ⏳ 待翻译: {len(md_files) - already}")
        return 0

    print(f"\n🚀 开始翻译 {len(md_files)} 个文件...\n")

    stats = {"ok": 0, "skipped": 0, "error": 0, "empty": 0}
    start_time = time.time()

    for i, f in enumerate(md_files):
        status = translate_file(f, progress, args.force)
        stats[status] += 1

        elapsed = time.time() - start_time
        eta = (elapsed / (i + 1)) * (len(md_files) - i - 1) if i > 0 else 0

        icon = {"ok": "✅", "skipped": "⏭️", "error": "❌", "empty": "📭"}[status]
        print(f"  {icon} [{i+1}/{len(md_files)}] {f.name} "
              f"({elapsed:.0f}s, ETA {eta:.0f}s)")

    elapsed = time.time() - start_time
    print(f"\n{'='*50}")
    print(f"🎉 翻译完成！")
    print(f"  ✅ 成功: {stats['ok']}  ⏭️ 跳过: {stats['skipped']}  "
          f"❌ 失败: {stats['error']}  📭 空: {stats['empty']}")
    print(f"  ⏱️ 耗时: {elapsed:.0f}s ({elapsed/60:.1f}min)")

    if stats["error"] > 0:
        print(f"\n⚠️ 失败文件可使用 --force 重新翻译")


if __name__ == "__main__":
    main()
