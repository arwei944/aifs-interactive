import { useState, useEffect } from 'react';
import CodeSandbox from './CodeSandbox';
import ActivationViz from './ActivationViz';
import GradientDescentViz from './GradientDescentViz';

interface Props {
  phaseId: string;
  lessonId: string;
}

interface ContentBlock {
  type: 'html' | 'code' | 'viz';
  content: string;
  language?: string;
  vizType?: string;
}

export default function LessonContent({ phaseId, lessonId }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);

        const res = await fetch(`/content/lessons/${lessonId}.md`);
        if (res.ok) {
          const md = await res.text();
          const parsed = parseMarkdown(md);
          setBlocks(parsed);
        } else {
          // fallback: 将 HTML 包装为单个块
          setBlocks([{ type: 'html', content: getFallbackHtml(phaseId, lessonId) }]);
        }
      } catch {
        setBlocks([{ type: 'html', content: getFallbackHtml(phaseId, lessonId) }]);
      } finally {
        setLoading(false);
      }
    }
    loadLesson();
  }, [phaseId, lessonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-ink-2">加载课程内容...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="prose-content"
      style={{ animation: 'fadeUp 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.12s forwards', opacity: 0 }}
    >
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <div key={i} className="my-4">
              <CodeSandbox initialCode={block.content} language={block.language} />
            </div>
          );
        }
        if (block.type === 'viz') {
          return (
            <div key={i} className="my-4">
              {block.vizType === 'gradient-descent' ? <GradientDescentViz /> : <ActivationViz />}
            </div>
          );
        }
        return <div key={i} dangerouslySetInnerHTML={{ __html: block.content }} />;
      })}
    </div>
  );
}

/** 将 Markdown 拆分为 HTML 块、代码块和可视化块 */
function parseMarkdown(md: string): ContentBlock[] {
  // 移除 YAML frontmatter
  md = md.replace(/^---[\s\S]*?---\n/, '');

  const blocks: ContentBlock[] = [];

  // 匹配 :::viz type="xxx" ... ::: 块
  const vizBlockRegex = /:::viz\s+type="([^"]+)"\s*\n([\s\S]*?):::/g;
  // 匹配代码块 ```lang\ncode```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  // 合并所有块的起始位置
  type BlockMatch = { index: number; length: number; type: 'viz' | 'code'; block: ContentBlock };
  const allMatches: BlockMatch[] = [];

  let m: RegExpExecArray | null;
  while ((m = vizBlockRegex.exec(md)) !== null) {
    allMatches.push({
      index: m.index,
      length: m[0].length,
      type: 'viz',
      block: { type: 'viz', content: m[2].trim(), vizType: m[1] },
    });
  }
  while ((m = codeBlockRegex.exec(md)) !== null) {
    allMatches.push({
      index: m.index,
      length: m[0].length,
      type: 'code',
      block: { type: 'code', content: m[2].trimEnd(), language: m[1] || 'code' },
    });
  }

  // 按位置排序
  allMatches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const match of allMatches) {
    if (match.index > lastIndex) {
      const textBefore = md.slice(lastIndex, match.index);
      const html = renderMarkdownToHtml(textBefore);
      if (html.trim()) {
        blocks.push({ type: 'html', content: html });
      }
    }
    blocks.push(match.block);
    lastIndex = match.index + match.length;
  }

  // 剩余文本
  if (lastIndex < md.length) {
    const remaining = md.slice(lastIndex);
    const html = renderMarkdownToHtml(remaining);
    if (html.trim()) {
      blocks.push({ type: 'html', content: html });
    }
  }

  return blocks;
}

/** 将纯文本 Markdown（不含代码块）渲染为 HTML */
function renderMarkdownToHtml(md: string): string {
  let html = md;

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-bg rounded text-[13px] font-mono text-red">$1</code>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-ink mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-ink mt-10 mb-4 pb-2 border-b border-border">$1</h2>');

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');

  // 表格
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
    const isHeader = match.includes('---');
    const tag = isHeader ? 'th' : 'td';
    const bg = isHeader ? 'bg-[#f0f4f8] font-semibold' : '';
    return `<tr>${cells.map(c => `<${tag} class="px-3 py-2 text-[13px] text-ink-2 border-b border-border ${bg}">${c.trim()}</${tag}>`).join('')}</tr>`;
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse">$&</table></div>');

  // 段落
  html = html.replace(/\n\n(?!<)/g, '</p><p class="text-[15px] text-ink leading-relaxed mb-4">');
  html = `<p class="text-[15px] text-ink leading-relaxed mb-4">${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, '');

  // 列表
  html = html.replace(/^- (.+)$/gm, '<li class="text-[15px] text-ink leading-relaxed mb-1 ml-4 list-disc">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)+/g, '<ul class="mb-4">$&</ul>');

  // 数学公式（简单处理）
  html = html.replace(/\$\$(.+?)\$\$/g, '<span class="font-mono text-[13px] bg-bg px-1.5 py-0.5 rounded inline-block">$1</span>');
  html = html.replace(/\$(.+?)\$/g, '<span class="font-mono text-[13px] text-blue italic">$1</span>');

  return html;
}

function getFallbackHtml(phaseId: string, lessonId: string): string {
  return `
    <div class="card p-6 mb-4">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">问题引入</div>
      <p class="text-[15px] text-ink leading-relaxed mb-4">
        这是 <strong>${lessonId}</strong> 的课程内容区域。完整课程内容将从原站数据源加载。
      </p>
    </div>
    <div class="card p-6 mb-4">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">核心概念</div>
      <p class="text-[15px] text-ink leading-relaxed mb-4">
        每节课遵循统一的教学流程：<strong>问题 → 概念 → 从零实现 → 框架对比 → 产出工具</strong>。
      </p>
    </div>
  `;
}
