"use client";

import { Check, X } from "lucide-react";
import {
  evaluatePassword, checkRequisitos, PASSWORD_MIN_LENGTH, type PersonalInfo,
} from "@/lib/password-strength";

interface Props extends PersonalInfo {
  password: string;
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs" style={{ color: ok ? "var(--hw-success)" : "var(--hw-text-4)" }}>
      {ok
        ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
        : <X className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {label}
    </li>
  );
}

/** Barra de fuerza + checklist en vivo de los requisitos — usado en registro,
 * invitación, cambio de contraseña y recuperación de contraseña. */
export function PasswordStrengthMeter({ password, nombre, email, rut }: Props) {
  if (!password) return null;

  const personal = { nombre, email, rut };
  const s   = evaluatePassword(password, personal);
  const req = checkRequisitos(password, personal);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-200"
            style={{ background: i <= s.score ? s.color : "var(--hw-border-2)" }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>

      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <ChecklistItem ok={req.minLength}  label={`Al menos ${PASSWORD_MIN_LENGTH} caracteres`} />
        <ChecklistItem ok={req.hasLetter}  label="Una letra" />
        <ChecklistItem ok={req.hasDigit}   label="Un número" />
        <ChecklistItem ok={req.hasSpecial} label="Un carácter especial" />
        <ChecklistItem ok={req.notCommon}  label="No es una contraseña común" />
        <ChecklistItem ok={req.noPersonalInfo} label="Sin tu nombre, correo o RUT" />
      </ul>
    </div>
  );
}
