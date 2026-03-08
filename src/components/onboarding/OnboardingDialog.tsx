import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  PanelLeft,
  Slash,
  Code,
  Cloud,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";

interface OnboardingDialogProps {
  onComplete: () => void;
}

interface TourStep {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <PanelLeft size={32} />,
    titleKey: "onboarding.tour_step_1_title",
    descriptionKey: "onboarding.tour_step_1",
  },
  {
    icon: <Slash size={32} />,
    titleKey: "onboarding.tour_step_2_title",
    descriptionKey: "onboarding.tour_step_2",
  },
  {
    icon: <Code size={32} />,
    titleKey: "onboarding.tour_step_3_title",
    descriptionKey: "onboarding.tour_step_3",
  },
  {
    icon: <Cloud size={32} />,
    titleKey: "onboarding.tour_step_4_title",
    descriptionKey: "onboarding.tour_step_4",
  },
];

export function OnboardingDialog({ onComplete }: OnboardingDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"welcome" | number>("welcome");

  const handleStartTour = () => {
    setStep(0);
  };

  const handleNext = () => {
    if (typeof step === "number" && step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (typeof step === "number" && step > 0) {
      setStep(step - 1);
    } else {
      setStep("welcome");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--overlay)" }}
    >
      <div
        className="w-[480px] overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t("onboarding.welcome")}
      >
        {step === "welcome" ? (
          <WelcomeStep onStart={handleStartTour} onSkip={onComplete} />
        ) : (
          <TourStepView
            step={TOUR_STEPS[step]!}
            currentIndex={step}
            totalSteps={TOUR_STEPS.length}
            onNext={handleNext}
            onBack={handleBack}
            isLast={step === TOUR_STEPS.length - 1}
          />
        )}
      </div>
    </div>
  );
}

function WelcomeStep({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center px-8 py-10">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--accent-subtle)" }}
      >
        <BookOpen size={32} style={{ color: "var(--accent)" }} />
      </div>

      <h1
        className="text-2xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {t("onboarding.welcome")}
      </h1>
      <p
        className="mt-2 text-center text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("onboarding.subtitle")}
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <button
          onClick={onStart}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--accent)")
          }
        >
          {t("onboarding.start_local")}
          <ArrowRight size={16} />
        </button>
        <button
          onClick={onSkip}
          className="rounded-lg px-4 py-2 text-sm transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}

function TourStepView({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onBack,
  isLast,
}: {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  isLast: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col px-8 py-10">
      <div className="flex flex-col items-center">
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "var(--accent-subtle)",
            color: "var(--accent)",
          }}
        >
          {step.icon}
        </div>

        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {t(step.titleKey)}
        </h2>
        <p
          className="mt-2 text-center text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {t(step.descriptionKey)}
        </p>
      </div>

      {/* Progress dots */}
      <div className="mt-6 flex justify-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === currentIndex ? 24 : 6,
              backgroundColor:
                i === currentIndex ? "var(--accent)" : "var(--border)",
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <ArrowLeft size={14} />
          {t("common.cancel")}
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--accent)")
          }
        >
          {isLast ? (
            <>
              {t("common.confirm")}
              <Check size={14} />
            </>
          ) : (
            <>
              {t("common.ok")}
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
