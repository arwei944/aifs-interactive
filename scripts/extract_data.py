#!/usr/bin/env python3
"""
从本地克隆的原站仓库提取完整课程数据。
读取 catalog.json + phases/*/docs/en.md → 生成 phases.ts + 复制 .md 文件。

用法:
  1. 克隆原站仓库: git clone --depth 1 https://github.com/rohitg00/ai-engineering-from-scratch.git
  2. 修改下方 SRC 路径指向克隆目录
  3. 运行: python scripts/extract_data.py
"""
import json, os, re, shutil, glob

# ===== 配置 =====
SRC = os.environ.get("AIFS_SRC", "../ai-engineering-from-scratch")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_PHASES = os.path.join(PROJECT_DIR, "src/data/phases.ts")
OUT_MD = os.path.join(PROJECT_DIR, "public/content/lessons")

PHASE_CN = {
    0: ("环境搭建与工具链", "环境搭建"),
    1: ("数学基础", "数学基础"),
    2: ("机器学习基础", "机器学习"),
    3: ("深度学习核心", "深度学习"),
    4: ("计算机视觉", "计算机视觉"),
    5: ("自然语言处理", "自然语言处理"),
    6: ("语音与音频", "语音与音频"),
    7: ("Transformer 深入", "Transformer"),
    8: ("生成式 AI", "生成式AI"),
    9: ("强化学习", "强化学习"),
    10: ("大语言模型从零构建", "大语言模型"),
    11: ("LLM 工程化", "LLM工程"),
    12: ("多模态 AI", "多模态AI"),
    13: ("工具与协议", "工具协议"),
    14: ("智能体工程", "智能体工程"),
    15: ("自主系统", "自主系统"),
    16: ("多智能体与群体", "多智能体"),
    17: ("基础设施与生产部署", "基础设施"),
    18: ("伦理安全与对齐", "伦理安全"),
    19: ("毕业项目", "毕业项目"),
}

def status_of(n):
    if n <= 5: return "completed"
    if n <= 7: return "in-progress"
    return "planned"

def parse_md(path):
    """读取 en.md，提取元数据和摘要关键词"""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except:
        return None
    meta = {"type": "learn", "languages": ["python"], "time": "~30 分钟"}

    m = re.search(r'\*\*Type:\*\*\s*(Build|Learn)', text)
    if m: meta["type"] = "build" if m.group(1) == "Build" else "learn"

    m = re.search(r'\*\*Languages?:\*\*\s*(.+)', text)
    if m: meta["languages"] = [l.strip().lower() for l in m.group(1).split(",")]

    m = re.search(r'\*\*Time:\*\*\s*(.+)', text)
    if m: meta["time"] = m.group(1).strip()

    # 摘要：取 The Problem 后第一段
    summary = ""
    m = re.search(r'##\s+The Problem\s*\n\n(.+?)(?:\n\n|\Z)', text, re.DOTALL)
    if m:
        summary = m.group(1).strip()[:150]
        if len(m.group(1).strip()) > 150: summary += "..."

    # 关键词：从 Key Terms 表格提取
    keywords = []
    m = re.search(r'##\s+Key Terms\s*\n\n(.+?)(?:\n##|\Z)', text, re.DOTALL)
    if m:
        for row in re.finditer(r'\|\s*([^|]+?)\s*\|', m.group(1)):
            t = row.group(1).strip()
            if t and t.lower() not in ("term", "---", "what people say", "what it actually means"):
                keywords.append(t)
    keywords = keywords[:8]

    # 时长分钟数
    minutes = 30
    m = re.search(r'(\d+)\s*(?:min|minute|小时|hour|h)', meta["time"], re.I)
    if m:
        v = int(m.group(1))
        minutes = v * 60 if re.search(r'hour|小时|h', m.group(0), re.I) else v

    return {"meta": meta, "summary": summary, "keywords": keywords, "minutes": minutes, "content": text}

def esc(s):
    """转义 TypeScript 字符串（在单引号字符串中使用）"""
    s = s.replace("\\", "\\\\")
    s = s.replace("'", "\\'")
    s = s.replace("\n", " ").replace("\r", "")
    return s

def esc_kw(s):
    """转义关键词（在双引号字符串中使用）"""
    s = s.replace("\\", "\\\\")
    s = s.replace('"', '\\"')
    s = s.replace("\n", " ").replace("\r", "")
    return s

def main():
    # 清空输出目录
    if os.path.exists(OUT_MD):
        shutil.rmtree(OUT_MD)
    os.makedirs(OUT_MD, exist_ok=True)

    catalog_path = os.path.join(SRC, "catalog.json")
    if not os.path.exists(catalog_path):
        print(f"❌ 找不到 {catalog_path}")
        print(f"   请先克隆仓库: git clone --depth 1 https://github.com/rohitg00/ai-engineering-from-scratch.git")
        print(f"   或设置环境变量: AIFS_SRC=/path/to/repo")
        return 1

    with open(catalog_path) as f:
        catalog = json.load(f)

    phases_json = []
    total = 0
    docs_ok = 0

    for phase in catalog["phases"]:
        pn = phase["num"]
        cn_title, cn_short = PHASE_CN.get(pn, (phase["title"], phase["title"][:6]))
        print(f"阶段 {pn}: {cn_short} ({phase['lesson_count']} 课)")

        lessons_json = []
        for lesson in phase["lessons"]:
            ln = lesson["num"]
            lid = f"{pn:02d}-{ln:02d}"
            ltitle = lesson["title"]
            lpath = os.path.join(SRC, lesson["path"], "docs", "en.md")

            data = parse_md(lpath)
            if data:
                docs_ok += 1
                # 保存 Markdown
                with open(os.path.join(OUT_MD, f"{lid}.md"), "w", encoding="utf-8") as f:
                    f.write(data["content"])
                m = data["meta"]
                kw = ", ".join(f'"{esc_kw(k)}"' for k in data["keywords"])
                lessons_json.append(
                    f"    {{ id: '{lid}', num: {ln}, title: '{esc(ltitle)}', "
                    f"type: '{m['type']}', lang: '{m['languages'][0]}', "
                    f"duration: '~{data['minutes']}min', "
                    f"summary: '{esc(data['summary'])}', keywords: [{kw}] }}"
                )
            else:
                lessons_json.append(
                    f"    {{ id: '{lid}', num: {ln}, title: '{esc(ltitle)}', "
                    f"type: 'learn', lang: 'python', duration: '~30min', "
                    f"summary: '', keywords: [] }}"
                )
            total += 1

        total_min = sum(
            int(re.search(r'(\d+)', l).group(1)) if re.search(r'(\d+)', l) else 30
            for l in lessons_json
        )
        dur = f"~{total_min // 60}h" if total_min >= 60 else f"~{total_min}min"

        phases_json.append(
            f"  {{\n    id: 'phase-{pn}', num: {pn},\n"
            f"    title: '{esc(cn_title)}', shortTitle: '{esc(cn_short)}',\n"
            f"    lessons: [\n" + ",\n".join(lessons_json) + "\n    ],\n"
            f"    duration: '{dur}', status: '{status_of(pn)}',\n"
            f"    description: '阶段 {pn}：{esc(cn_title)}，共 {phase['lesson_count']} 节课'\n  }}"
        )
        print(f"  ✅ 完成\n")

    # 写入 phases.ts
    ts = (
        "// 自动生成 — 来源 github.com/rohitg00/ai-engineering-from-scratch\n"
        "// 请勿手动修改，使用 scripts/extract_data.py 重新生成\n\n"
        "export interface Lesson {\n"
        "  id: string; num: number; title: string;\n"
        "  type: 'build' | 'learn' | 'capstone'; lang: string;\n"
        "  duration: string; summary: string; keywords: string[];\n"
        "}\n\n"
        "export interface Phase {\n"
        "  id: string; num: number; title: string; shortTitle: string;\n"
        "  lessons: Lesson[]; duration: string;\n"
        "  status: 'completed' | 'in-progress' | 'planned'; description: string;\n"
        "}\n\n"
        f"export const phases: Phase[] = [\n" + ",\n\n".join(phases_json) + "\n];\n\n"
        f"export function getPhase(id: string) {{ return phases.find(p => p.id === id); }}\n\n"
        f"export function getLesson(pid: string, lid: string) {{\n"
        f"  const p = getPhase(pid);\n"
        f"  return p ? {{ lesson: p.lessons.find(l => l.id === lid), phase: p }} : undefined;\n"
        f"}}\n\n"
        f"export function getTotalLessons() {{ return {total}; }}\n\n"
        f"export function getAllLessons() {{\n"
        f"  return phases.flatMap(p => p.lessons.map(l => ({{ lesson: l, phase: p }})));\n"
        f"}}\n"
    )
    with open(OUT_PHASES, "w", encoding="utf-8") as f:
        f.write(ts)

    print(f"🎉 完成！{len(catalog['phases'])} 阶段 / {total} 课 / {docs_ok} 文档")

if __name__ == "__main__":
    main()
