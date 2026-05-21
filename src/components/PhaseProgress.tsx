import type { Phase } from '../data/phases';

interface Props {
  phases: Phase[];
  progress: Record<string, { completed: boolean }>;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PhaseProgress({ phases, progress }: Props) {
  return (
    <div className="bg-surface border border-border rounded-[12px] p-5">
      <p className="section-label">阶段进度</p>
      <div className="flex flex-col gap-3">
        {phases.map((phase) => {
          const total = phase.lessons.length;
          const completed = phase.lessons.filter(
            (l) => progress[l.id]?.completed
          ).length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const allDone = completed === total && total > 0;
          const href = `/${phase.id}/${phase.lessons[0]?.id ?? ''}`;

          return (
            <a
              key={phase.id}
              href={href}
              className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-[8px] hover:bg-bg transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue/10 text-blue text-[12px] font-medium whitespace-nowrap">
                  {phase.num}
                </span>
                <span className="text-[14px] text-ink truncate">
                  {phase.shortTitle}
                </span>
              </div>

              <div className="flex items-center gap-3 ml-auto shrink-0">
                <span className="text-[12px] text-ink-3 whitespace-nowrap">
                  {completed}/{total} 课时
                </span>
                {allDone ? (
                  <CheckIcon />
                ) : (
                  <div className="w-24 h-2 rounded-full bg-bg overflow-hidden">
                    <div
                      className="h-full bg-blue rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
