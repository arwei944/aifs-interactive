import { describe, it, expect } from 'vitest';
import { phases, getPhase, getLesson, getTotalLessons, getAllLessons } from '../data/phases';

describe('课程数据', () => {
  it('应该包含多个阶段', () => {
    expect(phases.length).toBeGreaterThan(0);
  });

  it('每个阶段应该有必要的字段', () => {
    for (const phase of phases) {
      expect(phase.id).toBeTruthy();
      expect(phase.title).toBeTruthy();
      expect(phase.shortTitle).toBeTruthy();
      expect(phase.lessons).toBeInstanceOf(Array);
      expect(phase.lessons.length).toBeGreaterThan(0);
    }
  });

  it('每节课应该有必要的字段', () => {
    for (const phase of phases) {
      for (const lesson of phase.lessons) {
        expect(lesson.id).toBeTruthy();
        expect(lesson.title).toBeTruthy();
        expect(lesson.num).toBeGreaterThan(0);
        expect(['build', 'learn', 'capstone']).toContain(lesson.type);
      }
    }
  });

  it('getPhase 应该返回正确的阶段', () => {
    const phase = getPhase('phase-3');
    expect(phase).toBeDefined();
    expect(phase!.shortTitle).toBe('深度学习');
  });

  it('getPhase 对不存在的阶段应返回 undefined', () => {
    const phase = getPhase('phase-999');
    expect(phase).toBeUndefined();
  });

  it('getLesson 应该返回正确的课程', () => {
    const result = getLesson('phase-3', '03-04');
    expect(result).toBeDefined();
    expect(result!.lesson.title).toContain('Activation Functions');
  });

  it('getTotalLessons 应该返回正确的总数', () => {
    const total = getTotalLessons();
    expect(total).toBeGreaterThan(0);
    // 验证总数等于所有阶段课程数之和
    const sum = phases.reduce((acc, p) => acc + p.lessons.length, 0);
    expect(total).toBe(sum);
  });

  it('getAllLessons 应该返回所有课程', () => {
    const all = getAllLessons();
    expect(all.length).toBe(getTotalLessons());
    // 每个课程应该包含 lesson 和 phase 属性
    for (const item of all) {
      expect(item).toHaveProperty('lesson');
      expect(item).toHaveProperty('phase');
    }
  });
});
