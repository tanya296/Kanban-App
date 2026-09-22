import type { ReactNode } from "react";
import { Users, GripVertical, Zap } from "lucide-react";

const FEATURES = [
  { icon: Users, text: "Invite your whole team, no seat limits" },
  { icon: GripVertical, text: "Drag and drop cards between lists" },
  { icon: Zap, text: "See updates the moment they happen" },
];

export default function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div
        className="auth-panel dot-bg"
        style={{
          flex: 1,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", height: 220, marginBottom: 36 }}>
          <div className="sticky-card" style={{ position: "absolute", top: 10, left: 10, width: 150, height: 105, background: "var(--sticky)", borderRadius: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.35)", padding: 14, color: "var(--sticky-text)", fontSize: 13, fontWeight: 600, ["--rot" as any]: "-8deg", animationDelay: "0s, 0.3s" }}>Design mockups</div>
          <div className="sticky-card" style={{ position: "absolute", top: 45, left: 145, width: 150, height: 105, background: "var(--accent)", borderRadius: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.35)", padding: 14, color: "var(--accent-dark)", fontSize: 13, fontWeight: 600, ["--rot" as any]: "6deg", animationDelay: "0.1s, 0.9s" }}>Ship v1.0</div>
          <div className="sticky-card" style={{ position: "absolute", top: 100, left: 50, width: 150, height: 105, background: "#F5F5F0", borderRadius: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.35)", padding: 14, color: "#1B1D23", fontSize: 13, fontWeight: 600, ["--rot" as any]: "-3deg", animationDelay: "0.2s, 1.5s" }}>Fix login bug</div>
          <div className="sticky-card" style={{ position: "absolute", top: 5, left: 260, width: 130, height: 90, background: "var(--sticky)", borderRadius: 6, boxShadow: "0 8px 20px rgba(0,0,0,0.35)", padding: 12, color: "var(--sticky-text)", fontSize: 12, fontWeight: 600, ["--rot" as any]: "9deg", animationDelay: "0.3s, 1.1s" }}>Client feedback</div>
        </div>

        <h1 style={{ fontSize: 34, marginBottom: 10 }}>Kanbo</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 340, marginBottom: 32 }}>
          Boards, lists, and cards that move as fast as your team does.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: "var(--bg)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", flexShrink: 0,
                }}
              >
                <f.icon size={16} />
              </div>
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="dot-bg"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: 380,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "36px 32px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          }}
        >
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>{title}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
            {title === "Log in" ? "Welcome back." : "Let's get your boards set up."}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}