interface SeriesPoint {
  date: string;
  consumed: number;
  expired: number;
}

interface LineChartProps {
  series: SeriesPoint[];
  range: "week" | "month";
}

export function LineChart({ series, range }: LineChartProps) {
  const W = 600;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 36, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...series.flatMap((p) => [p.consumed, p.expired]), 1);
  const xStep = series.length > 1 ? chartW / (series.length - 1) : chartW;

  const px = (i: number) => PAD.left + i * xStep;
  const py = (v: number) => PAD.top + chartH - (v / maxVal) * chartH;

  const polyline = (key: "consumed" | "expired") =>
    series.map((p, i) => `${px(i)},${py(p[key])}`).join(" ");

  const area = (key: "consumed" | "expired") => {
    const pts = series.map((p, i) => `${px(i)},${py(p[key])}`).join(" ");
    const last = series.length - 1;
    return `M${px(0)},${py(series[0][key])} L${pts} L${px(last)},${PAD.top + chartH} L${px(0)},${PAD.top + chartH} Z`;
  };

  const labelEvery = range === "month" ? 6 : 1;
  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * maxVal));

  return (
    <section className="panel">
      <div className="analytics-chart-header">
        <h3>Trend over time</h3>
        <div className="analytics-legend">
          <span className="legend-dot consumed" />
          <span>Consumed</span>
          <span className="legend-dot expired" />
          <span>Expired</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="line-chart-svg" aria-hidden="true">
        <defs>
          <linearGradient id="grad-consumed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f8f57" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1f8f57" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-expired" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e05c5c" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#e05c5c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left} y1={py(tick)}
              x2={PAD.left + chartW} y2={py(tick)}
              stroke="rgba(0,0,0,0.07)" strokeWidth="1"
            />
            <text x={PAD.left - 6} y={py(tick)} textAnchor="end" dominantBaseline="middle"
              fontSize="10" fill="#8aaa98">{tick}</text>
          </g>
        ))}

        {/* Areas */}
        <path d={area("consumed")} fill="url(#grad-consumed)" />
        <path d={area("expired")} fill="url(#grad-expired)" />

        {/* Lines */}
        <polyline points={polyline("consumed")} fill="none" stroke="#1f8f57" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={polyline("expired")} fill="none" stroke="#e05c5c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {series.map((p, i) => (
          <g key={i}>
            {p.consumed > 0 && <circle cx={px(i)} cy={py(p.consumed)} r="3.5" fill="#1f8f57" />}
            {p.expired > 0 && <circle cx={px(i)} cy={py(p.expired)} r="3.5" fill="#e05c5c" />}
          </g>
        ))}

        {/* X axis labels */}
        {series.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8aaa98">
              {formatDate(p.date)}
            </text>
          ) : null
        )}
      </svg>
    </section>
  );
}
