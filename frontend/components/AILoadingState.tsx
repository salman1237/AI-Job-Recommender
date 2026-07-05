"use client";
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Loader2, Lightbulb } from "lucide-react";

export interface LoadingStep {
  label: string;
  duration: number; // ms until this step completes
}

interface Props {
  steps: LoadingStep[];
  tips: string[];
  done?: boolean;
  compact?: boolean; // smaller version for inline use (profile page)
}

export default function AILoadingState({ steps, tips, done = false, compact = false }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  // Auto-advance steps based on each step's duration
  useEffect(() => {
    if (done) { setCurrentStep(steps.length); return; }

    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      elapsed += step.duration;
      const t = setTimeout(() => {
        setCurrentStep(prev => Math.max(prev, i + 1));
      }, elapsed);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  }, [done, steps]);

  // Rotate tips with fade
  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex(i => (i + 1) % tips.length);
        setTipVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, [tips]);

  const headingSize = compact ? "0.95rem" : "1.1rem";
  const stepFontSize = compact ? "0.82rem" : "0.875rem";
  const padding = compact ? "1.5rem" : "2rem";

  return (
    <div style={{ padding, display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Step tracker */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        <p style={{ fontSize: headingSize, fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2
            size={compact ? 16 : 18}
            className="spinner"
            style={{ color: "#7c6aff", flexShrink: 0, display: done ? "none" : "block" }}
          />
          {done ? "✓ Done!" : "AI is working..."}
        </p>

        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep && !done;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: stepFontSize,
                color: isCompleted
                  ? "#22c55e"
                  : isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                opacity: i > currentStep + 1 ? 0.45 : 1,
                transition: "all 0.3s ease",
              }}
            >
              {isCompleted ? (
                <CheckCircle2 size={15} color="#22c55e" style={{ flexShrink: 0 }} />
              ) : isActive ? (
                <Loader2
                  size={15}
                  style={{
                    flexShrink: 0,
                    color: "#7c6aff",
                    animation: "spin 0.9s linear infinite",
                  }}
                />
              ) : (
                <Circle size={15} style={{ flexShrink: 0, color: "var(--text-secondary)", opacity: 0.4 }} />
              )}
              <span
                style={{
                  fontWeight: isActive ? 600 : 400,
                  animation: isActive ? "stepPulse 1.8s ease infinite" : undefined,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div>
        <div className="progress-bar-track">
          <div className={`progress-bar-fill${done ? " done" : ""}`} />
        </div>
        {!compact && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 6, textAlign: "right" }}>
            {done ? "Complete!" : "Processing…"}
          </p>
        )}
      </div>

      {/* Rotating tip */}
      {tips.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: compact ? "0.75rem 1rem" : "0.9rem 1.1rem",
            background: "rgba(124,106,255,0.06)",
            border: "1px solid rgba(124,106,255,0.15)",
            borderRadius: 10,
            opacity: tipVisible ? 1 : 0,
            transform: tipVisible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.35s ease, transform 0.35s ease",
          }}
        >
          <Lightbulb size={14} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: compact ? "0.78rem" : "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Tip: </strong>
            {tips[tipIndex]}
          </p>
        </div>
      )}
    </div>
  );
}
