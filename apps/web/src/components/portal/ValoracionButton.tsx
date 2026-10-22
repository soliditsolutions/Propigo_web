"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { ValoracionModal } from "@/components/marketplace/ValoracionModal";

interface Props {
  token: string;
}

export function ValoracionButton({ token }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{
          background: "rgba(245,158,11,0.10)",
          color: "var(--pgo-warning-dk)",
          border: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        <Star className="h-4 w-4" aria-hidden />
        Valorar al corredor
      </button>

      {abierto && (
        <ValoracionModal token={token} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}
