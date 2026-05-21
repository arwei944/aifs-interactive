interface Props {
  totalLessons: number;
  completedLessons: number;
  streak: number;
  quizAccuracy: number; // 0-100
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function DashboardStats({
  totalLessons,
  completedLessons,
  streak,
  quizAccuracy,
}: Props) {
  const percentage = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  const stats = [
    {
      icon: <BookIcon />,
      label: '已完成课时',
      value: String(completedLessons),
      iconBg: 'bg-blue/10 text-blue',
    },
    {
      icon: <ChartIcon />,
      label: '完成进度',
      value: `${completedLessons}/${totalLessons}`,
      subValue: `${percentage}%`,
      iconBg: 'bg-green/10 text-green',
    },
    {
      icon: <FlameIcon />,
      label: '连续学习',
      value: `${streak} 天`,
      iconBg: 'bg-amber/10 text-amber',
    },
    {
      icon: <TargetIcon />,
      label: '测验正确率',
      value: `${quizAccuracy}%`,
      iconBg: 'bg-purple/10 text-purple',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-surface border border-border rounded-[12px] p-5"
        >
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${stat.iconBg} mb-3`}>
            {stat.icon}
          </div>
          <p className="text-[12px] text-ink-3 mb-1">{stat.label}</p>
          <p className="text-[28px] font-bold text-ink leading-tight">
            {stat.value}
          </p>
          {stat.subValue && (
            <p className="text-[12px] text-ink-3 mt-0.5">{stat.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
}
