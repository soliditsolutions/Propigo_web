"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { validarRut, formatearRut } from "@propigo/core";
import { TerminosAviso } from "@/components/public/TerminosAviso";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import portalHero from "@/images/backgrounds/001_Consulta.png";
import { Logo } from "@/components/public/Logo";

export default function PortalPage() {
  const router = useRouter();
  const [rut, setRut]           = useState("");
  const [rutError, setRutError] = useState("");
  const [isPending, start]      = useTransition();
  const { show: toast } = useToast();

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRut(e.target.value);
    setRutError("");
  }

  function handleRutBlur() {
    if (rut && !validarRut(rut)) setRutError("RUT inválido. Revisa el dígito verificador.");
    else if (rut) setRut(formatearRut(rut));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rut.trim()) { setRutError("Ingresa tu RUT."); return; }
    if (!validarRut(rut)) { setRutError("RUT inválido."); return; }
    start(async () => {
      try {
        const res = await fetch("/api/portal/solicitar-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ rut: rut.replace(/\./g, "").trim().toUpperCase() }),
        });
        const data = await res.json();
        if (data.ok && data.otpId) {
          router.push(`/portal/verificar?id=${encodeURIComponent(data.otpId)}`);
        } else {
          toast("No fue posible enviar el código. Intenta nuevamente.", "error");
        }
      } catch {
        toast("Error de conexión. Intenta nuevamente.", "error");
      }
    });
  }

  const inputBorder = rutError ? "var(--pgo-danger)" : "var(--pf-border-input)";

  return (
    <>
    <TerminosAviso />
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Fondo — arrendatario instalado revisando su cuenta, composición
          pensada para dejar el centro (donde cae la card) despejado.
          objectPosition sesgado a la izquierda: excluye de la ventana de
          recorte el watermark del generador (esquina inferior derecha). */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <Image src={portalHero} alt="" fill preload className="object-cover" style={{ objectPosition: "30% center" }} />
      </div>
      {/* Tinte muy por debajo de lo que se ve en pantalla completa: con 88-95%
          la foto quedaba casi invisible en ambos temas. Baja a 28-56% para
          que la escena se aprecie claramente y el tinte solo resuelva
          contraste donde el texto (logo, pie) cae directo sobre la foto. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--pf-hero-1) 28%, transparent) 0%, color-mix(in srgb, var(--pf-hero-2) 38%, transparent) 45%, color-mix(in srgb, var(--pf-surface) 56%, transparent) 100%)" }}
      />
      {/* Franja superior — el tinte diagonal de arriba deja el logo (que cae
          justo en la esquina menos teñida) con poco contraste contra la
          cortina clara de la foto. Viñeta dedicada solo para esa franja. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--pf-surface) 68%, transparent) 0%, transparent 27%)" }}
      />
      {/* Parche puntual de seguridad sobre el watermark, por si el recorte
          real (según viewport) deja algo de la esquina visible. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle at 90% 85%, var(--pf-surface) 0%, transparent 18%)" }}
      />

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/marketplace" className="inline-flex">
            <Logo size="lg" />
          </Link>
          <p className="mt-1 text-sm" style={{ color: "var(--pf-text-muted)" }}>Portal de autoconsulta</p>
        </div>

        {/* Card */}
        <div
          className="pf-card rounded-2xl p-7"
          style={{ boxShadow: "0 20px 60px rgba(10, 37, 64, 0.10)" }}
        >
          <h1 className="mb-1 text-xl font-bold" style={{ color: "var(--pf-navy)" }}>
            Accede a tu información
          </h1>
          <p className="mb-6 text-sm" style={{ color: "var(--pf-text-body)" }}>
            Ingresa tu RUT para recibir un código de acceso en tu correo registrado.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="portal-rut" className="block text-sm font-semibold" style={{ color: "var(--pf-navy)" }}>
                RUT
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--pf-text-light)" }}
                  aria-hidden
                />
                <input
                  id="portal-rut"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="12.345.678-9"
                  value={rut}
                  onChange={handleRutChange}
                  onBlur={handleRutBlur}
                  disabled={isPending}
                  style={{
                    height:       "46px",
                    width:        "100%",
                    borderRadius: "12px",
                    border:       `1px solid ${inputBorder}`,
                    background:   "var(--pf-surface)",
                    color:        "var(--pf-navy)",
                    fontSize:     "15px",
                    padding:      "0 14px 0 44px",
                    outline:      "none",
                    boxShadow:    "0 1px 3px rgba(10,37,64,0.06)",
                    transition:   "border-color 150ms ease, box-shadow 150ms ease",
                    opacity:      isPending ? 0.6 : 1,
                  }}
                  onFocus={(e) => {
                    if (!rutError) {
                      e.currentTarget.style.borderColor = "var(--pf-brand)";
                      e.currentTarget.style.boxShadow   = "0 0 0 3px color-mix(in srgb, var(--pf-brand) 15%, transparent)";
                    }
                  }}
                  onBlurCapture={(e) => {
                    if (!rutError) {
                      e.currentTarget.style.borderColor = "var(--pf-border-input)";
                      e.currentTarget.style.boxShadow   = "0 1px 3px rgba(10,37,64,0.06)";
                    }
                  }}
                />
              </div>
              {rutError && (
                <p className="text-xs" style={{ color: "var(--pgo-danger)" }}>{rutError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="pf-btn-primary w-full"
              style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
            >
              {isPending ? (
                <>
                  <Spinner />
                  Enviando código…
                </>
              ) : (
                "Recibir código de acceso"
              )}
            </button>
          </form>
        </div>

        {/* Pie de seguridad */}
        <div className="mt-6 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--pf-text-muted)" }}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pf-success-check)" }} aria-hidden />
            Acceso seguro · Ley 21.719 · Datos personales protegidos
          </div>
          <Link
            href="/marketplace"
            className="block text-xs transition-colors hover:underline"
            style={{ color: "var(--pf-text-muted)" }}
          >
            ← Volver al marketplace
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
