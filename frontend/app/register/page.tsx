"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { sendOtp, register } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, User, Zap, ArrowRight, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

type Step = "details" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { login: saveToken } = useAuth();

  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // ── Step 1: send OTP ────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setSendingOtp(true);
    try {
      await sendOtp(form.email);
      toast.success("OTP sent! Check your inbox.");
      setStep("otp");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail || "Failed to send OTP";
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Step 2: verify OTP + create account ────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Enter the 6-digit code from your email"); return; }
    setCreatingAccount(true);
    try {
      const { data } = await register(form.email, form.password, form.full_name, otp);
      saveToken(data.access_token);
      toast.success("Account created! Upload your CV to get started.");
      router.push("/profile");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail || "Registration failed";
      toast.error(msg);
    } finally {
      setCreatingAccount(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────
  const handleResend = async () => {
    setSendingOtp(true);
    try {
      await sendOtp(form.email);
      toast.success("New OTP sent!");
      setOtp("");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail || "Failed to resend OTP";
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }} className="bg-mesh">
      <div style={{ position: "fixed", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass auth-card-padding"
        style={{ width: "100%", maxWidth: 420 }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#00d4ff,#7c6aff)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            {step === "otp" ? <ShieldCheck size={26} color="#fff" /> : <Zap size={26} color="#fff" />}
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>
            {step === "otp" ? "Verify your email" : "Create account"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
            {step === "otp"
              ? `We sent a 6-digit code to ${form.email}`
              : "Start your AI-powered career journey"}
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: account details ── */}
          {step === "details" && (
            <motion.form
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendOtp}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <User size={14} /> Full Name
                </label>
                <input
                  className="input"
                  placeholder="Your name"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Mail size={14} /> Email
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Lock size={14} /> Password
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>

              <button
                className="btn-primary"
                type="submit"
                disabled={sendingOtp}
                style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {sendingOtp
                  ? <><Loader2 size={18} className="spinner" /> Sending OTP…</>
                  : <><ArrowRight size={16} /> Send Verification Code</>}
              </button>
            </motion.form>
          )}

          {/* ── STEP 2: enter OTP ── */}
          {step === "otp" && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegister}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <ShieldCheck size={14} /> Verification Code
                </label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  style={{ fontSize: "1.6rem", letterSpacing: "0.35em", textAlign: "center", fontWeight: 700, padding: "0.75rem 1rem" }}
                />
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 8, textAlign: "center" }}>
                  Code expires in 10 minutes
                </p>
              </div>

              <button
                className="btn-primary"
                type="submit"
                disabled={creatingAccount || otp.length !== 6}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {creatingAccount
                  ? <><Loader2 size={18} className="spinner" /> Creating account…</>
                  : <><ShieldCheck size={16} /> Create Account</>}
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setStep("details"); setOtp(""); }}
                  style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer", padding: 0 }}
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={sendingOtp}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.82rem", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
                >
                  {sendingOtp ? <Loader2 size={13} className="spinner" /> : <RefreshCw size={13} />}
                  Resend code
                </button>
              </div>
            </motion.form>
          )}

        </AnimatePresence>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
