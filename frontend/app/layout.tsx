import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Opportunity Finder",
  description: "AI-powered opportunity discovery & career matching platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-mesh min-h-screen">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1a2e",
                color: "#f0f0ff",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "0.875rem",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
