"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { getOpportunities, getOpportunityTypes, getStats } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Search, Filter, Loader2, RefreshCw, ExternalLink,
  MapPin, Building, Calendar, ChevronLeft, ChevronRight, Globe
} from "lucide-react";

interface Opp {
  id: number; title: string; type: string; organization: string | null;
  location: string | null; country: string | null; deadline: string | null;
  posted_at: string | null; url: string; is_active: boolean; source: string;
}

const TYPE_COLORS: Record<string, string> = {
  job: "#a89aff", scholarship: "#00d4ff", fellowship: "#f472b6",
  grant: "#4ade80", internship: "#fbbf24",
};

const PAGE_SIZE = 25;

type SortCol = "posted_at" | "title" | "organization" | "deadline" | "type" | "source";
type SortDir = "asc" | "desc";

function SortTh({
  label, col, sortCol, sortDir, onSort, style
}: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir;
  onSort: (c: SortCol) => void; style?: React.CSSProperties;
}) {
  const active = sortCol === col;
  const arrow = !active ? "↕" : sortDir === "asc" ? "↑" : "↓";
  return (
    <th onClick={() => onSort(col)} style={{
      padding: "12px 14px", color: active ? "#7c6aff" : "var(--text-secondary)",
      fontWeight: 600, textAlign: "left", whiteSpace: "nowrap",
      fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em",
      cursor: "pointer", userSelect: "none", transition: "color 0.15s",
      ...style
    }}>
      {label} <span style={{ opacity: active ? 1 : 0.35, marginLeft: 3 }}>{arrow}</span>
    </th>
  );
}

export default function BrowsePage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  const [opps, setOpps] = useState<Opp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol>("posted_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getOpportunityTypes().then(r => setTypes(r.data.types)).catch(() => {});
    getStats().then(r => setSources((r.data.sources || []).map((s: any) => s.source))).catch(() => {});
  }, []);

  const fetchOpps = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page, page_size: PAGE_SIZE, active_only: activeOnly,
        sort_by: sortCol, sort_dir: sortDir,
      };
      if (search.trim()) params.q = search.trim().split(/\s+/).slice(0, 5);
      if (filterType) params.type = filterType;
      if (filterSource) params.source = filterSource;
      if (filterCountry) params.country = filterCountry;
      const { data } = await getOpportunities(params);
      setOpps(data.items);
      setTotal(data.total);
    } catch { toast.error("Failed to load opportunities"); }
    finally { setLoading(false); }
  }, [page, search, filterType, filterSource, filterCountry, activeOnly, sortCol, sortDir]);

  useEffect(() => { fetchOpps(); }, [fetchOpps]);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const today = new Date();

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 className="page-h1" style={{ fontSize: "2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <Globe style={{ color: "#7c6aff" }} size={26} /> Browse Opportunities
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Search, filter, and sort through all {total > 0 ? total.toLocaleString() + " " : ""}available opportunities.
          </p>
        </div>

        {/* Filter bar */}
        <div className="glass" style={{ padding: "1.25rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <Search size={12} /> Keyword Search
            </label>
            <input className="input" placeholder="Python, scholarship, Dhaka…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={e => e.key === "Enter" && fetchOpps()}
              style={{ padding: "0.6rem 0.85rem" }} />
          </div>

          <div style={{ flex: "0 1 160px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Type</label>
            <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}>
              <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>All types</option>
              {types.map(t => <option key={t} value={t} style={{ background: "#ffffff", color: "#0f172a" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          <div style={{ flex: "0 1 160px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Source</label>
            <select className="input" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}
              style={{ padding: "0.6rem 0.85rem", cursor: "pointer" }}>
              <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>All sources</option>
              {sources.map(s => <option key={s} value={s} style={{ background: "#ffffff", color: "#0f172a" }}>{s}</option>)}
            </select>
          </div>

          <div style={{ flex: "0 1 130px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Country</label>
            <input className="input" placeholder="BD, US…" value={filterCountry}
              onChange={e => { setFilterCountry(e.target.value); setPage(1); }}
              style={{ padding: "0.6rem 0.85rem" }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: activeOnly ? "var(--text-primary)" : "var(--text-secondary)", paddingBottom: 2 }}>
            <div onClick={() => { setActiveOnly(v => !v); setPage(1); }}
              style={{ width: 38, height: 20, borderRadius: 999, background: activeOnly ? "#6366f1" : "rgba(0,0,0,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: activeOnly ? "calc(100% - 18px)" : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
            Active only
          </label>

          <button onClick={() => { setPage(1); fetchOpps(); }} className="btn-primary"
            style={{ height: 38, display: "flex", alignItems: "center", gap: 6, paddingTop: 0, paddingBottom: 0 }}>
            {loading ? <Loader2 size={15} className="spinner" /> : <Filter size={15} />} Apply
          </button>

          <button onClick={() => {
            setSearch(""); setFilterType(""); setFilterSource(""); setFilterCountry("");
            setActiveOnly(true); setPage(1); setSortCol("posted_at"); setSortDir("desc");
          }} className="btn-ghost" style={{ height: 38, fontSize: "0.82rem", paddingTop: 0, paddingBottom: 0 }}>
            Clear
          </button>
        </div>

        {/* Result count + refresh */}
        <div style={{ marginBottom: "0.75rem", color: "var(--text-secondary)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
          <span>
            {loading ? "Loading…" : <><strong style={{ color: "var(--text-primary)" }}>{total.toLocaleString()}</strong> results · page {page}/{totalPages || 1}</>}
          </span>
          <button onClick={fetchOpps} className="btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="glass" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                  <SortTh label="Type" col="type" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Title" col="title" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Organisation" col="organization" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th style={{ padding: "12px 14px", color: "var(--text-secondary)", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Location</th>
                  <SortTh label="Deadline" col="deadline" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Source" col="source" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th style={{ padding: "12px 14px", color: "var(--text-secondary)", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                  <th style={{ padding: "12px 14px" }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center" }}>
                    <Loader2 size={28} className="spinner" style={{ margin: "0 auto", color: "#7c6aff" }} />
                  </td></tr>
                ) : opps.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    No opportunities match the current filters.
                  </td></tr>
                ) : opps.map((opp, i) => {
                  const expired = opp.deadline && new Date(opp.deadline) < today;
                  const color = TYPE_COLORS[opp.type?.toLowerCase()] || "#aaa";
                  return (
                    <tr key={opp.id}
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)")}>

                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700, textTransform: "capitalize", background: `${color}22`, color }}>{opp.type}</span>
                      </td>

                      <td style={{ padding: "11px 14px", maxWidth: 300 }}>
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
                          <ExternalLink size={11} /> Apply
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

      </main>
    </>
  );
}
