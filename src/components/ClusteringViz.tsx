import { useRef, useState, useCallback, useEffect } from 'react';

/* ─── 常量 ─── */
const CLUSTER_COLORS = ['#0071e3', '#ff9500', '#34c759', '#af52de', '#ff3b30', '#5ac8fa', '#ffcc00', '#ff2d55'];
const CANVAS_BG = '#fafafa';
const GRID_COLOR = '#e5e5ea';
const AXIS_COLOR = '#d2d2d7';
const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
const DATA_RANGE = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
const ELBOW_PAD = { top: 16, right: 12, bottom: 28, left: 36 };

/* ─── 类型 ─── */
interface Point {
  x: number;
  y: number;
  cluster: number;
}

interface Centroid {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

interface KMeansState {
  points: Point[];
  centroids: Centroid[];
  iteration: number;
  converged: boolean;
  inertia: number;
}

/* ─── 数据生成 ─── */
function generateClusterData(seed = 42): Point[] {
  const rng = mulberry32(seed);
  const centers = [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 50, y: 75 },
    { x: 20, y: 70 },
  ];
  const points: Point[] = [];
  const counts = [18, 20, 22, 18]; // ~78 points total

  for (let c = 0; c < centers.length; c++) {
    for (let i = 0; i < counts[c]; i++) {
      points.push({
        x: clamp(centers[c].x + gaussRand(rng) * 12, DATA_RANGE.xMin, DATA_RANGE.xMax),
        y: clamp(centers[c].y + gaussRand(rng) * 12, DATA_RANGE.yMin, DATA_RANGE.yMax),
        cluster: -1,
      });
    }
  }

  return points;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussRand(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ─── K-Means 算法 ─── */
function initCentroids(points: Point[], k: number, seed = 42): Centroid[] {
  const rng = mulberry32(seed + 1000);
  // K-Means++ 初始化
  const centroids: Centroid[] = [];
  const idx = Math.floor(rng() * points.length);
  centroids.push({ x: points[idx].x, y: points[idx].y, prevX: points[idx].x, prevY: points[idx].y });

  for (let c = 1; c < k; c++) {
    const dists = points.map((p) => {
      let minD = Infinity;
      for (const cent of centroids) {
        const d = (p.x - cent.x) ** 2 + (p.y - cent.y) ** 2;
        if (d < minD) minD = d;
      }
      return minD;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = rng() * totalDist;
    let chosen = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push({
      x: points[chosen].x,
      y: points[chosen].y,
      prevX: points[chosen].x,
      prevY: points[chosen].y,
    });
  }

  return centroids;
}

function assignClusters(points: Point[], centroids: Centroid[]): Point[] {
  return points.map((p) => {
    let minDist = Infinity;
    let bestCluster = 0;
    for (let c = 0; c < centroids.length; c++) {
      const d = (p.x - centroids[c].x) ** 2 + (p.y - centroids[c].y) ** 2;
      if (d < minDist) {
        minDist = d;
        bestCluster = c;
      }
    }
    return { ...p, cluster: bestCluster };
  });
}

function updateCentroids(points: Point[], centroids: Centroid[]): Centroid[] {
  return centroids.map((cent, c) => {
    const members = points.filter((p) => p.cluster === c);
    if (members.length === 0) return cent;
    const newX = members.reduce((s, p) => s + p.x, 0) / members.length;
    const newY = members.reduce((s, p) => s + p.y, 0) / members.length;
    return { x: newX, y: newY, prevX: cent.x, prevY: cent.y };
  });
}

function computeInertia(points: Point[], centroids: Centroid[]): number {
  return points.reduce((sum, p) => {
    const c = centroids[p.cluster];
    if (!c) return sum;
    return sum + (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
  }, 0);
}

function hasConverged(centroids: Centroid[], threshold = 0.01): boolean {
  return centroids.every(
    (c) => (c.x - c.prevX) ** 2 + (c.y - c.prevY) ** 2 < threshold,
  );
}

/* ─── 肘部法则计算 ─── */
function computeElbowData(points: Point[]): number[] {
  const inertias: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const centroids = initCentroids(points, k);
    let pts = assignClusters(points, centroids);
    let cents = updateCentroids(pts, centroids);
    for (let i = 0; i < 50; i++) {
      pts = assignClusters(pts, cents);
      cents = updateCentroids(pts, cents);
      if (hasConverged(cents)) break;
    }
    inertias.push(computeInertia(pts, cents));
  }
  return inertias;
}

function findElbowK(inertias: number[]): number {
  if (inertias.length < 3) return 2;
  let maxAngle = 0;
  let elbowK = 2;
  for (let i = 1; i < inertias.length - 1; i++) {
    const v1x = i - 0;
    const v1y = inertias[i] - inertias[0];
    const v2x = inertias.length - 1 - i;
    const v2y = inertias[inertias.length - 1] - inertias[i];
    const dot = v1x * v2x + v1y * v2y;
    const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (m1 === 0 || m2 === 0) continue;
    const cos = dot / (m1 * m2);
    const angle = Math.acos(clamp(cos, -1, 1));
    if (angle > maxAngle) {
      maxAngle = angle;
      elbowK = i + 1; // K = index + 1
    }
  }
  return elbowK;
}

/* ─── 坐标转换 ─── */
function dataToCanvas(
  dx: number,
  dy: number,
  w: number,
  h: number,
  pad: typeof PAD,
  range: typeof DATA_RANGE,
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const cx = pad.left + ((dx - range.xMin) / (range.xMax - range.xMin)) * plotW;
  const cy = pad.top + ((range.yMax - dy) / (range.yMax - range.yMin)) * plotH;
  return [cx, cy];
}

function canvasToData(
  cx: number,
  cy: number,
  w: number,
  h: number,
  pad: typeof PAD,
  range: typeof DATA_RANGE,
) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const dx = range.xMin + ((cx - pad.left) / plotW) * (range.xMax - range.xMin);
  const dy = range.yMax - ((cy - pad.top) / plotH) * (range.yMax - range.yMin);
  return [dx, dy];
}

/* ─── 主组件 ─── */
export default function ClusteringViz() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const elbowCanvasRef = useRef<HTMLCanvasElement>(null);
  const elbowContainerRef = useRef<HTMLDivElement>(null);

  const [k, setK] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1=normal, 2=fast, 0.5=slow
  const [points, setPoints] = useState<Point[]>(() => generateClusterData());
  const [centroids, setCentroids] = useState<Centroid[]>(() => initCentroids(generateClusterData(), 3));
  const [iteration, setIteration] = useState(0);
  const [converged, setConverged] = useState(false);
  const [inertia, setInertia] = useState(0);
  const [elbowData, setElbowData] = useState<number[]>(() => computeElbowData(generateClusterData()));
  const [elbowK, setElbowK] = useState(2);
  const [animStep, setAnimStep] = useState<'idle' | 'assign' | 'update'>('idle');

  // Refs for animation loop access to latest state
  const stateRef = useRef({ points, centroids, iteration, converged, k, playing, speed, animStep });
  stateRef.current = { points, centroids, iteration, converged, k, playing, speed, animStep };

  /* ─── 初始化 / 重置 ─── */
  const reset = useCallback(
    (newK?: number) => {
      const currentK = newK ?? k;
      const pts = points.map((p) => ({ ...p, cluster: -1 }));
      const cents = initCentroids(pts, currentK);
      setCentroids(cents);
      setPoints(pts);
      setIteration(0);
      setConverged(false);
      setInertia(0);
      setPlaying(false);
      setAnimStep('idle');
    },
    [k, points],
  );

  // 重新计算肘部数据当 points 变化时
  useEffect(() => {
    const data = computeElbowData(points);
    setElbowData(data);
    setElbowK(findElbowK(data));
  }, [points]);

  /* ─── K-Means 动画步进 ─── */
  const stepOnce = useCallback(() => {
    const { points: curPts, centroids: curCents, iteration: curIter } = stateRef.current;
    if (stateRef.current.converged) return;

    const assigned = assignClusters(curPts, curCents);
    setPoints(assigned);
    setAnimStep('assign');

    setTimeout(() => {
      const newCents = updateCentroids(assigned, curCents);
      const conv = hasConverged(newCents);
      const newInertia = computeInertia(assigned, newCents);

      setCentroids(newCents);
      setIteration(curIter + 1);
      setConverged(conv);
      setInertia(newInertia);
      setAnimStep('update');

      if (conv) {
        setPlaying(false);
      }
    }, 300 / stateRef.current.speed);
  }, []);

  /* ─── 播放循环 ─── */
  useEffect(() => {
    if (!playing || converged) return;

    const delay = 800 / speed;
    const timer = setTimeout(() => {
      stepOnce();
    }, delay);

    return () => clearTimeout(timer);
  }, [playing, converged, iteration, speed, stepOnce]);

  /* ─── 主散点图绘制 ─── */
  const drawMain = useCallback(
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
      for (let x = 0; x <= 100; x += 20) {
        const [cx] = dataToCanvas(x, 0, w, h, PAD, DATA_RANGE);
        ctx.beginPath();
        ctx.moveTo(cx, PAD.top);
        ctx.lineTo(cx, PAD.top + plotH);
        ctx.stroke();
      }
      for (let y = 0; y <= 100; y += 20) {
        const [, cy] = dataToCanvas(0, y, w, h, PAD, DATA_RANGE);
        ctx.beginPath();
        ctx.moveTo(PAD.left, cy);
        ctx.lineTo(PAD.left + plotW, cy);
        ctx.stroke();
      }

      /* 绘制数据点 */
      for (const p of points) {
        const [cx, cy] = dataToCanvas(p.x, p.y, w, h, PAD, DATA_RANGE);
        const color = p.cluster >= 0 ? CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length] : '#aeaeb2';

        // 外圈光晕
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = color + '18';
        ctx.fill();

        // 数据点
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 白色内圈
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      }

      /* 绘制质心 */
      for (let c = 0; c < centroids.length; c++) {
        const cent = centroids[c];
        const [cx, cy] = dataToCanvas(cent.x, cent.y, w, h, PAD, DATA_RANGE);
        const color = CLUSTER_COLORS[c % CLUSTER_COLORS.length];

        // 质心移动轨迹
        if (iteration > 0 && (cent.x !== cent.prevX || cent.y !== cent.prevY)) {
          const [px, py] = dataToCanvas(cent.prevX, cent.prevY, w, h, PAD, DATA_RANGE);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx, cy);
          ctx.strokeStyle = color + '40';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 外圈
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = color + '20';
        ctx.fill();

        // 质心主体
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#1d1d1f';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 内圈
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      /* 收敛提示 */
      if (converged) {
        ctx.fillStyle = 'rgba(52, 199, 89, 0.12)';
        const badgeW = 100;
        const badgeH = 28;
        const bx = w - PAD.right - badgeW - 8;
        const by = PAD.top + 8;
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 14);
        ctx.fill();

        ctx.fillStyle = '#34c759';
        ctx.font = '600 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('已收敛', bx + badgeW / 2, by + badgeH / 2);
      }

      /* 迭代次数 */
      ctx.fillStyle = '#aeaeb2';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`迭代 #${iteration}`, PAD.left + 4, PAD.top + 6);

      ctx.restore();
    },
    [points, centroids, iteration, converged],
  );

  /* ─── 肘部法则图绘制 ─── */
  const drawElbow = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      const plotW = w - ELBOW_PAD.left - ELBOW_PAD.right;
      const plotH = h - ELBOW_PAD.top - ELBOW_PAD.bottom;

      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      /* 背景 */
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, w, h);

      if (elbowData.length === 0) {
        ctx.restore();
        return;
      }

      const maxInertia = Math.max(...elbowData) * 1.05;
      const minInertia = 0;

      const kToX = (kVal: number) => ELBOW_PAD.left + ((kVal - 1) / 7) * plotW;
      const inertiaToY = (val: number) => ELBOW_PAD.top + ((maxInertia - val) / (maxInertia - minInertia)) * plotH;

      /* 网格 */
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      for (let kVal = 1; kVal <= 8; kVal++) {
        const x = kToX(kVal);
        ctx.beginPath();
        ctx.moveTo(x, ELBOW_PAD.top);
        ctx.lineTo(x, ELBOW_PAD.top + plotH);
        ctx.stroke();
      }

      /* 曲线 */
      ctx.beginPath();
      for (let i = 0; i < elbowData.length; i++) {
        const x = kToX(i + 1);
        const y = inertiaToY(elbowData[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#0071e3';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      /* 填充 */
      ctx.lineTo(kToX(8), inertiaToY(minInertia));
      ctx.lineTo(kToX(1), inertiaToY(minInertia));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, ELBOW_PAD.top, 0, ELBOW_PAD.top + plotH);
      grad.addColorStop(0, 'rgba(0, 113, 227, 0.08)');
      grad.addColorStop(1, 'rgba(0, 113, 227, 0.01)');
      ctx.fillStyle = grad;
      ctx.fill();

      /* 数据点 */
      for (let i = 0; i < elbowData.length; i++) {
        const x = kToX(i + 1);
        const y = inertiaToY(elbowData[i]);
        const isCurrent = i + 1 === k;
        const isElbow = i + 1 === elbowK;

        ctx.beginPath();
        ctx.arc(x, y, isCurrent ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? '#ff3b30' : isElbow ? '#ff9500' : '#0071e3';
        ctx.fill();

        if (isCurrent) {
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#ff3b30' + '40';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      /* 肘部标注 */
      if (elbowK >= 1 && elbowK <= 8) {
        const ex = kToX(elbowK);
        const ey = inertiaToY(elbowData[elbowK - 1]);

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(ex, ey + 8);
        ctx.lineTo(ex, ey + 22);
        ctx.strokeStyle = '#ff9500';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ff9500';
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('肘部', ex, ey + 24);
      }

      /* X 轴标签 */
      ctx.fillStyle = '#aeaeb2';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let kVal = 1; kVal <= 8; kVal++) {
        ctx.fillText(String(kVal), kToX(kVal), ELBOW_PAD.top + plotH + 6);
      }

      /* 轴标题 */
      ctx.fillStyle = '#aeaeb2';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('K', ELBOW_PAD.left + plotW / 2, h - 10);

      ctx.restore();
    },
    [elbowData, k, elbowK],
  );

  /* ─── Canvas 尺寸管理 ─── */
  useEffect(() => {
    const container = mainContainerRef.current;
    const canvas = mainCanvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = 340;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) drawMain(ctx, w, h);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [drawMain]);

  useEffect(() => {
    const container = elbowContainerRef.current;
    const canvas = elbowCanvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = 180;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) drawElbow(ctx, w, h);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [drawElbow]);

  /* ─── 重绘（状态变化时） ─── */
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    drawMain(ctx, canvas.width / dpr, canvas.height / dpr);
  }, [drawMain]);

  useEffect(() => {
    const canvas = elbowCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    drawElbow(ctx, canvas.width / dpr, canvas.height / dpr);
  }, [drawElbow]);

  /* ─── 点击 Canvas 添加数据点 ─── */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const plotW = w - PAD.left - PAD.right;
      const plotH = h - PAD.top - PAD.bottom;

      if (
        cx < PAD.left ||
        cx > PAD.left + plotW ||
        cy < PAD.top ||
        cy > PAD.top + plotH
      ) return;

      const [dx, dy] = canvasToData(cx, cy, w, h, PAD, DATA_RANGE);
      const newPoint: Point = {
        x: clamp(dx, DATA_RANGE.xMin, DATA_RANGE.xMax),
        y: clamp(dy, DATA_RANGE.yMin, DATA_RANGE.yMax),
        cluster: -1,
      };

      setPoints((prev) => [...prev, newPoint]);
      // 添加新点后重置算法
      setTimeout(() => {
        setPoints((prev) => {
          const pts = prev.map((p) => ({ ...p, cluster: -1 }));
          const cents = initCentroids(pts, stateRef.current.k);
          setCentroids(cents);
          setIteration(0);
          setConverged(false);
          setInertia(0);
          setPlaying(false);
          setAnimStep('idle');
          return pts;
        });
      }, 0);
    },
    [],
  );

  /* ─── K 值变更 ─── */
  const handleKChange = useCallback(
    (newK: number) => {
      setK(newK);
      const pts = points.map((p) => ({ ...p, cluster: -1 }));
      const cents = initCentroids(pts, newK);
      setCentroids(cents);
      setPoints(pts);
      setIteration(0);
      setConverged(false);
      setInertia(0);
      setPlaying(false);
      setAnimStep('idle');
    },
    [points],
  );

  /* ─── 速度标签 ─── */
  const speedLabel = speed === 0.5 ? '0.5x' : speed === 1 ? '1x' : speed === 2 ? '2x' : `${speed}x`;

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-wrap gap-2">
        {/* K 值选择 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-ink-2 mr-1 shrink-0">K =</span>
          {[2, 3, 4, 5, 6, 7, 8].map((kVal) => (
            <button
              key={kVal}
              onClick={() => handleKChange(kVal)}
              className={`w-7 h-7 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center ${
                k === kVal
                  ? 'bg-blue text-white shadow-sm'
                  : 'bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2'
              }`}
            >
              {kVal}
            </button>
          ))}
        </div>

        {/* 播放控制 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (converged) {
                reset();
                return;
              }
              if (playing) {
                setPlaying(false);
              } else {
                if (iteration === 0 && animStep === 'idle') {
                  // 首次开始
                  setPlaying(true);
                } else {
                  setPlaying(true);
                }
              }
            }}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ${
              playing
                ? 'bg-orange-50 text-orange border border-orange/20'
                : converged
                  ? 'bg-green-50 text-green border border-green/20'
                  : 'bg-blue text-white shadow-sm'
            }`}
          >
            {converged ? '重新开始' : playing ? '暂停' : iteration === 0 ? '播放' : '继续'}
          </button>

          <button
            onClick={() => {
              if (!playing && !converged) stepOnce();
            }}
            disabled={playing || converged}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ${
              playing || converged
                ? 'bg-bg border border-border text-ink-3 cursor-not-allowed'
                : 'bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2'
            }`}
          >
            单步
          </button>

          <button
            onClick={() => reset()}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer bg-bg border border-border text-ink-2 hover:text-ink hover:border-border-2"
          >
            重置
          </button>
        </div>

        {/* 速度控制 */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-2 shrink-0">速度</span>
          <div className="flex items-center gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  speed === s
                    ? 'bg-ink text-white'
                    : 'bg-bg border border-border text-ink-3 hover:text-ink'
                }`}
              >
                {s === 0.5 ? '0.5x' : s === 1 ? '1x' : '2x'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区：散点图 + 肘部法则 */}
      <div className="flex gap-3 px-4 pb-2">
        {/* 散点图 */}
        <div className="flex-1 min-w-0">
          <div ref={mainContainerRef} className="relative">
            <canvas
              ref={mainCanvasRef}
              className="w-full rounded-lg cursor-crosshair"
              style={{ height: 340 }}
              onClick={handleCanvasClick}
            />
          </div>
          <div className="text-[11px] text-ink-3 mt-1.5 text-center">
            点击画布添加数据点
          </div>
        </div>

        {/* 肘部法则图 */}
        <div className="w-[220px] shrink-0">
          <div className="text-[11px] text-ink-2 font-medium mb-1.5">肘部法则 (Elbow Method)</div>
          <div ref={elbowContainerRef} className="relative">
            <canvas
              ref={elbowCanvasRef}
              className="w-full rounded-lg"
              style={{ height: 180 }}
            />
          </div>
          <div className="mt-2 text-[11px] text-ink-3 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span>当前 K = {k}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <span>推荐 K = {elbowK}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部信息面板 */}
      <div className="grid grid-cols-4 border-t border-border">
        {[
          { label: '迭代次数', value: `${iteration}` },
          { label: '簇数 K', value: `${k}` },
          { label: 'Inertia', value: inertia > 0 ? inertia.toFixed(1) : '--' },
          { label: '状态', value: converged ? '已收敛' : playing ? '运行中...' : iteration > 0 ? '已暂停' : '就绪' },
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
