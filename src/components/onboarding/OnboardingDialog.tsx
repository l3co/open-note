import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PanelLeft,
  Slash,
  Code,
  Cloud,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import logoSrc from "@/assets/logo.png";
import { Button, Dialog } from "@/components/ui";

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
    <Dialog
      open={true}
      onClose={onComplete}
      data-testid="onboarding-dialog"
      showCloseButton={false}
      className="p-0 w-[480px]"
    >
      <div className="relative">
        <BackgroundPattern />
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
    </Dialog>
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
    <div
      className="relative z-10 flex flex-col items-center px-8 py-10"
      data-testid="onboarding-welcome"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center">
        <img src={logoSrc} alt="Open Note" className="h-14 w-14" />
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
        <Button
          variant="primary"
          onClick={onStart}
          data-testid="onboarding-start"
          fullWidth
          className="py-2.5"
          icon={<ArrowRight size={16} />}
          iconPosition="right"
        >
          {t("onboarding.start_local")}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          data-testid="onboarding-skip"
          fullWidth
        >
          {t("common.close")}
        </Button>
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
    <div
      className="relative z-10 flex flex-col px-8 py-10"
      data-testid="onboarding-tour-step"
    >
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
      <div
        className="mt-6 flex justify-center gap-1.5"
        data-testid="onboarding-progress"
      >
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
        <Button
          variant="ghost"
          onClick={onBack}
          data-testid="onboarding-back"
          icon={<ArrowLeft size={14} />}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          data-testid="onboarding-next"
          icon={isLast ? <Check size={14} /> : <ArrowRight size={14} />}
          iconPosition="right"
        >
          {isLast ? t("common.confirm") : t("common.ok")}
        </Button>
      </div>
    </div>
  );
}
