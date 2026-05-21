import { useRef, useState, useCallback, useEffect, useMemo } from 'react';

/* ─── 颜色常量 ─── */
const COLORS = {
  bg: '#f5f5f7',
  card: '#ffffff',
  primary: '#0071e3',
  green: '#34c759',
  orange: '#ff9500',
  purple: '#af52de',
  text: '#1d1d1f',
  text2: '#86868b',
  text3: '#aeaeb2',
  border: '#e5e5ea',
  border2: '#d2d2d7',
  canvasBg: '#fafafa',
  heatmapLow: [255, 255, 255],    // white
  heatmapHigh: [0, 113, 227],     // #0071e3
} as const;

/* ─── 注意力头颜色 ─── */
const HEAD_COLORS = [
  { name: 'Head 1', color: COLORS.primary, rgb: [0, 113, 227] },
  { name: 'Head 2', color: COLORS.green, rgb: [52, 199, 89] },
  { name: 'Head 3', color: COLORS.orange, rgb: [255, 149, 0] },
] as const;

/* ─── 默认句子 ─── */
const DEFAULT_SENTENCE = 'The cat sat on the mat';

/* ─── 生成模拟注意力矩阵 ─── */
function generateAttentionMatrix(tokens: string[], headIndex: number): number[][] {
  const n = tokens.length;
  const matrix: number[][] = [];

  // 使用确定性种子生成不同的注意力模式
  const patterns: Record<number, (i: number, j: number, n: number) => number> = {
    // Head 1: 相邻词注意力（局部模式）
    0: (i, j, _n) => {
      const dist = Math.abs(i - j);
      return Math.exp(-dist * 0.8) * (0.6 + 0.4 * Math.sin(i * 1.7 + j * 2.3));
    },
    // Head 2: 语法结构注意力（主语-谓语-宾语）
    1: (i, j, n) => {
      const patterns = [
        [0.8, 0.1, 0.05, 0.02, 0.02, 0.01], // The -> cat
        [0.1, 0.7, 0.15, 0.02, 0.02, 0.01], // cat -> sat
        [0.05, 0.15, 0.6, 0.1, 0.05, 0.05], // sat -> on
        [0.02, 0.02, 0.1, 0.7, 0.1, 0.06],  // on -> the
        [0.02, 0.02, 0.05, 0.1, 0.75, 0.06], // the -> mat
        [0.01, 0.01, 0.05, 0.06, 0.06, 0.81], // mat -> self
      ];
      if (i < patterns.length && j < patterns[i].length) {
        return patterns[i][j] + 0.05 * Math.sin(i * 3.1 + j * 1.7);
      }
      return Math.exp(-Math.abs(i - j) * 0.5);
    },
    // Head 3: 全局注意力（均匀分布，略偏向关键词）
    2: (i, j, n) => {
      const isKeyWord = j === 1 || j === 2 || j === 5; // cat, sat, mat
      return isKeyWord ? 0.25 + 0.1 * Math.cos(i * 2.1 + j) : 0.08 + 0.05 * Math.sin(i + j * 1.5);
    },
  };

  const patternFn = patterns[headIndex] || patterns[0];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const val = Math.max(0.001, patternFn(i, j, n));
      row.push(val);
      sum += val;
    }
    // Softmax 归一化
    const softmaxRow = row.map((v) => v / sum);
    matrix.push(softmaxRow);
  }

  return matrix;
}

/* ─── 生成模拟 Q/K/V 矩阵 ─── */
function generateQKV(tokens: string[]): { Q: number[][]; K: number[][]; V: number[][] } {
  const n = tokens.length;
  const d = 4; // 维度
  const seed = (s: string) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash;
  };

  const genMatrix = (prefix: string): number[][] => {
    return tokens.map((token, i) => {
      const row: number[] = [];
      for (let j = 0; j < d; j++) {
        const h = seed(prefix + token + String(j));
        row.push(((h % 200) - 100) / 100); // [-1, 1]
      }
      return row;
    });
  };

  return { Q: genMatrix('q'), K: genMatrix('k'), V: genMatrix('v') };
}

/* ─── 矩阵乘法 ─── */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += A[i][k] * B[k][j];
      }
      row.push(sum);
    }
    C.push(row);
  }
  return C;
}

/* ─── Softmax ─── */
function softmax(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const maxVal = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((v) => v / sum);
  });
}

/* ─── 转置 ─── */
function transpose(M: number[][]): number[][] {
  return M[0].map((_, j) => M.map((row) => row[j]));
}

/* ─── 颜色插值 ─── */
function lerpColor(low: readonly number[], high: readonly number[], t: number): string {
  const r = Math.round(low[0] + (high[0] - low[0]) * t);
  const g = Math.round(low[1] + (high[1] - low[1]) * t);
  const b = Math.round(low[2] + (high[2] - low[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function lerpColorRGB(low: readonly number[], high: readonly number[], t: number): number[] {
  return [
    Math.round(low[0] + (high[0] - low[0]) * t),
    Math.round(low[1] + (high[1] - low[1]) * t),
    Math.round(low[2] + (high[2] - low[2]) * t),
  ];
}

/* ─── 动画步骤定义 ─── */
type AnimStep = 'idle' | 'qk' | 'scores' | 'softmax' | 'multiply_v' | 'output';
const ANIM_STEPS: AnimStep[] = ['idle', 'qk', 'scores', 'softmax', 'multiply_v', 'output'];
const STEP_LABELS: Record<AnimStep, string> = {
  idle: '准备就绪',
  qk: 'Q \u00d7 K\u1d40 \u2192 Attention Scores',
  scores: '原始注意力分数',
  softmax: 'Softmax \u2192 归一化权重',
  multiply_v: '\u00d7 V \u2192 加权求和',
  output: '输出结果',
};

/* ─── Tab 类型 ─── */
type TabId = 'heatmap' | 'qkv' | 'multihead';

const TABS: { id: TabId; label: string }[] = [
  { id: 'heatmap', label: 'Self-Attention' },
  { id: 'qkv', label: 'Q/K/V \u8ba1\u7b97\u6d41\u7a0b' },
  { id: 'multihead', label: 'Multi-Head' },
];

/* ─── 热力图绘制 ─── */
function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  tokens: string[],
  matrix: number[][],
  w: number,
  h: number,
  mouse: { x: number; y: number } | null,
  headColor: readonly number[],
  options?: { showLabels?: boolean; compact?: boolean },
) {
  const dpr = window.devicePixelRatio || 1;
  const showLabels = options?.showLabels !== false;
  const compact = options?.compact ?? false;

  const n = tokens.length;
  const labelSpace = showLabels ? 50 : 20;
  const bottomLabelSpace = showLabels ? 60 : 20;
  const pad = { top: 30, right: 20, bottom: bottomLabelSpace, left: labelSpace };

  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const cellW = plotW / n;
  const cellH = plotH / n;

  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  // 背景
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = COLORS.text;
  ctx.font = `${compact ? '11' : '13'}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (!compact) {
    ctx.fillText('Attention Weights', w / 2, 8);
  }

  // 绘制单元格
  let hoveredCell: { row: number; col: number; value: number } | null = null;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = pad.left + j * cellW;
      const y = pad.top + i * cellH;
      const value = matrix[i][j];

      // 颜色
      const color = lerpColor([255, 255, 255], headColor, value);
      ctx.fillStyle = color;
      ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

      // 检查鼠标悬停
      if (mouse && mouse.x >= x && mouse.x < x + cellW && mouse.y >= y && mouse.y < y + cellH) {
        hoveredCell = { row: i, col: j, value };
        // 高亮边框
        ctx.strokeStyle = COLORS.text;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }

      // 显示数值（如果单元格足够大）
      if (cellW > 40 && cellH > 25) {
        ctx.fillStyle = value > 0.5 ? '#ffffff' : COLORS.text;
        ctx.font = '11px "SF Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value.toFixed(2), x + cellW / 2, y + cellH / 2);
      }
    }
  }

  // Token 标签
  if (showLabels) {
    ctx.fillStyle = COLORS.text2;
    ctx.font = `${compact ? '10' : '12'}px Inter, system-ui, sans-serif`;

    // 左侧标签（Query / 行）
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const y = pad.top + i * cellH + cellH / 2;
      ctx.fillText(tokens[i], pad.left - 8, y);
    }

    // 底部标签（Key / 列）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let j = 0; j < n; j++) {
      const x = pad.left + j * cellW + cellW / 2;
      ctx.save();
      ctx.translate(x, pad.top + plotH + 8);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(tokens[j], 0, 0);
      ctx.restore();
    }

    // 轴标签
    if (!compact) {
      ctx.fillStyle = COLORS.text3;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Key', w / 2, h - 12);

      ctx.save();
      ctx.translate(10, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Query', 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
  return hoveredCell;
}

/* ─── QKV 流程绘制 ─── */
function drawQKVFlow(
  ctx: CanvasRenderingContext2D,
  tokens: string[],
  step: AnimStep,
  progress: number,
  w: number,
  h: number,
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, w, h);

  const { Q, K, V } = generateQKV(tokens);
  const KT = transpose(K);
  const scores = matMul(Q, KT);
  const attnWeights = softmax(scores);
  const output = matMul(attnWeights, V);

  // 布局参数
  const boxW = Math.min(120, (w - 80) / 6);
  const boxH = Math.min(100, h - 80);
  const arrowW = 30;
  const totalW = boxW * 4 + arrowW * 3;
  const startX = (w - totalW) / 2;
  const startY = 30;

  // 步骤定义
  const steps = [
    { label: 'Q', data: Q, color: COLORS.primary },
    { label: 'K\u1d40', data: KT, color: COLORS.green },
    { label: 'Scores', data: scores, color: COLORS.orange },
    { label: 'Softmax', data: attnWeights, color: COLORS.purple },
    { label: '\u00d7 V', data: V, color: COLORS.green },
    { label: 'Output', data: output, color: COLORS.primary },
  ];

  // 绘制矩阵块
  const activeStepIdx = ANIM_STEPS.indexOf(step);

  const drawMatrixBlock = (
    x: number,
    y: number,
    label: string,
    data: number[][],
    color: string,
    isActive: boolean,
    alpha: number,
  ) => {
    const rows = data.length;
    const cols = data[0].length;
    const cellW = boxW / cols;
    const cellH = boxH / rows;

    ctx.globalAlpha = alpha;

    // 标签
    ctx.fillStyle = isActive ? color : COLORS.text2;
    ctx.font = `${isActive ? 'bold ' : ''}12px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + boxW / 2, y - 6);

    // 矩阵边框
    ctx.strokeStyle = isActive ? color : COLORS.border;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.strokeRect(x, y, boxW, boxH);

    // 单元格
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const cx = x + j * cellW;
        const cy = y + i * cellH;
        const val = data[i][j];

        if (label === 'Softmax') {
          // 热力图样式
          const t = Math.min(1, Math.max(0, val));
          ctx.fillStyle = lerpColor([255, 255, 255], [0, 113, 227], t);
          ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);

          ctx.fillStyle = t > 0.5 ? '#ffffff' : COLORS.text;
        } else {
          ctx.fillStyle = val >= 0 ? `rgba(0, 113, 227, ${Math.min(1, Math.abs(val) * 0.3)})` : `rgba(255, 59, 48, ${Math.min(1, Math.abs(val) * 0.3)})`;
          ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
          ctx.fillStyle = COLORS.text;
        }

        if (cellW > 22 && cellH > 16) {
          ctx.font = '9px "SF Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val.toFixed(1), cx + cellW / 2, cy + cellH / 2);
        }
      }
    }

    ctx.globalAlpha = 1;
  };

  // 根据当前步骤决定显示哪些矩阵
  const visibleSteps = [
    { idx: 0, show: activeStepIdx >= 1 || step === 'idle' },
    { idx: 1, show: activeStepIdx >= 1 || step === 'idle' },
    { idx: 2, show: activeStepIdx >= 2 || step === 'idle' },
    { idx: 3, show: activeStepIdx >= 3 || step === 'idle' },
    { idx: 4, show: activeStepIdx >= 4 || step === 'idle' },
    { idx: 5, show: activeStepIdx >= 5 || step === 'idle' },
  ];

  // 计算实际显示的矩阵位置
  const visibleIndices = visibleSteps.filter((s) => s.show).map((s) => s.idx);
  const actualBoxW = Math.min(120, (w - 60 - arrowW * (visibleIndices.length - 1)) / visibleIndices.length);
  const actualTotalW = actualBoxW * visibleIndices.length + arrowW * Math.max(0, visibleIndices.length - 1);
  const actualStartX = (w - actualTotalW) / 2;

  visibleIndices.forEach((stepIdx, pos) => {
    const x = actualStartX + pos * (actualBoxW + arrowW);
    const isActive = stepIdx === activeStepIdx || step === 'idle';
    const alpha = step === 'idle' ? 1 : (stepIdx <= activeStepIdx ? 1 : 0.2);

    drawMatrixBlock(x, startY, steps[stepIdx].label, steps[stepIdx].data, steps[stepIdx].color, isActive, alpha);

    // 箭头
    if (pos < visibleIndices.length - 1) {
      const arrowX = x + actualBoxW + 4;
      const arrowY = startY + boxH / 2;
      ctx.fillStyle = COLORS.text3;
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2192', arrowX + arrowW / 2 - 4, arrowY);
    }
  });

  // 进度条
  if (step !== 'idle') {
    const barY = startY + boxH + 20;
    const barW = w - 60;
    const barH = 3;
    const barX = 30;

    ctx.fillStyle = COLORS.border;
    ctx.fillRect(barX, barY, barW, barH);

    const stepProgress = (activeStepIdx + progress) / (ANIM_STEPS.length - 1);
    ctx.fillStyle = COLORS.primary;
    ctx.fillRect(barX, barY, barW * stepProgress, barH);
  }

  // 当前步骤标签
  ctx.fillStyle = COLORS.text;
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(STEP_LABELS[step], w / 2, startY + boxH + 30);

  ctx.restore();
}

/* ─── Multi-Head 绘制 ─── */
function drawMultiHead(
  ctx: CanvasRenderingContext2D,
  tokens: string[],
  matrices: number[][][],
  w: number,
  h: number,
  mouse: { x: number; y: number } | null,
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, w, h);

  const n = tokens.length;
  const numHeads = 3;

  // 计算布局
  const gap = 16;
  const labelH = 24;
  const bottomSpace = 70;
  const padX = 20;
  const headW = (w - padX * 2 - gap * (numHeads - 1)) / numHeads;
  const headH = h - labelH - bottomSpace - 20;

  // 标题
  ctx.fillStyle = COLORS.text;
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Multi-Head Attention', w / 2, 6);

  let hoveredCell: { head: number; row: number; col: number; value: number } | null = null;

  // 绘制每个头
  for (let head = 0; head < numHeads; head++) {
    const x = padX + head * (headW + gap);
    const y = labelH + 10;
    const attnMatrix = matrices[head];
    const headRgb = HEAD_COLORS[head].rgb;

    // 头标签
    ctx.fillStyle = HEAD_COLORS[head].color;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(HEAD_COLORS[head].name, x + headW / 2, y - 18);

    // 热力图
    const cellW = headW / n;
    const cellH = headH / n;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = x + j * cellW;
        const cy = y + i * cellH;
        const value = attnMatrix[i][j];

        ctx.fillStyle = lerpColor([255, 255, 255], headRgb, value);
        ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);

        if (mouse && mouse.x >= cx && mouse.x < cx + cellW && mouse.y >= cy && mouse.y < cy + cellH) {
          hoveredCell = { head, row: i, col: j, value };
          ctx.strokeStyle = COLORS.text;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
        }

        if (cellW > 35 && cellH > 22) {
          ctx.fillStyle = value > 0.5 ? '#ffffff' : COLORS.text;
          ctx.font = '10px "SF Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(value.toFixed(2), cx + cellW / 2, cy + cellH / 2);
        }
      }
    }

    // Token 标签
    ctx.fillStyle = COLORS.text3;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let j = 0; j < n; j++) {
      const cx = x + j * cellW + cellW / 2;
      ctx.save();
      ctx.translate(cx, y + headH + 4);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(tokens[j], 0, 0);
      ctx.restore();
    }
  }

  // 底部：Concat + Linear
  const concatY = labelH + 10 + headH + 40;
  const concatW = w - 80;
  const concatH = 28;
  const concatX = 40;

  // Concat 框
  ctx.fillStyle = 'rgba(175, 82, 222, 0.08)';
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(concatX, concatY, concatW, concatH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.purple;
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Concat(Head\u2081, Head\u2082, Head\u2083) \u2192 Linear \u2192 Output', concatX + concatW / 2, concatY + concatH / 2);

  // 连接线
  for (let head = 0; head < numHeads; head++) {
    const x = padX + head * (headW + gap) + headW / 2;
    const y = labelH + 10 + headH + 4;

    ctx.strokeStyle = HEAD_COLORS[head].color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, concatY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
  return hoveredCell;
}

/* ─── 主组件 ─── */
export default function AttentionViz() {
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const qkvCanvasRef = useRef<HTMLCanvasElement>(null);
  const qkvContainerRef = useRef<HTMLDivElement>(null);
  const multiheadCanvasRef = useRef<HTMLCanvasElement>(null);
  const multiheadContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [sentence, setSentence] = useState(DEFAULT_SENTENCE);
  const [activeTab, setActiveTab] = useState<TabId>('heatmap');
  const [selectedHead, setSelectedHead] = useState<number>(0);
  const [animStep, setAnimStep] = useState<AnimStep>('idle');
  const [animProgress, setAnimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  // 解析 token
  const tokens = useMemo(() => sentence.trim().split(/\s+/).filter(Boolean).slice(0, 8), [sentence]);

  // 生成注意力矩阵
  const attentionMatrices = useMemo(
    () => [0, 1, 2].map((h) => generateAttentionMatrix(tokens, h)),
    [tokens],
  );

  // 当前选中的矩阵
  const currentMatrix = attentionMatrices[selectedHead];

  /* ─── 热力图绘制 ─── */
  const drawHeatmapCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawHeatmap(ctx, tokens, currentMatrix, w, h, mouse, HEAD_COLORS[selectedHead].rgb);
    },
    [tokens, currentMatrix, mouse, selectedHead],
  );

  /* ─── QKV 绘制 ─── */
  const drawQKVCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawQKVFlow(ctx, tokens, animStep, animProgress, w, h);
    },
    [tokens, animStep, animProgress],
  );

  /* ─── Multi-Head 绘制 ─── */
  const drawMultiHeadCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      drawMultiHead(ctx, tokens, attentionMatrices, w, h, mouse);
    },
    [tokens, attentionMatrices, mouse],
  );

  /* ─── Canvas 尺寸管理 ─── */
  useEffect(() => {
    const setupCanvas = (
      container: HTMLDivElement | null,
      canvas: HTMLCanvasElement | null,
      drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
      height: number,
    ) => {
      if (!container || !canvas) return;

      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const w = rect.width;
        const h = height;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) drawFn(ctx, w, h);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();

      return () => observer.disconnect();
    };

    const cleanups: (() => void)[] = [];

    if (activeTab === 'heatmap') {
      cleanups.push(
        setupCanvas(heatmapContainerRef.current, heatmapCanvasRef.current, drawHeatmapCanvas, 320) ?? (() => {}),
      );
    } else if (activeTab === 'qkv') {
      cleanups.push(
        setupCanvas(qkvContainerRef.current, qkvCanvasRef.current, drawQKVCanvas, 240) ?? (() => {}),
      );
    } else if (activeTab === 'multihead') {
      cleanups.push(
        setupCanvas(multiheadContainerRef.current, multiheadCanvasRef.current, drawMultiHeadCanvas, 340) ?? (() => {}),
      );
    }

    return () => cleanups.forEach((c) => c());
  }, [activeTab, drawHeatmapCanvas, drawQKVCanvas, drawMultiHeadCanvas]);

  /* ─── 重绘 ─── */
  useEffect(() => {
    const canvas =
      activeTab === 'heatmap'
        ? heatmapCanvasRef.current
        : activeTab === 'qkv'
          ? qkvCanvasRef.current
          : multiheadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    if (activeTab === 'heatmap') drawHeatmapCanvas(ctx, w, h);
    else if (activeTab === 'qkv') drawQKVCanvas(ctx, w, h);
    else drawMultiHeadCanvas(ctx, w, h);
  }, [activeTab, drawHeatmapCanvas, drawQKVCanvas, drawMultiHeadCanvas]);

  /* ─── 动画控制 ─── */
  useEffect(() => {
    if (!isPlaying) return;

    const stepDuration = 1500; // 每步 1.5 秒
    let startTime: number | null = null;
    let currentStepIdx = 0;
    let animFrameId: number;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const stepProgress = Math.min(1, elapsed / stepDuration);

      setAnimProgress(stepProgress);

      if (stepProgress >= 1) {
        currentStepIdx++;
        if (currentStepIdx >= ANIM_STEPS.length - 1) {
          setAnimStep('output');
          setAnimProgress(1);
          setIsPlaying(false);
          return;
        }
        setAnimStep(ANIM_STEPS[currentStepIdx]);
        startTime = timestamp;
      }

      animFrameId = requestAnimationFrame(animate);
    };

    currentStepIdx = 1;
    setAnimStep(ANIM_STEPS[1]);
    animFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrameId);
  }, [isPlaying]);

  /* ─── 鼠标事件 ─── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMouse({ x, y });

      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      const n = tokens.length;

      if (activeTab === 'heatmap') {
        const labelSpace = 50;
        const pad = { top: 30, right: 20, bottom: 60, left: labelSpace };
        const plotW = cw - pad.left - pad.right;
        const plotH = ch - pad.top - pad.bottom;
        const cellW = plotW / n;
        const cellH = plotH / n;

        const col = Math.floor((x - pad.left) / cellW);
        const row = Math.floor((y - pad.top) / cellH);

        if (row >= 0 && row < n && col >= 0 && col < n) {
          const value = currentMatrix[row][col];
          tooltip.style.display = 'block';
          tooltip.style.left = `${x + 14}px`;
          tooltip.style.top = `${y - 10}px`;
          tooltip.textContent = `${tokens[row]} \u2192 ${tokens[col]}: ${value.toFixed(4)}`;
        } else {
          tooltip.style.display = 'none';
        }
      } else if (activeTab === 'multihead') {
        const gap = 16;
        const padX = 20;
        const labelH = 34;
        const bottomSpace = 70;
        const headW = (cw - padX * 2 - gap * 2) / 3;
        const headH = ch - labelH - bottomSpace - 20;
        const cellW = headW / n;
        const cellH = headH / n;

        let found = false;
        for (let head = 0; head < 3 && !found; head++) {
          const hx = padX + head * (headW + gap);
          const hy = labelH + 10;
          const col = Math.floor((x - hx) / cellW);
          const row = Math.floor((y - hy) / cellH);

          if (row >= 0 && row < n && col >= 0 && col < n) {
            const value = attentionMatrices[head][row][col];
            tooltip.style.display = 'block';
            tooltip.style.left = `${x + 14}px`;
            tooltip.style.top = `${y - 10}px`;
            tooltip.textContent = `${HEAD_COLORS[head].name} | ${tokens[row]} \u2192 ${tokens[col]}: ${value.toFixed(4)}`;
            found = true;
          }
        }
        if (!found) tooltip.style.display = 'none';
      } else {
        tooltip.style.display = 'none';
      }
    },
    [activeTab, tokens, currentMatrix, attentionMatrices],
  );

  const handleMouseLeave = useCallback(() => {
    setMouse(null);
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  }, []);

  /* ─── 播放/暂停 ─── */
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setAnimStep('qk');
      setAnimProgress(0);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setAnimStep('idle');
    setAnimProgress(0);
  }, []);

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* Tab 切换 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'qkv') {
                setIsPlaying(false);
                setAnimStep('idle');
              }
            }}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue text-white shadow-sm'
                : 'bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Self-Attention 热力图 */}
      {activeTab === 'heatmap' && (
        <>
          {/* 注意力头选择 */}
          <div className="flex items-center gap-2 px-4 pb-2">
            {[0, 1, 2].map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHead(h)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border"
                style={{
                  backgroundColor: selectedHead === h ? HEAD_COLORS[h].color : 'transparent',
                  borderColor: selectedHead === h ? HEAD_COLORS[h].color : COLORS.border,
                  color: selectedHead === h ? '#ffffff' : COLORS.text2,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: HEAD_COLORS[h].color }}
                />
                {HEAD_COLORS[h].name}
              </button>
            ))}
          </div>

          <div ref={heatmapContainerRef} className="relative px-4 pb-2">
            <canvas
              ref={heatmapCanvasRef}
              className="w-full rounded-lg cursor-crosshair"
              style={{ height: 320 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none bg-ink text-white text-[11px] font-mono rounded-md px-2 py-1 shadow-sm"
              style={{ display: 'none' }}
            />
          </div>

          {/* 颜色图例 */}
          <div className="flex items-center gap-3 px-4 pb-3">
            <span className="text-[11px] text-ink-3">0.0</span>
            <div
              className="flex-1 h-2 rounded-full"
              style={{
                background: `linear-gradient(to right, rgb(255,255,255), ${HEAD_COLORS[selectedHead].color})`,
                border: `1px solid ${COLORS.border}`,
              }}
            />
            <span className="text-[11px] text-ink-3">1.0</span>
          </div>
        </>
      )}

      {/* Q/K/V 计算流程 */}
      {activeTab === 'qkv' && (
        <>
          {/* 动画控制 */}
          <div className="flex items-center gap-2 px-4 pb-2">
            <button
              onClick={handlePlayPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer border"
              style={{
                backgroundColor: isPlaying ? COLORS.orange : COLORS.primary,
                borderColor: isPlaying ? COLORS.orange : COLORS.primary,
                color: '#ffffff',
              }}
            >
              {isPlaying ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="1" y="0" width="3" height="10" rx="0.5" />
                    <rect x="6" y="0" width="3" height="10" rx="0.5" />
                  </svg>
                  \u6682\u505c
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M2 0L10 5L2 10Z" />
                  </svg>
                  \u64ad\u653e\u52a8\u753b
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2"
            >
              \u91cd\u7f6e
            </button>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-1 ml-auto">
              {ANIM_STEPS.filter((s) => s !== 'idle').map((step, idx) => {
                const stepIdx = ANIM_STEPS.indexOf(step);
                const isActive = animStep === step;
                const isDone = ANIM_STEPS.indexOf(animStep) > stepIdx;
                return (
                  <div
                    key={step}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: isActive ? COLORS.primary : isDone ? COLORS.green : COLORS.border,
                      transform: isActive ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div ref={qkvContainerRef} className="relative px-4 pb-3">
            <canvas
              ref={qkvCanvasRef}
              className="w-full rounded-lg"
              style={{ height: 240 }}
            />
          </div>
        </>
      )}

      {/* Multi-Head Attention */}
      {activeTab === 'multihead' && (
        <div ref={multiheadContainerRef} className="relative px-4 pb-3">
          <canvas
            ref={multiheadCanvasRef}
            className="w-full rounded-lg cursor-crosshair"
            style={{ height: 340 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none bg-ink text-white text-[11px] font-mono rounded-md px-2 py-1 shadow-sm"
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* 底部控制区 */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-2 shrink-0">\u8f93\u5165\u53e5\u5b50</span>
          <input
            type="text"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Enter a sentence..."
            className="flex-1 px-3 py-1.5 rounded-lg text-[13px] bg-bg border border-border text-ink outline-none focus:border-blue transition-colors"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          />
          <span className="text-[11px] text-ink-3 shrink-0">
            {tokens.length} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
