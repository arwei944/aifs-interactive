#!/usr/bin/env python3
"""
翻译质量校对脚本 — 批量修正常见翻译问题。

修正内容：
  1. AI 术语误译修正（Transformer→变压器 等）
  2. Markdown 格式修复（** 被拆开为 * *）
  3. 损坏占位符清理（Z0、随机字符串）
  4. 元数据行英文值清理

用法:
  python3 scripts/proofread.py [--all] [--phase N] [--lesson XX-YY] [--dry-run]
"""

import os, re, sys, json, argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
LESSONS_DIR = PROJECT_DIR / "public" / "content" / "lessons"

# ===== AI 术语词典：错误翻译 → 正确翻译 =====
TERM_FIXES = [
    # 核心术语误译
    (r'激活功能', '激活函数'),
    (r'注意机制(?!的)', '注意力机制'),
    (r'自我关注', '自注意力'),
    (r'衍生物', '导数'),  # Derivative
    (r'衬底', '基线'),  # baseline
    (r'贴标机', '标注者'),  # annotator/labeler
    (r'亚当的王国', 'Adam 优化器'),
    (r'亚当优化', 'Adam 优化'),
    # Transformer 误译（保留英文）
    (r'变压器(?!模型)', 'Transformer'),
    (r'变形金刚(?!模型)', 'Transformer'),
    # LLM 误译
    (r'法学硕士', 'LLM'),
    # dim 误译
    (r'暗淡(\d)', r'dim\1'),  # "暗淡1024" → "dim1024"
    (r'(\d+)\s*暗', r'\1 dim'),  # "1280 暗" → "1280 dim"
    # ViT 误译
    (r'维特(?=\s*[^\u4e00-\u9fff])', 'ViT'),  # "维特" 后面跟非中文时
    # 人名误译（保留英文）
    (r'巴赫达瑙', 'Bahdanau'),
    (r'龙氏(?!用法)', 'Luong'),  # Luong attention
    # mermaid 误译
    (r'美人鱼', 'mermaid'),
    # AR 误译（在分布式训练上下文）
    (r'增大化现实', 'AllReduce'),
    # 其他常见误译
    (r'长视距构图', '长期规划'),
    (r'片场(?!特意)', '上下文窗口'),  # context window
    (r'子图(?=\[)', 'subgraph'),  # Mermaid 语法
    (r'方向LR', 'direction LR'),
    (r'导入(\w+)\s*为\s*(\w+)', r'import \1 as \2'),  # "导入numpy为np" → "import numpy as np"
    (r'返回上下文，权重', 'return context, weights'),
    (r'定义(\w+)', r'def \1'),  # "定义additive_attention" → "def additive_attention"
]

# ===== Markdown 格式修复规则 =====
# 修复被拆开的加粗 ** → * *
MARKDOWN_BOLD_FIX = re.compile(r'\*\s+\*')
# 修复被拆开的代码块 ``` → ` ` `
MARKDOWN_CODE_FIX = re.compile(r'`\s+`\s+`')
# 修复 **Type:** 等元数据行中多余的空格
META_FIX = re.compile(r'\*\*\s*(Type|Languages|Language|Time|Prerequisites)\s*:\s*\*\*\s*')

# ===== 损坏占位符清理 =====
# Z0 占位符（可能是原始内容中的图表引用）
Z0_FIX = re.compile(r'\bZ0\b')
# 随机字母数字串（20+字符的纯小写字母数字混合）
RANDOM_STRING = re.compile(r'\b[a-z0-9]{18,}\b')

# ===== 代码块保护 =====
CODE_BLOCK_RE = re.compile(r'^(`{3,}\S*?\n)(.*?)(^`{3,}\s*$)', re.MULTILINE | re.DOTALL)


def proofread_file(filepath, dry_run=False):
    """校对单个文件"""
    try:
        with open(filepath, encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {"file": filepath.name, "status": "error", "msg": str(e)}

    original = content
    changes = []

    # ===== 第一步：提取并保护代码块 =====
    code_blocks = []
    def _save_code(m):
        code_blocks.append(m.group(0))
        return f'\x00CODEBLOCK_{len(code_blocks) - 1}\x00'
    
    content = CODE_BLOCK_RE.sub(_save_code, content)

    # ===== 第二步：应用术语修正 =====
    for pattern, replacement in TERM_FIXES:
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            count = len(re.findall(pattern, content))
            changes.append(f"术语: {pattern} → {replacement} ({count}处)")
            content = new_content

    # ===== 第三步：修复 Markdown 格式 =====
    # 修复 ** 被拆开
    new_content = MARKDOWN_BOLD_FIX.sub('**', content)
    if new_content != content:
        count = len(MARKDOWN_BOLD_FIX.findall(content))
        changes.append(f"格式: 修复加粗标记 ** ({count}处)")
        content = new_content

    # 修复 ``` 被拆开
    new_content = MARKDOWN_CODE_FIX.sub('```', content)
    if new_content != content:
        count = len(MARKDOWN_CODE_FIX.findall(content))
        changes.append(f"格式: 修复代码块标记 ``` ({count}处)")
        content = new_content

    # ===== 第四步：清理损坏占位符 =====
    new_content = Z0_FIX.sub('', content)
    if new_content != content:
        count = len(Z0_FIX.findall(content))
        changes.append(f"清理: 移除 Z0 占位符 ({count}处)")
        content = new_content

    new_content = RANDOM_STRING.sub('', content)
    if new_content != content:
        count = len(RANDOM_STRING.findall(content))
        changes.append(f"清理: 移除随机字符串 ({count}处)")
        content = new_content

    # ===== 第五步：恢复代码块 =====
    for i, block in enumerate(code_blocks):
        content = content.replace(f'\x00CODEBLOCK_{i}\x00', block)

    # 清理多余空行（3+连续空行 → 2个）
    content = re.sub(r'\n{4,}', '\n\n\n', content)

    if content == original:
        return {"file": filepath.name, "status": "clean", "changes": []}

    if dry_run:
        return {"file": filepath.name, "status": "dry-run", "changes": changes}

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return {"file": filepath.name, "status": "fixed", "changes": changes}


def main():
    parser = argparse.ArgumentParser(description="翻译质量校对脚本")
    parser.add_argument("--all", action="store_true", help="校对所有文件")
    parser.add_argument("--phase", type=int, help="只校对指定阶段")
    parser.add_argument("--lesson", type=str, help="只校对指定课程")
    parser.add_argument("--dry-run", action="store_true", help="只检查不修改")
    args = parser.parse_args()

    if not args.all and not args.phase and not args.lesson:
        args.all = True

    md_files = sorted(LESSONS_DIR.glob("*.md"))

    if args.lesson:
        md_files = [f for f in md_files if f.stem == args.lesson]
    elif args.phase is not None:
        prefix = f"{args.phase:02d}-"
        md_files = [f for f in md_files if f.stem.startswith(prefix)]

    print(f"📂 扫描 {len(md_files)} 个文件...")
    if args.dry_run:
        print("🔍 干跑模式（只检查不修改）\n")

    stats = {"fixed": 0, "clean": 0, "error": 0}
    all_changes = []

    for f in md_files:
        result = proofread_file(f, args.dry_run)
        status = result["status"]

        if status == "error":
            stats["error"] += 1
            print(f"  ❌ {result['file']}: {result['msg']}")
        elif status == "clean":
            stats["clean"] += 1
        else:
            stats["fixed"] += 1
            label = "🔍" if args.dry_run else "✅"
            print(f"  {label} {result['file']}: {len(result['changes'])} 处修正")
            for c in result["changes"]:
                print(f"      - {c}")
            all_changes.append(result)

    total = len(md_files)
    print(f"\n{'='*50}")
    print(f"📊 校对完成: {total} 个文件")
    print(f"  ✅ 需修正: {stats['fixed']}  ✨ 无问题: {stats['clean']}  ❌ 错误: {stats['error']}")
    if args.dry_run and stats['fixed'] > 0:
        print(f"\n💡 去掉 --dry-run 参数以实际应用修正")


if __name__ == "__main__":
    main()
