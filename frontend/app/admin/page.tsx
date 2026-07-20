"use client";
import { useState, useEffect, useCallback } from "react";
import { triggerIngest, triggerEmails, backfillWp, getIngestionRuns, getAdminOpportunities, getOpportunityTypes, getStats, getEmailLogs } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Database, Play, RefreshCw, Loader2, Key,
  Search, ChevronLeft, ChevronRight, ExternalLink,
  MapPin, Building, Calendar, Filter, BarChart2, Briefcase, Mail, Users, Wand2
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
interface Run { id: number; source: string; status: string; started_at: string; fetched: number; created: number; updated: number; }
interface Opp { id: number; title: string; type: string; organization: string | null; location: string | null; country: string | null; deadline: string | null; posted_at: string | null; url: string; is_active: boolean; source: string; }
interface Stats { total: number; active: number; by_type: Record<string, number>; sources?: { source: string }[]; total_users?: number; }
interface EmailLog { id: number; user_id: number; user_email: string; email_type: string; status: string; error_message: string | null; sent_at: string; }

// ── Tab component ──────────────────────────────────────────────────────
function Tab({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon: any }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 20px", borderRadius: 10, fontSize: "0.9rem", fontWeight: 600,
      background: active ? "rgba(124,106,255,0.15)" : "transparent",
      color: active ? "#fff" : "var(--text-secondary)",
      border: `1px solid ${active ? "rgba(124,106,255,0.4)" : "transparent"}`,
      cursor: "pointer", transition: "all 0.15s",
    }}>
      <Icon size={16} /> {label}
    </button>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "ingest" | "emails">("overview");

  // ── Auth guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (user && user.role !== "admin") router.push("/opportunities");
  }, [user, router]);

  // ── Ingest state ────────────────────────────────────────────────────
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<null | { records_updated: number; deadline_filled: number; organization_filled: number; location_filled: number; total_wp_records: number }>(null);

  const loadRuns = async () => {
    setRunsLoading(true);
    try {
      const { data } = await getIngestionRuns();
      setRuns(data);
    } catch { toast.error("Failed to load runs."); }
    finally { setRunsLoading(false); }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerIngest();
      toast.success("Ingestion triggered in background!");
      setTimeout(loadRuns, 2500);
    } catch { toast.error("Failed to trigger ingestion"); }
    finally { setTriggering(false); }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const { data } = await backfillWp();
      setBackfillResult(data);
      toast.success(`Backfill done — ${data.records_updated} records updated.`);
    } catch { toast.error("Backfill failed."); }
    finally { setBackfilling(false); }
  };

  // ── Email Logs state ────────────────────────────────────────────────
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [triggeringEmails, setTriggeringEmails] = useState(false);

  const loadEmailLogs = useCallback(async () => {
    setEmailLogsLoading(true);
    try {
      const { data } = await getEmailLogs();
      setEmailLogs(data);
    } catch { toast.error("Failed to load email logs."); }
    finally { setEmailLogsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "emails") loadEmailLogs();
  }, [activeTab, loadEmailLogs]);

  const handleTriggerEmails = async () => {
    setTriggeringEmails(true);
    try {
      await triggerEmails();
      toast.success("Emails triggered in background!");
      setTimeout(loadEmailLogs, 2500);
    } catch { toast.error("Failed to trigger emails"); }
    finally { setTriggeringEmails(false); }
  };

  // ── Overview / Stats ────────────────────────────────────────────────
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  // ── Jobs browser state ──────────────────────────────────────────────
  const [opps, setOpps] = useState<Opp[]>([]);
  const [total, setTotal] = useState(0);
  const [oppsLoading, setOppsLoading] = useState(false);
  const [types, setTypes] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [sortCol, setSortCol] = useState("posted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    getOpportunityTypes().then(r => setTypes(r.data.types)).catch(() => {});
  }, []);

  const handleSort = (col: string) => {
    if (col === sortCol) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  const fetchOpps = useCallback(async () => {
    setOppsLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE, sort_by: sortCol, sort_dir: sortDir };
      if (search.trim()) params.q = search.trim().split(/\s+/).slice(0, 5);
      if (filterType) params.type = filterType;
      if (filterSource) params.source = filterSource;
      if (filterCountry) params.country = filterCountry;
      if (activeOnly) params.active_only = true;
      const { data } = await getAdminOpportunities(params);
      setOpps(data.items);
      setTotal(data.total);
    } catch { toast.error("Failed to load opportunities"); }
    finally { setOppsLoading(false); }
  }, [page, search, filterType, filterSource, filterCountry, activeOnly, sortCol, sortDir]);

  useEffect(() => {
    if (activeTab === "jobs") fetchOpps();
  }, [activeTab, fetchOpps]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const today = new Date();

  if (!user || user.role !== "admin") return null;

  const TYPE_COLORS: Record<string, string> = {
    job: "#a89aff", scholarship: "#00d4ff", fellowship: "#f472b6",
    grant: "#4ade80", internship: "#fbbf24",
  };

  return (
    <>
      <Navbar />
      <main className="main-pad" style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Page header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 className="page-h1" style={{ fontSize: "2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <Database style={{ color: "#7c6aff" }} size={26} /> Admin Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Manage ingestion, browse and filter all opportunities.</p>
        </div>

        {/* Tabs */}
        <div className="tabs-row" style={{ display: "flex", gap: 8, marginBottom: "1.75rem", flexWrap: "wrap" }}>
          <Tab label="Overview" icon={BarChart2} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <Tab label="All Opportunities" icon={Briefcase} active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} />
          <Tab label="Ingestion" icon={Play} active={activeTab === "ingest"} onClick={() => setActiveTab("ingest")} />
          <Tab label="Email Logs" icon={Mail} active={activeTab === "emails"} onClick={() => setActiveTab("emails")} />
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.25rem" }}>
            <div className="glass" style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Users size={13} /> TOTAL USERS
              </p>
              <p style={{ fontSize: "2.5rem", fontWeight: 800, background: "linear-gradient(135deg,#f472b6,#7c6aff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{stats?.total_users ?? "—"}</p>
            </div>
            <div className="glass" style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600, marginBottom: 8 }}>TOTAL OPPORTUNITIES</p>
              <p style={{ fontSize: "2.5rem", fontWeight: 800, background: "linear-gradient(135deg,#7c6aff,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{stats?.total ?? "—"}</p>
            </div>
            <div className="glass" style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600, marginBottom: 8 }}>ACTIVE</p>
              <p style={{ fontSize: "2.5rem", fontWeight: 800, color: "#22c55e" }}>{stats?.active ?? "—"}</p>
            </div>
            {stats && Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([t, count]) => (
              <div key={t} className="glass" style={{ padding: "1.5rem", textAlign: "center" }}>
                <p style={{ color: TYPE_COLORS[t] || "#aaa", fontSize: "0.8rem", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>{t}</p>
                <p style={{ fontSize: "2.5rem", fontWeight: 800 }}>{count}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── JOBS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "jobs" && (
          <div>
            {/* Filter bar */}
            <div className="glass" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
              {/* Search */}
              <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <Search size={12} /> Keyword Search
                </label>
                <input className="input" placeholder="Python, scholarship, Dhaka…" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  onKeyDown={e => e.key === "Enter" && fetchOpps()}
                  style={{ padding: "0.6rem 0.85rem" }}
                />
              </div>

              {/* Type */}
              <div style={{ flex: "0 1 160px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Type</label>
                <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}>
                  <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>All types</option>
                  {types.map(t => <option key={t} value={t} style={{ background: "#ffffff", color: "#0f172a" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              {/* Source */}
              <div style={{ flex: "0 1 160px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Source</label>
                <select className="input" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}
                  style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}>
                  <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>All sources</option>
                  {stats?.sources?.map((s: any) => <option key={s.source} value={s.source} style={{ background: "#ffffff", color: "#0f172a" }}>{s.source}</option>)}
                </select>
              </div>

              {/* Country */}
              <div style={{ flex: "0 1 140px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Country</label>
                <input className="input" placeholder="BD, US…" value={filterCountry}
                  onChange={e => { setFilterCountry(e.target.value); setPage(1); }}
                  style={{ padding: "0.6rem 0.85rem" }} />
              </div>

              {/* Active only toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: activeOnly ? "var(--text-primary)" : "var(--text-secondary)", paddingBottom: 2 }}>
                <div onClick={() => { setActiveOnly(v => !v); setPage(1); }}
                  style={{ width: 38, height: 20, borderRadius: 999, background: activeOnly ? "#6366f1" : "rgba(0,0,0,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: activeOnly ? "calc(100% - 18px)" : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
                Active only
              </label>

              <button onClick={() => { setPage(1); fetchOpps(); }} className="btn-primary" style={{ height: 38, display: "flex", alignItems: "center", gap: 6, paddingTop: 0, paddingBottom: 0 }}>
                {oppsLoading ? <Loader2 size={15} className="spinner" /> : <Filter size={15} />} Apply
              </button>

              <button onClick={() => { setSearch(""); setFilterType(""); setFilterSource(""); setFilterCountry(""); setActiveOnly(false); setPage(1); setTimeout(fetchOpps, 50); }}
                className="btn-ghost" style={{ height: 38, fontSize: "0.82rem", paddingTop: 0, paddingBottom: 0 }}>
                Clear
              </button>
            </div>

            {/* Result count */}
            <div style={{ marginBottom: "0.75rem", color: "var(--text-secondary)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
              <span>
                {oppsLoading ? "Loading…" : <><strong style={{ color: "var(--text-primary)" }}>{total.toLocaleString()}</strong> results · page {page}/{totalPages || 1}</>}
              </span>
              <button onClick={fetchOpps} className="btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 5 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {/* Table */}
            <div className="glass" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: 800 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                      {([
                        { label: "Type", col: "type", sortable: true },
                        { label: "Title", col: "title", sortable: true },
                        { label: "Organisation", col: "organization", sortable: true },
                        { label: "Location", col: null, sortable: false },
                        { label: "Deadline", col: "deadline", sortable: true },
                        { label: "Source", col: "source", sortable: true },
                        { label: "Status", col: null, sortable: false },
                        { label: "", col: null, sortable: false },
                      ] as { label: string; col: string | null; sortable: boolean }[]).map(({ label, col, sortable }) => {
                        const active = sortable && col === sortCol;
                        const arrow = !active ? "↕" : sortDir === "asc" ? "↑" : "↓";
                        return (
                          <th key={label || "action"}
                            onClick={sortable && col ? () => handleSort(col) : undefined}
                            style={{ padding: "12px 14px", color: active ? "#7c6aff" : "var(--text-secondary)", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", cursor: sortable ? "pointer" : "default", userSelect: "none" }}>
                            {label}{sortable && <span style={{ opacity: active ? 1 : 0.35, marginLeft: 3 }}>{arrow}</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {oppsLoading ? (
                      <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center" }}>
                        <Loader2 size={28} className="spinner" style={{ margin: "0 auto", color: "#7c6aff" }} />
                      </td></tr>
                    ) : opps.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>No opportunities match the current filters.</td></tr>
                    ) : opps.map((opp, i) => {
                      const expired = opp.deadline && new Date(opp.deadline) < today;
                      const color = TYPE_COLORS[opp.type?.toLowerCase()] || "#aaa";
                      return (
                        <tr key={opp.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)")}>

                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, textTransform: "capitalize", background: `${color}22`, color }}>{opp.type}</span>
                          </td>

                          <td style={{ padding: "11px 14px", maxWidth: 320 }}>
                            <span style={{ fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opp.title}</span>
                          </td>

                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {opp.organization ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building size={12} />{opp.organization}</span> : "—"}
                          </td>

                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {opp.location || opp.country ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{opp.location || opp.country}</span> : "—"}
                          </td>

                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            {opp.deadline ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, color: expired ? "#ef4444" : "var(--text-secondary)", fontWeight: expired ? 600 : 400 }}>
                                <Calendar size={12} />{new Date(opp.deadline).toLocaleDateString()}
                                {expired && <span style={{ fontSize: "0.7rem", background: "rgba(239,68,68,0.12)", color: "#ef4444", padding: "1px 6px", borderRadius: 4 }}>Expired</span>}
                              </span>
                            ) : "—"}
                          </td>

                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>{opp.source}</td>

                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: opp.is_active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)", color: opp.is_active ? "#4ade80" : "#f87171" }}>
                              {opp.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td style={{ padding: "11px 14px" }}>
                            <a href={opp.url} target="_blank" rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.8rem", transition: "all 0.15s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}>
                              <ExternalLink size={11} /> View
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", opacity: page === 1 ? 0.4 : 1 }}>
                    <ChevronLeft size={16} /> Prev
                  </button>

                  <div className="pagination-numbers" style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 7) p = i + 1;
                      else if (page <= 4) p = i + 1;
                      else if (page >= totalPages - 3) p = totalPages - 6 + i;
                      else p = page - 3 + i;
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}`, background: p === page ? "rgba(124,106,255,0.15)" : "transparent", color: p === page ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: "0.85rem", fontWeight: p === page ? 700 : 400, transition: "all 0.15s" }}>
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", opacity: page === totalPages ? 0.4 : 1 }}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INGESTION TAB ────────────────────────────────────────────── */}
        {activeTab === "ingest" && (
          <div>
            <div className="glass" style={{ padding: "1.5rem", marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <button onClick={loadRuns} disabled={runsLoading} className="btn-ghost" style={{ height: 42, display: "flex", alignItems: "center", gap: 8 }}>
                {runsLoading ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />} Refresh Logs
              </button>
              <button onClick={handleTrigger} disabled={triggering} className="btn-primary" style={{ height: 42, display: "flex", alignItems: "center", gap: 8 }}>
                {triggering ? <Loader2 size={16} className="spinner" /> : <Play size={16} />} Trigger Manual Ingest
              </button>
              <div style={{ borderLeft: "1px solid var(--border)", height: 28, alignSelf: "center", margin: "0 4px" }} />
              <button onClick={handleBackfill} disabled={backfilling} className="btn-ghost" style={{ height: 42, display: "flex", alignItems: "center", gap: 8, borderColor: "#f59e0b", color: "#f59e0b" }}>
                {backfilling ? <Loader2 size={16} className="spinner" /> : <Wand2 size={16} />} Backfill WP Data
              </button>
            </div>

            {backfillResult && (
              <div className="glass" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Scanned <strong style={{ color: "var(--text-primary)" }}>{backfillResult.total_wp_records}</strong> WP records
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Updated <strong style={{ color: "#4ade80" }}>{backfillResult.records_updated}</strong> total
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Deadlines filled: <strong style={{ color: "#f59e0b" }}>{backfillResult.deadline_filled}</strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Organisations filled: <strong style={{ color: "#a89aff" }}>{backfillResult.organization_filled}</strong>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Locations filled: <strong style={{ color: "#00d4ff" }}>{backfillResult.location_filled}</strong>
                </div>
              </div>
            )}


            <div className="glass" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Recent Ingestion Runs</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["ID", "Source", "Status", "Started At", "Fetched", "Created", "Updated"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
                        Click "Refresh Logs" to load ingestion history.
                      </td></tr>
                    ) : runs.map(run => (
                      <tr key={run.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>#{run.id}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{run.source}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", background: run.status === "completed" ? "rgba(34,197,94,0.1)" : run.status === "error" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: run.status === "completed" ? "#4ade80" : run.status === "error" ? "#f87171" : "#fbbf24" }}>
                            {run.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.82rem" }}>{new Date(run.started_at).toLocaleString()}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>{run.fetched}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#4ade80" }}>{run.created}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#fbbf24" }}>{run.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── EMAIL LOGS TAB ───────────────────────────────────────────── */}
        {activeTab === "emails" && (
          <div>
            <div className="glass" style={{ padding: "1.5rem", marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-end" }}>
              <button onClick={loadEmailLogs} disabled={emailLogsLoading} className="btn-ghost" style={{ height: 42, display: "flex", alignItems: "center", gap: 8 }}>
                {emailLogsLoading ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />} Refresh Logs
              </button>
              <button onClick={handleTriggerEmails} disabled={triggeringEmails} className="btn-primary" style={{ height: 42, display: "flex", alignItems: "center", gap: 8 }}>
                {triggeringEmails ? <Loader2 size={16} className="spinner" /> : <Play size={16} />} Trigger Manual Emails
              </button>
            </div>

            <div className="glass" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Recent Email Deliveries</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["ID", "User Email", "Type", "Status", "Sent At", "Error Message"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-secondary)" }}>
                        {emailLogsLoading ? "Loading..." : "No email logs found."}
                      </td></tr>
                    ) : emailLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>#{log.id}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{log.user_email || `User #${log.user_id}`}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 4, background: "rgba(0,0,0,0.05)", fontSize: "0.75rem", fontWeight: 600 }}>
                            {log.email_type === "daily_digest" ? "Daily Digest" : log.email_type === "deadline_alert" ? "Deadline Alert" : log.email_type}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", background: log.status === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: log.status === "success" ? "#4ade80" : "#f87171" }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.82rem" }}>{new Date(log.sent_at).toLocaleString()}</td>
                        <td style={{ padding: "12px 16px", color: "#f87171", fontSize: "0.82rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error_message || ""}>
                          {log.error_message || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
