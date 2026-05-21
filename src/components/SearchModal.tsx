import { useState, useEffect, useRef } from 'react';
import { phases, getAllLessons } from '../data/phases';
import { glossary } from '../data/glossary';

interface SearchResult {
  type: 'lesson' | 'glossary';
  title: string;
  subtitle: string;
  phaseLabel: string;
  href: string;
}

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 键盘快捷键
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // 搜索
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const allLessons = getAllLessons();
    const matched: SearchResult[] = [];

    for (const { lesson, phase } of allLessons) {
      const titleMatch = lesson.title.toLowerCase().includes(q);
      const summaryMatch = lesson.summary.toLowerCase().includes(q);
      const keywordMatch = lesson.keywords.some(k => k.toLowerCase().includes(q));
      const phaseMatch = phase.shortTitle.toLowerCase().includes(q);

      if (titleMatch || keywordMatch || phaseMatch) {
        matched.push({
          type: 'lesson',
          title: lesson.title,
          subtitle: lesson.summary.slice(0, 60) + '...',
          phaseLabel: `阶段 ${phase.num}`,
          href: `/${phase.id}/${lesson.id}`,
        });
      }
    }

    for (const term of glossary) {
      if (term.term.toLowerCase().includes(q) || term.actually.toLowerCase().includes(q)) {
        matched.push({
          type: 'glossary',
          title: term.term,
          subtitle: term.actually.slice(0, 60) + '...',
          phaseLabel: '术语表',
          href: `/glossary?q=${encodeURIComponent(term.term)}`,
        });
      }
    }

    setResults(matched.slice(0, 12));
    setSelectedIndex(0);
  }, [query]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    window.location.href = result.href;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* 搜索面板 */}
      <div className="relative w-full max-w-[560px] mx-4 bg-surface rounded-card shadow-lg border border-border overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 输入框 */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <svg className="w-4 h-4 text-ink-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索课程、术语..."
            className="flex-1 py-3.5 text-[15px] text-ink bg-transparent outline-none placeholder:text-ink-3"
          />
          <kbd className="text-[11px] text-ink-3 bg-bg border border-border rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* 结果列表 */}
        {results.length > 0 && (
          <div className="max-h-[360px] overflow-y-auto py-2">
            {results.map((result, i) => (
              <button
                key={`${result.type}-${result.title}`}
                onClick={() => handleSelect(result)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  i === selectedIndex ? 'bg-blue/[0.06]' : 'hover:bg-black/[0.03]'
                }`}
              >
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-chip flex-shrink-0 ${
                  result.type === 'lesson' ? 'bg-blue/10 text-blue' : 'bg-amber/10 text-amber'
                }`}>
                  {result.type === 'lesson' ? '课时' : '术语'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">{result.title}</div>
                  <div className="text-[12px] text-ink-3 truncate mt-0.5">{result.subtitle}</div>
                </div>
                <span className="text-[11px] text-ink-3 flex-shrink-0">{result.phaseLabel}</span>
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-[13px] text-ink-2">没有找到匹配的结果</div>
          </div>
        )}

        {!query.trim() && (
          <div className="py-8 text-center">
            <div className="text-[13px] text-ink-3">
              输入关键词搜索课程或术语 · <kbd className="bg-bg border border-border rounded px-1.5 py-0.5 text-[11px] font-mono mx-0.5">↑↓</kbd> 导航
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
