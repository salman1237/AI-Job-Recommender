"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, LayoutDashboard, User, LogOut, Zap } from "lucide-react";

const navLinks = [
  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  { href: "/profile", label: "My Profile", icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", height: 64 }}>
        {/* Logo */}
        <Link href="/opportunities" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#7c6aff,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem", background: "linear-gradient(135deg,#7c6aff,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Opportunity Finder
          </span>
        </Link>

        {/* Nav Links */}
        <div style={{ display: "flex", gap: 4, marginLeft: "2.5rem", flex: 1 }}>
          {navLinks.map(({ href, label, icon: Icon }) => {
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
          {user?.role === "admin" && (
            <Link href="/admin" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, fontSize: "0.875rem", fontWeight: 500,
              textDecoration: "none",
              color: pathname.startsWith("/admin") ? "#fff" : "var(--text-secondary)",
              background: pathname.startsWith("/admin") ? "rgba(124,106,255,0.15)" : "transparent",
              transition: "all 0.15s",
            }}>
              <LayoutDashboard size={15} />
              Admin
            </Link>
          )}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {user.email}
            </span>
          )}
          <button onClick={logout} className="btn-ghost" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
