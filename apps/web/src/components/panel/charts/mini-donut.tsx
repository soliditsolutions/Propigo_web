"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type DonutSlice = { label: string; value: number; color: string };

export function MiniDonut({ data, height = 140 }: { data: DonutSlice[]; height?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, width: height, color: "var(--pgo-text-4)" }}
      >
        Sin datos aún
      </div>
    );
  }
  return (
    // width fijo (no "100%"): dentro de un flex row junto a una leyenda, un
    // hijo sin ancho propio colapsa a 0 — ResponsiveContainer no tiene de
    // dónde medir. shrink-0 evita que el flex lo aplaste igual.
    <div className="shrink-0" style={{ height, width: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              return [`${n} (${Math.round((n / total) * 100)}%)`, String(name)];
            }}
            contentStyle={{
              background: "var(--pgo-surface)",
              border: "1px solid var(--pgo-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--pgo-text-1)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
