"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getLandingContent } from "@/lib/api";
import Link from "next/link";
import {
  Briefcase, Sparkles, Search, Mail, ArrowRight, Zap, Globe,
  GraduationCap, Trophy, Handshake, Star, Shield, Bell, Rocket,
  Users, Heart, Layers,
} from "lucide-react";

// ── Icon registry — maps string names stored in DB to React components ──
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Sparkles, Globe, Search, Mail, Zap, Star, Trophy, Shield, Bell, Rocket,
  Briefcase, GraduationCap, Users, Heart, Layers, Handshake,
};

const ICON_STYLE: Record<string, { color: string; bg: string }> = {
  Sparkles:     { color: "#4f46e5", bg: "#eef2ff" },
  Globe:        { color: "#0e7490", bg: "#ecfeff" },
  Search:       { color: "#047857", bg: "#ecfdf5" },
  Mail:         { color: "#c2410c", bg: "#fff7ed" },
  Zap:          { color: "#7c3aed", bg: "#f5f3ff" },
  Star:         { color: "#b45309", bg: "#fef3c7" },
  Trophy:       { color: "#065f46", bg: "#ecfdf5" },
  Shield:       { color: "#1e40af", bg: "#dbeafe" },
  Bell:         { color: "#be185d", bg: "#fce7f3" },
  Rocket:       { color: "#c2410c", bg: "#fff7ed" },
  Briefcase:    { color: "#4f46e5", bg: "#eef2ff" },
  GraduationCap:{ color: "#6d28d9", bg: "#f5f3ff" },
  Users:        { color: "#0e7490", bg: "#ecfeff" },
  Heart:        { color: "#e11d48", bg: "#fff1f2" },
  Layers:       { color: "#4f46e5", bg: "#eef2ff" },
  Handshake:    { color: "#0e7490", bg: "#ecfeff" },
};

// Fixed opportunity-type pills (driven by actual DB types, not editable)
const TYPES = [
  { label: "Jobs",         icon: Briefcase,    color: "#4338ca", bg: "#eef2ff" },
  { label: "Scholarships", icon: GraduationCap, color: "#6d28d9", bg: "#f5f3ff" },
  { label: "Fellowships",  icon: Handshake,    color: "#0e7490", bg: "#ecfeff" },
  { label: "Grants",       icon: Trophy,        color: "#047857", bg: "#ecfdf5" },
  { label: "Internships",  icon: Star,          color: "#c2410c", bg: "#fff7ed" },
];

type LandingContent = {
  hero: { badge: string; headline: string; subtext: string; cta_primary: string; cta_secondary: string };
  stats: { value: string; label: string }[];
  types_label: string;
  how_it_works: { title: string; subtitle: string; steps: { num: string; title: string; desc: string }[] };
  features: { title: string; subtitle: string; items: { icon: string; title: string; desc: string }[] };
  cta_banner: { title: string; subtitle: string; button: string };
};

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState<LandingContent | null>(null);

  // Fetch landing content immediately (public endpoint, no auth needed)
  useEffect(() => {
    getLandingContent()
      .then(r => setContent(r.data))
      .catch(() => {}); // silently fall through — content stays null → spinner stays until both resolve
  }, []);

  useEffect(() => {
    if (!authLoading && user) router.replace("/opportunities");
  }, [user, authLoading, router]);

  if (authLoading || !content) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }
  if (user) return null;

  const { hero, stats, types_label, how_it_works, features, cta_banner } = content;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "inherit" }}>

      {/* ── Navbar ── */}
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
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Opportunity Finder</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/login" style={{ padding: "6px 14px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)", textDecoration: "none", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            Sign in
          </Link>
          <Link href="/register" style={{ padding: "6px 16px", fontSize: "0.875rem", fontWeight: 700, color: "#fff", textDecoration: "none", borderRadius: "var(--radius-sm)", background: "var(--primary)" }}>
            {hero.cta_primary}
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "5rem 1.5rem 3.5rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "var(--primary-muted)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 999, fontSize: "0.775rem", fontWeight: 700, color: "var(--primary)", marginBottom: "1.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <Zap size={12} /> {hero.badge}
        </div>
        <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.12, color: "var(--text-1)", marginBottom: "1.25rem" }}>
          {hero.headline.split("AI").map((part, i, arr) =>
            i < arr.length - 1
              ? <span key={i}>{part}<span style={{ color: "var(--primary)" }}>AI</span></span>
              : <span key={i}>{part}</span>
          )}
        </h1>
        <p style={{ fontSize: "1.125rem", color: "var(--text-2)", maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.65 }}>
          {hero.subtext}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 28px", borderRadius: "var(--radius)", fontSize: "0.9375rem", fontWeight: 700, color: "#fff", textDecoration: "none", background: "var(--primary)", boxShadow: "0 4px 16px rgba(79,70,229,0.35)" }}>
            {hero.cta_primary} <ArrowRight size={16} />
          </Link>
          <Link href="/browse" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 28px", borderRadius: "var(--radius)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-1)", textDecoration: "none", background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <Search size={15} /> {hero.cta_secondary}
          </Link>
        </div>
      </section>

      {/* ── Stats bar ── */}
      {stats.length > 0 && (
        <section style={{ maxWidth: 760, margin: "0 auto 4rem", padding: "0 1.5rem" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem 2rem", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "1rem", boxShadow: "var(--shadow-sm)" }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Opportunity type pills ── */}
      <section style={{ maxWidth: 960, margin: "0 auto 5rem", padding: "0 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: "1.25rem" }}>
          {types_label}
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
      {how_it_works.steps.length > 0 && (
        <section style={{ background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "4.5rem 1.5rem" }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--text-1)" }}>
              {how_it_works.title}
            </h2>
            <p style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "3rem" }}>
              {how_it_works.subtitle}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
              {how_it_works.steps.map((s, i) => (
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
      )}

      {/* ── Features ── */}
      {features.items.length > 0 && (
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "5rem 1.5rem" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem", color: "var(--text-1)" }}>
            {features.title}
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "3rem" }}>
            {features.subtitle}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1.25rem" }}>
            {features.items.map((f, i) => {
              const IconComp = ICON_MAP[f.icon] || Sparkles;
              const style = ICON_STYLE[f.icon] || { color: "#4f46e5", bg: "#eef2ff" };
              return (
                <div key={i} className="card" style={{ padding: "1.5rem" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: style.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
                    <IconComp size={20} style={{ color: style.color }} />
                  </div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{f.title}</h3>
                  <p style={{ fontSize: "0.8375rem", color: "var(--text-2)", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CTA Banner ── */}
      <section style={{ maxWidth: 760, margin: "0 auto 5rem", padding: "0 1.5rem" }}>
        <div style={{ background: "var(--primary)", borderRadius: 16, padding: "3rem 2.5rem", textAlign: "center", boxShadow: "0 8px 32px rgba(79,70,229,0.28)" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: "0.625rem" }}>
            {cta_banner.title}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9375rem", marginBottom: "2rem" }}>
            {cta_banner.subtitle}
          </p>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 32px", borderRadius: "var(--radius)", fontWeight: 700, fontSize: "0.9375rem", color: "var(--primary)", textDecoration: "none", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            <Sparkles size={16} /> {cta_banner.button}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "1.75rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>
          © {new Date().getFullYear()} Opportunity Finder — AI-powered career discovery.{" "}
          <Link href="/login" style={{ color: "var(--text-3)", textDecoration: "none" }}>Sign in</Link>{" · "}
          <Link href="/register" style={{ color: "var(--text-3)", textDecoration: "none" }}>Register</Link>
        </p>
      </footer>
    </div>
  );
}
