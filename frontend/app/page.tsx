"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Briefcase,
  Sparkles,
  Search,
  Mail,
  ArrowRight,
  CheckCircle,
  Star,
  Zap,
  Globe,
  GraduationCap,
  Trophy,
  Handshake,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    color: "#4f46e5",
    bg: "#eef2ff",
    title: "AI-Powered Matching",
    desc: "Upload your CV or enter your skills. Our AI ranks every opportunity by how well it fits your unique background.",
  },
  {
    icon: Globe,
    color: "#0e7490",
    bg: "#ecfeff",
    title: "Diverse Opportunities",
    desc: "Jobs, scholarships, fellowships, grants, and internships — all in one place, continuously updated.",
  },
  {
    icon: Search,
    color: "#047857",
    bg: "#ecfdf5",
    title: "Smart Browse & Filter",
    desc: "Filter by type, location, or deadline. Sort by score or date. Find what matters without the noise.",
  },
  {
    icon: Mail,
    color: "#c2410c",
    bg: "#fff7ed",
    title: "Email Alerts",
    desc: "Get notified about new opportunities that match your profile so you never miss a deadline.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Create your account",
    desc: "Sign up in under a minute with just your email address.",
  },
  {
    num: "02",
    title: "Add your profile",
    desc: "Upload a PDF CV or manually enter your skills, education, and projects.",
  },
  {
    num: "03",
    title: "Get AI-matched",
    desc: "AI ranks hundreds of opportunities by fit and presents the best ones first.",
  },
];

const TYPES = [
  { label: "Jobs", icon: Briefcase, color: "#4338ca", bg: "#eef2ff" },
  { label: "Scholarships", icon: GraduationCap, color: "#6d28d9", bg: "#f5f3ff" },
  { label: "Fellowships", icon: Handshake, color: "#0e7490", bg: "#ecfeff" },
  { label: "Grants", icon: Trophy, color: "#047857", bg: "#ecfdf5" },
  { label: "Internships", icon: Star, color: "#c2410c", bg: "#fff7ed" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/opportunities");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }
  if (user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "inherit" }}>

      {/* ── Landing Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.5rem", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: "var(--primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Briefcase size={17} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            OpportunityAI
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/login" style={{ padding: "6px 14px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)", textDecoration: "none", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", transition: "all 0.15s" }}>
            Sign in
          </Link>
          <Link href="/register" style={{ padding: "6px 16px", fontSize: "0.875rem", fontWeight: 700, color: "#fff", textDecoration: "none", borderRadius: "var(--radius-sm)", background: "var(--primary)" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "5rem 1.5rem 3.5rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "var(--primary-muted)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 999, fontSize: "0.775rem", fontWeight: 700, color: "var(--primary)", marginBottom: "1.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <Zap size={12} /> AI-Powered Opportunity Discovery
        </div>
        <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.12, color: "var(--text-1)", marginBottom: "1.25rem" }}>
          Find Your Perfect<br />
          <span style={{ color: "var(--primary)" }}>Opportunity</span> with AI
        </h1>
        <p style={{ fontSize: "1.125rem", color: "var(--text-2)", maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.65 }}>
          Upload your CV or enter your skills. AI reads your profile and ranks hundreds of jobs, scholarships, fellowships, and more — by how well they fit <em>you</em>.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "12px 28px", borderRadius: "var(--radius)", fontSize: "0.9375rem", fontWeight: 700,
            color: "#fff", textDecoration: "none", background: "var(--primary)",
            boxShadow: "0 4px 16px rgba(79,70,229,0.35)",
          }}>
            Get Started Free <ArrowRight size={16} />
          </Link>
          <Link href="/browse" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "12px 28px", borderRadius: "var(--radius)", fontSize: "0.9375rem", fontWeight: 700,
            color: "var(--text-1)", textDecoration: "none", background: "#fff",
            border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
          }}>
            <Search size={15} /> Browse Opportunities
          </Link>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ maxWidth: 760, margin: "0 auto 4rem", padding: "0 1.5rem" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "1rem", boxShadow: "var(--shadow-sm)" }}>
          {[
            { value: "500+", label: "Active Opportunities" },
            { value: "5 Types", label: "Jobs, Grants & More" },
            { value: "AI", label: "Ranked by Fit" },
            { value: "Free", label: "No Cost, No Limits" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Opportunity types ── */}
      <section style={{ maxWidth: 960, margin: "0 auto 5rem", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: "1.25rem" }}>
          One platform for every opportunity type
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {TYPES.map(t => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", background: t.bg, borderRadius: 999, fontSize: "0.875rem", fontWeight: 700, color: t.color }}>
              <t.icon size={14} /> {t.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "4.5rem 1.5rem" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--text-1)" }}>
            How It Works
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "3rem" }}>
            From sign-up to your first AI match in under two minutes.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--primary-muted)", border: "1px solid rgba(79,70,229,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 900, color: "var(--primary)" }}>{s.num}</span>
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-2)", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "5rem 1.5rem" }}>
        <h2 style={{ textAlign: "center", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--text-1)" }}>
          Everything You Need
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "3rem" }}>
          Built for job seekers, students, and researchers who want better matches faster.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1.25rem" }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="card" style={{ padding: "1.5rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: "0.8375rem", color: "var(--text-2)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ maxWidth: 760, margin: "0 auto 5rem", padding: "0 1.5rem" }}>
        <div style={{
          background: "var(--primary)", borderRadius: 16,
          padding: "3rem 2.5rem", textAlign: "center",
          boxShadow: "0 8px 32px rgba(79,70,229,0.28)",
        }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: "0.625rem" }}>
            Ready to find your next opportunity?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9375rem", marginBottom: "2rem" }}>
            It's free. Sign up in seconds and let AI do the searching.
          </p>
          <Link href="/register" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 32px", borderRadius: "var(--radius)", fontWeight: 700,
            fontSize: "0.9375rem", color: "var(--primary)", textDecoration: "none",
            background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}>
            <Sparkles size={16} /> Start for Free
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "1.75rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>
          © {new Date().getFullYear()} OpportunityAI — AI-powered career discovery.{" "}
          <Link href="/login" style={{ color: "var(--text-3)", textDecoration: "none" }}>Sign in</Link>{" · "}
          <Link href="/register" style={{ color: "var(--text-3)", textDecoration: "none" }}>Register</Link>
        </p>
      </footer>
    </div>
  );
}
