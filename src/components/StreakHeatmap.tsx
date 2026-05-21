import { useMemo } from 'react';

interface Props {
  progress: Record<string, { completed: boolean; completedAt?: string }>;
}

const TOTAL_WEEKS = 16;
const TOTAL_DAYS = TOTAL_WEEKS * 7; // 112

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-[#ebedf0]',
  1: 'bg-[#9be9a8]',
  2: 'bg-[#40c463]',
  3: 'bg-[#30a14e]',
};

const LEVEL_LABELS: Record<number, string> = {
  0: '无学习记录',
  1: '完成 1 课时',
  2: '完成 2 课时',
  3: '完成 3+ 课时',
};

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonth(date: Date): string {
  return `${date.getMonth() + 1}月`;
}

const DAY_LABELS = ['一', '', '三', '', '五', '', ''];

export default function StreakHeatmap({ progress }: Props) {
  const { grid, monthLabels } = useMemo(() => {
    // Build a map of date -> lesson count from progress
    const dateCountMap: Record<string, number> = {};
    for (const entry of Object.values(progress)) {
      if (entry.completed && entry.completedAt) {
        const dateStr = entry.completedAt.slice(0, 10); // YYYY-MM-DD
        dateCountMap[dateStr] = (dateCountMap[dateStr] ?? 0) + 1;
      }
    }

    // Generate grid: array of columns (weeks), each column is 7 days (Mon-Sun)
    // Start from today and go backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the most recent Sunday (end of the current week)
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const sundayOffset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() + sundayOffset);

    // Build the grid going backwards from the last Sunday
    const columns: Array<Array<{ date: Date; count: number; dateStr: string }>> = [];
    const months: Array<{ label: string; colIndex: number }> = [];

    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const column: Array<{ date: Date; count: number; dateStr: string }> = [];
      for (let d = 6; d >= 0; d--) {
        const date = new Date(lastSunday);
        date.setDate(lastSunday.getDate() - w * 7 - d);
        const dateStr = formatDate(date);
        const count = dateCountMap[dateStr] ?? 0;
        column.push({ date, count, dateStr });
      }
      columns.push(column);
    }

    // Reverse columns so oldest is on the left
    columns.reverse();

    // Extract month labels: show label at the first column where a new month appears
    const seenMonths = new Set<number>();
    const mLabels: Array<{ label: string; colIndex: number }> = [];
    columns.forEach((col, colIdx) => {
      // Check the first row (Monday = index 0) of each column
      const topDate = col[0].date;
      const monthKey = topDate.getFullYear() * 100 + topDate.getMonth();
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        mLabels.push({ label: formatMonth(topDate), colIndex: colIdx });
      }
    });

    return { grid: columns, monthLabels: mLabels };
  }, [progress]);

  return (
    <div className="bg-surface border border-border rounded-[12px] p-5">
      <p className="section-label">学习热力图</p>

      {/* Month labels row */}
      <div className="flex ml-[24px] mb-1">
        {monthLabels.map((m, i) => {
          // Calculate left offset based on column index
          const prevCol = i === 0 ? 0 : monthLabels[i - 1].colIndex;
          const gap = m.colIndex - prevCol;
          return (
            <span
              key={`${m.label}-${m.colIndex}`}
              className="text-[10px] text-ink-3 whitespace-nowrap"
              style={{
                marginLeft: i === 0 ? 0 : `${gap * 15}px`,
              }}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-[3px]">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[3px] mr-1 shrink-0">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="w-[18px] h-[12px] flex items-center justify-center text-[10px] text-ink-3 leading-none"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid columns (weeks) */}
        {grid.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-[3px]">
            {week.map((day, dIdx) => {
              const level = getLevel(day.count);
              const tooltip = `${day.dateStr}：${LEVEL_LABELS[level]}`;
              return (
                <div
                  key={dIdx}
                  className={`w-[12px] h-[12px] rounded-[2px] ${LEVEL_COLORS[level]}`}
                  title={tooltip}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[10px] text-ink-3 mr-1">少</span>
        {[0, 1, 2, 3].map((level) => (
          <div
            key={level}
            className={`w-[12px] h-[12px] rounded-[2px] ${LEVEL_COLORS[level]}`}
          />
        ))}
        <span className="text-[10px] text-ink-3 ml-1">多</span>
      </div>
    </div>
  );
}
