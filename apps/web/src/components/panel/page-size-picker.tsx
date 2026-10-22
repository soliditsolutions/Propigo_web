"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const SIZES = [10, 25, 50, 100] as const;

export function PageSizePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs select-none"
        style={{ color: "var(--pgo-text-4)" }}
      >
        Mostrar
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Filas por página"
          style={{
            height: "32px",
            paddingLeft: "10px",
            paddingRight: "30px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "10px",
            border: `1px solid ${focused ? "var(--pgo-primary)" : "var(--pgo-border)"}`,
            background: focused ? "var(--pgo-primary-lt)" : "var(--pgo-surface)",
            color: focused ? "var(--pgo-primary-dk)" : "var(--pgo-text-2)",
            appearance: "none",
            WebkitAppearance: "none",
            cursor: "pointer",
            outline: "none",
            boxShadow: focused ? `0 0 0 3px var(--pgo-primary-bd)` : "none",
            transition: "border-color 150ms ease, box-shadow 150ms ease, background 150ms ease, color 150ms ease",
          }}
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s} por página
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2"
          style={{
            color: focused ? "var(--pgo-primary)" : "var(--pgo-text-4)",
            transition: "color 150ms ease",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
