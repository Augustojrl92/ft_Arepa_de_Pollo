"use client";

import { useCoalitionStore } from "@/hooks";

export default function LastUpdateText() {
  const { lastUpdate } = useCoalitionStore();

  return (
    <div className="flex items-center gap-2 self-start rounded-full bg-muted/40 px-3 py-1 text-text-secondary sm:self-auto">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      <span>
        Actualizado:{" "}
        <strong className="font-medium text-text">
          {lastUpdate || "Desconocido"}
        </strong>
      </span>
    </div>
  );
}