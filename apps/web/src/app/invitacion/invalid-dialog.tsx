"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function InvitacionInvalidDialog({ mensaje }: { mensaje: string }) {
  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(15,31,53,0.50)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitacion-invalid-title"
      >
        <div
          className="w-full max-w-sm text-center space-y-5 rounded-2xl p-8"
          style={{
            background: "var(--pgo-surface)",
            border:     "1px solid var(--pgo-border)",
            boxShadow:  "0 25px 60px rgba(15,31,53,0.20), 0 8px 24px rgba(15,31,53,0.12)",
            animation:  "pgo-toast-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--pgo-danger-lt)" }}>
              <AlertTriangle className="h-7 w-7" style={{ color: "var(--pgo-danger)" }} aria-hidden="true" />
            </div>
          </div>

          <div>
            <h1 id="invitacion-invalid-title" className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>
              Invitación inválida
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
              {mensaje}
            </p>
          </div>

          <Link
            href="/login"
            className="pgo-btn-primary inline-flex justify-center"
            style={{ height: "42px", fontSize: "14px", borderRadius: "10px", padding: "0 24px" }}
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    </>
  );
}
