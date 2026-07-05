"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { login } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Zap, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login: saveToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(email, password);
      saveToken(data.access_token);
      toast.success("Welcome back!");
      router.push("/opportunities");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }} className="bg-mesh">
      {/* Background orbs */}
      <div style={{ position: "fixed", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,106,255,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass auth-card-padding"
        style={{ width: "100%", maxWidth: 420 }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#7c6aff,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <Zap size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>Welcome back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>Sign in to your Opportunity Finder account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Mail size={14} /> Email
            </label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Lock size={14} /> Password
            </label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <Loader2 size={18} className="spinner" /> : <><ArrowRight size={16} /> Sign In</>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Create one</Link>
        </p>
      </motion.div>
    </div>
  );
}
