"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatChartValue, type ChartFormat } from "./format";

export type BarSerie = { key: string; label: string; color: string };

export function MiniBarSeries({
  data,
  series,
  xKey,
  height = 180,
  format = "clpCompact",
}: {
  data: Record<string, string | number>[];
  series: BarSerie[];
  xKey: string;
  height?: number;
  format?: ChartFormat;
}) {
  const hayDatos = data.some((d) => series.some((s) => Number(d[s.key] ?? 0) > 0));
  if (!hayDatos) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, color: "var(--pgo-text-4)" }}
      >
        Sin datos aún
      </div>
    );
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pgo-border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={{ stroke: "var(--pgo-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => formatChartValue(v, format)}
          />
          <Tooltip
            formatter={(value, name) => [formatChartValue(Number(value ?? 0), format), String(name)]}
            contentStyle={{
              background: "var(--pgo-surface)",
              border: "1px solid var(--pgo-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--pgo-text-1)",
            }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
