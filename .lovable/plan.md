
## Randomness & Statistics Simulator

A single-page simulator that rolls random integers from 1–1000 and visualizes the frequency distribution live as a responsive bar graph, with full stats and modern dark-neon styling.

### Core simulation
- Random integer 1–1000 generated each tick using `Math.random()`.
- Frequency stored in a `Uint32Array(1000)` for fast updates.
- **Speed slider**: controls rolls per second, ranging from **1/sec** up to **100,000/sec** (logarithmic scale). High speeds batch rolls per animation frame; low speeds use timed intervals.
- **Start / Pause** toggle button. **Reset** button clears all data.

### Bar graph
- Custom `<canvas>` renderer (1000 bars on a DOM-based chart would lag) drawn each animation frame.
- X-axis: numbers 1–1000 with tick labels every 100.
- Y-axis: count, **auto-rescales** so the tallest bar always fits — axis labels animate smoothly when the max grows.
- Bars filled with a vertical neon gradient (cyan → magenta), subtle glow on the tallest bar.
- Fully responsive: canvas resizes with container, supports HiDPI.
- **Hover tooltip**: shows `Number · Count · % of total · Deviation from expected`. Crosshair line follows the cursor.

### Stats panel (live, sampled ~10×/sec for performance)
- Total rolls (large hero number with animated count-up)
- Mean count per number
- Standard deviation of counts
- Expected count per number (total / 1000) with current chi-square-style deviation indicator
- Most frequent number (value + count)
- Least frequent number (value + count)
- Rolls per second (live throughput)

### UI / Visual style — Dark + neon gradient
- Background: deep near-black (`oklch(0.15 0.02 270)`) with subtle radial gradient glow.
- Accent gradient: cyan `oklch(0.78 0.15 200)` → magenta `oklch(0.65 0.25 330)` reused across bars, primary buttons, and stat highlights.
- Frosted/translucent stat cards with soft border glow, rounded-2xl.
- Inter (or system sans) for body, tabular numerals for all stat values to prevent layout shift.
- Smooth micro-animations on button states and stat updates.
- Mobile-responsive: stats stack above the graph on narrow viewports; controls stay reachable.

### Layout
1. Header: title "Randomness Simulator" with gradient text + short subtitle.
2. Controls row: Start/Pause, Reset, speed slider (with live "X rolls/sec" label).
3. Stats grid (2–4 columns responsive).
4. Bar graph filling remaining width, fixed aspect ratio on desktop, taller on mobile.

### Tech notes
- Single route: `src/routes/index.tsx` (replaces the placeholder).
- Canvas drawing in a `useEffect` with `requestAnimationFrame`; simulation state in refs to avoid React re-renders on every roll.
- Stats panel re-renders via a throttled `setState` (~10 Hz).
- No backend needed — pure client-side.
