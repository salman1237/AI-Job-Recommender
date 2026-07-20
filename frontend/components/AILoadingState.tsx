"use client";
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Loader2, Lightbulb } from "lucide-react";

export interface LoadingStep {
  label: string;
  duration: number;
}

interface Props {
  steps: LoadingStep[];
  tips: string[];
  done?: boolean;
  compact?: boolean;
}

export default function AILoadingState({ steps, tips, done = false, compact = false }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    if (done) { setCurrentStep(steps.length); return; }
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((step, i) => {
      elapsed += step.duration;
      const t = setTimeout(() => setCurrentStep(prev => Math.max(prev, i + 1)), elapsed);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [done, steps]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => { setTipIndex(i => (i + 1) % tips.length); setTipVisible(true); }, 350);
    }, 3500);
    return () => clearInterval(interval);
  }, [tips]);

  const p = compact ? "1.25rem" : "1.75rem";

  return (
    <div style={{ padding: p, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <p style={{ fontSize: compact ? "0.875rem" : "1rem", fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          {done
            ? <CheckCircle2 size={17} style={{ color: "var(--success)" }} />
            : <Loader2 size={17} className="spinner" style={{ color: "var(--primary)" }} />
          }
          {done ? "Done!" : "AI is working…"}
        </p>

        {steps.map((step, i) => {
          const done_ = i < currentStep;
          const active = i === currentStep && !done;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 9,
              fontSize: compact ? "0.8rem" : "0.85rem",
              color: done_ ? "var(--success)" : active ? "var(--text-1)" : "var(--text-3)",
              opacity: i > currentStep + 1 ? 0.5 : 1,
              transition: "all 0.3s",
            }}>
              {done_
                ? <CheckCircle2 size={14} style={{ flexShrink: 0, color: "var(--success)" }} />
                : active
                ? <Loader2 size={14} className="spinner" style={{ flexShrink: 0, color: "var(--primary)" }} />
                : <Circle size={14} style={{ flexShrink: 0, opacity: 0.35 }} />
              }
              <span style={{ fontWeight: active ? 600 : 400 }}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="progress-track">
        <div className={`progress-fill${done ? " done" : ""}`} />
      </div>

      {/* Tip */}
      {tips.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: compact ? "0.625rem 0.875rem" : "0.875rem 1rem",
          background: "var(--primary-muted)",
          border: "1px solid rgba(79,70,229,0.15)",
          borderRadius: 8,
          opacity: tipVisible ? 1 : 0,
          transform: tipVisible ? "none" : "translateY(4px)",
          transition: "opacity 0.3s, transform 0.3s",
        }}>
          <Lightbulb size={13} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: compact ? "0.775rem" : "0.82rem", color: "var(--text-2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-1)", fontWeight: 600 }}>Tip: </strong>
            {tips[tipIndex]}
          </p>
        </div>
      )}
    </div>
  );
}
