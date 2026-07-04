"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace("/opportunities");
      else router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#7c6aff,#00d4ff)", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}
