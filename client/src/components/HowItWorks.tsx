const STEPS = [
  {
    icon: "🧾",
    title: "Snap your groceries",
    body: "Scan a receipt, forward a Gmail order, or tap items in by hand. We pull in what you bought in seconds."
  },
  {
    icon: "🧠",
    title: "We predict freshness",
    body: "Our freshness engine factors category, opened state, and your overrides to flag what expires when."
  },
  {
    icon: "🔔",
    title: "Use-soon nudges",
    body: "Get a friendly heads-up before food turns. Mark items opened, consumed, or toss — we keep the ledger."
  },
  {
    icon: "🍲",
    title: "Cook, not compost",
    body: "Recipe ideas pop up from your about-to-expire ingredients. Waste less, eat better, save money."
  }
];

export function HowItWorks() {
  return (
    <section className="how-it-works">
      <div className="how-it-works-head">
        <span className="section-eyebrow honey">The StillGood way</span>
        <h2 className="display-heading">
          From fridge to <em>table</em> — not trash
        </h2>
        <p style={{ maxWidth: 520, margin: "8px auto 0" }}>
          Four tiny steps that turn your kitchen into a low-waste operation.
          No apps per household. No judgement. Just fresher food.
        </p>
      </div>

      <div className="how-it-works-grid">
        {STEPS.map((step, i) => (
          <div className="how-it-works-step" key={step.title}>
            <div className="how-it-works-icon" aria-hidden>
              {step.icon}
              <span className="how-it-works-number">{i + 1}</span>
            </div>
            <h4>{step.title}</h4>
            <p>{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
