const ITEMS = [
  {
    quote:
      "I used to throw away half a bag of spinach every week. Four months in, my ‘expired’ column is basically empty.",
    name: "Priya S.",
    role: "household of 4 · Brooklyn",
    initials: "PS",
    tone: "sage" as const
  },
  {
    quote:
      "The receipt scan is witchcraft. I photograph the Whole Foods tape and my whole fridge is on StillGood before I unload the car.",
    name: "Marcus T.",
    role: "roommate situation · Austin",
    initials: "MT",
    tone: "tomato" as const
  },
  {
    quote:
      "Finally a food app that doesn’t try to sell me a meal kit. It just… tells me the yogurt is about to turn, and I use it up.",
    name: "Elena R.",
    role: "solo cook · Lisbon",
    initials: "ER",
    tone: "honey" as const
  }
];

export function Testimonials() {
  return (
    <section>
      <div className="testimonial-section-head">
        <span className="section-eyebrow">Loved by home cooks</span>
        <h2 className="display-heading">
          People who <em>actually</em> finish their leftovers
        </h2>
      </div>

      <div className="testimonial-grid">
        {ITEMS.map((t) => (
          <article className="testimonial-card" key={t.name}>
            <div className="testimonial-stars" aria-hidden>★★★★★</div>
            <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
            <div className="testimonial-attrib">
              <div className={`testimonial-avatar ${t.tone}`} aria-hidden>
                {t.initials}
              </div>
              <div>
                <span className="testimonial-name">{t.name}</span>
                <span className="testimonial-role">{t.role}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
