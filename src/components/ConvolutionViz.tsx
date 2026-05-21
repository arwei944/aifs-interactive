import { useRef, useState, useCallback, useEffect } from 'react';

/* ─── Presets ─── */
interface KernelPreset {
  id: string;
  name: string;
  kernel: number[][];
}

const presets: KernelPreset[] = [
  { id: 'edge-h', name: '边缘检测(水平)', kernel: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]] },
  { id: 'edge-v', name: '边缘检测(垂直)', kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] },
  { id: 'blur', name: '模糊', kernel: [[1/9,1/9,1/9],[1/9,1/9,1/9],[1/9,1/9,1/9]] },
  { id: 'sharpen', name: '锐化', kernel: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  { id: 'emboss', name: '浮雕', kernel: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]] },
];

/* ─── Default 8x8 image ─── */
const DEFAULT_IMAGE = [
  [10,10,10,10,10,10,10,10],
  [10,10,10,10,10,10,10,10],
  [10,10,200,200,200,200,10,10],
  [10,10,200,200,200,200,10,10],
  [10,10,200,200,200,200,10,10],
  [10,10,200,200,200,200,10,10],
  [10,10,10,10,10,10,10,10],
  [10,10,10,10,10,10,10,10],
];

/* ─── Colors ─── */
const C = {
  bg: '#fafafa',
  grid: '#e5e5ea',
  highlight: 'rgba(0,113,227,0.18)',
  highlightBorder: '#0071e3',
  computedFill: 'rgba(52,199,89,0.15)',
  computedBorder: '#34c759',
  text: '#1d1d1f',
  textLight: '#86868b',
  textMuted: '#aeaeb2',
  positive: '#0071e3',
  negative: '#ff3b30',
  zero: '#aeaeb2',
};

/* ─── Helpers ─── */
function grayColor(v: number): string {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
}

function kernelColor(v: number): string {
  if (v > 0) return C.positive;
  if (v < 0) return C.negative;
  return C.zero;
}

function outputSize(inSize: number, kSize: number, stride: number, pad: number): number {
  return Math.floor((inSize + 2 * pad - kSize) / stride) + 1;
}

function padImage(img: number[][], pad: number): number[][] {
  if (pad === 0) return img;
  const rows = img.length, cols = img[0].length;
  const out: number[][] = [];
  for (let r = 0; r < rows + 2 * pad; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols + 2 * pad; c++) {
      const or = r - pad, oc = c - pad;
      row.push(or >= 0 && or < rows && oc >= 0 && oc < cols ? img[or][oc] : 0);
    }
    out.push(row);
  }
  return out;
}

function convStep(
  img: number[][], kern: number[][], oR: number, oC: number, stride: number, pad: number,
): { products: number[][]; sum: number; window: number[][] } {
  const padded = padImage(img, pad);
  const products: number[][] = [];
  const window: number[][] = [];
  let sum = 0;
  for (let kr = 0; kr < kern.length; kr++) {
    const pRow: number[] = [], wRow: number[] = [];
    for (let kc = 0; kc < kern[kr].length; kc++) {
      const iv = padded[oR * stride + kr]?.[oC * stride + kc] ?? 0;
      const kv = kern[kr][kc];
      const p = iv * kv;
      pRow.push(p);
      wRow.push(iv);
      sum += p;
    }
    products.push(pRow);
    window.push(wRow);
  }
  return { products, sum, window };
}

/* ─── Component ─── */
export default function ConvolutionViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [image] = useState<number[][]>(DEFAULT_IMAGE);
  const [kernel, setKernel] = useState<number[][]>(presets[0].kernel);
  const [activePreset, setActivePreset] = useState('edge-h');
  const [stride, setStride] = useState(1);
  const [padding, setPadding] = useState(0);
  const [speed, setSpeed] = useState(500);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [outputMap, setOutputMap] = useState<Map<string, number>>(new Map());

  const kSize = 3;
  const inSize = image.length;
  const outSizeVal = outputSize(inSize, kSize, stride, padding);
  const totalSteps = outSizeVal * outSizeVal;

  const curRow = Math.floor(currentStep / outSizeVal);
  const curCol = currentStep % outSizeVal;
  const winStartR = curRow * stride;
  const winStartC = curCol * stride;
  const comp = convStep(image, kernel, curRow, curCol, stride, padding);

  const resetOutput = useCallback(() => {
    setOutputMap(new Map());
    setCurrentStep(0);
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    resetOutput();
  }, [stride, padding, kernel, resetOutput]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          setIsPlaying(false);
          return prev;
        }
        const r = Math.floor(next / outSizeVal);
        const c = next % outSizeVal;
        const res = convStep(image, kernel, r, c, stride, padding);
        setOutputMap((m) => { const nm = new Map(m); nm.set(`${r},${c}`, res.sum); return nm; });
        return next;
      });
    };
    timerRef.current = setTimeout(tick, speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentStep, speed, totalSteps, outSizeVal, image, kernel, stride, padding]);

  const handlePlayPause = useCallback(() => {
    if (currentStep >= totalSteps - 1 && !isPlaying) {
      resetOutput();
      const res = convStep(image, kernel, 0, 0, stride, padding);
      setOutputMap((m) => { const nm = new Map(m); nm.set('0,0', res.sum); return nm; });
    }
    setIsPlaying((p) => !p);
  }, [currentStep, totalSteps, isPlaying, resetOutput, image, kernel, stride, padding]);

  const handleReset = useCallback(() => { setIsPlaying(false); resetOutput(); }, [resetOutput]);

  const handleStepForward = useCallback(() => {
    if (currentStep >= totalSteps - 1) return;
    const next = currentStep + 1;
    const r = Math.floor(next / outSizeVal);
    const c = next % outSizeVal;
    const res = convStep(image, kernel, r, c, stride, padding);
    setOutputMap((m) => { const nm = new Map(m); nm.set(`${r},${c}`, res.sum); return nm; });
    setCurrentStep(next);
  }, [currentStep, totalSteps, outSizeVal, image, kernel, stride, padding]);

  const handleStepBack = useCallback(() => {
    if (currentStep <= 0) return;
    const r = Math.floor(currentStep / outSizeVal);
    const c = currentStep % outSizeVal;
    setOutputMap((m) => { const nm = new Map(m); nm.delete(`${r},${c}`); return nm; });
    setCurrentStep(currentStep - 1);
  }, [currentStep, outSizeVal]);

  const handlePresetChange = useCallback((p: KernelPreset) => {
    setActivePreset(p.id);
    setKernel(p.kernel.map((row) => [...row]));
  }, []);

  const handleKernelEdit = useCallback((row: number, col: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setActivePreset('custom');
    setKernel((prev) => { const nk = prev.map((r) => [...r]); nk[row][col] = num; return nk; });
  }, []);

  /* ─── Canvas draw ─── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 380;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const cell = Math.min(Math.floor((w - 120) / (inSize + kSize + outSizeVal + 8)), 38);
    const inX = 20, inY = 40;
    const kX = inX + inSize * cell + cell * 2.5;
    const kY = inY + cell * 0.5;
    const oX = kX + kSize * cell + cell * 2.5;
    const oY = inY;

    /* Input image */
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`\u8F93\u5165\u56FE\u50CF (8\u00D78)`, inX + (inSize * cell) / 2, inY - 14);

    for (let r = 0; r < inSize; r++) {
      for (let c = 0; c < inSize; c++) {
        const x = inX + c * cell;
        const y = inY + r * cell;
        const inWin = r >= winStartR && r < winStartR + kSize && c >= winStartC && c < winStartC + kSize;

        ctx.fillStyle = grayColor(image[r][c]);
        ctx.fillRect(x, y, cell, cell);

        if (inWin) {
          ctx.fillStyle = C.highlight;
          ctx.fillRect(x, y, cell, cell);
          ctx.strokeStyle = C.highlightBorder;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        }

        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cell, cell);

        ctx.fillStyle = image[r][c] > 128 ? '#1d1d1f' : '#ffffff';
        ctx.font = `${cell < 30 ? 9 : 11}px JetBrains Mono, SF Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(image[r][c]), x + cell / 2, y + cell / 2);
      }
    }

    /* Kernel */
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`\u5377\u79EF\u6838 (3\u00D73)`, kX + (kSize * cell) / 2, kY - 14);

    for (let r = 0; r < kSize; r++) {
      for (let c = 0; c < kSize; c++) {
        const x = kX + c * cell;
        const y = kY + r * cell;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cell, cell);

        const v = kernel[r][c];
        ctx.fillStyle = kernelColor(v);
        ctx.font = `bold ${cell < 30 ? 9 : 11}px JetBrains Mono, SF Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Number.isInteger(v) ? String(v) : v.toFixed(2), x + cell / 2, y + cell / 2);
      }
    }

    /* Multiply sign */
    ctx.fillStyle = C.textLight;
    ctx.font = 'bold 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u00D7', kX + (kSize * cell) / 2, kY + kSize * cell + 20);

    /* Output feature map */
    ctx.fillStyle = C.text;
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const outLabel = padding > 0
      ? `\u8F93\u51FA\u7279\u5F81\u56FE (${outSizeVal}\u00D7${outSizeVal}, Same)`
      : `\u8F93\u51FA\u7279\u5F81\u56FE (${outSizeVal}\u00D7${outSizeVal}, Valid)`;
    ctx.fillText(outLabel, oX + (outSizeVal * cell) / 2, oY - 14);

    for (let r = 0; r < outSizeVal; r++) {
      for (let c = 0; c < outSizeVal; c++) {
        const x = oX + c * cell;
        const y = oY + r * cell;
        const key = `${r},${c}`;
        const val = outputMap.get(key);
        const isCur = r === curRow && c === curCol;

        if (val !== undefined) {
          ctx.fillStyle = isCur ? C.highlight : C.computedFill;
          ctx.fillRect(x, y, cell, cell);
          ctx.strokeStyle = isCur ? C.highlightBorder : C.computedBorder;
          ctx.lineWidth = isCur ? 2 : 1;
          ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
          ctx.fillStyle = C.text;
          ctx.font = `${cell < 30 ? 9 : 11}px JetBrains Mono, SF Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(Math.round(val)), x + cell / 2, y + cell / 2);
        } else {
          ctx.fillStyle = '#f5f5f7';
          ctx.fillRect(x, y, cell, cell);
          ctx.strokeStyle = C.grid;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, cell, cell);
          if (isCur) {
            ctx.fillStyle = C.highlight;
            ctx.fillRect(x, y, cell, cell);
            ctx.strokeStyle = C.highlightBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
            ctx.fillStyle = C.highlightBorder;
            ctx.font = `${cell < 30 ? 9 : 11}px JetBrains Mono, SF Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + cell / 2, y + cell / 2);
          }
        }
      }
    }

    /* Equals and arrow */
    ctx.fillStyle = C.textLight;
    ctx.font = 'bold 18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const eqX = (inX + inSize * cell + kX) / 2;
    const eqY = inY + (inSize * cell) / 2;
    ctx.fillText('=', eqX, eqY);
    const arrowX = (kX + kSize * cell + oX) / 2;
    ctx.fillText('\u2192', arrowX, eqY);

    /* Progress bar */
    const pY = h - 20;
    const pW = w - 40;
    const progress = totalSteps > 0 ? currentStep / (totalSteps - 1) : 0;

    ctx.fillStyle = '#e5e5ea';
    ctx.beginPath();
    ctx.roundRect(20, pY, pW, 4, 2);
    ctx.fill();

    ctx.fillStyle = '#0071e3';
    ctx.beginPath();
    ctx.roundRect(20, pY, pW * progress, 4, 2);
    ctx.fill();

    ctx.fillStyle = C.textMuted;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`\u6B65\u9AA4 ${currentStep + 1} / ${totalSteps}`, w - 20, pY - 6);
  }, [image, kernel, stride, padding, currentStep, outputMap, curRow, curCol, winStartR, winStartC, outSizeVal, inSize, totalSteps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

  /* ─── Info items ─── */
  const infoItems = [
    { label: '\u8F93\u5165\u5C3A\u5BF8', value: `${inSize}\u00D7${inSize}` },
    { label: '\u8F93\u51FA\u5C3A\u5BF8', value: `${outSizeVal}\u00D7${outSizeVal}` },
    { label: 'Stride', value: String(stride) },
    { label: 'Padding', value: padding === 0 ? 'Valid (0)' : 'Same (1)' },
  ];

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-border flex-wrap gap-2">
        <span className="text-[12px] font-medium text-ink-2 font-mono">{'\u5377\u79EF\u53EF\u89C6\u5316'}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                activePreset === p.id
                  ? 'bg-blue text-white'
                  : 'bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative">
        <canvas ref={canvasRef} className="block w-full" style={{ height: 380 }} />
      </div>

      {/* Computation display */}
      <div className="border-t border-border px-4 py-3">
        <div className="text-[11px] font-medium text-ink-3 mb-2 uppercase tracking-wider">
          {'\u5B9E\u65F6\u8BA1\u7B97'}
        </div>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[11px] text-ink-2 mb-1.5">{'\u5BF9\u5E94\u5143\u7D20\u76F8\u4E58'}</div>
            <div className="grid grid-cols-3 gap-1">
              {comp.products.map((row, r) =>
                row.map((prod, c) => (
                  <div key={`${r}-${c}`} className="bg-bg border border-border rounded-md px-2 py-1 text-center">
                    <span className="text-[10px] text-ink-3">{comp.window[r][c]}</span>
                    <span className="text-[10px] text-ink-3 mx-0.5">{'\u00D7'}</span>
                    <span className="text-[10px]" style={{ color: kernelColor(kernel[r][c]) }}>
                      {fmtNum(kernel[r][c])}
                    </span>
                    <span className="text-[10px] text-ink-3 mx-0.5">=</span>
                    <span className="text-[11px] font-mono font-medium text-ink">{fmtNum(prod)}</span>
                  </div>
                )),
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-4">
            <div className="text-[11px] text-ink-3">{'\u6C42\u548C ='}</div>
            <div className="bg-blue/10 border border-blue/30 rounded-lg px-4 py-2">
              <span className="text-[18px] font-mono font-bold text-blue">{Math.round(comp.sum)}</span>
            </div>
            <div className="text-[11px] text-ink-3">
              {'\u2192 output['}{curRow}{']['}{curCol}{']'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-border px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStepBack}
            disabled={currentStep <= 0 || isPlaying}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            {'\u25C0'}
          </button>
          <button
            onClick={handlePlayPause}
            disabled={currentStep >= totalSteps - 1 && !isPlaying}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber text-white hover:brightness-110'
                : currentStep >= totalSteps - 1
                  ? 'bg-bg border border-border text-ink-3 cursor-not-allowed'
                  : 'bg-blue text-white hover:bg-blue-hover'
            }`}
          >
            {isPlaying ? '\u23F8 \u6682\u505C' : (currentStep >= totalSteps - 1 ? '\u5DF2\u5B8C\u6210' : '\u25B6 \u64AD\u653E')}
          </button>
          <button
            onClick={handleStepForward}
            disabled={currentStep >= totalSteps - 1 || isPlaying}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            {'\u25B6'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 rounded-full text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            {'\u21BA \u91CD\u7F6E'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-ink-2 w-12 shrink-0">Stride</label>
            <div className="flex items-center gap-1">
              {[1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setStride(s)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    stride === s ? 'bg-blue text-white' : 'bg-bg border border-border text-ink-2 hover:border-border-2'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-ink-2 w-12 shrink-0">Padding</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPadding(0)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  padding === 0 ? 'bg-blue text-white' : 'bg-bg border border-border text-ink-2 hover:border-border-2'
                }`}
              >
                0 (Valid)
              </button>
              <button
                onClick={() => setPadding(1)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  padding === 1 ? 'bg-blue text-white' : 'bg-bg border border-border text-ink-2 hover:border-border-2'
                }`}
              >
                1 (Same)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-ink-2 w-12 shrink-0">{'\u901F\u5EA6'}</label>
            <input
              type="range"
              min={100}
              max={1500}
              step={100}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="flex-1 h-1.5 appearance-none bg-border rounded-full outline-none cursor-pointer accent-blue"
            />
            <span className="text-[11px] font-mono text-ink-2 w-12 text-right">
              {(speed / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Editable kernel */}
      {activePreset === 'custom' && (
        <div className="border-t border-border px-4 py-3">
          <div className="text-[11px] font-medium text-ink-3 mb-2 uppercase tracking-wider">
            {'\u81EA\u5B9A\u4E49\u5377\u79EF\u6838'}
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-w-[180px]">
            {kernel.map((row, r) =>
              row.map((val, c) => (
                <input
                  key={`${r}-${c}`}
                  type="number"
                  step="any"
                  value={val}
                  onChange={(e) => handleKernelEdit(r, c, e.target.value)}
                  className="w-full text-center text-[12px] font-mono border border-border rounded-md px-1 py-1.5 bg-bg text-ink focus:border-blue focus:outline-none transition-colors"
                />
              )),
            )}
          </div>
        </div>
      )}

      {/* Info panel */}
      <div className="grid grid-cols-4 gap-px bg-border border-t border-border">
        {infoItems.map((item) => (
          <div key={item.label} className="bg-surface px-3 py-2.5 text-center">
            <div className="text-[10px] font-medium text-ink-3 uppercase tracking-wider mb-0.5">
              {item.label}
            </div>
            <div className="text-[13px] font-mono font-medium text-ink">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
