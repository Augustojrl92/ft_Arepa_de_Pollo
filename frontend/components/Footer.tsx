import { ThemeToggleButton } from "./ThemeToggleButton";

export default function Footer() {
  return (
    <footer className="bg-card p-6 border-t-2 border-border">
      <div className="aedlph-container flex items-center justify-between text-sm">
        <div>
          © 2026 · AEDLPH
        </div>
        <div className="flex items-center gap-4">
          <p>Last updated: 2026-01-01</p>
          <ThemeToggleButton />
        </div>
      </div>
    </footer>
  );
}
