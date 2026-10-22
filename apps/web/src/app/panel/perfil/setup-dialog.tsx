"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, ArrowRight } from "lucide-react";
import { MARCA } from "@/lib/marca";

export function SetupDialog() {
  const router  = useRouter();
  const [open, setOpen] = useState(true);

  function handleEmpezar() {
    setOpen(false);
    // Limpiar el query param para que no reaparezca en recargas
    router.replace("/panel/perfil", { scroll: false });
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{
          background:           "rgba(15,31,53,0.55)",
          backdropFilter:       "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            background: "var(--pgo-surface)",
            border:     "1px solid var(--pgo-border)",
            boxShadow:  "var(--pgo-shadow-3)",
            animation:  "pgo-toast-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Icono */}
          <div className="flex justify-center mb-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "var(--pgo-primary-lt)" }}
            >
              <UserCog
                className="h-8 w-8"
                style={{ color: "var(--pgo-primary)" }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Texto */}
          <div className="text-center space-y-3 mb-8">
            <h1
              id="setup-title"
              className="text-xl font-bold"
              style={{ color: "var(--pgo-text-1)" }}
            >
              Configura tu perfil para comenzar
            </h1>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--pgo-text-3)" }}
            >
              Para publicar propiedades, crear contratos y usar todas las
              funciones de {MARCA} necesitas completar algunos datos básicos de
              tu perfil.
            </p>
          </div>

          {/* Lista de requisitos */}
          <ul className="space-y-2 mb-8">
            {[
              "Teléfono de contacto",
              "Fecha de nacimiento",
              "Dirección profesional",
              "Ciudad",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-sm"
                style={{ color: "var(--pgo-text-2)" }}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--pgo-primary)" }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            type="button"
            onClick={handleEmpezar}
            className="pgo-btn-primary w-full justify-center gap-2"
            style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
          >
            Comenzar configuración
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
