"use client";
import { useState, useEffect, useCallback } from "react";
import {
  triggerIngest, triggerEmails, getIngestionRuns,
  getAdminOpportunities, getOpportunityTypes, getStats, getEmailLogs,
  getLandingContent, updateLandingContent, resetLandingContent,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Database, Play, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight,
  ExternalLink, MapPin, Building, Calendar, Filter, BarChart2, Briefcase,
  Mail, Users, X, TrendingUp, Layout, Plus, Trash2, RotateCcw, Save,
} from "lucide-react";

interface Run { id: number; source: string; status: string; started_at: string; fetched: number; created: number; updated: number; }
interface Opp { id: number; title: string; type: string; organization: string | null; location: string | null; country: string | null; deadline: string | null; posted_at: string | null; url: string; is_active: boolean; source: string; }
interface Stats { total: number; active: number; by_type: Record<string, number>; sources?: { source: string }[]; total_users?: number; }
interface EmailLog { id: number; user_id: number; user_email: string; email_type: string; status: string; error_message: string | null; sent_at: string; }

type StatItem    = { value: string; label: string };
type StepItem    = { num: string; title: string; desc: string };
type FeatureItem = { icon: string; title: string; desc: string };
type LandingContent = {
  hero: { badge: string; headline: string; subtext: string; cta_primary: string; cta_secondary: string };
  stats: StatItem[];
  types_label: string;
  how_it_works: { title: string; subtitle: string; steps: StepItem[] };
  features: { title: string; subtitle: string; items: FeatureItem[] };
  cta_banner: { title: string; subtitle: string; button: string };
};

const AVAILABLE_ICONS = [
  "Sparkles","Globe","Search","Mail","Zap","Star","Trophy",
  "Shield","Bell","Rocket","Briefcase","GraduationCap","Users",
  "Heart","Layers","Handshake",
];

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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow: "hidden", marginBottom: "1.25rem" }}>
      <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-1)" }}>{title}</h3>
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.875rem" }}>
      <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "ingest" | "emails" | "landing">("overview");

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

  // Opportunities
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

  // ── Landing page content editor ──
  const [landing, setLanding] = useState<LandingContent | null>(null);
  const [landingLoading, setLandingLoading] = useState(false);
  const [savingLanding, setSavingLanding] = useState(false);

  const loadLanding = useCallback(async () => {
    setLandingLoading(true);
    try { const { data } = await getLandingContent(); setLanding(data); }
    catch { toast.error("Failed to load landing content."); }
    finally { setLandingLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "landing") loadLanding(); }, [activeTab, loadLanding]);

  const saveLanding = async () => {
    if (!landing) return;
    setSavingLanding(true);
    try {
      await updateLandingContent(landing);
      toast.success("Landing page saved!");
    } catch { toast.error("Failed to save."); }
    finally { setSavingLanding(false); }
  };

  const resetLanding = async () => {
    setSavingLanding(true);
    try {
      const { data } = await resetLandingContent();
      setLanding(data);
      toast.success("Reset to defaults.");
    } catch { toast.error("Failed to reset."); }
    finally { setSavingLanding(false); }
  };

  // Helpers to update nested landing state
  const setHero = (field: string, val: string) =>
    setLanding(c => c ? { ...c, hero: { ...c.hero, [field]: val } } : c);

  const setStat = (i: number, field: keyof StatItem, val: string) =>
    setLanding(c => c ? { ...c, stats: c.stats.map((s, idx) => idx === i ? { ...s, [field]: val } : s) } : c);

  const addStat = () =>
    setLanding(c => c ? { ...c, stats: [...c.stats, { value: "", label: "" }] } : c);

  const removeStat = (i: number) =>
    setLanding(c => c ? { ...c, stats: c.stats.filter((_, idx) => idx !== i) } : c);

  const setHiw = (field: string, val: string) =>
    setLanding(c => c ? { ...c, how_it_works: { ...c.how_it_works, [field]: val } } : c);

  const setStep = (i: number, field: keyof StepItem, val: string) =>
    setLanding(c => c ? { ...c, how_it_works: { ...c.how_it_works, steps: c.how_it_works.steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s) } } : c);

  const addStep = () =>
    setLanding(c => c ? { ...c, how_it_works: { ...c.how_it_works, steps: [...c.how_it_works.steps, { num: String(c.how_it_works.steps.length + 1).padStart(2, "0"), title: "", desc: "" }] } } : c);

  const removeStep = (i: number) =>
    setLanding(c => c ? { ...c, how_it_works: { ...c.how_it_works, steps: c.how_it_works.steps.filter((_, idx) => idx !== i) } } : c);

  const setFeatSec = (field: string, val: string) =>
    setLanding(c => c ? { ...c, features: { ...c.features, [field]: val } } : c);

  const setFeature = (i: number, field: keyof FeatureItem, val: string) =>
    setLanding(c => c ? { ...c, features: { ...c.features, items: c.features.items.map((f, idx) => idx === i ? { ...f, [field]: val } : f) } } : c);

  const addFeature = () =>
    setLanding(c => c ? { ...c, features: { ...c.features, items: [...c.features.items, { icon: "Sparkles", title: "", desc: "" }] } } : c);

  const removeFeature = (i: number) =>
    setLanding(c => c ? { ...c, features: { ...c.features, items: c.features.items.filter((_, idx) => idx !== i) } } : c);

  const setBanner = (field: string, val: string) =>
    setLanding(c => c ? { ...c, cta_banner: { ...c.cta_banner, [field]: val } } : c);

  if (!user || user.role !== "admin") return null;

  const tabs = [
    { id: "overview", label: "Overview",     icon: BarChart2 },
    { id: "jobs",     label: "Opportunities", icon: Briefcase },
    { id: "ingest",   label: "Ingestion",    icon: Database },
    { id: "emails",   label: "Email Logs",   icon: Mail },
    { id: "landing",  label: "Landing Page", icon: Layout },
  ] as const;

  const SortTh = ({ label, col }: { label: string; col: string }) => {
    const active = sortCol === col;
    return (
      <th onClick={() => handleSort(col)} className={`th-sortable${active ? " th-active" : ""}`}>
        {label} <span style={{ opacity: active ? 1 : 0.3, marginLeft: 2 }}>{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </th>
    );
  };

  const inputStyle: React.CSSProperties = { width: "100%", fontSize: "0.875rem" };

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto" }}>

        <div style={{ marginBottom: "1.5rem" }}>
          <h1 className="page-title" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={22} style={{ color: "var(--primary)" }} /> Admin Dashboard
          </h1>
          <p style={{ color: "var(--text-2)", marginTop: 4, fontSize: "0.875rem" }}>
            Manage ingestion, opportunities, email deliveries, and landing page content.
          </p>
        </div>

        <div className="tab-bar" style={{ display: "flex", gap: 6, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`tab-btn${activeTab === id ? " active" : ""}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
            <StatCard label="Total Users" value={stats?.total_users ?? "—"} color="var(--primary)" icon={Users} />
            <StatCard label="Total Opportunities" value={stats?.total ?? "—"} icon={Briefcase} />
            <StatCard label="Active" value={stats?.active ?? "—"} color="var(--success)" icon={TrendingUp} />
            {stats && Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([t, count]) => {
              const tc = TYPE_COLORS[t] || { text: "var(--text-2)" };
              return <StatCard key={t} label={t} value={count} color={tc.text} icon={Briefcase} />;
            })}
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
                  <button onClick={() => { setPage(1); fetchOpps(); }} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronLeft size={14} /> Prev</button>
                  <div className="pagination-nums" style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      let p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                      return <button key={p} onClick={() => setPage(p)} className={`page-btn${p === page ? " active" : ""}`}>{p}</button>;
                    })}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>Next <ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INGESTION ── */}
        {activeTab === "ingest" && (
          <div>
            <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={loadRuns} disabled={runsLoading} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {runsLoading ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />} Refresh Logs
              </button>
              <button onClick={handleTrigger} disabled={triggering} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {triggering ? <Loader2 size={15} className="spinner" /> : <Play size={15} />} Trigger Ingest
              </button>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Recent Ingestion Runs</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>{["ID","Source","Status","Started At","Fetched","Created","Updated"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {runs.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Click "Refresh Logs" to load ingestion history.</td></tr>
                    ) : runs.map(run => (
                      <tr key={run.id}>
                        <td style={{ color: "var(--text-3)" }}>#{run.id}</td>
                        <td style={{ fontWeight: 600 }}>{run.source}</td>
                        <td><span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", background: run.status === "success" ? "#ecfdf5" : run.status === "error" ? "#fef2f2" : "#fffbeb", color: run.status === "success" ? "#065f46" : run.status === "error" ? "#991b1b" : "#92400e" }}>{run.status}</span></td>
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
              <button onClick={loadEmailLogs} disabled={emailLogsLoading} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {emailLogsLoading ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />} Refresh Logs
              </button>
              <button onClick={handleTriggerEmails} disabled={triggeringEmails} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {triggeringEmails ? <Loader2 size={15} className="spinner" /> : <Play size={15} />} Trigger Emails
              </button>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Recent Email Deliveries</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr>{["ID","User Email","Type","Status","Sent At","Error"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {emailLogs.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>{emailLogsLoading ? "Loading…" : "No email logs found."}</td></tr>
                    ) : emailLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ color: "var(--text-3)" }}>#{log.id}</td>
                        <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{log.user_email || `User #${log.user_id}`}</td>
                        <td><span style={{ padding: "2px 7px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "0.72rem", fontWeight: 600 }}>{log.email_type === "daily_digest" ? "Daily Digest" : log.email_type === "deadline_alert" ? "Deadline Alert" : log.email_type}</span></td>
                        <td><span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", background: log.status === "success" ? "#ecfdf5" : "#fef2f2", color: log.status === "success" ? "#065f46" : "#991b1b" }}>{log.status}</span></td>
                        <td style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>{new Date(log.sent_at).toLocaleString()}</td>
                        <td style={{ color: "var(--danger)", fontSize: "0.8rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error_message || ""}>{log.error_message || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── LANDING PAGE EDITOR ── */}
        {activeTab === "landing" && (
          <div>
            {/* Action bar */}
            <div className="card" style={{ padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={saveLanding} disabled={savingLanding || !landing} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {savingLanding ? <Loader2 size={15} className="spinner" /> : <Save size={15} />} Save Changes
              </button>
              <button onClick={loadLanding} disabled={landingLoading} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {landingLoading ? <Loader2 size={15} className="spinner" /> : <RefreshCw size={15} />} Reload
              </button>
              <button onClick={resetLanding} disabled={savingLanding} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warning)" }}>
                <RotateCcw size={15} /> Reset to Defaults
              </button>
              <span style={{ fontSize: "0.8rem", color: "var(--text-3)", marginLeft: "auto" }}>
                Changes are reflected on the public landing page immediately after saving.
              </span>
            </div>

            {landingLoading || !landing ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-2)" }}>
                <Loader2 size={28} className="spinner" style={{ color: "var(--primary)", margin: "0 auto" }} />
              </div>
            ) : (
              <>
                {/* Hero */}
                <SectionCard title="Hero Section">
                  <Field label="Badge text"><input className="input" style={inputStyle} value={landing.hero.badge} onChange={e => setHero("badge", e.target.value)} /></Field>
                  <Field label="Headline"><input className="input" style={inputStyle} value={landing.hero.headline} onChange={e => setHero("headline", e.target.value)} /></Field>
                  <Field label="Subtext"><textarea className="input" style={{ ...inputStyle, resize: "vertical" }} rows={3} value={landing.hero.subtext} onChange={e => setHero("subtext", e.target.value)} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Primary CTA button"><input className="input" style={inputStyle} value={landing.hero.cta_primary} onChange={e => setHero("cta_primary", e.target.value)} /></Field>
                    <Field label="Secondary CTA button"><input className="input" style={inputStyle} value={landing.hero.cta_secondary} onChange={e => setHero("cta_secondary", e.target.value)} /></Field>
                  </div>
                </SectionCard>

                {/* Stats */}
                <SectionCard title="Stats Bar">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {landing.stats.map((s, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                        <input className="input" placeholder="Value (e.g. 500+)" style={{ fontSize: "0.875rem" }} value={s.value} onChange={e => setStat(i, "value", e.target.value)} />
                        <input className="input" placeholder="Label (e.g. Active Opportunities)" style={{ fontSize: "0.875rem" }} value={s.label} onChange={e => setStat(i, "label", e.target.value)} />
                        <button onClick={() => removeStat(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 6 }}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addStat} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Add Stat</button>
                </SectionCard>

                {/* Types label */}
                <SectionCard title="Opportunity Types Section">
                  <Field label="Section label text">
                    <input className="input" style={inputStyle} value={landing.types_label} onChange={e => setLanding(c => c ? { ...c, types_label: e.target.value } : c)} />
                  </Field>
                  <p style={{ fontSize: "0.775rem", color: "var(--text-3)" }}>The type pills (Jobs, Scholarships, etc.) are fixed — they reflect the actual opportunity types in the database.</p>
                </SectionCard>

                {/* How it works */}
                <SectionCard title="How It Works">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <Field label="Section title"><input className="input" style={inputStyle} value={landing.how_it_works.title} onChange={e => setHiw("title", e.target.value)} /></Field>
                    <Field label="Section subtitle"><input className="input" style={inputStyle} value={landing.how_it_works.subtitle} onChange={e => setHiw("subtitle", e.target.value)} /></Field>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    {landing.how_it_works.steps.map((s, i) => (
                      <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.875rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr auto", gap: 8, alignItems: "start" }}>
                          <div><label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>NUM</label><input className="input" style={{ fontSize: "0.875rem" }} value={s.num} onChange={e => setStep(i, "num", e.target.value)} /></div>
                          <div><label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>TITLE</label><input className="input" style={{ fontSize: "0.875rem" }} value={s.title} onChange={e => setStep(i, "title", e.target.value)} /></div>
                          <div><label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>DESCRIPTION</label><input className="input" style={{ fontSize: "0.875rem" }} value={s.desc} onChange={e => setStep(i, "desc", e.target.value)} /></div>
                          <button onClick={() => removeStep(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 6, marginTop: 22 }}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addStep} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Add Step</button>
                </SectionCard>

                {/* Features */}
                <SectionCard title="Features Section">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <Field label="Section title"><input className="input" style={inputStyle} value={landing.features.title} onChange={e => setFeatSec("title", e.target.value)} /></Field>
                    <Field label="Section subtitle"><input className="input" style={inputStyle} value={landing.features.subtitle} onChange={e => setFeatSec("subtitle", e.target.value)} /></Field>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    {landing.features.items.map((f, i) => (
                      <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.875rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr auto", gap: 8, alignItems: "start" }}>
                          <div>
                            <label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>ICON</label>
                            <select className="input" style={{ fontSize: "0.875rem" }} value={f.icon} onChange={e => setFeature(i, "icon", e.target.value)}>
                              {AVAILABLE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                            </select>
                          </div>
                          <div><label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>TITLE</label><input className="input" style={{ fontSize: "0.875rem" }} value={f.title} onChange={e => setFeature(i, "title", e.target.value)} /></div>
                          <div><label style={{ fontSize: "0.725rem", fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>DESCRIPTION</label><textarea className="input" rows={2} style={{ fontSize: "0.8125rem", resize: "vertical" }} value={f.desc} onChange={e => setFeature(i, "desc", e.target.value)} /></div>
                          <button onClick={() => removeFeature(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 6, marginTop: 22 }}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addFeature} className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}><Plus size={13} /> Add Feature</button>
                </SectionCard>

                {/* CTA Banner */}
                <SectionCard title="CTA Banner">
                  <Field label="Headline"><input className="input" style={inputStyle} value={landing.cta_banner.title} onChange={e => setBanner("title", e.target.value)} /></Field>
                  <Field label="Subtitle"><input className="input" style={inputStyle} value={landing.cta_banner.subtitle} onChange={e => setBanner("subtitle", e.target.value)} /></Field>
                  <Field label="Button text"><input className="input" style={{ maxWidth: 260, fontSize: "0.875rem" }} value={landing.cta_banner.button} onChange={e => setBanner("button", e.target.value)} /></Field>
                </SectionCard>

                {/* Bottom save */}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "1rem" }}>
                  <button onClick={saveLanding} disabled={savingLanding} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {savingLanding ? <Loader2 size={15} className="spinner" /> : <Save size={15} />} Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </>
  );
}
