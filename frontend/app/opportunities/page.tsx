"use client";
import { useState, useEffect, useMemo } from "react";
import { getRecommended, getOpportunityTypes } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import AILoadingState, { LoadingStep } from "@/components/AILoadingState";
import SkeletonCard from "@/components/SkeletonCard";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MapPin, Building, Calendar, ArrowUpRight, Loader2, RefreshCw, Database } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const RANKING_STEPS: LoadingStep[] = [
  { label: "Fetching latest opportunities…",  duration: 1500 },
  { label: "Reading your CV profile…",         duration: 3000 },
  { label: "Scoring each match with AI…",      duration: 7000 },
  { label: "Sorting by best fit…",             duration: 2000 },
  { label: "Almost ready!",                    duration: 1500 },
];

const RANKING_TIPS = [
  "A match score above 80% means you're a strong fit — apply with confidence!",
  "AI reads your full CV context, not just keywords. Projects and descriptions matter.",
  "Scores refresh each time you click 'Refresh' for the latest AI rankings.",
  "Opportunities with a deadline soon are prioritised within each score tier.",
  "Uploading an updated CV gives you fresher, more accurate match scores.",
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  job:         { bg: "#eef2ff", text: "#4338ca" },
  scholarship: { bg: "#f5f3ff", text: "#6d28d9" },
  fellowship:  { bg: "#ecfeff", text: "#0e7490" },
  grant:       { bg: "#ecfdf5", text: "#047857" },
  internship:  { bg: "#fff7ed", text: "#c2410c" },
};

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`toggle${on ? " on" : ""}`}
      />
      <span style={{ fontSize: "0.8125rem", color: on ? "var(--text-1)" : "var(--text-2)", fontWeight: on ? 500 : 400 }}>
        {label}
      </span>
    </label>
  );
}

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [allOpps, setAllOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [hideExpired, setHideExpired] = useState(true);
  const [hideBelow50, setHideBelow50] = useState(true);

  const fetchRecommended = async (forceRefresh = false) => {
    if (!user) return;
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await getRecommended(forceRefresh);
      setAllOpps(data.items);
      setFromCache(data.cached);
      if (forceRefresh) toast.success("Refreshed with latest AI rankings!");
    } catch (err: unknown) {
      toast.error((err as any)?.response?.data?.detail || "Failed to load opportunities");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getOpportunityTypes().then(r => setTypes(r.data.types)).catch(() => {});
    if (user?.parsed_cv) fetchRecommended(false);
    else setLoading(false);
  }, [user]);

  const toggleType = (t: string) =>
    setActiveTypes(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const filtered = useMemo(() => {
    let list = allOpps;
    if (hideBelow50) list = list.filter(o => o.match_score >= 50);
    if (hideExpired) list = list.filter(o => !o.deadline || new Date(o.deadline) >= today);
    if (activeTypes.size > 0) list = list.filter(o => activeTypes.has(o.type?.toLowerCase()));
    return list;
  }, [allOpps, hideBelow50, hideExpired, activeTypes, today]);

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-title" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
              For You <Sparkles size={20} style={{ color: "var(--primary)" }} />
            </h1>
            <p style={{ color: "var(--text-2)", marginTop: 4, fontSize: "0.875rem" }}>
              AI-ranked matches based on your uploaded CV.
              {fromCache && (
                <span style={{ marginLeft: 8 }}>
                  <Database size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                  Cached —{" "}
                  <button onClick={() => fetchRecommended(true)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "inherit", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
                    refresh
                  </button>
                </span>
              )}
            </p>
          </div>
          <button onClick={() => fetchRecommended(true)} disabled={refreshing} className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {refreshing ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />}
            {refreshing ? "Ranking…" : "Refresh"}
          </button>
        </div>

        {/* Filter bar */}
        {!loading && allOpps.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="card"
            style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.625rem", alignItems: "center" }}>

            {/* Type pills */}
            {types.map(t => {
              const active = activeTypes.has(t.toLowerCase());
              const col = TYPE_COLORS[t.toLowerCase()];
              return (
                <button key={t} onClick={() => toggleType(t.toLowerCase())} style={{
                  padding: "4px 12px", borderRadius: 999, fontSize: "0.775rem", fontWeight: 600,
                  cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
                  border: `1px solid ${active && col ? col.bg : "var(--border)"}`,
                  background: active && col ? col.bg : "transparent",
                  color: active && col ? col.text : "var(--text-2)",
                  fontFamily: "inherit",
                }}>
                  {t}
                </button>
              );
            })}

            <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px" }} />
            <Toggle on={hideBelow50} onToggle={() => setHideBelow50(v => !v)} label="Hide <50% matches" />
            <Toggle on={hideExpired} onToggle={() => setHideExpired(v => !v)} label="Hide expired" />

            <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
              {filtered.length} / {allOpps.length}
            </span>
          </motion.div>
        )}

        {/* Re-ranking banner */}
        <AnimatePresence>
          {refreshing && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="card" style={{ marginBottom: "1rem", padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: 12, borderLeft: "3px solid var(--primary)" }}>
              <Loader2 size={16} className="spinner" style={{ color: "var(--primary)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 6 }}>AI is re-ranking your matches…</p>
                <div className="progress-track"><div className="progress-fill" /></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No CV state */}
        {!user?.parsed_cv ? (
          <div className="card" style={{ padding: "3.5rem 2rem", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <Sparkles size={26} style={{ color: "var(--primary)" }} />
            </div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>No CV uploaded yet</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", maxWidth: 360, margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
              Upload your CV in your profile to let AI find and rank the best opportunities for you.
            </p>
            <Link href="/profile" className="btn btn-primary" style={{ display: "inline-flex", textDecoration: "none" }}>
              Go to Profile
            </Link>
          </div>

        ) : loading ? (
          <div>
            <div className="opp-grid" style={{ marginBottom: "1.5rem" }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
              <AILoadingState steps={RANKING_STEPS} tips={RANKING_TIPS} />
            </div>
          </div>

        ) : (
          <AnimatePresence mode="popLayout">
            <div className="opp-grid">
              {filtered.map((opp, idx) => {
                const isExpired = opp.deadline && new Date(opp.deadline) < today;
                const scoreHigh = opp.match_score >= 80;
                const scoreMid  = opp.match_score >= 50;
                const typeColor = TYPE_COLORS[opp.type?.toLowerCase()] || { bg: "#f1f5f9", text: "#475569" };

                return (
                  <motion.div
                    key={opp.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: isExpired ? 0.65 : 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                    className="card"
                    style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}
                  >
                    {/* Top row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: typeColor.bg, color: typeColor.text }}>
                        {opp.type}
                      </span>
                      <span className={`score-badge ${scoreHigh ? "score-high" : scoreMid ? "score-mid" : "score-low"}`}>
                        {opp.match_score}% match
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: "0.975rem", fontWeight: 700, lineHeight: 1.4, marginBottom: "0.625rem", color: "var(--text-1)" }}>
                      {opp.title}
                    </h3>

                    {/* Meta chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.875rem" }}>
                      {opp.organization && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.775rem", color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px" }}>
                          <Building size={11} /> {opp.organization}
                        </span>
                      )}
                      {opp.location && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.775rem", color: "var(--text-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px" }}>
                          <MapPin size={11} /> {opp.location}
                        </span>
                      )}
                      {opp.deadline && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.775rem", background: isExpired ? "var(--danger-muted)" : "var(--surface-2)", border: `1px solid ${isExpired ? "#fecaca" : "var(--border)"}`, color: isExpired ? "var(--danger)" : "var(--text-2)", borderRadius: 999, padding: "2px 8px", fontWeight: isExpired ? 600 : 400 }}>
                          <Calendar size={11} /> {isExpired ? "Expired: " : ""}{new Date(opp.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* AI reason */}
                    {opp.match_reason && (
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", fontStyle: "italic", borderLeft: "2px solid var(--primary-muted)", paddingLeft: "0.75rem", marginBottom: "1rem", lineHeight: 1.55, background: "var(--primary-muted)", padding: "0.5rem 0.625rem 0.5rem 0.75rem", borderRadius: "0 6px 6px 0" }}>
                        "{opp.match_reason}"
                      </p>
                    )}

                    {/* CTA */}
                    <a href={opp.url} target="_blank" rel="noreferrer" className="btn btn-primary"
                      style={{ marginTop: "auto", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      View Opportunity <ArrowUpRight size={13} />
                    </a>
                  </motion.div>
                );
              })}

              {filtered.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", color: "var(--text-2)" }}>
                  No results match the current filters.
                </div>
              )}
            </div>
          </AnimatePresence>
        )}
      </main>
    </>
  );
}
