import { useCoalitionStore } from '@/hooks';

export default function Footer() {
  const { lastUpdate } = useCoalitionStore();
  return (
    <footer className="bg-card p-6 border-t-2 border-border">
      <div className="aedlph-container flex items-center justify-between text-sm">
        <div>
          © 2026 · AEDLPH
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-text">Actualizado {lastUpdate || "Desconocido"}</p>
        </div>
      </div>
    </footer>
  );
}
