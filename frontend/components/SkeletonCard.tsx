export default function SkeletonCard() {
  return (
    <div
      className="glass"
      style={{
        padding: "1.4rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header row: type badge + score badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="skeleton-block" style={{ height: 22, width: 72 }} />
        <div className="skeleton-block" style={{ height: 22, width: 52, borderRadius: 999 }} />
      </div>

      {/* Title lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="skeleton-block" style={{ height: 16, width: "90%" }} />
        <div className="skeleton-block" style={{ height: 16, width: "65%" }} />
      </div>

      {/* Meta row: org / location / date */}
      <div style={{ display: "flex", gap: 12 }}>
        <div className="skeleton-block" style={{ height: 13, width: 90 }} />
        <div className="skeleton-block" style={{ height: 13, width: 70 }} />
        <div className="skeleton-block" style={{ height: 13, width: 80 }} />
      </div>

      {/* Reason block */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div className="skeleton-block" style={{ height: 12, width: "100%" }} />
        <div className="skeleton-block" style={{ height: 12, width: "80%" }} />
        <div className="skeleton-block" style={{ height: 12, width: "55%" }} />
      </div>

      {/* Button */}
      <div className="skeleton-block" style={{ height: 40, width: "100%", borderRadius: 10, marginTop: "auto" }} />
    </div>
  );
}
