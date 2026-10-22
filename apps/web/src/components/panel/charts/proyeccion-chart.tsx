"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatChartValue } from "./format";

export type PuntoProyeccion = { mes: string; realizadoClp: number; proyectadoClp: number; esAproximado: boolean };

/**
 * Barras apiladas: realizado (sólido) + proyectado (rayado, vía patrón SVG) —
 * mismo lenguaje visual "realizado vs. proyectado" de toda la sección de
 * estadísticas (ver arquitectura: nunca se presenta un monto futuro como si
 * fuera un hecho consumado).
 */
export function ProyeccionChart({
  data,
  height = 220,
}: {
  data: PuntoProyeccion[];
  height?: number;
}) {
  const hayDatos = data.some((d) => d.realizadoClp > 0 || d.proyectadoClp > 0);
  if (!hayDatos) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, color: "var(--pgo-text-4)" }}
      >
        Sin períodos futuros generados aún
      </div>
    );
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <pattern id="rayadoProyectado" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--pgo-primary)" fillOpacity={0.35} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--pgo-primary)" strokeWidth="3" />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pgo-border)" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={{ stroke: "var(--pgo-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => formatChartValue(v, "clpCompact")}
          />
          <Tooltip
            formatter={(value, name) => [formatChartValue(Number(value ?? 0), "clpCompact"), String(name)]}
            contentStyle={{
              background: "var(--pgo-surface)",
              border: "1px solid var(--pgo-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--pgo-text-1)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--pgo-text-3)" }} />
          <Bar dataKey="realizadoClp" name="Cobrado" stackId="ing" fill="var(--pgo-success)" radius={[0, 0, 0, 0]} maxBarSize={36} />
          <Bar dataKey="proyectadoClp" name="Proyectado (aprox.)" stackId="ing" fill="url(#rayadoProyectado)" radius={[3, 3, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
