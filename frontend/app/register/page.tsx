"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { sendOtp, register } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, User, Loader2, ShieldCheck, RefreshCw, Briefcase, ChevronLeft } from "lucide-react";

type Step = "details" | "otp";

export default function RegisterPage() {
  const router = useRouter();
  const { login: saveToken } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingOtp(true);
    try {
      await sendOtp(form.email);
      toast.success("Verification code sent — check your inbox.");
      setStep("otp");
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || "Failed to send code");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setCreating(true);
    try {
      const { data } = await register(form.email, form.password, form.full_name, otp);
      saveToken(data.access_token);
      toast.success("Account created! Upload your CV to get started.");
      router.push("/profile");
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || "Registration failed");
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async () => {
    setSendingOtp(true);
    try {
      await sendOtp(form.email);
      toast.success("New code sent!");
      setOtp("");
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setSendingOtp(false);
    }
  };

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
            background: "var(--primary-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            {step === "otp"
              ? <ShieldCheck size={24} style={{ color: "var(--primary)" }} />
              : <Briefcase size={24} style={{ color: "var(--primary)" }} />
            }
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            {step === "otp" ? "Verify your email" : "Create account"}
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: 6 }}>
            {step === "otp"
              ? `Code sent to ${form.email}`
              : "Start your AI-powered career journey"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, marginBottom: "1.75rem" }}>
          {(["details", "otp"] as Step[]).map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 999, background: step === "otp" || s === "details" ? "var(--primary)" : "var(--border)", transition: "background 0.3s" }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "details" && (
            <motion.form
              key="details"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              onSubmit={handleSendOtp}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Full Name</label>
                <div style={{ position: "relative" }}>
                  <User size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" placeholder="Your name" value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    style={{ paddingLeft: "2.25rem" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Email address</label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" type="email" placeholder="you@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required style={{ paddingLeft: "2.25rem" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                  <input className="input" type="password" placeholder="Min. 8 characters" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required minLength={8} style={{ paddingLeft: "2.25rem" }} />
                </div>
              </div>
              <button type="submit" disabled={sendingOtp} className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem", height: 42 }}>
                {sendingOtp ? <Loader2 size={18} className="spinner" /> : "Continue"}
              </button>
            </motion.form>
          )}

          {step === "otp" && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              onSubmit={handleRegister}
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 8, textAlign: "center" }}>
                  Enter 6-digit code
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
                  style={{ fontSize: "1.75rem", letterSpacing: "0.4em", textAlign: "center", fontWeight: 700, padding: "0.875rem" }}
                />
                <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 8, textAlign: "center" }}>
                  Code expires in 10 minutes
                </p>
              </div>

              <button type="submit" disabled={creating || otp.length !== 6} className="btn btn-primary" style={{ width: "100%", height: 42 }}>
                {creating ? <Loader2 size={18} className="spinner" /> : <><ShieldCheck size={16} /> Create Account</>}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" onClick={() => { setStep("details"); setOtp(""); }}
                  style={{ background: "none", border: "none", color: "var(--text-2)", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  <ChevronLeft size={14} /> Change email
                </button>
                <button type="button" onClick={handleResend} disabled={sendingOtp}
                  style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit" }}>
                  {sendingOtp ? <Loader2 size={13} className="spinner" /> : <RefreshCw size={13} />} Resend
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--text-2)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
