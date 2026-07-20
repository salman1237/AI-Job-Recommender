"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar, uploadCV } from "@/lib/api";
import Navbar from "@/components/Navbar";
import AILoadingState, { LoadingStep } from "@/components/AILoadingState";
import toast from "react-hot-toast";
import { User, Upload, FileText, Loader2, Camera, Sparkles } from "lucide-react";

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);

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

  const cv = user.parsed_cv as Record<string, any> | null;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Profile Header Card */}
        <div className="card" style={{ padding: "1.75rem", marginBottom: "1.25rem" }}>
          <div className="profile-header" style={{ display: "flex", gap: "1.75rem", alignItems: "center" }}>

            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "var(--surface-2)",
                border: "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {user.avatar_path ? (
                  <img
                    src={`${apiBase}/uploads/avatars/${user.avatar_path.split("/").pop()?.split("\\").pop()}`}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <User size={36} style={{ color: "var(--text-3)" }} />
                )}
              </div>
              <button
                disabled={uploadingAvatar}
                onClick={() => avatarRef.current?.click()}
                style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--primary)", color: "#fff", border: "2px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.4)",
                }}>
                {uploadingAvatar ? <Loader2 size={13} className="spinner" /> : <Camera size={13} />}
              </button>
              <input type="file" hidden ref={avatarRef} accept="image/*" onChange={handleAvatar} />
            </div>

            {/* Info */}
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

        {/* CV Card */}
        <div className="card" style={{ overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "1.5rem", borderBottom: uploadingCV || cv ? "1px solid var(--border)" : undefined }}>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <FileText size={18} style={{ color: "var(--primary)" }} /> AI Resume Profile
                </h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", maxWidth: 520, lineHeight: 1.55 }}>
                  Upload your latest PDF CV. AI will parse your skills, education, and projects to automatically match you with the best opportunities.
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

          {/* AI loading while parsing */}
          {uploadingCV && (
            <AILoadingState steps={CV_STEPS} tips={CV_TIPS} compact />
          )}

          {/* CV data */}
          {cv && !uploadingCV && (
            <div style={{ padding: "1.5rem" }}>
              <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: cv.projects?.length ? "1.5rem" : 0 }}>

                {/* Skills */}
                <div>
                  <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    Extracted Skills
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cv.skills?.map((s: string, i: number) => (
                      <span key={i} style={{ padding: "3px 9px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, fontSize: "0.775rem", color: "var(--text-1)", fontWeight: 500 }}>
                        {s}
                      </span>
                    ))}
                    {!cv.skills?.length && <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>No skills extracted</span>}
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    Target Keywords
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cv.job_keywords?.map((k: string, i: number) => (
                      <span key={i} style={{ padding: "3px 9px", background: "var(--primary-muted)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 999, fontSize: "0.775rem", color: "var(--primary)", fontWeight: 500 }}>
                        {k}
                      </span>
                    ))}
                    {!cv.job_keywords?.length && <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>No keywords extracted</span>}
                  </div>
                </div>
              </div>

              {/* Projects */}
              {cv.projects && cv.projects.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.875rem" }}>
                    Projects & Experience
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {cv.projects.map((p: any, i: number) => (
                      <div key={i} style={{ padding: "0.875rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                        <h4 style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 4 }}>{p.name}</h4>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", lineHeight: 1.55 }}>{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no CV */}
          {!cv && !uploadingCV && (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-2)" }}>
              <Sparkles size={32} style={{ color: "var(--text-3)", margin: "0 auto 0.75rem" }} />
              <p style={{ fontSize: "0.875rem" }}>No CV uploaded yet. Upload a PDF to get AI-matched opportunities.</p>
            </div>
          )}
        </div>

      </main>
    </>
  );
}
