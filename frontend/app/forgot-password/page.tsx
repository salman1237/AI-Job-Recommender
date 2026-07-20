"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { forgotPassword, resetPassword } from "@/lib/api";
import { Mail, Lock, KeyRound, ArrowRight, Loader2, RefreshCw, CheckCircle } from "lucide-react";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    try {
      await forgotPassword(email);
      toast.success("Reset code sent! Check your inbox.");
      setStep("reset");
    } catch {
      toast.error("Failed to send reset code. Try again.");
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
    if (code.length !== 6) { toast.error("Enter the 6-digit code from your email."); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setResetting(true);
    try {
      await resetPassword(email, code, newPassword);
      toast.success("Password reset successfully!");
      setStep("done");
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail || "Invalid or expired code.";
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }} className="bg-mesh">
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass auth-card-padding"
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#d97706,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            {step === "done" ? <CheckCircle size={26} color="#fff" /> : <KeyRound size={26} color="#fff" />}
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>
            {step === "email" ? "Forgot password?" : step === "reset" ? "Enter reset code" : "All done!"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
            {step === "email"
              ? "Enter your email and we'll send a reset code."
              : step === "reset"
              ? `We sent a 6-digit code to ${email}`
              : "Your password has been updated. Redirecting…"}
          </p>
        </div>

        <AnimatePresence mode="wait">

          {step === "email" && (
            <motion.form key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Mail size={14} /> Email address
                </label>
                <input className="input" type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn-primary" type="submit" disabled={sending}
                style={{ width: "100%", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "linear-gradient(135deg,#d97706,#b45309)" }}>
                {sending ? <><Loader2 size={18} className="spinner" /> Sending…</> : <><ArrowRight size={16} /> Send Reset Code</>}
              </button>
            </motion.form>
          )}

          {step === "reset" && (
            <motion.form key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <KeyRound size={14} /> 6-Digit Reset Code
                </label>
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  placeholder="000000" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required autoFocus
                  style={{ fontSize: "1.6rem", letterSpacing: "0.35em", textAlign: "center", fontWeight: 700, padding: "0.75rem 1rem" }} />
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 6, textAlign: "center" }}>
                  Code expires in 15 minutes
                </p>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Lock size={14} /> New Password
                </label>
                <input className="input" type="password" placeholder="Min. 8 characters" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required minLength={8} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Lock size={14} /> Confirm Password
                </label>
                <input className="input" type="password" placeholder="Re-enter new password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required />
              </div>

              <button className="btn-primary" type="submit" disabled={resetting || code.length !== 6}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "linear-gradient(135deg,#d97706,#b45309)" }}>
                {resetting ? <><Loader2 size={18} className="spinner" /> Resetting…</> : <><KeyRound size={16} /> Reset Password</>}
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
                <button type="button" onClick={() => { setStep("email"); setCode(""); }}
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", padding: 0 }}>
                  ← Change email
                </button>
                <button type="button" onClick={handleResend} disabled={sending}
                  style={{ background: "none", border: "none", color: "#d97706", fontSize: "0.82rem", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  {sending ? <Loader2 size={13} className="spinner" /> : <RefreshCw size={13} />} Resend code
                </button>
              </div>
            </motion.form>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", padding: "1rem 0" }}>
              <CheckCircle size={48} style={{ color: "#22c55e", margin: "0 auto 1rem" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Redirecting to sign in…</p>
            </motion.div>
          )}

        </AnimatePresence>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
