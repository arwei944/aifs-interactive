import { useState, useEffect, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Loss functions                                                     */
/* ------------------------------------------------------------------ */

interface LossFunction {
  id: string;
  name: string;
  fn: (x: number) => number;
  xRange: [number, number];
  yRange: [number, number];
  defaultStart: number;
}

const lossFunctions: LossFunction[] = [
  {
    id: 'quadratic',
    name: '二次函数',
    fn: (x: number) => 0.5 * (x - 2) * (x - 2),
    xRange: [-2, 6] as [number, number],
    yRange: [-0.5, 8] as [number, number],
    defaultStart: -1.5,
  },
  {
    id: 'multimodal',
    name: '多极值函数',
    fn: (x: number) => Math.sin(2 * x) + 0.5 * Math.cos(x) + 0.1 * x * x,
    xRange: [-5, 5] as [number, number],
    yRange: [-2, 5] as [number, number],
    defaultStart: -3,
  },
  {
    id: 'wavy',
    name: '波浪函数',
    fn: (x: number) => Math.exp(-0.3 * Math.abs(x)) * Math.sin(3 * x) + 0.2 * x * x,
    xRange: [-5, 5] as [number, number],
    yRange: [-2, 6] as [number, number],
    defaultStart: -4,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function numericalGradient(fn: (x: number) => number, x: number, h = 0.001): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GradientDescentViz() {
  const [funcIndex, setFuncIndex] = useState(0);
  const [learningRate, setLearningRate] = useState(0.1);
  const [startPos, setStartPos] = useState(lossFunctions[0].defaultStart);
  const [isRunning, setIsRunning] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [currentX, setCurrentX] = useState(lossFunctions[0].defaultStart);
  const [currentLoss, setCurrentLoss] = useState(() => lossFunctions[0].fn(lossFunctions[0].defaultStart));
  const [currentGrad, setCurrentGrad] = useState(() => numericalGradient(lossFunctions[0].fn, lossFunctions[0].defaultStart));
  const [converged, setConverged] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const stateRef = useRef({
    x: lossFunctions[0].defaultStart,
    step: 0,
    running: false,
    converged: false,
  });

  const currentFunc = lossFunctions[funcIndex];

  /* ---- sync state ref ---- */
  useEffect(() => {
    stateRef.current.x = currentX;
    stateRef.current.step = stepCount;
    stateRef.current.running = isRunning;
    stateRef.current.converged = converged;
  }, [currentX, stepCount, isRunning, converged]);

  /* ---- reset when function changes ---- */
  const reset = useCallback(() => {
    const fn = lossFunctions[funcIndex];
    setIsRunning(false);
    setConverged(false);
    setStepCount(0);
    setCurrentX(fn.defaultStart);
    setCurrentLoss(fn.fn(fn.defaultStart));
    setCurrentGrad(numericalGradient(fn.fn, fn.defaultStart));
    setStartPos(fn.defaultStart);
    trailRef.current = [];
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [funcIndex]);

  useEffect(() => {
    reset();
  }, [funcIndex]);

  /* ---- animation loop ---- */
  useEffect(() => {
    if (!isRunning || converged) return;

    let lastTime = 0;
    const interval = 60; // ms between steps

    function tick(time: number) {
      if (time - lastTime < interval) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTime = time;

      const s = stateRef.current;
      if (s.converged || s.step >= 500) {
        setIsRunning(false);
        setConverged(true);
        return;
      }

      const fn = lossFunctions[funcIndex];
      const grad = numericalGradient(fn.fn, s.x);
      const newX = s.x - learningRate * grad;
      const newLoss = fn.fn(newX);
      const newGrad = numericalGradient(fn.fn, newX);

      // record trail
      trailRef.current.push({ x: s.x, y: fn.fn(s.x) });
      if (trailRef.current.length > 200) trailRef.current.shift();

      s.x = newX;
      s.step += 1;

      setCurrentX(newX);
      setCurrentLoss(newLoss);
      setCurrentGrad(newGrad);
      setStepCount(s.step);

      if (Math.abs(newGrad) < 0.001) {
        s.converged = true;
        setIsRunning(false);
        setConverged(true);
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning, converged, funcIndex, learningRate]);

  /* ---- canvas drawing ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 260;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const [xMin, xMax] = currentFunc.xRange;
    const [yMin, yMax] = currentFunc.yRange;

    const toCanvasX = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const toCanvasY = (y: number) => pad.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = '#e5e5ea';
    ctx.lineWidth = 0.5;

    // vertical grid lines
    const xStep = Math.pow(10, Math.floor(Math.log10(xMax - xMin))) / 2;
    for (let gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
      const cx = toCanvasX(gx);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
    }

    // horizontal grid lines
    const yStep = Math.pow(10, Math.floor(Math.log10(yMax - yMin))) / 2;
    for (let gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
      const cy = toCanvasY(gy);
      ctx.beginPath();
      ctx.moveTo(pad.left, cy);
      ctx.lineTo(pad.left + plotW, cy);
      ctx.stroke();
    }

    // axes
    ctx.strokeStyle = '#aeaeb2';
    ctx.lineWidth = 1;

    // x-axis (y=0)
    if (yMin <= 0 && yMax >= 0) {
      const cy = toCanvasY(0);
      ctx.beginPath();
      ctx.moveTo(pad.left, cy);
      ctx.lineTo(pad.left + plotW, cy);
      ctx.stroke();
    }

    // y-axis (x=0)
    if (xMin <= 0 && xMax >= 0) {
      const cx = toCanvasX(0);
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
    }

    // axis labels
    ctx.fillStyle = '#aeaeb2';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
      const cx = toCanvasX(gx);
      ctx.fillText(Number(gx.toFixed(1)).toString(), cx, pad.top + plotH + 16);
    }
    ctx.textAlign = 'right';
    for (let gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
      const cy = toCanvasY(gy);
      ctx.fillText(Number(gy.toFixed(1)).toString(), pad.left - 6, cy + 3);
    }

    // loss curve
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      const y = currentFunc.fn(x);
      const cx = toCanvasX(x);
      const cy = toCanvasY(y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // trail
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const alpha = 0.08 + 0.4 * (i / trail.length);
      const radius = 2 + 1.5 * (i / trail.length);
      ctx.fillStyle = `rgba(0, 113, 227, ${alpha})`;
      ctx.beginPath();
      ctx.arc(toCanvasX(trail[i].x), toCanvasY(trail[i].y), radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // gradient arrow
    const ballCX = toCanvasX(currentX);
    const ballCY = toCanvasY(currentLoss);
    const arrowLen = Math.min(40, Math.abs(currentGrad) * 15);
    const arrowDir = currentGrad > 0 ? 1 : -1; // gradient direction

    if (arrowLen > 3) {
      ctx.strokeStyle = '#ff3b30';
      ctx.fillStyle = '#ff3b30';
      ctx.lineWidth = 2;
      const endX = ballCX + arrowDir * arrowLen;

      ctx.beginPath();
      ctx.moveTo(ballCX, ballCY);
      ctx.lineTo(endX, ballCY);
      ctx.stroke();

      // arrowhead
      ctx.beginPath();
      ctx.moveTo(endX, ballCY);
      ctx.lineTo(endX - arrowDir * 6, ballCY - 4);
      ctx.lineTo(endX - arrowDir * 6, ballCY + 4);
      ctx.closePath();
      ctx.fill();
    }

    // ball shadow
    ctx.fillStyle = 'rgba(0, 113, 227, 0.15)';
    ctx.beginPath();
    ctx.arc(ballCX, ballCY + 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // ball
    ctx.fillStyle = '#0071e3';
    ctx.beginPath();
    ctx.arc(ballCX, ballCY, 8, 0, Math.PI * 2);
    ctx.fill();

    // ball highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(ballCX - 2, ballCY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [currentFunc, currentX, currentLoss, currentGrad]);

  /* ---- redraw on state change ---- */
  useEffect(() => {
    draw();
  }, [draw]);

  /* ---- responsive canvas ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  /* ---- handlers ---- */
  const handleToggle = () => {
    if (converged) return;
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    reset();
  };

  const handleFuncChange = (idx: number) => {
    setFuncIndex(idx);
  };

  const handleStartPosChange = (val: number) => {
    setStartPos(val);
    setCurrentX(val);
    setCurrentLoss(currentFunc.fn(val));
    setCurrentGrad(numericalGradient(currentFunc.fn, val));
    setStepCount(0);
    setConverged(false);
    setIsRunning(false);
    trailRef.current = [];
  };

  /* ---- format helpers ---- */
  const fmt = (n: number) => {
    if (Math.abs(n) < 0.001) return '0.0000';
    if (Math.abs(n) >= 100) return n.toFixed(1);
    return n.toFixed(4);
  };

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-border">
        <span className="text-[12px] font-medium text-ink-2 font-mono">梯度下降可视化</span>
        <div className="flex items-center gap-1.5">
          {lossFunctions.map((fn, idx) => (
            <button
              key={fn.id}
              onClick={() => handleFuncChange(idx)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                idx === funcIndex
                  ? 'bg-blue text-white'
                  : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
              }`}
            >
              {fn.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative">
        <canvas ref={canvasRef} className="block w-full" style={{ height: 260 }} />

        {/* Converged overlay */}
        {converged && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green/10 border border-green/30 text-[11px] font-medium text-green">
            已收敛
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="grid grid-cols-4 gap-px bg-border border-t border-b border-border">
        {[
          { label: '当前位置 x', value: fmt(currentX) },
          { label: '损失值 f(x)', value: fmt(currentLoss) },
          { label: '梯度 df/dx', value: fmt(currentGrad) },
          { label: '迭代步数', value: stepCount.toString() },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-3 py-2.5 text-center">
            <div className="text-[10px] font-medium text-ink-3 uppercase tracking-wider mb-0.5">
              {item.label}
            </div>
            <div className="text-[14px] font-mono font-medium text-ink">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-3">
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={converged}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
              isRunning
                ? 'bg-amber text-white hover:brightness-110'
                : converged
                  ? 'bg-bg border border-border text-ink-3 cursor-not-allowed'
                  : 'bg-blue text-white hover:bg-blue-hover'
            }`}
          >
            {converged ? '已收敛' : isRunning ? '⏸ 暂停' : '▶ 开始'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 rounded-full text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            ↺ 重置
          </button>
        </div>

        {/* Sliders */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-ink-2 w-16 shrink-0">学习率</label>
            <input
              type="range"
              min={0.01}
              max={1.0}
              step={0.01}
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              className="flex-1 h-1.5 appearance-none bg-border rounded-full outline-none cursor-pointer accent-blue"
            />
            <span className="text-[12px] font-mono text-ink w-10 text-right">{learningRate.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-ink-2 w-16 shrink-0">起始位置</label>
            <input
              type="range"
              min={currentFunc.xRange[0] + 0.5}
              max={currentFunc.xRange[1] - 0.5}
              step={0.1}
              value={startPos}
              onChange={(e) => handleStartPosChange(Number(e.target.value))}
              className="flex-1 h-1.5 appearance-none bg-border rounded-full outline-none cursor-pointer accent-blue"
            />
            <span className="text-[12px] font-mono text-ink w-10 text-right">{startPos.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
