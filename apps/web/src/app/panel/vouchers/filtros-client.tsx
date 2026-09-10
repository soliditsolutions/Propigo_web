"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Filter, X } from "lucide-react";

interface Props {
  contratos:       { id: string; label: string }[];
  tipoActivo?:     string;
  desdeActivo?:    string;
  hastaActivo?:    string;
  contratoIdActivo?: string;
}

export function FiltrosClient({
  contratos,
  tipoActivo,
  desdeActivo,
  hastaActivo,
  contratoIdActivo,
}: Props) {
  const router    = useRouter();
  const pathname  = usePathname();
  const [, start] = useTransition();

  function aplicar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    if (fd.get("tipo"))        params.set("tipo",       String(fd.get("tipo")));
    if (fd.get("desde"))       params.set("desde",      String(fd.get("desde")));
    if (fd.get("hasta"))       params.set("hasta",      String(fd.get("hasta")));
    if (fd.get("contratoId"))  params.set("contratoId", String(fd.get("contratoId")));
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  const hasFilters = tipoActivo || desdeActivo || hastaActivo || contratoIdActivo;

  return (
    <form
      onSubmit={aplicar}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl p-4"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
    >
      {/* Tipo */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Tipo
        </label>
        <select
          name="tipo"
          defaultValue={tipoActivo ?? ""}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{
            borderColor: "var(--hw-border)",
            color: "var(--hw-text-2)",
            background: "var(--hw-surface)",
          }}
        >
          <option value="">Todos</option>
          <option value="pago">Pago</option>
          <option value="liquidacion">Liquidación</option>
          <option value="garantia">Devolución de garantía</option>
        </select>
      </div>

      {/* Desde */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Desde
        </label>
        <input
          type="date"
          name="desde"
          defaultValue={desdeActivo ?? ""}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{
            borderColor: "var(--hw-border)",
            color: "var(--hw-text-2)",
            background: "var(--hw-surface)",
          }}
        />
      </div>

      {/* Hasta */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Hasta
        </label>
        <input
          type="date"
          name="hasta"
          defaultValue={hastaActivo ?? ""}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{
            borderColor: "var(--hw-border)",
            color: "var(--hw-text-2)",
            background: "var(--hw-surface)",
          }}
        />
      </div>

      {/* Contrato / Propiedad */}
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Propiedad
        </label>
        <select
          name="contratoId"
          defaultValue={contratoIdActivo ?? ""}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{
            borderColor: "var(--hw-border)",
            color: "var(--hw-text-2)",
            background: "var(--hw-surface)",
          }}
        >
          <option value="">Todas</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Botones */}
      <div className="flex items-center gap-2 self-end">
        <button
          type="submit"
          className="hw-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--hw-primary)" }}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Filtrar
        </button>
        {hasFilters && (
          <a
            href="/panel/vouchers"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--hw-surface-2)]"
            style={{ color: "var(--hw-text-3)" }}
            aria-label="Limpiar filtros"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpiar
          </a>
        )}
      </div>
    </form>
  );
}
