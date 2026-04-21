export interface ImpactStat {
  icon: string;
  value: string;
  label: string;
  tone?: "sage" | "tomato" | "honey" | "navy";
}

export function ImpactStats({ stats }: { stats: ImpactStat[] }) {
  return (
    <section className="impact-bar fade-up" aria-label="Household impact stats">
      {stats.map((stat) => (
        <div className="impact-item" key={stat.label}>
          <div className={`impact-item-icon ${stat.tone ?? "sage"}`} aria-hidden>
            {stat.icon}
          </div>
          <div>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
