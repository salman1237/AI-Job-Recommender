"use client";
import { useState, useEffect, useMemo } from "react";
import { getRecommended, getOpportunityTypes } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import AILoadingState, { LoadingStep } from "@/components/AILoadingState";
import SkeletonCard from "@/components/SkeletonCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, MapPin, Building, Calendar, ArrowUpRight,
  Loader2, RefreshCw, Database, Filter
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const RANKING_STEPS: LoadingStep[] = [
  { label: "Fetching latest opportunities…",   duration: 1500 },
  { label: "Reading your CV profile…",          duration: 3000 },
  { label: "Scoring each match with Gemini AI…", duration: 7000 },
  { label: "Sorting by best fit…",              duration: 2000 },
  { label: "Almost ready!",                     duration: 1500 },
];

const RANKING_TIPS = [
  "A match score above 80% means you're a strong fit — don't hesitate to apply!",
  "Gemini AI reads your full CV, not just keywords. Projects and descriptions matter.",
  "Scores refresh each time you click 'Refresh with AI' for the latest rankings.",
  "Opportunities with a deadline soon are shown first within each score tier.",
  "Uploading an updated CV gives you fresher, more accurate match scores.",
];

export default function OpportunitiesPage() {
  const { user } = useAuth();

  // Raw data from API
  const [allOpportunities, setAllOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  // Filter state
  const [types, setTypes] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [hideExpired, setHideExpired] = useState(true);
  const [hideBelow50, setHideBelow50] = useState(true);

  const fetchTypes = async () => {
    try {
      const { data } = await getOpportunityTypes();
      setTypes(data.types);
    } catch { /* ignore */ }
  };

  const fetchRecommended = async (forceRefresh = false) => {
    if (!user) return;
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await getRecommended(forceRefresh);
      setAllOpportunities(data.items);
      setFromCache(data.cached);
      setCachedAt(forceRefresh ? new Date().toLocaleTimeString() : null);
      if (forceRefresh) toast.success("Refreshed with latest AI rankings!");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.detail || "Failed to load opportunities";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTypes();
    if (user?.parsed_cv) fetchRecommended(false);
    else setLoading(false);
  }, [user]);

  const toggleType = (t: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    let list = allOpportunities;
    // Filter <50% score
    if (hideBelow50) list = list.filter(o => o.match_score >= 50);
    // Filter expired
    if (hideExpired) {
      list = list.filter(o => {
        if (!o.deadline) return true;
        return new Date(o.deadline) >= today;
      });
    }
    // Filter by type
    if (activeTypes.size > 0) {
      list = list.filter(o => activeTypes.has(o.type?.toLowerCase()));
    }
    return list;
  }, [allOpportunities, hideBelow50, hideExpired, activeTypes]);

  const TYPE_COLORS: Record<string, string> = {
    job: "#a89aff",
    scholarship: "#00d4ff",
    fellowship: "#f472b6",
    grant: "#4ade80",
    internship: "#fbbf24",
  };

  return (
    <>
      <Navbar />
      <main className="main-pad" style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>
        
        {/* Header */}
        <div className="page-header-row" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-h1" style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
              For You <Sparkles size={24} style={{ color: "#7c6aff" }} />
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: "0.9rem" }}>
              AI-ranked matches based on your uploaded CV.{" "}
              {fromCache && (
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  <Database size={12} style={{ display: "inline", marginRight: 4 }} />
                  Loaded from cache — <button onClick={() => fetchRecommended(true)} style={{ background: "none", border: "none", color: "var(--accent-2)", cursor: "pointer", fontSize: "inherit", textDecoration: "underline", padding: 0 }}>click to refresh</button>
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchRecommended(true)}
            disabled={refreshing}
            className="btn-primary btn-full-mobile"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {refreshing ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
            {refreshing ? "Ranking with AI..." : "Refresh with AI"}
          </button>
        </div>

        {/* Filter bar */}
        {!loading && allOpportunities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass"
            style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} /> Filters
            </span>

            <div style={{ width: 1, height: 20, background: "var(--border)" }} />

            {/* Type toggles */}
            {types.map(t => {
              const active = activeTypes.has(t.toLowerCase());
              const color = TYPE_COLORS[t.toLowerCase()] || "#aaa";
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t.toLowerCase())}
                  style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600,
                    cursor: "pointer", border: `1px solid ${active ? color : "var(--border)"}`,
                    background: active ? `${color}22` : "transparent",
                    color: active ? color : "var(--text-secondary)",
                    textTransform: "capitalize", transition: "all 0.15s",
                  }}
                >
                  {t}
                </button>
              );
            })}

            <div style={{ width: 1, height: 20, background: "var(--border)" }} />

            {/* Hide below 50% toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: hideBelow50 ? "var(--text-primary)" : "var(--text-secondary)" }}>
              <div
                onClick={() => setHideBelow50(v => !v)}
                style={{
                  width: 40, height: 22, borderRadius: 999,
                  background: hideBelow50 ? "#6366f1" : "rgba(0,0,0,0.1)",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: hideBelow50 ? "calc(100% - 19px)" : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s",
                }} />
              </div>
              Hide &lt;50% matches
            </label>

            {/* Hide expired toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: hideExpired ? "var(--text-primary)" : "var(--text-secondary)" }}>
              <div
                onClick={() => setHideExpired(v => !v)}
                style={{
                  width: 40, height: 22, borderRadius: 999,
                  background: hideExpired ? "#0ea5e9" : "rgba(0,0,0,0.1)",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: hideExpired ? "calc(100% - 19px)" : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s",
                }} />
              </div>
              Hide expired
            </label>

            {/* Result count */}
            <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Showing <strong style={{ color: "var(--text-primary)" }}>{filtered.length}</strong> / {allOpportunities.length}
            </span>
          </motion.div>
        )}

        {/* Re-ranking banner (shown over existing cards) */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass"
              style={{
                marginBottom: "1.25rem",
                padding: "1rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderColor: "rgba(124,106,255,0.3)",
                background: "rgba(124,106,255,0.07)",
              }}
            >
              <Loader2 size={18} className="spinner" style={{ color: "#7c6aff", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Gemini AI is re-ranking your matches…
                </p>
                <div className="progress-bar-track" style={{ marginTop: 8 }}>
                  <div className="progress-bar-fill" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* States */}
        {!user?.parsed_cv ? (
          <div className="glass" style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>No CV Found</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", maxWidth: 400, margin: "0 auto 2rem" }}>
              Upload your CV in your profile to let Gemini AI find and rank the best opportunities for you.
            </p>
            <Link href="/profile" className="btn-primary" style={{ display: "inline-flex", textDecoration: "none" }}>
              Go to Profile
            </Link>
          </div>
        ) : loading ? (
          <div>
            {/* Skeleton card grid */}
            <div className="opp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            {/* AI progress panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass"
              style={{ maxWidth: 520, margin: "0 auto" }}
            >
              <AILoadingState steps={RANKING_STEPS} tips={RANKING_TIPS} />
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="opp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: "1.25rem" }}>
              {filtered.map((opp, idx) => {
                const isExpired = opp.deadline && new Date(opp.deadline) < today;
                const scoreHigh = opp.match_score >= 80;
                const scoreMid = opp.match_score >= 50;

                return (
                  <motion.div
                    key={opp.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.6) }}
                    className="glass"
                    style={{ padding: "1.4rem", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", opacity: isExpired ? 0.6 : 1 }}
                  >
                    {/* Score glow */}
                    <div style={{ position: "absolute", top: -50, right: -50, width: 100, height: 100, borderRadius: "50%", background: scoreHigh ? "#22c55e" : scoreMid ? "#f59e0b" : "#ef4444", filter: "blur(48px)", opacity: 0.12, pointerEvents: "none" }} />

                    {/* Header row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
                      <span className={`type-badge type-${opp.type?.toLowerCase()}`}>{opp.type}</span>
                      <span className={`score-badge ${scoreHigh ? "score-high" : scoreMid ? "score-mid" : "score-low"}`}>
                        {opp.match_score}%
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.4, marginBottom: 8 }}>{opp.title}</h3>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: "0.9rem", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                      {opp.organization && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building size={12} />{opp.organization}</span>}
                      {opp.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{opp.location}</span>}
                      {opp.deadline && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: isExpired ? "#ef4444" : "inherit" }}>
                          <Calendar size={12} />
                          {isExpired ? "Expired: " : ""}{new Date(opp.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {opp.match_reason && (
                      <div style={{ background: "rgba(0,0,0,0.03)", padding: "10px 12px", borderRadius: 8, fontSize: "0.82rem", color: "var(--text-secondary)", borderLeft: "2px solid var(--accent)", fontStyle: "italic", marginBottom: "1.2rem", lineHeight: 1.5 }}>
                        "{opp.match_reason}"
                      </div>
                    )}

                    <a href={opp.url} target="_blank" rel="noreferrer" className="btn-primary" style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                      View Details <ArrowUpRight size={14} />
                    </a>
                  </motion.div>
                );
              })}
              {filtered.length === 0 && !loading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-secondary)", padding: "3rem" }}
                >
                  No results match the current filters.
                </motion.p>
              )}
            </div>
          </AnimatePresence>
        )}
      </main>
    </>
  );
}
