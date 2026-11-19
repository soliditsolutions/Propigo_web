"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, IdCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { validarRut, formatearRut } from "@propigo/core";
import { TerminosAviso } from "@/components/public/TerminosAviso";
import { useToast } from "@/components/ui/toast";
import { Boton, Campo } from "@/components/acceso/campos";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";

export default function PortalPage() {
  const router = useRouter();
  const [rut, setRut]           = useState("");
  const [rutError, setRutError] = useState("");
  const [isPending, start]      = useTransition();
  const { show: toast } = useToast();

  function handleRutBlur() {
    if (rut && !validarRut(rut)) setRutError("RUT inválido. Revisa el dígito verificador.");
    else if (rut) setRut(formatearRut(rut));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rut.trim()) { setRutError("Ingresa tu RUT."); return; }
    if (!validarRut(rut)) { setRutError("RUT inválido. Revisa el dígito verificador."); return; }
    start(async () => {
      try {
        const res = await fetch("/api/portal/solicitar-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ rut: rut.replace(/\./g, "").trim().toUpperCase() }),
        });
        const data = await res.json().catch(() => null);
        if (data?.ok && data.otpId) {
          router.push(`/portal/verificar?id=${encodeURIComponent(data.otpId)}`);
        } else if (res.status === 429 && data?.error) {
          // El servidor dice cuánto esperar; reemplazarlo por un "intenta
          // nuevamente" invitaba a reintentar y volver a chocar con el límite.
          toast(data.error, "warning");
        } else {
          toast("No pudimos enviar el código por un problema de nuestro lado. Intenta de nuevo en unos minutos.", "error");
        }
      } catch {
        toast("Error de conexión. Intenta nuevamente.", "error");
      }
    });
  }

  return (
    <>
      <TerminosAviso destino="al portal" />
      <MarcoGuiado flujo="portal">
        <form onSubmit={handleSubmit} className="pgo-acc-cuerpo" noValidate>
          <hgroup className="pgo-acc-cabecera">
            <h1 className="pgo-acc-titulo">{T.portal.titulo}</h1>
            <p className="pgo-acc-sub">{T.portal.sub}</p>
          </hgroup>

          <Campo
            id="portal-rut" etiqueta={T.portal.rut} icono={IdCard}
            autoComplete="off" placeholder="12.345.678-9"
            value={rut} disabled={isPending} error={rutError || null}
            onChange={(e) => { setRut(e.target.value); setRutError(""); }}
            onBlur={handleRutBlur}
          />

          <Boton type="submit" bloque cargando={isPending}>
            {isPending ? T.portal.ctaCargando : T.portal.cta}
          </Boton>
          <Link href="/marketplace" className="pgo-acc-enlace pgo-acc-enlace--suave" style={{ justifySelf: "center" }}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {T.portal.volver}
          </Link>
        </form>
      </MarcoGuiado>
    </>
  );
}
