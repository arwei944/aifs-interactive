import { useRef, useState, useCallback, useEffect } from 'react';

/* ─── 激活函数数据 ─── */
const functions = [
  { id: 'relu', name: 'ReLU', range: '[0, +∞)', pros: '计算极快，缓解梯度消失', cons: '负区域神经元死亡', useCase: '隐藏层默认选择' },
  { id: 'sigmoid', name: 'Sigmoid', range: '(0, 1)', pros: '输出可解释为概率', cons: '两端饱和，梯度消失', useCase: '二分类输出层' },
  { id: 'tanh', name: 'Tanh', range: '(-1, 1)', pros: '零中心化输出', cons: '仍然存在饱和问题', useCase: 'LSTM 门控机制' },
  { id: 'gelu', name: 'GELU', range: '(-∞, +∞)', pros: '平滑、处处可微', cons: '计算开销较大', useCase: 'Transformer 模型' },
  { id: 'swish', name: 'Swish', range: '(-∞, +∞)', pros: '自门控、平滑非单调', cons: '需要调参 β', useCase: '现代深度网络' },
] as const;

type FnId = (typeof functions)[number]['id'];

/* ─── 纯 JS 激活函数实现 ─── */
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const fnMap: Record<FnId, (x: number, beta?: number) => number> = {
  relu: (x) => Math.max(0, x),
  sigmoid,
  tanh: (x) => Math.tanh(x),
  gelu: (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x))),
  swish: (x, beta = 1) => x * sigmoid(beta * x),
};

/* ─── 坐标系常量 ─── */
const X_MIN = -6;
const X_MAX = 6;
const Y_MIN = -2;
const Y_MAX = 3;
const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
const CURVE_COLOR = '#0071e3';
const CURVE_WIDTH = 2.5;
const GRID_COLOR = '#e5e5ea';
const AXIS_COLOR = '#d2d2d7';
const FILL_ALPHA = 0.06;
const CANVAS_BG = '#fafafa';

export default function ActivationViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [activeFn, setActiveFn] = useState<FnId>('relu');
  const [beta, setBeta] = useState(1.0);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  /* ─── 坐标转换 ─── */
  const dataToCanvas = useCallback(
    (dx: number, dy: number, w: number, h: number) => {
      const plotW = w - PAD.left - PAD.right;
      const plotH = h - PAD.top - PAD.bottom;
      const cx = PAD.left + ((dx - X_MIN) / (X_MAX - X_MIN)) * plotW;
      const cy = PAD.top + ((Y_MAX - dy) / (Y_MAX - Y_MIN)) * plotH;
      return [cx, cy];
    },
    [],
  );

  const canvasToData = useCallback(
    (cx: number, cy: number, w: number, h: number) => {
      const plotW = w - PAD.left - PAD.right;
      const plotH = h - PAD.top - PAD.bottom;
      const dx = X_MIN + ((cx - PAD.left) / plotW) * (X_MAX - X_MIN);
      const dy = Y_MAX - ((cy - PAD.top) / plotH) * (Y_MAX - Y_MIN);
      return [dx, dy];
    },
    [],
  );

  /* ─── 核心绘制 ─── */
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      const plotW = w - PAD.left - PAD.right;
      const plotH = h - PAD.top - PAD.bottom;

      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      /* 背景 */
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, w, h);

      /* 网格线 */
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;

      for (let x = X_MIN; x <= X_MAX; x += 2) {
        const [cx] = dataToCanvas(x, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(cx, PAD.top);
        ctx.lineTo(cx, PAD.top + plotH);
        ctx.stroke();
      }
      for (let y = Y_MIN; y <= Y_MAX; y += 1) {
        const [, cy] = dataToCanvas(0, y, w, h);
        ctx.beginPath();
        ctx.moveTo(PAD.left, cy);
        ctx.lineTo(PAD.left + plotW, cy);
        ctx.stroke();
      }

      /* 坐标轴 */
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;

      // X 轴 (y=0)
      const [, y0] = dataToCanvas(0, 0, w, h);
      if (y0 >= PAD.top && y0 <= PAD.top + plotH) {
        ctx.beginPath();
        ctx.moveTo(PAD.left, y0);
        ctx.lineTo(PAD.left + plotW, y0);
        ctx.stroke();
      }

      // Y 轴 (x=0)
      const [x0] = dataToCanvas(0, 0, w, h);
      if (x0 >= PAD.left && x0 <= PAD.left + plotW) {
        ctx.beginPath();
        ctx.moveTo(x0, PAD.top);
        ctx.lineTo(x0, PAD.top + plotH);
        ctx.stroke();
      }

      /* 刻度标签 */
      ctx.fillStyle = '#aeaeb2';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let x = X_MIN; x <= X_MAX; x += 2) {
        const [cx] = dataToCanvas(x, 0, w, h);
        ctx.fillText(String(x), cx, PAD.top + plotH + 8);
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Y_MIN; y <= Y_MAX; y += 1) {
        const [, cy] = dataToCanvas(0, y, w, h);
        ctx.fillText(String(y), PAD.left - 8, cy);
      }

      /* 曲线填充 */
      const fn = fnMap[activeFn];
      const steps = Math.max(plotW * 2, 400);
      const dx = (X_MAX - X_MIN) / steps;

      const [, baselineY] = dataToCanvas(0, 0, w, h);
      const clampedBaseline = Math.max(PAD.top, Math.min(PAD.top + plotH, baselineY));

      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= steps; i++) {
        const xv = X_MIN + i * dx;
        const yv = fn(xv, beta);
        const [cx, cy] = dataToCanvas(xv, yv, w, h);
        if (first) {
          ctx.moveTo(cx, cy);
          first = false;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      // 闭合填充区域到 y=0 基线
      const [lastCx] = dataToCanvas(X_MAX, fn(X_MAX, beta), w, h);
      const [firstCx] = dataToCanvas(X_MIN, fn(X_MIN, beta), w, h);
      ctx.lineTo(lastCx, clampedBaseline);
      ctx.lineTo(firstCx, clampedBaseline);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
      gradient.addColorStop(0, `rgba(0, 113, 227, ${FILL_ALPHA})`);
      gradient.addColorStop(1, `rgba(0, 113, 227, ${FILL_ALPHA * 0.3})`);
      ctx.fillStyle = gradient;
      ctx.fill();

      /* 曲线 */
      ctx.beginPath();
      first = true;
      for (let i = 0; i <= steps; i++) {
        const xv = X_MIN + i * dx;
        const yv = fn(xv, beta);
        const [cx, cy] = dataToCanvas(xv, yv, w, h);
        if (first) {
          ctx.moveTo(cx, cy);
          first = false;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.strokeStyle = CURVE_COLOR;
      ctx.lineWidth = CURVE_WIDTH;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      /* 鼠标交互 */
      if (mouse) {
        const [mx, my] = [mouse.x, mouse.y];

        // 判断鼠标是否在绘图区域内
        if (
          mx >= PAD.left &&
          mx <= PAD.left + plotW &&
          my >= PAD.top &&
          my <= PAD.top + plotH
        ) {
          const [dataX] = canvasToData(mx, my, w, h);
          const dataY = fn(dataX, beta);
          const [curveX, curveY] = dataToCanvas(dataX, dataY, w, h);

          // 十字线
          ctx.strokeStyle = 'rgba(0, 113, 227, 0.25)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(curveX, PAD.top);
          ctx.lineTo(curveX, PAD.top + plotH);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(PAD.left, curveY);
          ctx.lineTo(PAD.left + plotW, curveY);
          ctx.stroke();

          ctx.setLineDash([]);

          // 曲线上的点
          ctx.beginPath();
          ctx.arc(curveX, curveY, 5, 0, Math.PI * 2);
          ctx.fillStyle = CURVE_COLOR;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(curveX, curveY, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }

      ctx.restore();
    },
    [activeFn, beta, mouse, dataToCanvas, canvasToData],
  );

  /* ─── Canvas 尺寸管理 ─── */
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = 280;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, w, h);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [draw]);

  /* ─── 重绘（函数/beta/mouse 变化时） ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    draw(ctx, w, h);
  }, [draw]);

  /* ─── 鼠标事件 ─── */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMouse({ x, y });

      // 更新 tooltip 位置和内容
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const plotW = w - PAD.left - PAD.right;
      const plotH = h - PAD.top - PAD.bottom;

      if (
        x >= PAD.left &&
        x <= PAD.left + plotW &&
        y >= PAD.top &&
        y <= PAD.top + plotH
      ) {
        const [dataX] = canvasToData(x, y, w, h);
        const fn = fnMap[activeFn];
        const dataY = fn(dataX, beta);

        tooltip.style.display = 'block';
        tooltip.style.left = `${x + 14}px`;
        tooltip.style.top = `${y - 10}px`;
        tooltip.textContent = `(${dataX.toFixed(2)}, ${dataY.toFixed(2)})`;
      } else {
        tooltip.style.display = 'none';
      }
    },
    [activeFn, beta, canvasToData],
  );

  const handleMouseLeave = useCallback(() => {
    setMouse(null);
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  }, []);

  /* ─── 当前函数信息 ─── */
  const currentFn = functions.find((f) => f.id === activeFn)!;

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* 函数选择器 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {functions.map((fn) => (
          <button
            key={fn.id}
            onClick={() => setActiveFn(fn.id)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 cursor-pointer ${
              activeFn === fn.id
                ? 'bg-blue text-white shadow-sm'
                : 'bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2'
            }`}
          >
            {fn.name}
          </button>
        ))}
      </div>

      {/* Canvas 容器 */}
      <div ref={containerRef} className="relative px-4 pb-2">
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg cursor-crosshair"
          style={{ height: 280 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none bg-ink text-white text-[11px] font-mono rounded-md px-2 py-1 shadow-sm"
          style={{ display: 'none' }}
        />
      </div>

      {/* Swish β 参数滑块 */}
      {activeFn === 'swish' && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-2 shrink-0">
              β 参数
            </span>
            <input
              type="range"
              min={0.01}
              max={2.0}
              step={0.01}
              value={beta}
              onChange={(e) => setBeta(parseFloat(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: '#0071e3',
                background: `linear-gradient(to right, #0071e3 0%, #0071e3 ${((beta - 0.01) / (2.0 - 0.01)) * 100}%, #e5e5ea ${((beta - 0.01) / (2.0 - 0.01)) * 100}%, #e5e5ea 100%)`,
              }}
            />
            <span className="text-[13px] text-ink font-mono w-10 text-right">
              {beta.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* 信息面板 */}
      <div className="grid grid-cols-4 border-t border-border">
        {[
          { label: '范围', value: currentFn.range },
          { label: '优点', value: currentFn.pros },
          { label: '缺点', value: currentFn.cons },
          { label: '使用场景', value: currentFn.useCase },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3 border-r border-border last:border-r-0">
            <div className="text-[11px] text-ink-3 mb-1">{item.label}</div>
            <div className="text-[13px] text-ink font-medium leading-snug">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
