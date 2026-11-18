/** Pure SVG builders for the surprise plot (no DOM needed, so they are testable). */

export interface PlotOptions {
  width?: number;
  height?: number;
  /** Y-axis upper bound in nats; defaults to max(ln(vocab), observed max). */
  yMax?: number;
}

/** Points for the polyline, in SVG pixel coordinates. */
export function plotPoints(
  values: readonly number[],
  { width = 600, height = 160, yMax }: PlotOptions = {},
): [number, number][] {
  const top = yMax ?? Math.max(...values, 1e-6);
  const pad = 4;
  const n = values.length;
  return values.map((v, i) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad);
    const clamped = Math.min(Math.max(v, 0), top);
    const y = height - pad - (clamped / top) * (height - 2 * pad);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  });
}

/** SVG inner markup: reference line at uniform-guess surprise, plus the curve. */
export function surpriseSvg(
  values: readonly number[],
  vocab: number,
  opts: PlotOptions = {},
): string {
  const width = opts.width ?? 600;
  const height = opts.height ?? 160;
  const uniform = Math.log(vocab);
  const yMax = opts.yMax ?? Math.max(uniform, ...values) * 1.05;
  const [[, refY]] = plotPoints([uniform], { width, height, yMax });
  const ref = `<line x1="0" x2="${width}" y1="${refY}" y2="${refY}" stroke="currentColor" stroke-dasharray="4 4" opacity=".4"/>`;
  if (values.length === 0) return ref;
  const pts = plotPoints(values, { width, height, yMax })
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return `${ref}<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
}

/** Text summary for screen readers. */
export function describeSurprise(values: readonly number[], vocab: number): string {
  if (values.length === 0) return "No surprise recorded yet.";
  const last = values[values.length - 1];
  return `${values.length} notes so far. Latest surprise ${last.toFixed(2)} nats; a uniform guess would be ${Math.log(vocab).toFixed(2)}.`;
}
