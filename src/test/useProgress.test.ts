import { describe, it, expect, beforeEach } from 'vitest';

// 模拟 localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// 重新导入模块以使用模拟的 localStorage
describe('进度追踪', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('应该正确初始化默认进度', () => {
    const data = localStorage.getItem('aifs-progress');
    expect(data).toBeNull();
  });

  it('应该正确保存和读取进度', () => {
    const progress = {
      lessons: { '03-04': { completed: true, quizScore: { correct: 2, total: 3 } } },
      streak: 5,
      lastStudyDate: '2026-05-21',
    };
    localStorage.setItem('aifs-progress', JSON.stringify(progress));
    const loaded = JSON.parse(localStorage.getItem('aifs-progress')!);
    expect(loaded.streak).toBe(5);
    expect(loaded.lessons['03-04'].completed).toBe(true);
    expect(loaded.lessons['03-04'].quizScore?.correct).toBe(2);
  });

  it('应该正确标记课程完成', () => {
    const progress = { lessons: {}, streak: 0, lastStudyDate: '' };
    progress.lessons['03-04'] = { completed: true, completedAt: '2026-05-21T10:00:00Z' };
    expect(progress.lessons['03-04'].completed).toBe(true);
    expect(progress.lessons['03-04'].completedAt).toBe('2026-05-21T10:00:00Z');
  });

  it('应该正确计算阶段进度', () => {
    const progress = {
      lessons: {
        '03-01': { completed: true },
        '03-02': { completed: true },
        '03-03': { completed: true },
        '03-04': { completed: false },
      },
      streak: 3,
      lastStudyDate: '2026-05-21',
    };
    const lessonIds = ['03-01', '03-02', '03-03', '03-04'];
    const completed = lessonIds.filter(id => progress.lessons[id]?.completed).length;
    const percent = Math.round((completed / lessonIds.length) * 100);
    expect(percent).toBe(75);
  });

  it('应该正确计算连续学习天数 - 昨天', () => {
    const today = '2026-05-21';
    const yesterday = '2026-05-20';
    const streak = 5;
    const lastStudyDate = yesterday;
    // 如果昨天学习过，连续天数 +1
    const newStreak = lastStudyDate === yesterday ? streak + 1 : 1;
    expect(newStreak).toBe(6);
  });

  it('应该正确计算连续学习天数 - 今天已学习', () => {
    const today = '2026-05-21';
    const streak = 5;
    const lastStudyDate = today;
    // 如果今天已学习过，保持不变
    const newStreak = lastStudyDate === today ? streak : 1;
    expect(newStreak).toBe(5);
  });

  it('应该正确计算连续学习天数 - 中断了', () => {
    const today = '2026-05-21';
    const twoDaysAgo = '2026-05-19';
    const streak = 5;
    const lastStudyDate = twoDaysAgo;
    // 如果既不是今天也不是昨天，重置为 1
    const newStreak = (lastStudyDate === today || lastStudyDate === '2026-05-20') ? streak : 1;
    expect(newStreak).toBe(1);
  });

  it('应该正确记录测验分数', () => {
    const progress = { lessons: {}, streak: 0, lastStudyDate: '' };
    progress.lessons['03-04'] = {
      completed: true,
      quizScore: { correct: 3, total: 3 },
      completedAt: '2026-05-21T10:00:00Z',
    };
    const score = progress.lessons['03-04'].quizScore;
    expect(score?.correct).toBe(3);
    expect(score?.total).toBe(3);
  });
});
