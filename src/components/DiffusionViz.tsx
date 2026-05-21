import { useRef, useState, useCallback, useEffect } from 'react';

/* ─── 常量 ─── */
const GRID = 8;           // 8x8 像素图像
const TOTAL_STEPS = 20;   // 扩散步数 T
const BETA_START = 0.0001;
const BETA_END = 0.02;

/* ─── 噪声调度 ─── */
type ScheduleType = 'linear' | 'cosine';

function linearSchedule(t: number, T: number): number {
  return BETA_START + (BETA_END - BETA_START) * (t / T);
}

function cosineSchedule(t: number, T: number): number {
  const f = Math.cos(((t / T) + 0.008) / 1.008 * Math.PI / 2) ** 2;
  const f0 = Math.cos(0.008 / 1.008 * Math.PI / 2) ** 2;
  return Math.min(1, (1 - f / f0) * (BETA_END - BETA_START) + BETA_START);
}

function getSchedule(type: ScheduleType) {
  return type === 'linear' ? linearSchedule : cosineSchedule;
}

/* ─── 预计算调度参数 ─── */
function computeScheduleParams(type: ScheduleType, T: number) {
  const schedule = getSchedule(type);
  const betas: number[] = [];
  const alphas: number[] = [];
  const alphaBars: number[] = [];

  for (let t = 0; t <= T; t++) {
    const beta = schedule(t, T);
    betas.push(beta);
    const alpha = 1 - beta;
    alphas.push(alpha);
  }

  alphaBars.push(1);
  for (let t = 1; t <= T; t++) {
    alphaBars.push(alphaBars[t - 1] * alphas[t]);
  }

  return { betas, alphas, alphaBars };
}

/* ─── 8x8 笑脸图案 ─── */
function createSmiley(): number[][] {
  // 0=白, 1=黑, 0.5=灰(轮廓)
  const pattern = [
    [0,   0,   0, 0.5, 0.5, 0,   0,   0  ],
    [0,   0, 0.5, 1,   1,  0.5, 0,   0  ],
    [0,  0.5, 1,   0,   0,   1,  0.5, 0  ],
    [0.5,1,   0,   0,   0,   0,   1,  0.5],
    [0.5,1,   0,   0,   0,   0,   1,  0.5],
    [0,  0.5, 1,   0.5,0.5, 1,  0.5, 0  ],
    [0,   0,  0.5, 1,   1,  0.5, 0,   0  ],
    [0,   0,   0, 0.5, 0.5, 0,   0,   0  ],
  ];
  return pattern;
}

/* ─── Box-Muller 高斯随机数 ─── */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/* ─── 前向扩散：加噪 ─── */
function forwardDiffusion(
  image: number[][],
  step: number,
  alphaBars: number[],
  noise: number[][],
): number[][] {
  const result: number[][] = [];
  const sqrtAlphaBar = Math.sqrt(alphaBars[step]);
  const sqrtOneMinusAlphaBar = Math.sqrt(1 - alphaBars[step]);

  for (let r = 0; r < GRID; r++) {
    result[r] = [];
    for (let c = 0; c < GRID; c++) {
      result[r][c] = sqrtAlphaBar * image[r][c] + sqrtOneMinusAlphaBar * noise[r][c];
    }
  }
  return result;
}

/* ─── 反向去噪（简化模拟） ─── */
function reverseDenoise(
  noisy: number[][],
  step: number,
  alphaBars: number[],
  predictedNoise: number[][],
): number[][] {
  const result: number[][] = [];
  const alphaBarT = alphaBars[step];
  const alphaBarPrev = step > 0 ? alphaBars[step - 1] : 1;
  const alpha = alphaBarT / alphaBarPrev;
  const beta = 1 - alpha;

  for (let r = 0; r < GRID; r++) {
    result[r] = [];
    for (let c = 0; c < GRID; c++) {
      // DDPM 简化去噪公式
      const pred = (noisy[r][c] - beta / Math.sqrt(1 - alphaBarT) * predictedNoise[r][c]) / Math.sqrt(alpha);
      // 加一点随机性模拟后验分布
      const posteriorVariance = beta * (1 - alphaBarPrev) / (1 - alphaBarT);
      const z = step > 1 ? gaussianRandom() * Math.sqrt(Math.max(0, posteriorVariance)) * 0.3 : 0;
      result[r][c] = pred + z;
    }
  }
  return result;
}

/* ─── 生成固定噪声 ─── */
function generateNoise(): number[][] {
  const noise: number[][] = [];
  for (let r = 0; r < GRID; r++) {
    noise[r] = [];
    for (let c = 0; c < GRID; c++) {
      noise[r][c] = gaussianRandom();
    }
  }
  return noise;
}

/* ─── 颜色映射：值 → 颜色 ─── */
function valueToColor(val: number): string {
  const clamped = Math.max(-1, Math.min(1, val));
  if (clamped >= 0) {
    // 白色到蓝色
    const r = Math.round(255 - clamped * 200);
    const g = Math.round(255 - clamped * 145);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  } else {
    // 白色到橙色
    const t = -clamped;
    const r = 255;
    const g = Math.round(255 - t * 106);
    const b = Math.round(255 - t * 204);
    return `rgb(${r},${g},${b})`;
  }
}

/* ─── 绘制 8x8 像素网格 ─── */
function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  data: number[][],
  x: number,
  y: number,
  cellSize: number,
  label: string,
) {
  // 绘制像素
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      ctx.fillStyle = valueToColor(data[r][c]);
      ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize - 1, cellSize - 1);
    }
  }

  // 标签
  ctx.fillStyle = '#86868b';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + (GRID * cellSize) / 2, y + GRID * cellSize + 6);
}

/* ─── 绘制调度曲线 ─── */
function drawScheduleChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  linearParams: ReturnType<typeof computeScheduleParams>,
  cosineParams: ReturnType<typeof computeScheduleParams>,
  currentStep: number,
  scheduleType: ScheduleType,
) {
  const pad = { top: 20, right: 16, bottom: 28, left: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // 背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);

  // 网格
  ctx.strokeStyle = '#e5e5ea';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const x = pad.left + (i / 4) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
  }

  // X 轴标签
  ctx.fillStyle = '#aeaeb2';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const x = pad.left + (i / 4) * plotW;
    ctx.fillText(String(i * 5), x, pad.top + plotH + 8);
  }
  ctx.fillText('t', pad.left + plotW + 12, pad.top + plotH + 8);

  // Y 轴标签
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (1 - i / 4) * plotH;
    ctx.fillText((i * 0.25).toFixed(2), pad.left - 6, y);
  }

  // 绘制 beta_t 曲线
  const drawCurve = (
    params: ReturnType<typeof computeScheduleParams>,
    color: string,
    dash: number[],
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (let t = 0; t <= TOTAL_STEPS; t++) {
      const cx = pad.left + (t / TOTAL_STEPS) * plotW;
      const cy = pad.top + (1 - params.betas[t] / BETA_END) * plotH;
      if (t === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawCurve(linearParams, '#0071e3', []);
  drawCurve(cosineParams, '#ff9500', [6, 3]);

  // alpha_bar 累积曲线
  const drawAlphaBarCurve = (
    params: ReturnType<typeof computeScheduleParams>,
    color: string,
    dash: number[],
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let t = 0; t <= TOTAL_STEPS; t++) {
      const cx = pad.left + (t / TOTAL_STEPS) * plotW;
      const cy = pad.top + (1 - params.alphaBars[t]) * plotH;
      if (t === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };

  drawAlphaBarCurve(linearParams, '#0071e3', [3, 3]);
  drawAlphaBarCurve(cosineParams, '#ff9500', [3, 3]);

  // 当前步高亮
  const stepX = pad.left + (currentStep / TOTAL_STEPS) * plotW;
  const activeParams = scheduleType === 'linear' ? linearParams : cosineParams;
  const stepY = pad.top + (1 - activeParams.betas[currentStep] / BETA_END) * plotH;

  ctx.strokeStyle = 'rgba(52, 199, 89, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(stepX, pad.top);
  ctx.lineTo(stepX, pad.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 当前步点
  ctx.beginPath();
  ctx.arc(stepX, stepY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#34c759';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(stepX, stepY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 图例
  const legendX = pad.left + 8;
  const legendY = pad.top + 8;

  ctx.fillStyle = '#0071e3';
  ctx.fillRect(legendX, legendY, 12, 2);
  ctx.fillStyle = '#86868b';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Linear', legendX + 16, legendY + 1);

  ctx.strokeStyle = '#ff9500';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY + 16);
  ctx.lineTo(legendX + 12, legendY + 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#86868b';
  ctx.fillText('Cosine', legendX + 16, legendY + 17);

  ctx.fillStyle = 'rgba(52, 199, 89, 0.8)';
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#86868b';
  ctx.fillText('当前步', legendX + 16, legendY + 33);
}

/* ─── 主组件 ─── */
export default function DiffusionViz() {
  /* Refs */
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const pixelContainerRef = useRef<HTMLDivElement>(null);
  const scheduleCanvasRef = useRef<HTMLCanvasElement>(null);
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  /* 原始图像和噪声（固定种子） */
  const [originalImage] = useState(() => createSmiley());
  const [noise] = useState(() => generateNoise());
  const [reverseNoise] = useState(() => generateNoise());

  /* 状态 */
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('linear');
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /* 预计算调度参数 */
  const linearParams = useCallback(() => computeScheduleParams('linear', TOTAL_STEPS), []);
  const cosineParams = useCallback(() => computeScheduleParams('cosine', TOTAL_STEPS), []);

  const currentParams = scheduleType === 'linear' ? linearParams() : cosineParams();
  const { betas, alphas, alphaBars } = currentParams;

  /* 当前显示数据 */
  const forwardData = forwardDiffusion(originalImage, step, alphaBars, noise);

  // 反向过程：从 step=20 的纯噪声逐步去噪
  const reverseData = (() => {
    if (step === 0) return originalImage;
    const fullyNoisy = forwardDiffusion(originalImage, TOTAL_STEPS, alphaBars, noise);
    // 简化：模拟去噪，使用原始噪声的缩放版作为"预测噪声"
    let current = fullyNoisy;
    for (let t = TOTAL_STEPS; t >= TOTAL_STEPS - step + 1; t--) {
      const predictedNoise = noise.map(row => row.map(v => v * (t / TOTAL_STEPS)));
      current = reverseDenoise(current, t, alphaBars, predictedNoise);
    }
    return current;
  })();

  const displayData = mode === 'forward' ? forwardData : reverseData;

  /* ─── 绘制像素 Canvas ─── */
  const drawPixelCanvas = useCallback(() => {
    const canvas = pixelCanvasRef.current;
    const container = pixelContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 220;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    // 计算单元格大小
    const maxGridHeight = h - 50;
    const cellSize = Math.min(Math.floor(maxGridHeight / GRID), 24);

    // 三列布局：原始 | 噪声 | 结果
    const gridW = GRID * cellSize;
    const gap = 40;
    const totalW = gridW * 3 + gap * 2;
    const startX = (w - totalW) / 2;
    const startY = 10;

    // 原始图像
    drawPixelGrid(ctx, originalImage, startX, startY, cellSize, '原始图像');

    // 噪声
    const noiseDisplay = noise.map(row => row.map(v => v * Math.sqrt(1 - alphaBars[step])));
    drawPixelGrid(ctx, noiseDisplay, startX + gridW + gap, startY, cellSize, '噪声');

    // 结果
    drawPixelGrid(ctx, displayData, startX + (gridW + gap) * 2, startY, cellSize, mode === 'forward' ? '加噪结果' : '去噪结果');

    // 步骤指示箭头
    ctx.fillStyle = '#aeaeb2';
    ctx.font = '18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arrowY = startY + (GRID * cellSize) / 2;
    ctx.fillText('+', startX + gridW + gap / 2, arrowY);
    ctx.fillText('=', startX + (gridW + gap) * 2 - gap / 2, arrowY);
  }, [originalImage, noise, alphaBars, step, displayData, mode]);

  /* ─── 绘制调度曲线 Canvas ─── */
  const drawScheduleCanvas = useCallback(() => {
    const canvas = scheduleCanvasRef.current;
    const container = scheduleContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 200;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    drawScheduleChart(ctx, w, h, linearParams(), cosineParams(), step, scheduleType);
  }, [step, scheduleType, linearParams, cosineParams]);

  /* ─── 动画循环 ─── */
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = 0;
    const interval = 300;

    function tick(time: number) {
      if (time - lastTime < interval) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTime = time;

      setStep((prev) => {
        const next = mode === 'forward' ? prev + 1 : prev - 1;
        if (next >= TOTAL_STEPS || next <= 0) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, mode]);

  /* ─── 响应式 Canvas ─── */
  useEffect(() => {
    const container = pixelContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawPixelCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawPixelCanvas]);

  useEffect(() => {
    const container = scheduleContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawScheduleCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawScheduleCanvas]);

  /* ─── 重绘 ─── */
  useEffect(() => {
    drawPixelCanvas();
  }, [drawPixelCanvas]);

  useEffect(() => {
    drawScheduleCanvas();
  }, [drawScheduleCanvas]);

  /* ─── 切换模式时重置步数 ─── */
  useEffect(() => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setStep(mode === 'forward' ? 0 : TOTAL_STEPS);
  }, [mode, scheduleType]);

  /* ─── 操作 ─── */
  const handlePlay = () => {
    if (mode === 'forward' && step >= TOTAL_STEPS) setStep(0);
    if (mode === 'reverse' && step <= 0) setStep(TOTAL_STEPS);
    setIsPlaying(true);
  };

  const handleReset = () => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setStep(mode === 'forward' ? 0 : TOTAL_STEPS);
  };

  const handleStepChange = (val: number) => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setStep(val);
  };

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-border">
        <span className="text-[12px] font-medium text-ink-2 font-mono">扩散模型可视化</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMode('forward')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              mode === 'forward'
                ? 'bg-blue text-white'
                : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
            }`}
          >
            前向加噪
          </button>
          <button
            onClick={() => setMode('reverse')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              mode === 'reverse'
                ? 'bg-blue text-white'
                : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
            }`}
          >
            反向去噪
          </button>
        </div>
      </div>

      {/* 像素 Canvas */}
      <div ref={pixelContainerRef} className="relative">
        <canvas ref={pixelCanvasRef} className="block w-full" style={{ height: 220 }} />
      </div>

      {/* 参数面板 */}
      <div className="grid grid-cols-4 gap-px bg-border border-t border-b border-border">
        {[
          { label: '当前步 t', value: `${step} / ${TOTAL_STEPS}` },
          { label: 'β_t', value: betas[step].toFixed(5) },
          { label: 'α_t', value: alphas[step].toFixed(5) },
          { label: 'ᾱ_t', value: alphaBars[step].toFixed(5) },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-3 py-2.5 text-center">
            <div className="text-[10px] font-medium text-ink-3 uppercase tracking-wider mb-0.5">
              {item.label}
            </div>
            <div className="text-[13px] font-mono font-medium text-ink">{item.value}</div>
          </div>
        ))}
      </div>

      {/* 控制面板 */}
      <div className="px-4 py-3 space-y-3">
        {/* 播放按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            disabled={mode === 'forward' ? step >= TOTAL_STEPS : step <= 0}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber text-white hover:brightness-110'
                : (mode === 'forward' ? step >= TOTAL_STEPS : step <= 0)
                  ? 'bg-bg border border-border text-ink-3 cursor-not-allowed'
                  : 'bg-blue text-white hover:bg-blue-hover'
            }`}
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 rounded-full text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            ↺ 重置
          </button>

          {/* 调度切换 */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setScheduleType('linear')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                scheduleType === 'linear'
                  ? 'bg-blue text-white'
                  : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => setScheduleType('cosine')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                scheduleType === 'cosine'
                  ? 'bg-blue text-white'
                  : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
              }`}
            >
              Cosine
            </button>
          </div>
        </div>

        {/* 步数滑块 */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-medium text-ink-2 w-16 shrink-0">
            {mode === 'forward' ? '加噪步数' : '去噪步数'}
          </label>
          <input
            type="range"
            min={0}
            max={TOTAL_STEPS}
            step={1}
            value={step}
            onChange={(e) => handleStepChange(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none bg-border rounded-full outline-none cursor-pointer accent-blue"
          />
          <span className="text-[12px] font-mono text-ink w-10 text-right">{step}</span>
        </div>
      </div>

      {/* 噪声调度对比图 */}
      <div className="border-t border-border">
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-medium text-ink-3 uppercase tracking-wider">噪声调度对比</span>
        </div>
        <div ref={scheduleContainerRef} className="relative px-4 pb-3">
          <canvas ref={scheduleCanvasRef} className="block w-full rounded-lg" style={{ height: 200 }} />
        </div>
      </div>
    </div>
  );
}
