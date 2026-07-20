"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, LayoutDashboard, User, LogOut, Menu, X, Globe } from "lucide-react";

const navLinks = [
  { href: "/opportunities", label: "My Matches", icon: Briefcase },
  { href: "/browse", label: "Browse All", icon: Globe },
  { href: "/profile", label: "My Profile", icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  const allLinks = [
    ...navLinks,
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: LayoutDashboard }] : []),
  ];

  return (
    <nav
      style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* ── Main bar ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.25rem", display: "flex", alignItems: "center", height: 64, gap: 12 }}>
        
        {/* Logo */}
        <Link href="/opportunities" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <Image
            src="/logo.png"
            alt="Opportunity Finder"
            width={36}
            height={36}
            style={{ objectFit: "contain", borderRadius: 8 }}
            priority
          />
          <span style={{ fontWeight: 800, fontSize: "1.05rem", background: "linear-gradient(135deg,#7c6aff,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Opportunity Finder
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="nav-links-desktop" style={{ display: "flex", gap: 4, marginLeft: "1.5rem", flex: 1 }}>
          {allLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 8, fontSize: "0.875rem", fontWeight: 500,
                textDecoration: "none",
                color: active ? "#fff" : "var(--text-secondary)",
                background: active ? "rgba(124,106,255,0.15)" : "transparent",
                transition: "all 0.15s",
              }}>
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Spacer (mobile) */}
        <div style={{ flex: 1 }} />

        {/* Desktop Right side */}
        <div className="nav-email-desktop" style={{ display: "flex", alignItems: "center" }}>
          {user && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginRight: 12 }}>
              {user.email}
            </span>
          )}
        </div>
        <button onClick={logout} className="btn-ghost nav-logout-desktop" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
          <LogOut size={14} />
          Logout
        </button>

        {/* Hamburger (mobile only) */}
        <button
          className="mobile-hamburger"
          onClick={() => setDrawerOpen(o => !o)}
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile Drawer ── */}
      <div className={`mobile-drawer${drawerOpen ? " open" : ""}`}>
        {allLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "active" : ""}
              onClick={closeDrawer}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        <div className="mobile-drawer-divider" />

        {user && (
          <p className="mobile-drawer-user">{user.email}</p>
        )}

        <button className="drawer-logout" onClick={() => { logout(); closeDrawer(); }}>
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </nav>
  );
}
