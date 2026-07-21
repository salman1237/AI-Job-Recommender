"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeContent() {
  const params = useSearchParams();
  const type = params.get("type");
  const done = params.get("done");

  const label =
    type === "digest" ? "daily digest"
    : type === "alerts" ? "deadline alerts"
    : "all emails";

  if (!done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
        <div className="card" style={{ maxWidth: 420, width: "100%", padding: "2.5rem", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.5rem" }}>✕</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>Invalid link</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>This unsubscribe link is invalid or has already been used.</p>
          <Link href="/profile" className="btn btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>Manage from Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1.5rem" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: "2.5rem", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: "1.5rem" }}>✓</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>Unsubscribed</h1>
        <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          You have been unsubscribed from <strong>{label}</strong>.
        </p>
        <p style={{ color: "var(--text-3)", fontSize: "0.8rem", marginBottom: "1.75rem" }}>
          You can re-enable emails anytime from your{" "}
          <Link href="/profile" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Profile page</Link>.
        </p>
        <Link href="/opportunities" className="btn btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
          Go to My Matches
        </Link>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
