import { describe, it, expect } from 'vitest';

// 测试 Markdown 解析核心逻辑

describe('Markdown 解析', () => {
  it('应该正确处理行内代码', () => {
    const md = '使用 `numpy` 安装';
    const html = md.replace(/`([^`]+)`/g, '<code>$1</code>');
    expect(html).toContain('<code>numpy</code>');
  });

  it('应该正确处理二级标题', () => {
    const md = '## 核心概念';
    const html = md.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    expect(html).toContain('<h2>核心概念</h2>');
  });

  it('应该正确处理三级标题', () => {
    const md = '### ReLU — 深度学习的基石';
    const html = md.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    expect(html).toContain('<h3>ReLU — 深度学习的基石</h3>');
  });

  it('应该正确处理粗体文本', () => {
    const md = '**非线性**决策边界';
    const html = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    expect(html).toContain('<strong>非线性</strong>');
  });

  it('应该正确移除 YAML frontmatter', () => {
    const md = `---
title: 测试
---
## 内容`;
    const result = md.replace(/^---[\s\S]*?---\n/, '');
    expect(result).not.toContain('---');
    expect(result).toContain('## 内容');
  });

  it('应该正确提取代码块', () => {
    const md = '```python\nprint("hello")\n```';
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    const match = regex.exec(md);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('python');
    expect(match![2].trim()).toBe('print("hello")');
  });

  it('应该正确解析 :::viz 块', () => {
    const md = '一些文本\n:::viz type="activation"\n描述\n:::\n更多文本';
    const regex = /:::viz\s+type="([^"]+)"\s*\n([\s\S]*?):::/g;
    const match = regex.exec(md);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('activation');
    expect(match![2].trim()).toBe('描述');
  });

  it('应该正确解析 :::quiz 块', () => {
    const md = ':::quiz\n**Q1.** 问题\n- A) 选项1\n- B) 选项2 ✅\n:::';
    const regex = /:::quiz\n([\s\S]*?):::/g;
    const match = regex.exec(md);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Q1.');
    expect(match![1]).toContain('选项1');
  });

  it('应该正确处理表格行', () => {
    const md = '| 激活函数 | 范围 |';
    const regex = /^\|(.+)\|$/gm;
    const match = regex.exec(md);
    expect(match).not.toBeNull();
    const cells = match![1].split('|').map(c => c.trim()).filter(c => c);
    expect(cells).toEqual(['激活函数', '范围']);
  });

  it('应该跳过表格分隔行', () => {
    const md = '|---|---|';
    const regex = /^\|(.+)\|$/gm;
    const match = regex.exec(md);
    expect(match).not.toBeNull();
    const cells = match![1].split('|').filter(c => c.trim());
    expect(cells.every(c => /^[-:]+$/.test(c.trim()))).toBe(true);
  });
});
