"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { getOpportunities, getOpportunityTypes, getStats } from "@/lib/api";
import toast from "react-hot-toast";
import { Search, Filter, Loader2, RefreshCw, ExternalLink, MapPin, Building, Calendar, ChevronLeft, ChevronRight, Globe, X, Bookmark } from "lucide-react";
import { createSavedSearch } from "@/lib/api";

interface Opp {
  id: number; title: string; type: string; organization: string | null;
  location: string | null; country: string | null; deadline: string | null;
  posted_at: string | null; url: string; is_active: boolean; source: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  job:         { bg: "#eef2ff", text: "#4338ca" },
  scholarship: { bg: "#f5f3ff", text: "#6d28d9" },
  fellowship:  { bg: "#ecfeff", text: "#0e7490" },
  grant:       { bg: "#ecfdf5", text: "#047857" },
  internship:  { bg: "#fff7ed", text: "#c2410c" },
};

const PAGE_SIZE = 25;
type SortCol = "posted_at" | "title" | "organization" | "deadline" | "type" | "source";
type SortDir = "asc" | "desc";

function SortTh({ label, col, sortCol, sortDir, onSort }: { label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onSort: (c: SortCol) => void }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} className={`th-sortable${active ? " th-active" : ""}`}>
      {label} <span style={{ opacity: active ? 1 : 0.3, marginLeft: 2 }}>{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
}

export default function BrowsePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!authLoading && user === null) router.push("/login"); }, [user, authLoading, router]);

  const [opps, setOpps] = useState<Opp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE, active_only: activeOnly, sort_by: sortCol, sort_dir: sortDir };
      if (search.trim()) params.q = [search.trim()]; // send as single phrase; plainto_tsquery handles multi-word AND internally
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
    if (col === sortCol) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch(""); setFilterType(""); setFilterSource(""); setFilterCountry("");
    setActiveOnly(true); setPage(1); setSortCol("posted_at"); setSortDir("desc");
  };

  const hasFilters = search || filterType || filterSource || filterCountry || !activeOnly;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Save Search modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const openSaveModal = () => {
    setSaveName(search.trim() || filterType || filterCountry || "My Search");
    setShowSaveModal(true);
  };

  const handleSaveSearch = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await createSavedSearch({
        name: saveName.trim(),
        keywords: search.trim() || undefined,
        opp_type: filterType || undefined,
        country: filterCountry || undefined,
      });
      toast.success("Search saved! You'll get daily email alerts for new matches.");
      setShowSaveModal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to save search.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };
  const today = new Date();

  if (!user) return null;

  const MobileCard = ({ opp }: { opp: Opp }) => {
    const expired = opp.deadline && new Date(opp.deadline) < today;
    const tc = TYPE_COLORS[opp.type?.toLowerCase()] || { bg: "#f1f5f9", text: "#475569" };
    return (
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: tc.bg, color: tc.text }}>
            {opp.type}
          </span>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: opp.is_active ? "#ecfdf5" : "#fef2f2", color: opp.is_active ? "#065f46" : "#991b1b" }}>
            {opp.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <h3 style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.4, marginBottom: 6, color: "var(--text-1)" }}>{opp.title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
          {opp.organization && <span style={{ fontSize: "0.8rem", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}><Building size={11} />{opp.organization}</span>}
          {(opp.location || opp.country) && <span style={{ fontSize: "0.8rem", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{opp.location || opp.country}</span>}
          {opp.deadline && <span style={{ fontSize: "0.8rem", color: expired ? "var(--danger)" : "var(--text-2)", display: "flex", alignItems: "center", gap: 4, fontWeight: expired ? 600 : 400 }}><Calendar size={11} />{expired ? "Expired: " : ""}{new Date(opp.deadline).toLocaleDateString()}</span>}
        </div>
        <a href={opp.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          <ExternalLink size={11} /> Apply
        </a>
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <main className="page-wrapper" style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h1 className="page-title" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={22} style={{ color: "var(--primary)" }} /> Browse
            </h1>
            <p style={{ color: "var(--text-2)", marginTop: 4, fontSize: "0.875rem" }}>
              {total > 0 ? `${total.toLocaleString()} opportunities` : "All opportunities"} — search, filter, and sort.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {hasFilters && (
              <button onClick={openSaveModal} className="btn btn-outline"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Bookmark size={14} /> Save Search
              </button>
            )}
            <button onClick={() => setFiltersOpen(v => !v)} className="btn btn-outline"
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} /> Filters {hasFilters ? "•" : ""}
            </button>
            <button onClick={fetchOpps} disabled={loading} className="btn btn-outline btn-icon">
              <RefreshCw size={15} className={loading ? "spinner" : ""} />
            </button>
          </div>
        </div>

        {/* Search bar — always visible */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <input
            className="input"
            placeholder='Search by keyword, title, or organisation…'
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            onKeyDown={e => e.key === "Enter" && fetchOpps()}
            style={{ paddingLeft: "2.25rem", fontSize: "0.9375rem", height: 44 }}
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(1); }}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex" }}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
            <div className="filter-bar">
              {/* Type */}
              <div style={{ flex: "1 1 130px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Type</label>
                <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
                  <option value="">All types</option>
                  {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>

              {/* Source */}
              <div style={{ flex: "1 1 130px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Source</label>
                <select className="input" value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}>
                  <option value="">All sources</option>
                  {sources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Country */}
              <div style={{ flex: "1 1 100px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Country</label>
                <input className="input" placeholder="US, BD…" value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setPage(1); }} />
              </div>

              {/* Active only */}
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
                  {loading ? <Loader2 size={14} className="spinner" /> : <Filter size={14} />} Apply
                </button>
                {hasFilters && (
                  <button onClick={clearFilters} className="btn btn-outline"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <X size={13} /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results count */}
        <div style={{ marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--text-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {loading ? "Loading…" : <><strong style={{ color: "var(--text-1)" }}>{total.toLocaleString()}</strong> results · page {page} of {totalPages || 1}</>}
          </span>
        </div>

        {/* Desktop table */}
        <div className="card desktop-table" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <SortTh label="Type" col="type" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Title" col="title" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Organisation" col="organization" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th>Location</th>
                  <SortTh label="Deadline" col="deadline" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Source" col="source" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center" }}>
                    <Loader2 size={26} className="spinner" style={{ color: "var(--primary)", margin: "0 auto" }} />
                  </td></tr>
                ) : opps.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-2)" }}>
                    No opportunities match the current filters.
                  </td></tr>
                ) : opps.map(opp => {
                  const expired = opp.deadline && new Date(opp.deadline) < today;
                  const tc = TYPE_COLORS[opp.type?.toLowerCase()] || { bg: "#f1f5f9", text: "#475569" };
                  return (
                    <tr key={opp.id}>
                      <td>
                        <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: tc.bg, color: tc.text }}>
                          {opp.type}
                        </span>
                      </td>
                      <td style={{ maxWidth: 300 }}>
                        <span className="truncate-2" style={{ fontWeight: 600, lineHeight: 1.4 }}>{opp.title}</span>
                      </td>
                      <td style={{ color: "var(--text-2)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opp.organization ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building size={11} />{opp.organization}</span> : "—"}
                      </td>
                      <td style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {opp.location || opp.country ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{opp.location || opp.country}</span> : "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {opp.deadline ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: expired ? "var(--danger)" : "var(--text-2)", fontWeight: expired ? 600 : 400 }}>
                            <Calendar size={11} />{new Date(opp.deadline).toLocaleDateString()}
                            {expired && <span style={{ fontSize: "0.67rem", background: "var(--danger-muted)", color: "var(--danger)", padding: "1px 5px", borderRadius: 3 }}>Expired</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{opp.source}</td>
                      <td>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: opp.is_active ? "#ecfdf5" : "#fef2f2", color: opp.is_active ? "#065f46" : "#991b1b" }}>
                          {opp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <a href={opp.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
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
            <div style={{ padding: "0.875rem 1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <div className="pagination-nums" style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return <button key={p} onClick={() => setPage(p)} className={`page-btn${p === page ? " active" : ""}`}>{p}</button>;
                })}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 5 }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile card list */}
        <div className="mobile-cards">
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Loader2 size={26} className="spinner" style={{ color: "var(--primary)", margin: "0 auto" }} />
            </div>
          ) : opps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-2)" }}>No opportunities match the current filters.</div>
          ) : opps.map(opp => <MobileCard key={opp.id} opp={opp} />)}

          {/* Mobile pagination */}
          {totalPages > 1 && !loading && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.5rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 5 }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

      </main>

      {/* Save Search modal */}
      {showSaveModal && (
        <div onClick={() => setShowSaveModal(false)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 400, padding: "1.75rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>Save this search</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-2)", marginBottom: "1.25rem" }}>
              You'll get a daily email alert when new opportunities match these filters.
            </p>
            {/* Summary pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
              {search && <span style={{ padding: "2px 9px", borderRadius: 999, background: "var(--primary-muted)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600 }}>keyword: {search}</span>}
              {filterType && <span style={{ padding: "2px 9px", borderRadius: 999, background: "#f5f3ff", color: "#6d28d9", fontSize: "0.75rem", fontWeight: 600 }}>type: {filterType}</span>}
              {filterCountry && <span style={{ padding: "2px 9px", borderRadius: 999, background: "#ecfdf5", color: "#047857", fontSize: "0.75rem", fontWeight: 600 }}>country: {filterCountry}</span>}
            </div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
              Search name
            </label>
            <input
              className="input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSaveSearch()}
              placeholder="e.g. ML Engineer in Dhaka"
              autoFocus
              style={{ marginBottom: "1.25rem" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowSaveModal(false)} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={handleSaveSearch} disabled={saving || !saveName.trim()} className="btn btn-primary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {saving ? <Loader2 size={13} className="spinner" /> : <Bookmark size={13} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
