"use client";
import { useState, useEffect, useCallback } from "react";
import {
  triggerIngest, triggerEmails, backfillWp, getIngestionRuns,
  getAdminOpportunities, getOpportunityTypes, getStats, getEmailLogs
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Database, Play, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight,
  ExternalLink, MapPin, Building, Calendar, Filter, BarChart2, Briefcase,
  Mail, Users, Wand2, X, TrendingUp, CheckCircle
} from "lucide-react";

interface Run { id: number; source: string; status: string; started_at: string; fetched: number; created: number; updated: number; }
interface Opp { id: number; title: string; type: string; organization: string | null; location: string | null; country: string | null; deadline: string | null; posted_at: string | null; url: string; is_active: boolean; source: string; }
interface Stats { total: number; active: number; by_type: Record<string, number>; sources?: { source: string }[]; total_users?: number; }
interface EmailLog { id: number; user_id: number; user_email: string; email_type: string; status: string; error_message: string | null; sent_at: string; }

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  job:         { bg: "#eef2ff", text: "#4338ca" },
  scholarship: { bg: "#f5f3ff", text: "#6d28d9" },
  fellowship:  { bg: "#ecfeff", text: "#0e7490" },
  grant:       { bg: "#ecfdf5", text: "#047857" },
  internship:  { bg: "#fff7ed", text: "#c2410c" },
};

const PAGE_SIZE = 25;

function StatCard({ label, value, color, icon: Icon }: { label: string; value: string | number; color?: string; icon: any }) {
  return (
    <div className="stat-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-2)" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} style={{ color: color || "var(--text-2)" }} />
        </div>
      </div>
      <p style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", color: color || "var(--text-1)", lineHeight: 1 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "ingest" | "emails">("overview");

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/opportunities");
  }, [user, router]);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { getStats().then(r => setStats(r.data)).catch(() => {}); }, []);

  // Ingest
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<null | { processed: number; total: number; pct: number; updated: number; deadline_filled: number; org_filled: number; loc_filled: number }>(null);
  const [backfillResult, setBackfillResult] = useState<null | { records_updated: number; deadline_filled: number; organization_filled: number; location_filled: number; total_wp_records: number; skipped_no_raw: number; skipped_no_content: number; skipped_already_complete: number }>(null);

  const loadRuns = async () => {
    setRunsLoading(true);
    try { const { data } = await getIngestionRuns(); setRuns(data); }
    catch { toast.error("Failed to load runs."); }
    finally { setRunsLoading(false); }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try { await triggerIngest(); toast.success("Ingestion triggered in background!"); setTimeout(loadRuns, 2500); }
    catch { toast.error("Failed to trigger ingestion"); }
    finally { setTriggering(false); }
  };

  const handleBackfill = async () => {
    setBackfilling(true); setBackfillProgress(null); setBackfillResult(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    try {
      const resp = await fetch(`${API_URL}/admin/backfill-wp`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "start") setBackfillProgress({ processed: 0, total: ev.total, pct: 0, updated: 0, deadline_filled: 0, org_filled: 0, loc_filled: 0 });
            else if (ev.type === "progress") setBackfillProgress(ev);
            else if (ev.type === "done") { setBackfillProgress(null); setBackfillResult(ev); toast.success(`Backfill done — ${ev.records_updated} records updated.`); }
            else if (ev.type === "error") toast.error(`Backfill error: ${ev.message}`);
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) { toast.error(`Backfill failed: ${(err as Error)?.message ?? "network error"}`); }
    finally { setBackfilling(false); }
  };

  // Emails
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [triggeringEmails, setTriggeringEmails] = useState(false);

  const loadEmailLogs = useCallback(async () => {
    setEmailLogsLoading(true);
    try { const { data } = await getEmailLogs(); setEmailLogs(data); }
    catch { toast.error("Failed to load email logs."); }
    finally { setEmailLogsLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "emails") loadEmailLogs(); }, [activeTab, loadEmailLogs]);

  const handleTriggerEmails = async () => {
    setTriggeringEmails(true);
    try { await triggerEmails(); toast.success("Emails triggered in background!"); setTimeout(loadEmailLogs, 2500); }
    catch { toast.error("Failed to trigger emails"); }
    finally { setTriggeringEmails(false); }
  };

  // Opportunities browser
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

  useEffect(() => { getOpportunityTypes().then(r => setTypes(r.data.types)).catch(() => {}); }, []);

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
      setOpps(data.items); setTotal(data.total);
    } catch { toast.error("Failed to load opportunities"); }
    finally { setOppsLoading(false); }
  }, [page, search, filterType, filterSource, filterCountry, activeOnly, sortCol, sortDir]);

  useEffect(() => { if (activeTab === "jobs") fetchOpps(); }, [activeTab, fetchOpps]);

  const handleSort = (col: string) => {
    if (col === sortCol) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const today = new Date();

  if (!user || user.role !== "admin") return null;

  const tabs = [
    { id: "overview", label: "Overview",    icon: BarChart2 },
    { id: "jobs",     label: "Opportunities", icon: Briefcase },
    { id: "ingest",   label: "Ingestion",   icon: Database },
    { id: "emails",   label: "Email Logs",  icon: Mail },
  ] as const;

  const SortTh = ({ label, col }: { label: string; col: string }) => {
    const active = sortCol === col;
    return (
      <th onClick={() => handleSort(col)} className={`th-sortable${active ? " th-active" : ""}`}>
        {label} <span style={{ opacity: active ? 1 : 0.3, marginLeft: 2 }}>{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </th>
    );
  };

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="page-title" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={22} style={{ color: "var(--primary)" }} /> Admin Dashboard
          </h1>
          <p style={{ color: "var(--text-2)", marginTop: 4, fontSize: "0.875rem" }}>
            Manage ingestion, browse all opportunities, and monitor email deliveries.
          </p>
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`tab-btn${activeTab === id ? " active" : ""}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <StatCard label="Total Users" value={stats?.total_users ?? "—"} color="var(--primary)" icon={Users} />
              <StatCard label="Total Opportunities" value={stats?.total ?? "—"} icon={Briefcase} />
              <StatCard label="Active" value={stats?.active ?? "—"} color="var(--success)" icon={TrendingUp} />
              {stats && Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([t, count]) => {
                const tc = TYPE_COLORS[t] || { text: "var(--text-2)" };
                return <StatCard key={t} label={t} value={count} color={tc.text} icon={Briefcase} />;
              })}
            </div>
          </div>
        )}

        {/* ── OPPORTUNITIES ── */}
        {activeTab === "jobs" && (
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
              <div className="filter-bar">
                <div style={{ flex: "2 1 200px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Search</label>
                  <div style={{ position: "relative" }}>
                    <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
                    <input className="input" placeholder="keyword…" value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      onKeyDown={e => e.key === "Enter" && fetchOpps()}
                      style={{ paddingLeft: "2rem" }} />
                  </div>
                </div>
                <div style={{ flex: "1 1 130px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Type</label>
                  <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                    <option value="">All types</option>
                    {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 130px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Source</label>
                  <select className="input" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}>
                    <option value="">All sources</option>
                    {stats?.sources?.map((s: any) => <option key={s.source} value={s.source}>{s.source}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Country</label>
                  <input className="input" placeholder="BD, US…" value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setPage(1); }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, justifyContent: "flex-end", paddingBottom: 1 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none", fontSize: "0.8125rem" }}>
                    <button type="button" role="switch" aria-checked={activeOnly}
                      onClick={() => { setActiveOnly(v => !v); setPage(1); }}
                      className={`toggle${activeOnly ? " on" : ""}`} />
                    Active only
                  </label>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", paddingBottom: 1 }}>
                  <button onClick={() => { setPage(1); fetchOpps(); }} className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {oppsLoading ? <Loader2 size={14} className="spinner" /> : <Filter size={14} />} Apply
                  </button>
                  <button onClick={() => { setSearch(""); setFilterType(""); setFilterSource(""); setFilterCountry(""); setActiveOnly(false); setPage(1); setTimeout(fetchOpps, 50); }}
                    className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <X size={13} /> Clear
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--text-2)", display: "flex", justifyContent: "space-between" }}>
              <span>{oppsLoading ? "Loading…" : <><strong style={{ color: "var(--text-1)" }}>{total.toLocaleString()}</strong> results · page {page}/{totalPages || 1}</>}</span>
              <button onClick={fetchOpps} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ minWidth: 800 }}>
                  <thead>
                    <tr>
                      <SortTh label="Type" col="type" />
                      <SortTh label="Title" col="title" />
                      <SortTh label="Organisation" col="organization" />
                      <th>Location</th>
                      <SortTh label="Deadline" col="deadline" />
                      <SortTh label="Source" col="source" />
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {oppsLoading ? (
                      <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center" }}>
                        <Loader2 size={26} className="spinner" style={{ color: "var(--primary)", margin: "0 auto" }} />
                      </td></tr>
                    ) : opps.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-2)" }}>No opportunities found.</td></tr>
                    ) : opps.map(opp => {
                      const expired = opp.deadline && new Date(opp.deadline) < today;
                      const tc = TYPE_COLORS[opp.type?.toLowerCase()] || { bg: "#f1f5f9", text: "#475569" };
                      return (
                        <tr key={opp.id}>
                          <td><span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: tc.bg, color: tc.text }}>{opp.type}</span></td>
                          <td style={{ maxWidth: 300 }}><span className="truncate-2" style={{ fontWeight: 600 }}>{opp.title}</span></td>
                          <td style={{ color: "var(--text-2)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {opp.organization ? <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Building size={11} />{opp.organization}</span> : "—"}
                          </td>
                          <td style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>
                            {opp.location || opp.country ? <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={11} />{opp.location || opp.country}</span> : "—"}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {opp.deadline ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 3, color: expired ? "var(--danger)" : "var(--text-2)", fontWeight: expired ? 600 : 400 }}>
                                <Calendar size={11} />{new Date(opp.deadline).toLocaleDateString()}
                                {expired && <span style={{ fontSize: "0.67rem", background: "var(--danger-muted)", color: "var(--danger)", padding: "1px 5px", borderRadius: 3 }}>Exp.</span>}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{opp.source}</td>
                          <td><span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: opp.is_active ? "#ecfdf5" : "#fef2f2", color: opp.is_active ? "#065f46" : "#991b1b" }}>{opp.is_active ? "Active" : "Inactive"}</span></td>
                          <td>
                            <a href={opp.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                              <ExternalLink size={11} /> View
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ padding: "0.875rem 1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronLeft size={14} /> Prev</button>
                  <div className="pagination-nums" style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      let p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                      return <button key={p} onClick={() => setPage(p)} className={`page-btn${p === page ? " active" : ""}`}>{p}</button>;
                    })}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}>Next <ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INGESTION ── */}
        {activeTab === "ingest" && (
          <div>
            {/* Action bar */}
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={loadRuns} disabled={runsLoading} className="btn btn-outline"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {runsLoading ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />} Refresh Logs
              </button>
              <button onClick={handleTrigger} disabled={triggering} className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {triggering ? <Loader2 size={15} className="spinner" /> : <Play size={15} />} Trigger Ingest
              </button>
              <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 2px" }} />
              <button onClick={handleBackfill} disabled={backfilling} className="btn"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                {backfilling ? <Loader2 size={15} className="spinner" /> : <Wand2 size={15} />} Backfill WP Data
              </button>
            </div>

            {/* Backfill progress */}
            {backfillProgress && (
              <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem", borderLeft: "3px solid var(--warning)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-2)" }}>Processing <strong style={{ color: "var(--text-1)" }}>{backfillProgress.processed.toLocaleString()}</strong> / {backfillProgress.total.toLocaleString()}</span>
                  <strong style={{ color: "var(--warning)" }}>{backfillProgress.pct}%</strong>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${backfillProgress.pct}%`, background: "var(--warning)", borderRadius: 999, transition: "width 0.25s" }} />
                </div>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--text-2)" }}>
                  <span>Updated: <strong style={{ color: "var(--success)" }}>{backfillProgress.updated}</strong></span>
                  <span>Deadlines: <strong style={{ color: "var(--warning)" }}>{backfillProgress.deadline_filled}</strong></span>
                  <span>Organisations: <strong style={{ color: "var(--primary)" }}>{backfillProgress.org_filled}</strong></span>
                  <span>Locations: <strong>{backfillProgress.loc_filled}</strong></span>
                </div>
              </div>
            )}

            {/* Backfill result */}
            {backfillResult && !backfillProgress && (
              <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem", borderLeft: "3px solid var(--success)" }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--success)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle size={15} /> Backfill complete
                </p>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--text-2)" }}>
                  <span>Scanned: <strong style={{ color: "var(--text-1)" }}>{backfillResult.total_wp_records.toLocaleString()}</strong></span>
                  <span>Updated: <strong style={{ color: "var(--success)" }}>{backfillResult.records_updated.toLocaleString()}</strong></span>
                  <span>Deadlines: <strong style={{ color: "var(--warning)" }}>{backfillResult.deadline_filled.toLocaleString()}</strong></span>
                  <span>Orgs: <strong style={{ color: "var(--primary)" }}>{backfillResult.organization_filled.toLocaleString()}</strong></span>
                  <span>Locations: <strong>{backfillResult.location_filled.toLocaleString()}</strong></span>
                </div>
              </div>
            )}

            {/* Runs table */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Recent Ingestion Runs</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>
                    {["ID", "Source", "Status", "Started At", "Fetched", "Created", "Updated"].map(h => <th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {runs.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
                        Click "Refresh Logs" to load ingestion history.
                      </td></tr>
                    ) : runs.map(run => (
                      <tr key={run.id}>
                        <td style={{ color: "var(--text-3)" }}>#{run.id}</td>
                        <td style={{ fontWeight: 600 }}>{run.source}</td>
                        <td>
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                            background: run.status === "success" ? "#ecfdf5" : run.status === "error" ? "#fef2f2" : "#fffbeb",
                            color: run.status === "success" ? "#065f46" : run.status === "error" ? "#991b1b" : "#92400e" }}>
                            {run.status}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>{new Date(run.started_at).toLocaleString()}</td>
                        <td style={{ textAlign: "center" }}>{run.fetched}</td>
                        <td style={{ textAlign: "center", color: "var(--success)", fontWeight: 600 }}>{run.created}</td>
                        <td style={{ textAlign: "center", color: "var(--warning)", fontWeight: 600 }}>{run.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── EMAIL LOGS ── */}
        {activeTab === "emails" && (
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={loadEmailLogs} disabled={emailLogsLoading} className="btn btn-outline"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {emailLogsLoading ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />} Refresh Logs
              </button>
              <button onClick={handleTriggerEmails} disabled={triggeringEmails} className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {triggeringEmails ? <Loader2 size={15} className="spinner" /> : <Play size={15} />} Trigger Emails
              </button>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Recent Email Deliveries</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>
                    {["ID", "User Email", "Type", "Status", "Sent At", "Error"].map(h => <th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {emailLogs.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
                        {emailLogsLoading ? "Loading…" : "No email logs found."}
                      </td></tr>
                    ) : emailLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ color: "var(--text-3)" }}>#{log.id}</td>
                        <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{log.user_email || `User #${log.user_id}`}</td>
                        <td>
                          <span style={{ padding: "2px 7px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "0.72rem", fontWeight: 600 }}>
                            {log.email_type === "daily_digest" ? "Daily Digest" : log.email_type === "deadline_alert" ? "Deadline Alert" : log.email_type}
                          </span>
                        </td>
                        <td>
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                            background: log.status === "success" ? "#ecfdf5" : "#fef2f2",
                            color: log.status === "success" ? "#065f46" : "#991b1b" }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>{new Date(log.sent_at).toLocaleString()}</td>
                        <td style={{ color: "var(--danger)", fontSize: "0.8rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error_message || ""}>
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
