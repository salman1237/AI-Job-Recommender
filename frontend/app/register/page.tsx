"use client";
import { useState, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { sendOtp, register, updateManualProfile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Mail, Lock, User, Loader2, ShieldCheck, RefreshCw, Briefcase, ChevronLeft,
  Plus, X, GraduationCap, Layers,
} from "lucide-react";

type Step = "details" | "otp" | "profile";
const STEP_IDX: Record<Step, number> = { details: 0, otp: 1, profile: 2 };

export default function RegisterPage() {
  const router = useRouter();
  const { login: saveToken } = useAuth();

  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creating, setCreating] = useState(false);

  // Profile setup step
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [edu, setEdu] = useState({ degree: "", institution: "", year: "" });
  const [projects, setProjects] = useState<{ name: string; description: string }[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

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
      setStep("profile");
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

  const addSkill = () => {
    const val = skillInput.trim().replace(/,$/, "");
    if (val && !skills.includes(val)) setSkills(s => [...s, val]);
    setSkillInput("");
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); }
  };

  const addProject = () =>
    setProjects(p => [...p, { name: "", description: "" }]);

  const updateProject = (i: number, field: "name" | "description", val: string) =>
    setProjects(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  const removeProject = (i: number) =>
    setProjects(p => p.filter((_, idx) => idx !== i));

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const toastId = toast.loading("AI is generating your match keywords…");
    try {
      await updateManualProfile({
        skills,
        education: edu.degree || edu.institution ? { degree: edu.degree, institution: edu.institution, year: edu.year } : null,
        achievements: [],
        projects: projects.filter(p => p.name.trim()),
      });
      toast.success("Profile saved! Finding your matches…", { id: toastId });
      router.push("/opportunities");
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || "Failed to save profile", { id: toastId });
    } finally {
      setSavingProfile(false);
    }
  };

  const idx = STEP_IDX[step];

  return (
    <div className="auth-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="auth-card"
        style={step === "profile" ? { maxWidth: 520, width: "100%" } : undefined}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--primary-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            {step === "otp" ? <ShieldCheck size={24} style={{ color: "var(--primary)" }} />
              : step === "profile" ? <Layers size={24} style={{ color: "var(--primary)" }} />
                : <Briefcase size={24} style={{ color: "var(--primary)" }} />}
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            {step === "otp" ? "Verify your email"
              : step === "profile" ? "Set up your profile"
                : "Create account"}
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: 6 }}>
            {step === "otp" ? `Code sent to ${form.email}`
              : step === "profile" ? "Add your skills so AI can find your best matches"
                : "Start your AI-powered career journey"}
          </p>
        </div>

        {/* Step indicator — 3 bars */}
        <div style={{ display: "flex", gap: 6, marginBottom: "1.75rem" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: idx >= i ? "var(--primary)" : "var(--border)", transition: "background 0.3s" }} />
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Details ── */}
          {step === "details" && (
            <motion.form key="details" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <motion.form key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 8, textAlign: "center" }}>
                  Enter 6-digit code
                </label>
                <input
                  className="input" type="text" inputMode="numeric" pattern="[0-9]*"
                  maxLength={6} placeholder="000000" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required autoFocus
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

          {/* ── Step 3: Profile Setup ── */}
          {step === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Skills */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)", marginBottom: "0.625rem" }}>
                  <Layers size={14} style={{ color: "var(--primary)" }} /> Skills
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, minHeight: skills.length ? "auto" : 0 }}>
                  {skills.map(s => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, fontSize: "0.775rem", color: "var(--text-1)", fontWeight: 500 }}>
                      {s}
                      <button type="button" onClick={() => setSkills(sk => sk.filter(x => x !== s))}
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0, color: "var(--text-3)", lineHeight: 1 }}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="input" placeholder="Type a skill and press Enter…" value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={onSkillKey}
                    onBlur={addSkill}
                    style={{ flex: 1, fontSize: "0.875rem" }}
                  />
                  <button type="button" onClick={addSkill} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Education */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)", marginBottom: "0.625rem" }}>
                  <GraduationCap size={14} style={{ color: "var(--primary)" }} /> Education
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input className="input" placeholder="Degree (e.g. BSc Computer Science)" value={edu.degree}
                    onChange={e => setEdu(d => ({ ...d, degree: e.target.value }))} style={{ fontSize: "0.875rem" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <input className="input" placeholder="Institution" value={edu.institution}
                      onChange={e => setEdu(d => ({ ...d, institution: e.target.value }))} style={{ fontSize: "0.875rem" }} />
                    <input className="input" placeholder="Year" value={edu.year}
                      onChange={e => setEdu(d => ({ ...d, year: e.target.value }))}
                      style={{ width: 80, fontSize: "0.875rem" }} />
                  </div>
                </div>
              </div>

              {/* Projects */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)" }}>
                    Projects <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <button type="button" onClick={addProject} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Plus size={13} /> Add
                  </button>
                </div>
                {projects.length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
                    No projects added. You can add them later in your profile.
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {projects.map((p, i) => (
                    <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.75rem", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input className="input" placeholder="Project name" value={p.name}
                          onChange={e => updateProject(i, "name", e.target.value)}
                          style={{ flex: 1, fontSize: "0.85rem" }} />
                        <button type="button" onClick={() => removeProject(i)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                          <X size={15} />
                        </button>
                      </div>
                      <textarea className="input" placeholder="Brief description…" value={p.description}
                        onChange={e => updateProject(i, "description", e.target.value)}
                        rows={2} style={{ fontSize: "0.8125rem", resize: "vertical" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "0.25rem" }}>
                <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="btn btn-primary" style={{ width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  {savingProfile ? <><Loader2 size={16} className="spinner" /> Generating your keywords…</> : "Save & Find Matches"}
                </button>
                <button type="button" onClick={() => router.push("/opportunities")}
                  style={{ width: "100%", padding: "10px", background: "none", border: "none", color: "var(--text-2)", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {step !== "profile" && (
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--text-2)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
