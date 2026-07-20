"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { forgotPassword, resetPassword } from "@/lib/api";
import { Mail, Lock, KeyRound, Loader2, RefreshCw, CheckCircle, ChevronLeft, Eye, EyeOff } from "lucide-react";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await forgotPassword(email);
      toast.success("Reset code sent — check your inbox.");
      setStep("reset");
    } catch {
      toast.error("Failed to send reset code.");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setSending(true);
    try {
      await forgotPassword(email);
      toast.success("New reset code sent!");
      setCode("");
    } catch {
      toast.error("Failed to resend code.");
    } finally {
      setSending(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error("Enter the 6-digit code."); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setResetting(true);
    try {
      await resetPassword(email, code, newPassword);
      toast.success("Password reset successfully!");
      setStep("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || "Invalid or expired code.");
    } finally {
      setResetting(false);
    }
  };

  const stepIndex = { email: 0, reset: 1, done: 2 }[step];

  return (
    <div className="auth-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="auth-card"
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: step === "done" ? "#ecfdf5" : "#fffbeb",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            {step === "done"
              ? <CheckCircle size={24} style={{ color: "#059669" }} />
              : <KeyRound size={24} style={{ color: "#d97706" }} />
            }
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            {step === "email" ? "Reset password" : step === "reset" ? "Enter reset code" : "All done!"}
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: 6 }}>
            {step === "email"
              ? "We'll send a reset code to your email."
              : step === "reset"
              ? `Code sent to ${email}`
              : "Your password has been updated. Redirecting…"}
          </p>
        </div>

        {/* Progress indicators */}
        {step !== "done" && (
          <div style={{ display: "flex", gap: 6, marginBottom: "1.75rem" }}>
            {[0, 1].map(i => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= stepIndex ? "#d97706" : "var(--border)", transition: "background 0.3s" }} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.form key="email" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Email address</label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required autoFocus style={{ paddingLeft: "2.25rem" }} />
                </div>
              </div>
              <button type="submit" disabled={sending} className="btn"
                style={{ width: "100%", height: 42, background: "#d97706", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                {sending ? <Loader2 size={18} className="spinner" /> : "Send Reset Code"}
              </button>
            </motion.form>
          )}

          {step === "reset" && (
            <motion.form key="reset" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 8, textAlign: "center" }}>
                  6-digit reset code
                </label>
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="000000" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required autoFocus
                  style={{ fontSize: "1.75rem", letterSpacing: "0.4em", textAlign: "center", fontWeight: 700, padding: "0.875rem" }} />
                <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 6, textAlign: "center" }}>Code expires in 15 minutes</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>New password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" type={showPw ? "text" : "password"} placeholder="Min. 8 characters" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} required minLength={8} style={{ paddingLeft: "2.25rem", paddingRight: "2.5rem" }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 2 }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Confirm new password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" type="password" placeholder="Re-enter new password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} required style={{ paddingLeft: "2.25rem" }} />
                </div>
              </div>
              <button type="submit" disabled={resetting || code.length !== 6} className="btn"
                style={{ width: "100%", height: 42, background: "#d97706", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                {resetting ? <Loader2 size={18} className="spinner" /> : <><KeyRound size={16} /> Reset Password</>}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" onClick={() => { setStep("email"); setCode(""); }}
                  style={{ background: "none", border: "none", color: "var(--text-2)", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  <ChevronLeft size={14} /> Change email
                </button>
                <button type="button" onClick={handleResend} disabled={sending}
                  style={{ background: "none", border: "none", color: "#d97706", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit" }}>
                  {sending ? <Loader2 size={13} className="spinner" /> : <RefreshCw size={13} />} Resend
                </button>
              </div>
            </motion.form>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", padding: "1rem 0" }}>
              <CheckCircle size={52} style={{ color: "#059669", margin: "0 auto 1rem" }} />
              <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>Redirecting to sign in…</p>
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--text-2)" }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
