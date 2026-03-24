interface DonutChartProps {
  consumed: number;
  expired: number;
}

export function DonutChart({ consumed, expired }: DonutChartProps) {
  const total = consumed + expired;
  const consumedPct = total === 0 ? 0 : consumed / total;
  const R = 60;
  const CX = 80;
  const CY = 80;
  const circumference = 2 * Math.PI * R;
  const consumedDash = consumedPct * circumference;
  const expiredDash = (1 - consumedPct) * circumference;
  const wasteRate = total === 0 ? 0 : Math.round((expired / total) * 100);

  return (
    <section className="panel donut-panel">
      <h3>Consumed vs Expired</h3>
      <div className="donut-wrap">
        <svg viewBox="0 0 160 160" className="donut-svg" aria-hidden="true">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e8f5ee" strokeWidth="18" />
          {total > 0 && (
            <>
              <circle
                cx={CX} cy={CY} r={R}
                fill="none" stroke="#1f8f57" strokeWidth="18"
                strokeDasharray={`${consumedDash} ${circumference}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${CX} ${CY})`}
              />
              <circle
                cx={CX} cy={CY} r={R}
                fill="none" stroke="#e05c5c" strokeWidth="18"
                strokeDasharray={`${expiredDash} ${circumference}`}
                strokeDashoffset={-consumedDash}
                strokeLinecap="round"
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            </>
          )}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f3d24">
            {wasteRate}%
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize="11" fill="#5a8a70">
            waste rate
          </text>
        </svg>

        <div className="donut-legend">
          <div className="donut-stat">
            <span className="legend-dot consumed" />
            <div>
              <strong>{consumed}</strong>
              <span>Consumed</span>
            </div>
          </div>
          <div className="donut-stat">
            <span className="legend-dot expired" />
            <div>
              <strong>{expired}</strong>
              <span>Expired</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
