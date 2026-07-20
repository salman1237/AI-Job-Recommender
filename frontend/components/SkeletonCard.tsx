export default function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="skeleton" style={{ width: 80, height: 22 }} />
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="skeleton" style={{ width: "90%", height: 18 }} />
        <div className="skeleton" style={{ width: "65%", height: 18 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="skeleton" style={{ width: 110, height: 16, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 90, height: 16, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 100, height: 16, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div className="skeleton" style={{ width: "100%", height: 13 }} />
        <div className="skeleton" style={{ width: "85%", height: 13 }} />
        <div className="skeleton" style={{ width: "70%", height: 13 }} />
      </div>
      <div className="skeleton" style={{ width: "100%", height: 38, marginTop: "auto" }} />
    </div>
  );
}
