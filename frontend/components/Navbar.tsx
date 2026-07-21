"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, LayoutDashboard, User, LogOut, Globe } from "lucide-react";

const NAV_LINKS = [
  { href: "/opportunities", label: "My Matches", icon: Briefcase },
  { href: "/browse",        label: "Browse",     icon: Globe },
  { href: "/profile",       label: "Profile",    icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const links = [
    ...NAV_LINKS,
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: LayoutDashboard }] : []),
  ];

  return (
    <>
      {/* ── Top bar (desktop) ───────────────────────────────────────── */}
      <nav style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 50,
        height: "var(--nav-h)",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        gap: "1rem",
      }}>
        {/* Logo */}
        <Link href="/opportunities" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/logo.png" alt="Opportunity Finder" width={30} height={30} style={{ objectFit: "contain", borderRadius: 6 }} priority />
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary)", letterSpacing: "-0.01em" }}>
            Opportunity Finder
          </span>
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "1rem", flex: 1 }} className="desktop-nav">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 7,
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "var(--primary)" : "var(--text-2)",
                background: active ? "var(--primary-muted)" : "transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Desktop right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }} className="desktop-nav">
          {user && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </span>
          )}
          <button
            onClick={logout}
            className="btn btn-outline btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </nav>

      {/* ── Bottom tab bar (mobile only) ─────────────────────────────── */}
      <nav style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 50,
        height: "var(--bottom-nav-h)",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "stretch",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
      }} className="bottom-nav">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              textDecoration: "none",
              color: active ? "var(--primary)" : "var(--text-3)",
              fontSize: "0.65rem",
              fontWeight: active ? 700 : 500,
              paddingBottom: "env(safe-area-inset-bottom)",
              background: active ? "rgba(79,70,229,0.06)" : "transparent",
              borderTop: active ? "2px solid var(--primary)" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
        <button onClick={logout} style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          border: "none",
          background: "transparent",
          color: "var(--text-3)",
          fontSize: "0.65rem",
          fontWeight: 500,
          cursor: "pointer",
          borderTop: "2px solid transparent",
          fontFamily: "inherit",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          <LogOut size={22} />
          Logout
        </button>
      </nav>

      <style>{`
        .desktop-nav { display: flex; }
        .bottom-nav  { display: none !important; }
        @media (max-width: 1023px) {
          .desktop-nav { display: none !important; }
          .bottom-nav  { display: flex !important; }
        }
      `}</style>
    </>
  );
}
