"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar, uploadCV } from "@/lib/api";
import Navbar from "@/components/Navbar";
import AILoadingState, { LoadingStep } from "@/components/AILoadingState";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { User, Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";

const CV_STEPS: LoadingStep[] = [
  { label: "Uploading your PDF…",            duration: 2000 },
  { label: "Extracting text content…",       duration: 3500 },
  { label: "Gemini AI reading your CV…",     duration: 6000 },
  { label: "Identifying skills & keywords…", duration: 2500 },
  { label: "Building your AI profile…",      duration: 1500 },
];

const CV_TIPS = [
  "A focused 1–2 page CV gives Gemini AI the clearest signal about your strengths.",
  "Include project descriptions — Gemini matches based on context, not just skill names.",
  "Listing certifications and tools improves your match rate for technical opportunities.",
  "After parsing, head to Opportunities to see your AI-ranked matches!",
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);

  if (!user) return null; // Let middleware or protected route handle redirect

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(e.target.files[0]);
      await refreshUser();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadingCV(true);
    const toastId = toast.loading("AI is parsing your CV (this takes ~15 seconds)...");
    try {
      await uploadCV(e.target.files[0]);
      await refreshUser();
      toast.success("CV parsed successfully!", { id: toastId });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "CV parsing failed";
      toast.error(msg, { id: toastId });
    } finally {
      setUploadingCV(false);
    }
  };

  const cv = user.parsed_cv as Record<string, any> | null;

  return (
    <>
      <Navbar />
      <main className="main-pad" style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
        
        {/* Header Section */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: "2rem", marginBottom: "2rem" }}>
          <div className="profile-header" style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          
          <div style={{ position: "relative" }}>
            <div style={{ width: 100, height: 100, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "2px solid var(--border)" }}>
              {user.avatar_path ? (
                <img src={`http://127.0.0.1:8000/uploads/avatars/${user.avatar_path.split("/").pop()?.split("\\").pop()}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <User size={40} color="var(--text-secondary)" />
              )}
            </div>
            <button
              disabled={uploadingAvatar}
              onClick={() => avatarRef.current?.click()}
              style={{ position: "absolute", bottom: 0, right: 0, background: "var(--accent)", color: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
            >
              {uploadingAvatar ? <Loader2 size={16} className="spinner" /> : <Upload size={14} />}
            </button>
            <input type="file" hidden ref={avatarRef} accept="image/*" onChange={handleAvatar} />
          </div>

          <div>
            <h1 className="page-h1" style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>{user.full_name || "Welcome!"}</h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>{user.email}</p>
            <div style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", background: "rgba(124,106,255,0.1)", color: "var(--accent)", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
              {user.role}
            </div>
          </div>
          </div>
        </motion.div>

        {/* CV Upload Section */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass" style={{ marginBottom: "2rem", overflow: "hidden" }}>
          {/* CV Card Header */}
          <div style={{ padding: "2rem", paddingBottom: uploadingCV ? "1rem" : "2rem" }}>
            <div className="page-header-row" style={{ alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={20} className="gradient-text" /> AI Resume Profile
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 4, maxWidth: 600 }}>
                  Upload your latest PDF CV. Our Gemini AI will parse your skills, education, and projects to automatically match you with the best opportunities.
                </p>
              </div>
              <button
                onClick={() => cvRef.current?.click()}
                disabled={uploadingCV}
                className="btn-primary btn-full-mobile"
                style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, opacity: uploadingCV ? 0.6 : 1 }}
              >
                {uploadingCV ? <Loader2 size={16} className="spinner" /> : <Upload size={16} />}
                {uploadingCV ? "Parsing…" : "Upload PDF CV"}
              </button>
              <input type="file" hidden ref={cvRef} accept="application/pdf" onChange={handleCV} />
            </div>
          </div>

          {/* Inline AI loading state during CV parsing */}
          {uploadingCV && (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <AILoadingState steps={CV_STEPS} tips={CV_TIPS} compact />
            </div>
          )}

          {cv && !uploadingCV && (
            <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid var(--border)" }}>
              <div className="grid-1col-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-secondary)" }}>Extracted Skills</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cv.skills?.map((s: string, i: number) => (
                      <span key={i} style={{ padding: "4px 10px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontSize: "0.8rem" }}>{s}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-secondary)" }}>Target Keywords</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cv.job_keywords?.map((k: string, i: number) => (
                      <span key={i} style={{ padding: "4px 10px", background: "rgba(0,212,255,0.1)", color: "#00d4ff", borderRadius: 6, fontSize: "0.8rem" }}>{k}</span>
                    ))}
                  </div>
                </div>

              </div>
              
              {cv.projects && cv.projects.length > 0 && (
                <div style={{ marginTop: "2rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-secondary)" }}>Projects & Experience</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {cv.projects.map((p: any, i: number) => (
                      <div key={i} style={{ padding: "1rem", background: "rgba(0,0,0,0.02)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <h4 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{p.name}</h4>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

      </main>
    </>
  );
}
