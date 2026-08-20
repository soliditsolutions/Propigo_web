"use client";

import { useActionState, useState, useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User, Phone, CalendarDays, MapPin, Lock, Shield, Fingerprint,
  Eye, EyeOff, CheckCircle2, Loader2, Camera, Send, RotateCw, X, Mail,
} from "lucide-react";
import {
  guardarPerfilAction, cambiarPasswordAction,
  solicitarCambioContactoAction, confirmarCambioContactoAction,
} from "./actions";
import { REGIONES_CHILE, getComunasDeRegion } from "@housing/core";
import type { PerfilState, PasswordState, CampoContacto } from "./actions";
import { useToast }                from "@/components/ui/toast";
import { validateRut, formatRut }  from "@/lib/rut";
import { PasswordStrengthMeter }   from "@/components/ui/password-strength-meter";
import { evaluatePassword }        from "@/lib/password-strength";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PerfilData {
  nombre:          string;
  email:           string;
  rut:             string | null;
  telefono:        string | null;
  fechaNacimiento: Date | null;
  direccion:       string | null;
  ciudad:          string | null;
  region:          string | null;
  fotoPerfil:      string | null;
  perfilCompleto:  boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const iso = new Date(d).toISOString();
  return iso.split("T")[0];
}

function initials(nombre: string): string {
  return nombre.split(" ").slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();
}

// ── Sección: avatar ───────────────────────────────────────────────────────────

function AvatarSection({
  nombre,
  fotoPerfil,
  onFotoChange,
}: {
  nombre: string;
  fotoPerfil: string;
  onFotoChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload?type=perfil", { method: "POST", body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) onFotoChange(data.url);
    } catch {
      // upload silenced — user retries
    } finally {
      setUploading(false);
    }
  }

  const hasFoto = fotoPerfil.startsWith("/");

  return (
    <div className="flex items-center gap-5">
      {/* Avatar */}
      <div className="relative shrink-0">
        {hasFoto ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-full" style={{ border: "3px solid var(--hw-border)" }}>
            <Image src={fotoPerfil} alt="Foto de perfil" fill className="object-cover" sizes="80px" />
          </div>
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{
              background: "linear-gradient(135deg, var(--hw-primary) 0%, var(--hw-sidebar) 100%)",
            }}
          >
            {initials(nombre)}
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Cambiar foto de perfil"
          className="hw-btn absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md"
          style={{ background: "var(--hw-primary)" }}
        >
          {uploading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFile}
          aria-label="Seleccionar foto de perfil"
        />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "var(--hw-text-1)" }}>{nombre}</p>
        <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>
          {hasFoto ? "Haz clic en la cámara para cambiar tu foto" : "Sube una foto de perfil (opcional)"}
        </p>
      </div>
    </div>
  );
}

// ── Sección: cambiar contraseña ───────────────────────────────────────────────

function CambiarPasswordSection({ nombre, email }: { nombre: string; email: string }) {
  const { show: toast } = useToast();
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    cambiarPasswordAction, null,
  );
  const [showActual, setShowActual] = useState(false);
  const [showNuevo,  setShowNuevo]  = useState(false);
  const [pwd, setPwd] = useState("");
  const passes = evaluatePassword(pwd, { nombre, email }).passes;

  useEffect(() => {
    if (state?.ok) toast("Contraseña actualizada correctamente.", "success");
  }, [state, toast]);

  const inputStyle = {
    height: "44px", width: "100%", borderRadius: "12px",
    border: "1px solid var(--hw-border-2)", background: "var(--hw-surface)",
    color: "var(--hw-text-1)", fontSize: "14px", padding: "0 44px 0 14px",
    outline: "none", boxShadow: "var(--hw-input-shadow)",
  };

  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Lock className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
        <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
          Cambiar contraseña
        </h2>
      </div>

      <form action={formAction} className="space-y-4">
        {/* Contraseña actual */}
        <div className="space-y-1.5">
          <label htmlFor="passwordActual" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
            Contraseña actual
          </label>
          <div className="relative">
            <input
              id="passwordActual" name="passwordActual"
              type={showActual ? "text" : "password"}
              autoComplete="current-password"
              required disabled={pending}
              style={{ ...inputStyle, opacity: pending ? 0.6 : 1 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
            />
            <button type="button" onClick={() => setShowActual(!showActual)}
              aria-label={showActual ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70"
              style={{ color: "var(--hw-text-4)" }}>
              {showActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {!state?.ok && state?.field === "passwordActual" && (
            <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{state.error}</p>
          )}
        </div>

        {/* Nueva contraseña */}
        <div className="space-y-1.5">
          <label htmlFor="passwordNuevo" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="passwordNuevo" name="passwordNuevo"
              type={showNuevo ? "text" : "password"}
              autoComplete="new-password"
              required disabled={pending}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={{ ...inputStyle, opacity: pending ? 0.6 : 1 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
            />
            <button type="button" onClick={() => setShowNuevo(!showNuevo)}
              aria-label={showNuevo ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70"
              style={{ color: "var(--hw-text-4)" }}>
              {showNuevo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <PasswordStrengthMeter password={pwd} nombre={nombre} email={email} />
          {!state?.ok && state?.field === "passwordNuevo" && (
            <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{state.error}</p>
          )}
        </div>

        {/* Confirmar */}
        <div className="space-y-1.5">
          <label htmlFor="passwordConfirm" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
            Confirmar nueva contraseña
          </label>
          <input
            id="passwordConfirm" name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required disabled={pending}
            style={{ ...inputStyle, padding: "0 14px", opacity: pending ? 0.6 : 1 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
          />
          {!state?.ok && state?.field === "passwordConfirm" && (
            <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{state.error}</p>
          )}
        </div>

        {/* Error global */}
        {!state?.ok && state?.error && !state.field && (
          <p className="text-sm rounded-xl px-4 py-2.5" style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)", border: "1px solid var(--hw-danger-bd)" }}>
            {state.error}
          </p>
        )}

        <button
          type="submit" disabled={pending || !passes}
          className="hw-btn-primary"
          style={{ height: "42px", fontSize: "14px", borderRadius: "10px", opacity: (!passes && pwd.length > 0) ? 0.5 : 1 }}
        >
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Actualizando…</> : "Actualizar contraseña"}
        </button>
      </form>
    </section>
  );
}

// ── Campo con cambio protegido por código (teléfono / correo) ────────────────
// El valor actual solo cambia tras confirmar un código de 6 dígitos enviado
// al correo YA verificado de la sesión — nunca al valor nuevo. Reemplaza el
// input libremente editable que tenía antes el teléfono, y le da al correo
// (antes 100% bloqueado) una forma de cambiarlo con la misma fricción que
// verificar un dispositivo nuevo.

function CambiarContactoField({
  campo,
  label,
  icon,
  valorActual,
  inputType,
  placeholder,
}: {
  campo: CampoContacto;
  label: string;
  icon: React.ReactNode;
  valorActual: string;
  inputType: "tel" | "email";
  placeholder: string;
}) {
  const router = useRouter();
  const { show: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [paso, setPaso]           = useState<"idle" | "nuevo" | "codigo">("idle");
  const [nuevoValor, setNuevoValor] = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [codigo, setCodigo]         = useState("");
  const [error, setError]           = useState("");
  const [valorMostrado, setValorMostrado] = useState(valorActual);
  const [cooldown, setCooldown]     = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function cancelar() {
    setPaso("idle");
    setNuevoValor("");
    setPassword("");
    setCodigo("");
    setError("");
  }

  // El password se conserva mientras dura el flujo (no solo en el primer envío)
  // para que "Reenviar código" no obligue a retipearlo — se limpia recién al
  // cancelar o al confirmar el cambio.
  function handleEnviarCodigo() {
    setError("");
    startTransition(async () => {
      const res = await solicitarCambioContactoAction(campo, nuevoValor, password);
      if (!res.ok) { setError(res.error); return; }
      setPaso("codigo");
      setCooldown(60);
      toast("Código enviado a tu correo actual.", "success");
    });
  }

  function handleConfirmar() {
    setError("");
    startTransition(async () => {
      const res = await confirmarCambioContactoAction(campo, codigo);
      if (!res.ok) { setError(res.error); return; }
      setValorMostrado(res.valorNuevo);
      cancelar();
      toast(`${label} actualizado correctamente.`, "success");
      router.refresh();
    });
  }

  const fieldStyle: React.CSSProperties = {
    height: "44px", width: "100%", borderRadius: "12px",
    border: "1px solid var(--hw-border-2)", background: "var(--hw-surface)",
    color: "var(--hw-text-1)", fontSize: "14px", padding: "0 14px",
    outline: "none", boxShadow: "var(--hw-input-shadow)",
    opacity: isPending ? 0.6 : 1,
    transition: "border-color 150ms ease, box-shadow 150ms ease",
  };
  const btnPrimaryStyle: React.CSSProperties = {
    height: "40px", fontSize: "13px", borderRadius: "10px", flexShrink: 0,
  };
  const btnGhostStyle: React.CSSProperties = {
    height: "40px", borderRadius: "10px", padding: "0 14px", fontSize: "13px", fontWeight: 600,
    background: "var(--hw-surface-2)", color: "var(--hw-text-3)", border: "1px solid var(--hw-border)",
    display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0,
    transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
  };
  const ghostHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background   = "var(--hw-surface-3, var(--hw-border))";
      e.currentTarget.style.borderColor  = "var(--hw-border-2)";
      e.currentTarget.style.color        = "var(--hw-text-1)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background   = "var(--hw-surface-2)";
      e.currentTarget.style.borderColor  = "var(--hw-border)";
      e.currentTarget.style.color        = "var(--hw-text-3)";
    },
  };

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
        {icon}
        {label}
      </label>

      {paso === "idle" && (
        <div className="flex items-center gap-2">
          <input
            type={inputType} value={valorMostrado} disabled readOnly
            title={valorMostrado}
            style={{ ...fieldStyle, opacity: 0.55, cursor: "not-allowed", minWidth: 0, textOverflow: "ellipsis" }}
          />
          <button
            type="button" onClick={() => setPaso("nuevo")}
            className="hw-btn" style={btnGhostStyle} {...ghostHover}
          >
            Cambiar
          </button>
        </div>
      )}

      {paso === "nuevo" && (
        <div className="space-y-2">
          <input
            type={inputType} value={nuevoValor}
            onChange={(e) => setNuevoValor(e.target.value)}
            placeholder={placeholder} disabled={isPending}
            style={fieldStyle} autoFocus
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
          />
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña actual" disabled={isPending}
              autoComplete="current-password"
              style={{ ...fieldStyle, paddingRight: "40px" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
            />
            <button
              type="button" onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70"
              style={{ color: "var(--hw-text-4)" }}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: "var(--hw-text-4)" }}>
            Confirma tu contraseña para pedir el código de verificación.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={handleEnviarCodigo} disabled={isPending || !nuevoValor.trim() || !password}
              className="hw-btn-primary" style={{ ...btnPrimaryStyle, opacity: (!nuevoValor.trim() || !password) ? 0.5 : 1 }}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              {isPending ? "Enviando…" : "Enviar código"}
            </button>
            <button type="button" onClick={cancelar} disabled={isPending} className="hw-btn" style={btnGhostStyle} {...ghostHover}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {paso === "codigo" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>
            Enviamos un código de 6 dígitos a tu correo actual para confirmar el cambio a{" "}
            <strong style={{ color: "var(--hw-text-2)" }}>{nuevoValor}</strong>.
          </p>
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000" disabled={isPending}
            style={{ ...fieldStyle, letterSpacing: "0.3em", textAlign: "center" }}
            autoFocus
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--hw-primary)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--hw-border-2)"; e.currentTarget.style.boxShadow = "var(--hw-input-shadow)"; }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={handleConfirmar} disabled={isPending || codigo.length !== 6}
              className="hw-btn-primary" style={{ ...btnPrimaryStyle, opacity: codigo.length !== 6 ? 0.5 : 1 }}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {isPending ? "Confirmando…" : "Confirmar"}
            </button>
            <button
              type="button" onClick={handleEnviarCodigo} disabled={isPending || cooldown > 0}
              className="hw-btn" style={{ ...btnGhostStyle, opacity: cooldown > 0 ? 0.6 : 1 }} {...ghostHover}
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              {cooldown > 0 ? `Reenviar (${cooldown}s)` : "Reenviar código"}
            </button>
            <button type="button" onClick={cancelar} disabled={isPending} className="hw-btn" style={btnGhostStyle} {...ghostHover}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>
      )}

      {paso !== "idle" && (
        <p className="text-[11px]" style={{ color: "var(--hw-text-4)" }}>
          ¿No tienes acceso a tu correo? Contacta a soporte.
        </p>
      )}
    </div>
  );
}

// ── Sección: 2FA (coming soon) ────────────────────────────────────────────────

function TwoFASection() {
  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
          <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
            Autenticación de dos factores (2FA)
          </h2>
        </div>
        <span
          className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--hw-primary-lt)", color: "var(--hw-primary-dk)", border: "1px solid var(--hw-primary-bd)" }}
        >
          Próximamente
        </span>
      </div>

      <p className="text-sm mb-5" style={{ color: "var(--hw-text-3)" }}>
        El 2FA agrega una segunda capa de verificación al iniciar sesión. Usarás una app
        autenticadora (Google Authenticator, Authy u otra) para generar códigos de un solo uso.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-5">
        {[
          { title: "Aplicación TOTP",   desc: "Compatibilidad con Google Authenticator, Authy y cualquier app TOTP estándar (RFC 6238)." },
          { title: "Códigos de respaldo", desc: "Recibe 8 códigos de un solo uso para recuperar el acceso si pierdes tu dispositivo." },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border)" }}
          >
            <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--hw-text-1)" }}>{item.title}</p>
            <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Disponible próximamente"
        className="hw-btn-primary opacity-40 cursor-not-allowed"
        style={{ height: "42px", fontSize: "14px", borderRadius: "10px" }}
      >
        <Shield className="h-4 w-4" aria-hidden="true" />
        Activar 2FA
      </button>
    </section>
  );
}

// ── Formulario principal de perfil ────────────────────────────────────────────

export function PerfilForm({ perfil, section = "datos" }: { perfil: PerfilData; section?: "datos" | "seguridad" }) {
  const router = useRouter();
  const { show: toast } = useToast();

  const [state, formAction, pending] = useActionState<PerfilState, FormData>(
    guardarPerfilAction, null,
  );

  const [fotoPerfil, setFotoPerfil] = useState(perfil.fotoPerfil ?? "");
  const [region, setRegion]         = useState(perfil.region ?? "");
  const [ciudad, setCiudad]         = useState(perfil.ciudad ?? "");
  const comunasDisponibles          = useMemo(() => getComunasDeRegion(region), [region]);
  // El Manager siempre llega con RUT ya fijado (verificado contra la cédula
  // en /registro), pero un Collaborator invitado (ADR-0013) no pasa por esa
  // verificación y empieza con rut=null — debe poder fijarlo una vez, igual
  // que fechaNacimiento. Una vez fijado (Manager o Collaborator), queda
  // inmutable (server-side en guardarPerfilAction, esto es solo la UI).
  const rutBloqueado = !!perfil.rut;
  const [rutInput, setRutInput] = useState(perfil.rut ?? "");
  const rutInlineError = !rutBloqueado && rutInput.length > 3 && !validateRut(rutInput) ? "RUT inválido" : null;

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9kK]/g, "");
    setRutInput(raw.length > 1 ? formatRut(raw) : raw);
  }

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast("Perfil guardado correctamente.", "success");
      if (state.perfilCompleto) {
        // Redirigir al panel tras completar el perfil por primera vez
        if (!perfil.perfilCompleto) {
          router.push("/panel");
        }
      }
    }
  }, [state, toast, router, perfil.perfilCompleto]);

  const labelStyle  = { color: "var(--hw-text-2)" };
  const inputBase   = {
    height: "44px", width: "100%", borderRadius: "12px",
    border: "1px solid var(--hw-border-2)", background: "var(--hw-surface)",
    color: "var(--hw-text-1)", fontSize: "14px", padding: "0 14px",
    outline: "none",
    boxShadow: "var(--hw-input-shadow)",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    opacity: pending ? 0.6 : 1,
  };
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "var(--hw-primary)";
      e.currentTarget.style.boxShadow   = "var(--hw-input-shadow-focus)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "var(--hw-border-2)";
      e.currentTarget.style.boxShadow   = "var(--hw-input-shadow)";
    },
  };

  function fieldError(field: string): string | null {
    if (!state || state.ok) return null;
    return state.field === field ? state.error : null;
  }

  return (
    <div className="space-y-6">
      {section === "datos" && (
        <>

      {/* Sección: foto + nombre */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
      >
        <AvatarSection
          nombre={perfil.nombre}
          fotoPerfil={fotoPerfil}
          onFotoChange={setFotoPerfil}
        />
        <input type="hidden" name="fotoPerfil" value={fotoPerfil} form="perfil-form" />
      </section>

      {/* Sección: datos del corredor */}
      <form id="perfil-form" action={formAction}>
        <input type="hidden" name="fotoPerfil" value={fotoPerfil} />

        <section
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
            <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
              Información personal
            </h2>
          </div>

          {/* Nombre + RUT — identidad verificada contra la cédula en /registro,
              inmutables de por vida (defensa en profundidad server-side en
              guardarPerfilAction, esto es solo la capa visual). */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-semibold" style={labelStyle}>
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                Nombre completo
              </label>
              <div className="relative">
                <input
                  type="text" value={perfil.nombre} disabled readOnly
                  style={{ ...inputBase, opacity: 0.55, cursor: "not-allowed", paddingRight: "38px" }}
                />
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rut" className="flex items-center gap-1.5 text-sm font-semibold" style={labelStyle}>
                <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                RUT
              </label>
              <div className="relative">
                <input
                  id="rut" name="rut" type="text"
                  inputMode="numeric" autoComplete="off" maxLength={12}
                  value={rutInput}
                  readOnly={rutBloqueado}
                  disabled={rutBloqueado ? undefined : pending}
                  onChange={rutBloqueado ? undefined : handleRutChange}
                  placeholder={rutBloqueado ? undefined : "12.345.678-9"}
                  required={!rutBloqueado}
                  style={{
                    ...inputBase,
                    paddingRight: "38px",
                    ...(rutBloqueado
                      ? { opacity: 0.55, cursor: "not-allowed" }
                      : { borderColor: (rutInlineError || fieldError("rut")) ? "var(--hw-danger)" : undefined }),
                  }}
                  {...(rutBloqueado ? {} : focusHandlers)}
                />
                {rutBloqueado && (
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
                )}
              </div>
              {(rutInlineError || fieldError("rut")) && (
                <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("rut") ?? rutInlineError}</p>
              )}
            </div>
          </div>
          <p className="-mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--hw-text-4)" }}>
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Verificados con tu cédula al crear la cuenta — no se pueden modificar.
          </p>

          {/* Fecha de nacimiento — editable una sola vez, luego inmutable */}
          <div className="space-y-1.5">
            <label htmlFor="fechaNacimiento" className="flex items-center gap-1.5 text-sm font-semibold" style={labelStyle}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Fecha de nacimiento{" "}
              {!perfil.fechaNacimiento && <span style={{ color: "var(--hw-danger)" }}>*</span>}
            </label>
            <div className="relative sm:w-1/2 sm:pr-2">
              <input
                id="fechaNacimiento" name="fechaNacimiento" type="date"
                defaultValue={toDateInput(perfil.fechaNacimiento)}
                required disabled={pending}
                readOnly={!!perfil.fechaNacimiento}
                style={{
                  ...inputBase,
                  ...(perfil.fechaNacimiento ? { opacity: 0.55, cursor: "not-allowed", paddingRight: "38px" } : {}),
                }}
                {...focusHandlers}
              />
              {perfil.fechaNacimiento && (
                <Lock className="pointer-events-none absolute right-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sm:right-3.5" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
              )}
            </div>
            {fieldError("fechaNacimiento") && (
              <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("fechaNacimiento")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Teléfono — editable libremente solo la primera vez (onboarding,
                perfil.telefono === null); una vez fijado, solo cambia vía
                CambiarContactoField (código al correo actual). */}
            {perfil.telefono ? (
              <CambiarContactoField
                campo="telefono" label="Teléfono" inputType="tel"
                icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
                valorActual={perfil.telefono} placeholder="+56 9 1234 5678"
              />
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="telefono" className="flex items-center gap-1.5 text-sm font-semibold" style={labelStyle}>
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Teléfono{" "}
                  <span style={{ color: "var(--hw-danger)" }}>*</span>
                </label>
                <input
                  id="telefono" name="telefono" type="tel"
                  defaultValue="" placeholder="+56 9 1234 5678"
                  required disabled={pending}
                  style={inputBase}
                  {...focusHandlers}
                />
                {fieldError("telefono") && (
                  <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("telefono")}</p>
                )}
              </div>
            )}

            {/* Correo — siempre viene fijado desde /registro, cambia solo vía código */}
            <CambiarContactoField
              campo="email" label="Correo electrónico" inputType="email"
              icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
              valorActual={perfil.email} placeholder="nuevo@correo.cl"
            />
          </div>
        </section>

        {/* Sección: dirección */}
        <section
          className="rounded-2xl p-6 space-y-5 mt-6"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
            <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
              Dirección profesional
            </h2>
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <label htmlFor="direccion" className="block text-sm font-semibold" style={labelStyle}>
              Dirección{" "}
              <span style={{ color: "var(--hw-danger)" }}>*</span>
            </label>
            <input
              id="direccion" name="direccion" type="text"
              defaultValue={perfil.direccion ?? ""}
              placeholder="Av. Providencia 1234, oficina 56"
              required disabled={pending}
              style={inputBase}
              {...focusHandlers}
            />
            {fieldError("direccion") && (
              <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("direccion")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Región */}
            <div className="space-y-1.5">
              <label htmlFor="region" className="block text-sm font-semibold" style={labelStyle}>
                Región{" "}
                <span style={{ color: "var(--hw-danger)" }}>*</span>
              </label>
              <select
                id="region" name="region"
                value={region}
                onChange={(e) => { setRegion(e.target.value); setCiudad(""); }}
                required disabled={pending}
                style={{
                  ...inputBase,
                  padding: "0 14px",
                  cursor: "pointer",
                  appearance: "auto",
                }}
                {...focusHandlers}
              >
                <option value="">Seleccionar región…</option>
                {REGIONES_CHILE.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {fieldError("region") && (
                <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("region")}</p>
              )}
            </div>

            {/* Ciudad / comuna — depende de la región elegida */}
            <div className="space-y-1.5">
              <label htmlFor="ciudad" className="block text-sm font-semibold" style={labelStyle}>
                Ciudad / comuna{" "}
                <span style={{ color: "var(--hw-danger)" }}>*</span>
              </label>
              <select
                id="ciudad" name="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                required disabled={pending || !region}
                style={{
                  ...inputBase,
                  padding: "0 14px",
                  cursor: region ? "pointer" : "not-allowed",
                  appearance: "auto",
                }}
                {...focusHandlers}
              >
                <option value="">{region ? "Seleccionar comuna…" : "Primero elige una región"}</option>
                {comunasDisponibles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldError("ciudad") && (
                <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{fieldError("ciudad")}</p>
              )}
            </div>
          </div>
        </section>

        {/* Error global */}
        {state && !state.ok && !state.field && (
          <div
            className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            role="alert"
            style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)", border: "1px solid var(--hw-danger-bd)" }}
          >
            {state.error}
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit" disabled={pending}
            className="hw-btn-primary"
            style={{ height: "46px", fontSize: "15px", borderRadius: "12px", padding: "0 28px" }}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Guardando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Guardar perfil
              </>
            )}
          </button>
          {state?.ok && (
            <span className="text-sm" style={{ color: "var(--hw-success)" }}>
              ✓ Cambios guardados
            </span>
          )}
        </div>
      </form>

        </>
      )}

      {section === "seguridad" && (
        <>
          <CambiarPasswordSection nombre={perfil.nombre} email={perfil.email} />
          <TwoFASection />
        </>
      )}
    </div>
  );
}
