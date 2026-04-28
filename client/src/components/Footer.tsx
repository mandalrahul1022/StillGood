import { FormEvent, useState } from "react";
import { StillGoodLogo } from "./StillGoodLogo";

function IconInstagram() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconTwitter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.53 3H20.5l-6.48 7.41L22 21h-5.86l-4.59-6-5.25 6H3.3l6.93-7.93L3 3h6l4.15 5.49L17.53 3Zm-1.03 16.2h1.63L7.58 4.7H5.83L16.5 19.2Z" />
    </svg>
  );
}

function IconGithub() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.87 10.94c.58.11.8-.25.8-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.17A11 11 0 0 1 12 5.8c.98 0 1.97.13 2.89.39 2.2-1.48 3.17-1.17 3.17-1.17.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.08 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.81.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <div className="footer-brand-row">
            <StillGoodLogo className="footer-logo" />
            <span className="footer-brand-name">StillGood</span>
          </div>
          <p>
            We&rsquo;re on a mission to halve household food waste by 2030 —
            one fridge, one leftover, one thoughtful cook at a time. Made with
            care for the planet and the people feeding it.
          </p>
          <div className="footer-socials">
            <a className="footer-social-btn" href="#" aria-label="Instagram"><IconInstagram /></a>
            <a className="footer-social-btn" href="#" aria-label="Twitter"><IconTwitter /></a>
            <a className="footer-social-btn" href="#" aria-label="GitHub"><IconGithub /></a>
            <a className="footer-social-btn" href="mailto:hello@stillgood.app" aria-label="Email"><IconMail /></a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><a href="/">Dashboard</a></li>
            <li><a href="/add-item">Add item</a></li>
            <li><a href="/scan-receipt">Receipt scan</a></li>
            <li><a href="/analytics">Analytics</a></li>
            <li><a href="/integrations">Integrations</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Kitchen</h4>
          <ul>
            <li><a href="#">Freshness guide</a></li>
            <li><a href="#">Recipe library</a></li>
            <li><a href="#">Storage tips</a></li>
            <li><a href="#">Meal planner</a></li>
            <li><a href="#">Household sharing</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Stay fresh</h4>
          <ul>
            <li><a href="#">Weekly newsletter</a></li>
            <li><a href="#">Blog</a></li>
            <li><a href="#">Support</a></li>
            <li><a href="#">Privacy</a></li>
          </ul>
          <form className="footer-newsletter-row" onSubmit={handleSubscribe}>
            <input
              type="email"
              placeholder={subscribed ? "You're in — welcome!" : "you@kitchen.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for newsletter"
              disabled={subscribed}
            />
            <button type="submit" className="footer-newsletter-btn" disabled={subscribed}>
              {subscribed ? "✓" : "Subscribe"}
            </button>
          </form>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} StillGood — Make food, not waste.</span>
        <span className="footer-badge">
          <span className="dot" />
          All systems fresh
        </span>
      </div>
    </footer>
  );
}
