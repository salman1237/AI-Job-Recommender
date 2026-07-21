"use client";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar, uploadCV, updateManualProfile, changePassword, deleteAccount, updateEmailPreferences, getSavedSearches, updateSavedSearch, deleteSavedSearch } from "@/lib/api";
import Navbar from "@/components/Navbar";
import AILoadingState, { LoadingStep } from "@/components/AILoadingState";
import toast from "react-hot-toast";
import {
  User, Upload, FileText, Loader2, Camera, Sparkles,
  Plus, X, GraduationCap, Layers, Save, Pencil, Lock, Briefcase, Trash2, Bell, Bookmark,
} from "lucide-react";

const CV_STEPS: LoadingStep[] = [
  { label: "Uploading your PDF…",            duration: 2000 },
  { label: "Extracting text content…",       duration: 3500 },
  { label: "AI reading your CV…",            duration: 6000 },
  { label: "Identifying skills & keywords…", duration: 2500 },
  { label: "Building your AI profile…",      duration: 1500 },
];

const CV_TIPS = [
  "A focused 1–2 page CV gives the AI the clearest signal about your strengths.",
  "Include project descriptions — AI matches based on context, not just skill names.",
  "Listing certifications and tools improves your match rate for technical opportunities.",
  "After parsing, head to My Matches to see your AI-ranked opportunities!",
];

type Edu = { degree: string; institution: string; year: string };
type Project = { name: string; description: string };
type Experience = { title: string; company: string; duration: string; description: string };

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);

  // Manual profile state
  const [localSkills, setLocalSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [localEdu, setLocalEdu] = useState<Edu>({ degree: "", institution: "", year: "" });
  const [localExperience, setLocalExperience] = useState<Experience[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileEdited, setProfileEdited] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Email preferences state
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);

  // Saved searches state
  interface SavedSearch { id: number; name: string; keywords: string | null; opp_type: string | null; country: string | null; notify_enabled: boolean; }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingSearches, setLoadingSearches] = useState(false);

  const cv = user?.parsed_cv as Record<string, any> | null;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // Sync local state whenever parsed_cv changes (after CV upload or manual save)
  useEffect(() => {
    if (cv) {
      setLocalSkills((cv.skills as string[]) || []);
      setLocalEdu({
        degree: cv.education?.degree || "",
        institution: cv.education?.institution || "",
        year: cv.education?.year || "",
      });
      setLocalExperience((cv.experience as Experience[]) || []);
      setLocalProjects((cv.projects as Project[]) || []);
    } else {
      setLocalSkills([]);
      setLocalEdu({ degree: "", institution: "", year: "" });
      setLocalExperience([]);
      setLocalProjects([]);
    }
    setProfileEdited(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.parsed_cv]);

  useEffect(() => {
    if (user) {
      setDigestEnabled(user.email_digest_enabled ?? true);
      setAlertsEnabled(user.email_alerts_enabled ?? true);
    }
  }, [user?.email_digest_enabled, user?.email_alerts_enabled]);

  useEffect(() => {
    if (!user) return;
    setLoadingSearches(true);
    getSavedSearches()
      .then(r => setSavedSearches(r.data))
      .catch(() => {})
      .finally(() => setLoadingSearches(false));
  }, [user?.id]);

  const handleToggleSavedSearch = async (id: number, enabled: boolean) => {
    setSavedSearches(prev => prev.map(s => s.id === id ? { ...s, notify_enabled: enabled } : s));
    try {
      await updateSavedSearch(id, { notify_enabled: enabled });
    } catch {
      setSavedSearches(prev => prev.map(s => s.id === id ? { ...s, notify_enabled: !enabled } : s));
      toast.error("Failed to update saved search.");
    }
  };

  const handleDeleteSavedSearch = async (id: number) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    try {
      await deleteSavedSearch(id);
      toast.success("Saved search deleted.");
    } catch {
      getSavedSearches().then(r => setSavedSearches(r.data)).catch(() => {});
      toast.error("Failed to delete saved search.");
    }
  };

  if (!user) return null;

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(e.target.files[0]);
      await refreshUser();
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadingCV(true);
    const toastId = toast.loading("AI is parsing your CV (~15 seconds)…");
    try {
      await uploadCV(e.target.files[0]);
      await refreshUser();
      toast.success("CV parsed successfully!", { id: toastId });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "CV parsing failed", { id: toastId });
    } finally {
      setUploadingCV(false);
    }
  };

  // Skills helpers
  const commitSkill = () => {
    const val = skillInput.trim().replace(/,$/, "");
    if (val && !localSkills.includes(val)) {
      setLocalSkills(s => [...s, val]);
      setProfileEdited(true);
    }
    setSkillInput("");
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitSkill(); }
  };
  const removeSkill = (s: string) => {
    setLocalSkills(sk => sk.filter(x => x !== s));
    setProfileEdited(true);
  };

  // Experience helpers
  const addExperience = () => {
    setLocalExperience(e => [...e, { title: "", company: "", duration: "", description: "" }]);
    setProfileEdited(true);
  };
  const updateExperience = (i: number, field: keyof Experience, val: string) => {
    setLocalExperience(e => e.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
    setProfileEdited(true);
  };
  const removeExperience = (i: number) => {
    setLocalExperience(e => e.filter((_, idx) => idx !== i));
    setProfileEdited(true);
  };

  // Project helpers
  const addProject = () => {
    setLocalProjects(p => [...p, { name: "", description: "" }]);
    setProfileEdited(true);
  };
  const updateProject = (i: number, field: keyof Project, val: string) => {
    setLocalProjects(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
    setProfileEdited(true);
  };
  const removeProject = (i: number) => {
    setLocalProjects(p => p.filter((_, idx) => idx !== i));
    setProfileEdited(true);
  };

  const handleSaveEmailPrefs = async (newDigest: boolean, newAlerts: boolean) => {
    setSavingEmailPrefs(true);
    try {
      await updateEmailPreferences(newDigest, newAlerts);
      await refreshUser();
      toast.success("Email preferences saved.");
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      localStorage.removeItem("token");
      window.location.href = "/";
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to delete account.");
      setDeletingAccount(false);
    }
  };

  const handleChangePw = async () => {
    if (!currentPw || !newPw || !confirmPw) return toast.error("Please fill in all fields.");
    if (newPw !== confirmPw) return toast.error("New passwords do not match.");
    if (newPw.length < 8) return toast.error("New password must be at least 8 characters.");
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success("Password changed successfully.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to change password.");
    } finally {
      setChangingPw(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const toastId = toast.loading("AI is generating your match keywords…");
    try {
      await updateManualProfile({
        skills: localSkills,
        education: localEdu.degree || localEdu.institution
          ? { degree: localEdu.degree, institution: localEdu.institution, year: localEdu.year }
          : null,
        experience: localExperience.filter(e => e.title.trim() || e.company.trim()),
        achievements: (cv?.achievements as string[]) || [],
        projects: localProjects.filter(p => p.name.trim()),
      });
      await refreshUser();
      toast.success("Profile saved & keywords refreshed!", { id: toastId });
      setProfileEdited(false);
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to save profile",
        { id: toastId }
      );
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── Profile Header Card ── */}
        <div className="card" style={{ padding: "1.75rem", marginBottom: "1.25rem" }}>
          <div className="profile-header" style={{ display: "flex", gap: "1.75rem", alignItems: "center" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: "var(--surface-2)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {user.avatar_path ? (
                  <img src={`${apiBase}/uploads/avatars/${user.avatar_path.split("/").pop()?.split("\\").pop()}`}
                    alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <User size={36} style={{ color: "var(--text-3)" }} />
                )}
              </div>
              <button disabled={uploadingAvatar} onClick={() => avatarRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.4)" }}>
                {uploadingAvatar ? <Loader2 size={13} className="spinner" /> : <Camera size={13} />}
              </button>
              <input type="file" hidden ref={avatarRef} accept="image/*" onChange={handleAvatar} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
                {user.full_name || "Your Profile"}
              </h1>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: 8 }}>{user.email}</p>
              <span style={{ display: "inline-block", padding: "3px 10px", background: "var(--primary-muted)", color: "var(--primary)", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* ── CV Card ── */}
        <div className="card" style={{ overflow: "hidden", marginBottom: "1.25rem" }}>
          <div style={{ padding: "1.5rem", borderBottom: uploadingCV || cv ? "1px solid var(--border)" : undefined }}>
            <div className="card-header-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <FileText size={18} style={{ color: "var(--primary)" }} /> AI Resume Profile
                </h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", maxWidth: 480, lineHeight: 1.55 }}>
                  Upload your latest PDF CV. AI will parse your skills, education, and projects automatically.
                </p>
              </div>
              <button onClick={() => cvRef.current?.click()} disabled={uploadingCV} className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {uploadingCV ? <Loader2 size={15} className="spinner" /> : <Upload size={15} />}
                {uploadingCV ? "Parsing…" : cv ? "Replace CV" : "Upload CV"}
              </button>
              <input type="file" hidden ref={cvRef} accept="application/pdf" onChange={handleCV} />
            </div>
          </div>

          {uploadingCV && <AILoadingState steps={CV_STEPS} tips={CV_TIPS} compact />}

          {cv && !uploadingCV && (
            <div style={{ padding: "1rem 1.5rem", background: "var(--success-muted)", borderBottom: "1px solid #d1fae5", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--success)", fontWeight: 600 }}>
                ✓ CV parsed — {cv.skills?.length || 0} skills · {cv.projects?.length || 0} projects · {cv.job_keywords?.length || 0} AI keywords
              </span>
            </div>
          )}

          {!cv && !uploadingCV && (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-2)" }}>
              <Sparkles size={32} style={{ color: "var(--text-3)", margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.875rem" }}>No CV uploaded. Upload a PDF or fill in your details below.</p>
            </div>
          )}
        </div>

        {/* ── Manual Profile Editor ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <Pencil size={16} style={{ color: "var(--primary)" }} /> Skills & Experience
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8rem", lineHeight: 1.5 }}>
                {cv
                  ? "Auto-populated from your CV. Edit and save to re-rank with updated AI keywords."
                  : "No CV? Enter your details manually — AI generates your match keywords on save."}
              </p>
            </div>
            {profileEdited && (
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--warning)", background: "var(--warning-muted)", padding: "3px 10px", borderRadius: 999, flexShrink: 0 }}>
                Unsaved changes
              </span>
            )}
          </div>

          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>

            {/* Skills */}
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)", marginBottom: "0.625rem" }}>
                <Layers size={14} style={{ color: "var(--primary)" }} /> Skills
              </label>
              {localSkills.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {localSkills.map(s => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, fontSize: "0.775rem", color: "var(--text-1)", fontWeight: 500 }}>
                      {s}
                      <button type="button" onClick={() => removeSkill(s)}
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0, color: "var(--text-3)" }}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="input" placeholder="Type a skill and press Enter or comma…"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={onSkillKey}
                  onBlur={commitSkill}
                  style={{ flex: 1, fontSize: "0.875rem" }}
                />
                <button type="button" onClick={commitSkill} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
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
                <input className="input" placeholder="Degree (e.g. BSc Computer Science)" value={localEdu.degree}
                  onChange={e => { setLocalEdu(d => ({ ...d, degree: e.target.value })); setProfileEdited(true); }}
                  style={{ fontSize: "0.875rem" }} />
                <div className="sub-grid-auto" style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
                  <input className="input" placeholder="Institution" value={localEdu.institution}
                    onChange={e => { setLocalEdu(d => ({ ...d, institution: e.target.value })); setProfileEdited(true); }}
                    style={{ fontSize: "0.875rem" }} />
                  <input className="input" placeholder="Year" value={localEdu.year}
                    onChange={e => { setLocalEdu(d => ({ ...d, year: e.target.value })); setProfileEdited(true); }}
                    style={{ fontSize: "0.875rem" }} />
                </div>
              </div>
            </div>

            {/* Experience */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Briefcase size={14} style={{ color: "var(--primary)" }} /> Work Experience
                </label>
                <button type="button" onClick={addExperience} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Plus size={13} /> Add Role
                </button>
              </div>

              {localExperience.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
                  No experience yet. Click "Add Role" to include your work history.
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {localExperience.map((exp, i) => (
                  <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.875rem", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input className="input" placeholder="Job title" value={exp.title}
                        onChange={e => updateExperience(i, "title", e.target.value)}
                        style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }} />
                      <button type="button" onClick={() => removeExperience(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                        <X size={15} />
                      </button>
                    </div>
                    <div className="sub-grid-auto" style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8 }}>
                      <input className="input" placeholder="Company / Organization" value={exp.company}
                        onChange={e => updateExperience(i, "company", e.target.value)}
                        style={{ fontSize: "0.875rem" }} />
                      <input className="input" placeholder="Duration" value={exp.duration}
                        onChange={e => updateExperience(i, "duration", e.target.value)}
                        style={{ fontSize: "0.875rem" }} />
                    </div>
                    <textarea className="input" placeholder="Responsibilities and achievements…"
                      value={exp.description}
                      onChange={e => updateExperience(i, "description", e.target.value)}
                      rows={2} style={{ fontSize: "0.8125rem", resize: "vertical" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
                  Projects
                </label>
                <button type="button" onClick={addProject} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Plus size={13} /> Add Project
                </button>
              </div>

              {localProjects.length === 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
                  No projects yet. Click "Add Project" to include your work.
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {localProjects.map((p, i) => (
                  <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.875rem", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input className="input" placeholder="Project name" value={p.name}
                        onChange={e => updateProject(i, "name", e.target.value)}
                        style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }} />
                      <button type="button" onClick={() => removeProject(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                        <X size={15} />
                      </button>
                    </div>
                    <textarea className="input" placeholder="Brief description of what you built, technologies used, impact…"
                      value={p.description}
                      onChange={e => updateProject(i, "description", e.target.value)}
                      rows={2} style={{ fontSize: "0.8125rem", resize: "vertical" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Keywords (read-only) */}
            {cv && cv.job_keywords?.length > 0 && (
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.625rem" }}>
                  AI Match Keywords
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(cv?.job_keywords as string[]).map((k: string, i: number) => (
                    <span key={i} style={{ padding: "3px 9px", background: "var(--primary-muted)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 999, fontSize: "0.775rem", color: "var(--primary)", fontWeight: 500 }}>
                      {k}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 8 }}>
                  Regenerated by AI each time you save. These drive your opportunity matches.
                </p>
              </div>
            )}

            {/* Save button */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                {savingProfile
                  ? <><Loader2 size={15} className="spinner" /> Generating keywords…</>
                  : <><Save size={15} /> Save & Re-rank with AI</>}
              </button>
              <p style={{ fontSize: "0.775rem", color: "var(--text-3)", marginTop: 8 }}>
                AI re-generates your match keywords on every save.
              </p>
            </div>
          </div>
        </div>

        {/* ── Email Preferences Card ── */}
        <div className="card" style={{ overflow: "hidden", marginTop: "1.25rem" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <Bell size={16} style={{ color: "var(--primary)" }} /> Email Notifications
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
              Control which automated emails you receive. Changes apply immediately.
            </p>
          </div>
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Daily digest toggle */}
            {(["digest", "alerts"] as const).map(type => {
              const isDigest = type === "digest";
              const enabled = isDigest ? digestEnabled : alertsEnabled;
              const setEnabled = isDigest ? setDigestEnabled : setAlertsEnabled;
              const label = isDigest ? "Daily Job Digest" : "Deadline Alerts";
              const desc = isDigest
                ? "Receive your top AI-matched opportunities every morning with an Excel attachment."
                : "Get a 48-hour warning when a high-match opportunity is about to close.";
              return (
                <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.875rem 1rem", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text-1)" }}>{label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.775rem", color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={savingEmailPrefs}
                    onClick={() => {
                      const next = !enabled;
                      setEnabled(next);
                      handleSaveEmailPrefs(isDigest ? next : digestEnabled, isDigest ? alertsEnabled : next);
                    }}
                    style={{
                      flexShrink: 0,
                      width: 44, height: 24, borderRadius: 999,
                      background: enabled ? "var(--primary)" : "var(--border)",
                      border: "none", cursor: savingEmailPrefs ? "wait" : "pointer",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Saved Searches Card ── */}
        <div className="card" style={{ overflow: "hidden", marginTop: "1.25rem" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <Bookmark size={16} style={{ color: "var(--primary)" }} /> Saved Searches
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
                Get daily email alerts when new opportunities match these searches. Set filters on Browse, then click "Save Search".
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 600, flexShrink: 0, marginLeft: "1rem" }}>
              {savedSearches.length}/5 used
            </span>
          </div>
          <div style={{ padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingSearches ? (
              <div style={{ textAlign: "center", padding: "0.75rem" }}>
                <Loader2 size={18} className="spinner" style={{ color: "var(--primary)" }} />
              </div>
            ) : savedSearches.length === 0 ? (
              <p style={{ fontSize: "0.84rem", color: "var(--text-3)", textAlign: "center", padding: "0.5rem 0" }}>
                No saved searches yet. Use filters on the Browse page and click "Save Search".
              </p>
            ) : savedSearches.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text-1)" }}>{s.name}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {s.keywords && <span style={{ padding: "1px 7px", borderRadius: 999, background: "var(--primary-muted)", color: "var(--primary)", fontSize: "0.7rem", fontWeight: 600 }}>{s.keywords}</span>}
                    {s.opp_type && <span style={{ padding: "1px 7px", borderRadius: 999, background: "#f5f3ff", color: "#6d28d9", fontSize: "0.7rem", fontWeight: 600 }}>{s.opp_type}</span>}
                    {s.country && <span style={{ padding: "1px 7px", borderRadius: 999, background: "#ecfdf5", color: "#047857", fontSize: "0.7rem", fontWeight: 600 }}>{s.country}</span>}
                  </div>
                </div>
                {/* Notify toggle */}
                <button
                  type="button"
                  title={s.notify_enabled ? "Alerts on" : "Alerts off"}
                  onClick={() => handleToggleSavedSearch(s.id, !s.notify_enabled)}
                  style={{
                    flexShrink: 0, width: 40, height: 22, borderRadius: 999,
                    background: s.notify_enabled ? "var(--primary)" : "var(--border)",
                    border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: s.notify_enabled ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                  }} />
                </button>
                {/* Delete */}
                <button
                  type="button"
                  title="Delete saved search"
                  onClick={() => handleDeleteSavedSearch(s.id)}
                  style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Danger Zone Card ── */}
        {user.role !== "admin" && (
          <div className="card" style={{ overflow: "hidden", marginTop: "1.25rem", borderColor: "var(--error, #ef4444)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #fee2e2" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 3, color: "#dc2626" }}>
                <Trash2 size={16} /> Danger Zone
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
                Permanently delete your account and all data. You can re-register with the same email afterwards.
              </p>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid #dc2626", background: "transparent", color: "#dc2626", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Trash2 size={14} /> Delete My Account
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: "0.8125rem", color: "#dc2626", fontWeight: 600 }}>
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <input
                    className="input"
                    placeholder="Type DELETE to confirm"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    style={{ fontSize: "0.875rem", borderColor: "#dc2626" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deletingAccount || deleteConfirmText !== "DELETE"}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed", opacity: deleteConfirmText === "DELETE" ? 1 : 0.5, fontFamily: "inherit" }}
                    >
                      {deletingAccount ? <Loader2 size={14} className="spinner" /> : <Trash2 size={14} />}
                      {deletingAccount ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                      style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Change Password Card ── */}
        <div className="card" style={{ overflow: "hidden", marginTop: "1.25rem" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <Lock size={16} style={{ color: "var(--primary)" }} /> Change Password
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>
              Update your account password. Minimum 8 characters.
            </p>
          </div>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="password"
              className="input"
              placeholder="Current password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              style={{ fontSize: "0.875rem" }}
            />
            <input
              type="password"
              className="input"
              placeholder="New password (min 8 characters)"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              style={{ fontSize: "0.875rem" }}
            />
            <input
              type="password"
              className="input"
              placeholder="Confirm new password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleChangePw()}
              style={{ fontSize: "0.875rem" }}
            />
            <div style={{ paddingTop: 4 }}>
              <button
                type="button"
                onClick={handleChangePw}
                disabled={changingPw}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                {changingPw
                  ? <><Loader2 size={15} className="spinner" /> Changing…</>
                  : <><Lock size={15} /> Change Password</>}
              </button>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
