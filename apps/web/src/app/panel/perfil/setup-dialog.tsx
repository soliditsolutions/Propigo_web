"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, ArrowRight } from "lucide-react";
import { MARCA } from "@/lib/marca";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const REQUISITOS_PERFIL = ["Teléfono de contacto", "Fecha de nacimiento", "Dirección profesional", "Ciudad"] as const;

/**
 * Aviso de primer ingreso: el perfil está incompleto. Usa el Dialog de Base UI
 * (foco atrapado, Esc y fondo inerte) y un h2: el h1 de la pantalla es el de
 * «Mi perfil», que sigue debajo.
 */
export function SetupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function cerrar() {
    setOpen(false);
    // Sin el query param, el aviso no reaparece al recargar.
    router.replace("/panel/perfil", { scroll: false });
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <DialogContent
        showCloseButton={false}
        className="pgo-auth-card gap-0 p-8 text-center sm:max-w-md lg:max-w-md"
      >
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--pgo-primary-lt)", color: "var(--pgo-primary)" }}
          aria-hidden="true"
        >
          <UserCog className="h-7 w-7" />
        </div>

        <DialogTitle className="text-xl font-bold leading-tight" style={{ color: "var(--pgo-text-1)" }}>
          Configura tu perfil para comenzar
        </DialogTitle>
        <DialogDescription className="mt-3 leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
          Para publicar propiedades, crear contratos y usar todas las funciones de {MARCA}, completa estos datos de tu perfil.
        </DialogDescription>

        <ul className="mx-auto my-7 grid w-fit gap-2 text-left text-sm" style={{ color: "var(--pgo-text-2)" }}>
          {REQUISITOS_PERFIL.map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              {/* Punto, no ✓: son datos que faltan, no pasos cumplidos. */}
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--pgo-primary)" }} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={cerrar}
          className="pgo-btn-primary w-full justify-center gap-2"
          style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
        >
          Completar mi perfil
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
