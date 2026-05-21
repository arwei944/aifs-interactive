import { useState, useEffect } from 'react';

interface Props {
  phaseId: string;
  lessonId: string;
}

export default function LessonContent({ phaseId, lessonId }: Props) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);
        setError(null);

        // 尝试从本地 content 加载
        const res = await fetch(`/content/lessons/${lessonId}.md`);
        if (res.ok) {
          const md = await res.text();
          // 简单的 Markdown 渲染（生产环境用 marked 或 mdx）
          const rendered = renderMarkdown(md);
          setHtml(rendered);
        } else {
          // 如果本地没有，显示示例内容
          setHtml(getFallbackContent(phaseId, lessonId));
        }
      } catch (e) {
        setError('加载课程内容失败');
        setHtml(getFallbackContent(phaseId, lessonId));
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
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ animation: 'fadeUp 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.12s forwards', opacity: 0 }}
    />
  );
}

function renderMarkdown(md: string): string {
  let html = md;

  // 移除 YAML frontmatter
  html = html.replace(/^---[\s\S]*?---\n/, '');

  // 1. 先处理代码块（必须在行内代码之前，避免反引号冲突）
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="code-block card my-4">
      <div class="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-border text-[12px] font-mono text-ink-2">
        <span>${lang || 'code'}</span>
        <button onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('pre').textContent);this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)" class="px-2.5 py-1 bg-bg border border-border rounded-md text-[12px] font-sans font-medium text-ink-2 hover:border-border-2 hover:text-ink transition-all cursor-pointer">复制</button>
      </div>
      <pre class="px-5 py-4 font-mono text-[12.5px] leading-relaxed overflow-x-auto text-ink"><code>${escaped}</code></pre>
    </div>`;
  });

  // 2. 行内代码（代码块已被替换，不会冲突）
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-bg rounded text-[13px] font-mono text-red">$1</code>');

  // 3. 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-ink mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-ink mt-10 mb-4 pb-2 border-b border-border">$1</h2>');

  // 4. 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');

  // 5. 表格
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
    const isHeader = match.includes('---');
    const tag = isHeader ? 'th' : 'td';
    const bg = isHeader ? 'bg-[#f0f4f8] font-semibold' : '';
    return `<tr>${cells.map(c => `<${tag} class="px-3 py-2 text-[13px] text-ink-2 border-b border-border ${bg}">${c.trim()}</${tag}>`).join('')}</tr>`;
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, '<div class="overflow-x-auto my-4"><table class="w-full border-collapse">$&</table></div>');

  // 6. 段落
  html = html.replace(/\n\n(?!<)/g, '</p><p class="text-[15px] text-ink leading-relaxed mb-4">');
  html = `<p class="text-[15px] text-ink leading-relaxed mb-4">${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, '');

  // 7. 列表
  html = html.replace(/^- (.+)$/gm, '<li class="text-[15px] text-ink leading-relaxed mb-1 ml-4 list-disc">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)+/g, '<ul class="mb-4">$&</ul>');

  // 8. 数学公式（简单处理）
  html = html.replace(/\$\$(.+?)\$\$/g, '<span class="font-mono text-[13px] bg-bg px-1.5 py-0.5 rounded inline-block">$1</span>');
  html = html.replace(/\$(.+?)\$/g, '<span class="font-mono text-[13px] text-blue italic">$1</span>');

  return html;
}

function getFallbackContent(phaseId: string, lessonId: string): string {
  return `
    <div class="card p-6 mb-4">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">问题引入</div>
      <p class="text-[15px] text-ink leading-relaxed mb-4">
        这是 <strong>${lessonId}</strong> 的课程内容区域。在 M2 阶段，我们正在构建课程阅读器的核心功能。
        完整的课程内容将从原站数据源加载。
      </p>
    </div>
    <div class="card p-6 mb-4">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">核心概念</div>
      <p class="text-[15px] text-ink leading-relaxed mb-4">
        每节课遵循统一的教学流程：<strong>问题 → 概念 → 从零实现 → 框架对比 → 产出工具</strong>。
      </p>
    </div>
    <div class="card p-6 mb-4">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">从零实现</div>
      <div class="bg-bg border border-border rounded-lg p-4 font-mono text-[12.5px] leading-relaxed text-ink">
        <div class="text-[12px] text-ink-3 mb-2"># 示例代码</div>
        <div><span style="color:#c7254e">def</span> <span style="color:#0071e3">hello</span>():</div>
        <div>    <span style="color:#183691">print</span>(<span style="color:#183691">"你好，AI 工程从零学起！"</span>)</div>
        <div></div>
        <div>hello()</div>
      </div>
    </div>
    <div class="card p-6">
      <div class="text-micro font-semibold text-ink-3 uppercase tracking-wider mb-3">检验理解</div>
      <div class="space-y-3">
        <div class="bg-surface border border-border rounded-card p-5">
          <div class="text-[14px] font-medium text-ink mb-3">Q1. 这是一个示例测验题目吗？</div>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 bg-bg border border-border rounded-lg cursor-pointer hover:border-blue hover:text-blue transition-all">
              <span class="w-5 h-5 rounded-full border-[1.5px] border-border-2 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">A</span>
              <span class="text-[13px] text-ink-2">是的，这只是占位内容</span>
            </label>
            <label class="flex items-center gap-3 p-2.5 bg-bg border border-border rounded-lg cursor-pointer hover:border-blue hover:text-blue transition-all">
              <span class="w-5 h-5 rounded-full border-[1.5px] border-border-2 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">B</span>
              <span class="text-[13px] text-ink-2">不是，这是真实内容</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}
