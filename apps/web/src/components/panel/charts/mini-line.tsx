"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatChartValue, type ChartFormat } from "./format";

export function MiniLine({
  data,
  xKey,
  yKey,
  color,
  height = 160,
  format = "clpCompact",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  color: string;
  height?: number;
  format?: ChartFormat;
}) {
  const hayDatos = data.some((d) => Number(d[yKey] ?? 0) !== 0);
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
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pgo-border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={{ stroke: "var(--pgo-border)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--pgo-text-4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => formatChartValue(v, format)}
          />
          <Tooltip
            formatter={(value) => [formatChartValue(Number(value ?? 0), format), ""]}
            contentStyle={{
              background: "var(--pgo-surface)",
              border: "1px solid var(--pgo-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--pgo-text-1)",
            }}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
