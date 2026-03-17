import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const steps = [
  {
    eyebrow: "What StillGood does",
    title: "Your kitchen, translated into a live freshness map.",
    body:
      "Add groceries once, and StillGood keeps track of what is fresh, what is getting risky, and what needs attention next.",
    accent: "Track every item with a clear freshness signal instead of guessing from memory."
  },
  {
    eyebrow: "Why it helps",
    title: "The app warns you before food quietly turns into waste.",
    body:
      "Opened items tighten their freshness window, use-soon items rise to the top, and the dashboard shows what to eat first.",
    accent: "You get fast cues, not spreadsheets."
  },
  {
    eyebrow: "What to do next",
    title: "Create a household, add items, then act from one place.",
    body:
      "Start by setting up a household, add what is in the fridge, and use recipes, alerts, and analytics to stay ahead of waste.",
    accent: "The first useful loop is simple: add, review, open, consume."
  }
] as const;

interface OnboardingOverlayProps {
  userId: string;
  householdName: string | null;
}

export function OnboardingOverlay({ userId, householdName }: OnboardingOverlayProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const storageKey = `stillgood:onboarding:${userId}:v1`;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) {
      setOpen(true);
    }
  }, [userId]);

  const dismiss = () => {
    window.localStorage.setItem(`stillgood:onboarding:${userId}:v1`, "seen");
    setOpen(false);
  };

  const activeStep = steps[stepIndex];

  if (!open) {
    return null;
  }

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="onboarding-shell">
        <div className="onboarding-stage">
          <div className="onboarding-copy">
            <span className="onboarding-eyebrow">{activeStep.eyebrow}</span>
            <h2 id="onboarding-title">{activeStep.title}</h2>
            <p>{activeStep.body}</p>
            <p className="onboarding-accent">{activeStep.accent}</p>
          </div>

          <div className="onboarding-visual" aria-hidden="true">
            <div className="signal-card signal-card-a">
              <span className="signal-title">Freshness</span>
              <strong>{stepIndex === 0 ? "Live Status" : stepIndex === 1 ? "Use Soon" : "In Motion"}</strong>
              <p>{stepIndex === 0 ? "Fresh, opened, archived." : stepIndex === 1 ? "Prioritize what needs attention." : "Track progress as you use items."}</p>
            </div>
            <div className="signal-card signal-card-b">
              <span className="signal-title">Household</span>
              <strong>{householdName ?? "Set up shared space"}</strong>
              <p>{householdName ? "Inventory is shared across your kitchen." : "Invite everyone who adds or uses food."}</p>
            </div>
            <div className="signal-line signal-line-a" />
            <div className="signal-line signal-line-b" />
            <div className="signal-dot signal-dot-a" />
            <div className="signal-dot signal-dot-b" />
            <div className="signal-dot signal-dot-c" />
          </div>
        </div>

        <div className="onboarding-rail">
          <div className="onboarding-steps" aria-label="Onboarding progress">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                className={`onboarding-step ${index === stepIndex ? "active" : ""}`}
                onClick={() => setStepIndex(index)}
                aria-label={`Go to step ${index + 1}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.eyebrow}</strong>
              </button>
            ))}
          </div>

          <div className="onboarding-actions">
            <button type="button" className="button ghost" onClick={dismiss}>
              Skip
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" className="button" onClick={() => setStepIndex((current) => current + 1)}>
                Next
              </button>
            ) : (
              <div className="onboarding-final-actions">
                <Link className="button secondary" to="/add-item" onClick={dismiss}>
                  Add first item
                </Link>
                <button type="button" className="button" onClick={dismiss}>
                  Open dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
