import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: SimulatorPage,
});

const N = 1000; // numbers 1..1000

// Logarithmic speed slider: 0 -> 1 rps, 1 -> 100000 rps
const MIN_RPS = 1;
const MAX_RPS = 100_000;
function sliderToRps(t: number) {
  // t in [0,1]
  const min = Math.log(MIN_RPS);
  const max = Math.log(MAX_RPS);
  return Math.round(Math.exp(min + (max - min) * t));
}
function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

interface Stats {
  total: number;
  mean: number;
  std: number;
  expected: number;
  chi: number;
  most: { value: number; count: number };
  least: { value: number; count: number };
  rps: number;
}

function computeStats(counts: Uint32Array, total: number, rps: number): Stats {
  const expected = total / N;
  let mostIdx = 0;
  let leastIdx = 0;
  let mostC = -Infinity;
  let leastC = Infinity;
  let sumSq = 0;
  let chi = 0;
  for (let i = 0; i < N; i++) {
    const c = counts[i];
    if (c > mostC) {
      mostC = c;
      mostIdx = i;
    }
    if (c < leastC) {
      leastC = c;
      leastIdx = i;
    }
    const d = c - expected;
    sumSq += d * d;
    if (expected > 0) chi += (d * d) / expected;
  }
  const variance = sumSq / N;
  return {
    total,
    mean: expected,
    std: Math.sqrt(variance),
    expected,
    chi,
    most: { value: mostIdx + 1, count: mostC === -Infinity ? 0 : mostC },
    least: { value: leastIdx + 1, count: leastC === Infinity ? 0 : leastC },
    rps,
  };
}

function SimulatorPage() {
  // Refs for hot simulation state (no React re-renders per roll)
  const countsRef = useRef<Uint32Array>(new Uint32Array(N));
  const totalRef = useRef(0);
  const runningRef = useRef(false);
  const rpsTargetRef = useRef(1000);
  const lastTickRef = useRef<number>(0);
  const carryRef = useRef(0); // fractional rolls accumulator
  const rollsThisSecondRef = useRef(0);
  const measuredRpsRef = useRef(0);
  const lastSecondMarkRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  // React state (low-frequency UI)
  const [running, setRunning] = useState(false);
  const [sliderT, setSliderT] = useState(0.5); // ~316 rps
  const [stats, setStats] = useState<Stats>(() =>
    computeStats(new Uint32Array(N), 0, 0),
  );
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    bucket: number;
    count: number;
  } | null>(null);

  // Keep target rps ref in sync
  useEffect(() => {
    rpsTargetRef.current = sliderToRps(sliderT);
  }, [sliderT]);

  const performRolls = useCallback((n: number) => {
    if (n <= 0) return;
    const counts = countsRef.current;
    for (let i = 0; i < n; i++) {
      const v = (Math.random() * N) | 0; // 0..999
      counts[v]++;
    }
    totalRef.current += n;
    rollsThisSecondRef.current += n;
  }, []);

  // Main loop: rAF, simulation + drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = container.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let lastStatsUpdate = 0;
    let smoothedMax = 1;

    const draw = (now: number) => {
      // --- simulation step ---
      if (runningRef.current) {
        if (lastTickRef.current === 0) lastTickRef.current = now;
        const dt = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        const target = rpsTargetRef.current;
        const want = target * dt + carryRef.current;
        const doNow = Math.floor(want);
        carryRef.current = want - doNow;
        if (doNow > 0) performRolls(doNow);
      } else {
        lastTickRef.current = now;
      }

      // measured rps
      if (lastSecondMarkRef.current === 0) lastSecondMarkRef.current = now;
      if (now - lastSecondMarkRef.current >= 1000) {
        const elapsed = (now - lastSecondMarkRef.current) / 1000;
        measuredRpsRef.current = rollsThisSecondRef.current / elapsed;
        rollsThisSecondRef.current = 0;
        lastSecondMarkRef.current = now;
      }

      // --- draw ---
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // background subtle gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(255,255,255,0.02)");
      bg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // chart area
      const padL = 48;
      const padR = 12;
      const padT = 12;
      const padB = 28;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const counts = countsRef.current;
      let curMax = 1;
      for (let i = 0; i < N; i++) {
        if (counts[i] > curMax) curMax = counts[i];
      }
      // smooth axis growth
      smoothedMax += (curMax - smoothedMax) * 0.15;
      const yMax = Math.max(1, smoothedMax);

      // grid lines + y labels
      ctx.font =
        "11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      const gridLines = 5;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let g = 0; g <= gridLines; g++) {
        const y = padT + (chartH * g) / gridLines;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartW, y);
        ctx.stroke();
        const value = yMax * (1 - g / gridLines);
        ctx.fillText(formatNumber(Math.round(value)), padL - 6, y);
      }

      // bars
      const barW = chartW / N;
      const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad.addColorStop(0, "rgba(255, 92, 200, 0.95)"); // magenta top
      grad.addColorStop(1, "rgba(80, 220, 255, 0.95)"); // cyan bottom
      ctx.fillStyle = grad;

      let maxIdx = 0;
      for (let i = 0; i < N; i++) {
        const c = counts[i];
        if (c > counts[maxIdx]) maxIdx = i;
        if (c === 0) continue;
        const bh = (c / yMax) * chartH;
        const x = padL + i * barW;
        const y = padT + chartH - bh;
        ctx.fillRect(x, y, Math.max(1, barW - 0.3), bh);
      }

      // glow on tallest bar
      if (counts[maxIdx] > 0) {
        const bh = (counts[maxIdx] / yMax) * chartH;
        const x = padL + maxIdx * barW;
        const y = padT + chartH - bh;
        ctx.save();
        ctx.shadowColor = "rgba(255, 120, 220, 0.9)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "rgba(255, 180, 240, 1)";
        ctx.fillRect(x, y, Math.max(1.5, barW - 0.3), bh);
        ctx.restore();
      }

      // x axis labels (every 100)
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let v = 0; v <= 1000; v += 100) {
        const x = padL + ((v === 0 ? 0 : v - 1) / N) * chartW;
        const xClamp = Math.min(padL + chartW, Math.max(padL, x));
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.moveTo(xClamp, padT + chartH);
        ctx.lineTo(xClamp, padT + chartH + 4);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(String(v === 0 ? 1 : v), xClamp, padT + chartH + 6);
      }

      // hover crosshair + tooltip data
      const hover = hoverRef.current;
      let tooltip: typeof hoverInfo = null;
      if (
        hover &&
        hover.x >= padL &&
        hover.x <= padL + chartW &&
        hover.y >= padT &&
        hover.y <= padT + chartH
      ) {
        const idx = Math.min(
          N - 1,
          Math.max(0, Math.floor(((hover.x - padL) / chartW) * N)),
        );
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hover.x, padT);
        ctx.lineTo(hover.x, padT + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // highlight the hovered bar
        const c = counts[idx];
        if (c > 0) {
          const bh = (c / yMax) * chartH;
          const bx = padL + idx * barW;
          const by = padT + chartH - bh;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(bx, by, Math.max(1.5, barW - 0.3), bh);
        }
        tooltip = { x: hover.x, y: hover.y, bucket: idx + 1, count: c };
      }

      // throttled stats / tooltip state updates (~10Hz)
      if (now - lastStatsUpdate > 100) {
        lastStatsUpdate = now;
        setStats(
          computeStats(
            countsRef.current,
            totalRef.current,
            measuredRpsRef.current,
          ),
        );
        setHoverInfo(tooltip);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [performRolls]);

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    hoverRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };
  const onMouseLeave = () => {
    hoverRef.current = null;
    setHoverInfo(null);
  };

  const toggleRunning = () => {
    runningRef.current = !runningRef.current;
    lastTickRef.current = 0;
    carryRef.current = 0;
    setRunning(runningRef.current);
  };

  const reset = () => {
    countsRef.current = new Uint32Array(N);
    totalRef.current = 0;
    rollsThisSecondRef.current = 0;
    measuredRpsRef.current = 0;
    setStats(computeStats(countsRef.current, 0, 0));
  };

  const targetRps = sliderToRps(sliderT);
  const pct = stats.total > 0 ? (hoverInfo ? (hoverInfo.count / stats.total) * 100 : 0) : 0;
  const dev = hoverInfo ? hoverInfo.count - stats.expected : 0;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="bg-[var(--gradient-neon)] bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
              Randomness Simulator
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Roll integers from 1 to 1000 and watch the distribution unfold in real time.
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2 text-sm font-semibold text-secondary-foreground transition-all hover:bg-secondary active:scale-95"
                aria-label="About this page"
              >
                <Info className="h-4 w-4" />
                About
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>About this page</DialogTitle>
                <DialogDescription>
                  A live randomness &amp; statistics playground.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This simulator rolls random integers from 1 to 1000 using JavaScript&apos;s
                  built-in <code>Math.random()</code> and visualizes the frequency
                  distribution in real time, together with full statistics
                  (mean, standard deviation, χ², most/least frequent number).
                </p>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Where calculations happen</h3>
                  <p>
                    Everything runs <strong>100% in your browser</strong>. There is no
                    backend, no server-side processing, and no database. The page is
                    static — your device does all the rolling and drawing.
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Privacy &amp; anonymity</h3>
                  <p>
                    No accounts, no logins, no cookies set by this app. No roll data,
                    settings or personal information ever leave your device. The site
                    is fully anonymous to use — the operator cannot see what you do here.
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">Disclaimers</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <code>Math.random()</code> is a pseudo-random generator. It is
                      <strong> not cryptographically secure</strong> and must not be
                      used for security, gambling, lotteries, or anything where
                      unpredictability matters.
                    </li>
                    <li>
                      This page is for educational and entertainment purposes only.
                      Statistics shown are computed from your current session and are
                      not guarantees about any real-world process.
                    </li>
                    <li>
                      Provided “as is”, without warranty of any kind. Use at your own risk.
                    </li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        {/* Controls */}
        <section className="mb-6 rounded-2xl border border-border/60 bg-card/50 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex gap-2">
              <button
                onClick={toggleRunning}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[var(--gradient-neon)] px-5 py-2.5 text-sm font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] shadow-[var(--shadow-neon)] transition-all hover:scale-[1.03] active:scale-95"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? "Pause" : "Start"}
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-all hover:bg-secondary active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="flex-1">
              <div className="mb-1.5 flex items-baseline justify-between">
                <label
                  htmlFor="speed"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Speed
                </label>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {formatNumber(targetRps)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    rolls/sec
                  </span>
                </span>
              </div>
              <input
                id="speed"
                type="range"
                min={0}
                max={1000}
                value={Math.round(sliderT * 1000)}
                onChange={(e) => setSliderT(Number(e.target.value) / 1000)}
                className="neon-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/80"
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <StatCard label="Total rolls" value={formatNumber(stats.total)} highlight />
          <StatCard label="Rolls / sec" value={formatNumber(Math.round(stats.rps))} />
          <StatCard
            label="Expected per #"
            value={stats.expected.toFixed(2)}
            sub="total ÷ 1000"
          />
          <StatCard
            label="Std deviation"
            value={stats.std.toFixed(2)}
            sub={`χ² ≈ ${stats.chi.toFixed(1)}`}
          />
          <StatCard
            label="Most frequent"
            value={`#${stats.most.value}`}
            sub={`${formatNumber(stats.most.count)} rolls`}
          />
          <StatCard
            label="Least frequent"
            value={`#${stats.least.value}`}
            sub={`${formatNumber(stats.least.count)} rolls`}
          />
          <StatCard label="Mean count" value={stats.mean.toFixed(2)} />
          <StatCard
            label="Status"
            value={running ? "Rolling" : "Paused"}
            sub={running ? "live" : "press start"}
          />
        </section>

        {/* Chart */}
        <section
          ref={containerRef}
          className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-2 shadow-[var(--shadow-card)] backdrop-blur-xl sm:h-[440px] lg:h-[520px]"
        >
          <canvas
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="block h-full w-full"
          />
          {hoverInfo && (
            <div
              className="pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 -translate-y-full rounded-xl border border-border/80 bg-popover/95 px-3 py-2 text-xs shadow-[var(--shadow-card)] backdrop-blur-md"
              style={{
                left: Math.max(80, Math.min(hoverInfo.x, (containerRef.current?.clientWidth ?? 600) - 80)),
                top: Math.max(40, hoverInfo.y - 8),
              }}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">#{hoverInfo.bucket}</span>
                <span className="tabular-nums text-foreground">
                  {formatNumber(hoverInfo.count)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>Share</span>
                <span className="tabular-nums">{pct.toFixed(3)}%</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>Δ expected</span>
                <span
                  className={`tabular-nums ${
                    dev > 0 ? "text-[var(--neon-cyan)]" : dev < 0 ? "text-[var(--neon-magenta)]" : ""
                  }`}
                >
                  {dev > 0 ? "+" : ""}
                  {dev.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-6 space-y-1 text-center text-xs text-muted-foreground">
          <div>
            Pure client-side simulation using <code>Math.random()</code>. Drawn at 60fps.
          </div>
          <div>
            Vibecoded by{" "}
            <a
              href="https://github.com/Martin8O"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Martin
            </a>{" "}
            with Lovable
          </div>
        </footer>
      </div>

      <style>{`
        .neon-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: var(--gradient-neon);
          box-shadow: 0 0 12px color-mix(in oklab, var(--neon-magenta) 60%, transparent);
          cursor: pointer;
          border: 2px solid oklch(0.97 0.01 250);
        }
        .neon-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: var(--gradient-neon);
          box-shadow: 0 0 12px color-mix(in oklab, var(--neon-magenta) 60%, transparent);
          cursor: pointer;
          border: 2px solid oklch(0.97 0.01 250);
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl transition-all ${
        highlight ? "ring-1 ring-[color-mix(in_oklab,var(--neon-cyan)_50%,transparent)]" : ""
      }`}
    >
      {highlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-neon-soft)" }}
        />
      )}
      <div className="relative">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 tabular-nums font-bold leading-tight text-foreground ${
            highlight ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{sub}</div>
        )}
      </div>
    </div>
  );
}
