"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useActionState }  from "react";
import Link                from "next/link";
import {
  Eye, EyeOff, AlertCircle, Shield, Upload, X, CheckCircle2, Camera, ImageUp,
} from "lucide-react";
import { registroAction }         from "./actions";
import { evaluatePassword }       from "@/lib/password-strength";
import { validateRut, formatRut } from "@/lib/rut";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

/* ── Estilos de input reutilizables ─────────────────────────────────────── */
const inputBase: React.CSSProperties = {
  height:       "44px",
  width:        "100%",
  borderRadius: "12px",
  background:   "var(--pgo-glass-input)",
  color:        "var(--pgo-text-1)",
  fontSize:     "14px",
  padding:      "0 14px",
  outline:      "none",
  boxShadow:    "var(--pgo-input-shadow)",
  transition:   "border-color 150ms ease, box-shadow 150ms ease",
};

function inputStyle(hasError: boolean, disabled?: boolean): React.CSSProperties {
  return {
    ...inputBase,
    border:  `1px solid ${hasError ? "var(--pgo-danger)" : "var(--pgo-border-2)"}`,
    opacity: disabled ? 0.6 : 1,
  };
}

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--pgo-primary)";
  e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow-focus)";
}

function makeOnBlur(hasError: boolean) {
  return (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = hasError ? "var(--pgo-danger)" : "var(--pgo-border-2)";
    e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow)";
  };
}

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES        = 5 * 1024 * 1024;

/* ── Contenido del diálogo de verificación de carnet ─────────────────────── */
// FIX UI-C7: refactor a Dialog de @base-ui/react.
// El Popup gestiona automáticamente role="dialog", aria-modal="true",
// aria-labelledby (apunta a DialogTitle) y el focus trap.
// Soporte de cámara detectado una sola vez en el módulo: en jsdom (tests) y en
// navegadores sin getUserMedia (http no seguro, permiso bloqueado por política,
// etc.) da false y el modo por archivo queda como único camino — sin ramas
// nuevas que mantener en los tests existentes.
const CAMERA_SUPPORTED =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function CarnetModalBody({
  onConfirmar,
}: {
  onConfirmar: (file: File, consentIa: boolean) => void;
}) {
  const [carnetFile,    setCarnetFile]    = useState<File | null>(null);
  const [carnetPreview, setCarnetPreview] = useState<string | null>(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [fileError,     setFileError]     = useState<string | null>(null);
  const [consentIa,     setConsentIa]     = useState(false);
  const [modo,          setModo]          = useState<"camara" | "archivo">(
    CAMERA_SUPPORTED ? "camara" : "archivo",
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function procesarArchivo(file: File) {
    setFileError(null);
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      setFileError("Solo se aceptan imágenes JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("La imagen no puede superar los 5 MB.");
      return;
    }
    setCarnetFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCarnetPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  function limpiar() {
    setCarnetFile(null);
    setCarnetPreview(null);
    setFileError(null);
  }

  // Enciende la cámara mientras el modo sea "camara" y no haya foto capturada
  // todavía; libera el stream (apaga el indicador de cámara del navegador) en
  // cualquier otro caso — cambio de modo, foto ya tomada, o cierre del modal.
  useEffect(() => {
    if (modo !== "camara" || carnetFile) return;
    let cancelado = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        setCameraReady(true);
        setCameraError(null);
      })
      .catch(() => {
        // Permiso denegado, sin cámara disponible, o contexto no seguro (http).
        // Nunca bloqueamos el registro por esto — el upload manual sigue disponible.
        setCameraError("No pudimos acceder a la cámara. Puedes subir una foto en su lugar.");
        setModo("archivo");
      });

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [modo, carnetFile]);

  function capturarFoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      procesarArchivo(new File([blob], `carnet-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <>
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4 p-6 pb-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--pgo-primary-lt)" }}
          >
            <Shield className="h-6 w-6" style={{ color: "var(--pgo-primary)" }} aria-hidden="true" />
          </div>
          <div>
            <DialogTitle
              className="text-base font-semibold leading-none"
              style={{ color: "var(--pgo-text-1)" }}
            >
              Verificación de identidad
            </DialogTitle>
            <DialogDescription
              className="mt-1 text-xs"
              style={{ color: "var(--pgo-text-3)" }}
            >
              Requerida para crear tu cuenta
            </DialogDescription>
          </div>
        </div>
        <DialogClose
          aria-label="Cerrar modal de verificación"
          className="pgo-btn pgo-tap-target relative rounded-lg p-1.5 transition-colors"
          style={{ color: "var(--pgo-text-4)" }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogClose>
      </div>

      <div className="space-y-4 p-6">
        {/* Explicación */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--pgo-text-2)" }}>
          Para prevenir usurpación de identidad, verificamos que el{" "}
          <strong>RUT y nombre ingresados</strong> correspondan a tu documento.
          Sube una foto clara del{" "}
          <strong>frontis de tu Cédula de Identidad chilena</strong>.
        </p>

        {/* Zona de carga, cámara o previsualización */}
        {!carnetPreview && modo === "camara" ? (
          <div className="space-y-2">
            <div
              className="relative overflow-hidden rounded-xl"
              style={{ height: "220px", background: "#0a0a0a" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Marco guía — proporción de una cédula chilena (~85.6 × 54 mm) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
                <div
                  className="w-full rounded-lg"
                  style={{
                    aspectRatio: "1.586",
                    maxHeight:   "132px",
                    border:      "3px solid rgba(255,255,255,0.9)",
                    boxShadow:   "0 0 0 9999px rgba(0,0,0,0.5)",
                  }}
                />
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            <p className="text-center text-xs" style={{ color: "var(--pgo-text-4)" }}>
              Encuadra tu cédula dentro del marco y toma la foto
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={capturarFoto}
                disabled={!cameraReady}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "var(--pgo-primary)" }}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Capturar foto
              </button>
              <button
                type="button"
                onClick={() => setModo("archivo")}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium"
                style={{ color: "var(--pgo-text-3)" }}
              >
                <ImageUp className="h-3.5 w-3.5" aria-hidden="true" />
                Subir archivo
              </button>
            </div>
          </div>
        ) : !carnetPreview ? (
          <div className="space-y-2">
            {cameraError && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
                role="alert"
                style={{
                  background: "var(--pgo-warning-lt)",
                  color:      "var(--pgo-warning-dk)",
                  border:     "1px solid var(--pgo-warning-bd)",
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {cameraError}
              </div>
            )}
            <label
              className="flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer"
              style={{
                height:     "156px",
                border:     `2px dashed ${dragOver ? "var(--pgo-primary)" : "var(--pgo-border-2)"}`,
                background: dragOver ? "var(--pgo-primary-lt)" : "var(--pgo-page)",
              }}
              onDragOver={(e)  => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={()  => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) procesarArchivo(f);
              }}
            >
              <Upload
                className="mb-2 h-8 w-8"
                style={{ color: dragOver ? "var(--pgo-primary)" : "var(--pgo-text-4)" }}
                aria-hidden="true"
              />
              <span
                className="text-sm font-medium"
                style={{ color: dragOver ? "var(--pgo-primary)" : "var(--pgo-text-1)" }}
              >
                Arrastra tu carnet o haz clic aquí
              </span>
              <span className="mt-1 text-xs" style={{ color: "var(--pgo-text-4)" }}>
                JPG, PNG o WEBP · Máx. 5 MB
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Subir imagen del carnet de identidad"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) procesarArchivo(f);
                  e.target.value = "";
                }}
              />
            </label>
            {CAMERA_SUPPORTED && !cameraError && (
              <button
                type="button"
                onClick={() => setModo("camara")}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "var(--pgo-primary)" }}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Usar la cámara en su lugar
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="relative overflow-hidden rounded-xl"
              style={{ height: "156px", background: "var(--pgo-page)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carnetPreview}
                alt="Vista previa del carnet"
                className="h-full w-full object-contain"
              />
              <div
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
                style={{ background: "var(--pgo-success-lt)", color: "var(--pgo-success-dk)" }}
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Imagen cargada
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="truncate text-xs" style={{ color: "var(--pgo-text-3)" }}>
                {carnetFile?.name}
              </span>
              <button
                type="button"
                onClick={limpiar}
                className="ml-2 shrink-0 text-xs font-medium"
                style={{ color: "var(--pgo-danger)" }}
              >
                Cambiar imagen
              </button>
            </div>
          </div>
        )}

        {/* Error de archivo */}
        {fileError && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
            role="alert"
            style={{
              background: "var(--pgo-danger-lt)",
              color:      "var(--pgo-danger)",
              border:     "1px solid var(--pgo-danger-bd)",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {fileError}
          </div>
        )}

        {/* Nota de privacidad */}
        <p className="text-xs leading-relaxed" style={{ color: "var(--pgo-text-4)" }}>
          🔒 La imagen se analiza con IA exclusivamente para verificar que el RUT y
          nombre coincidan. No se almacena ni se comparte con terceros.
        </p>

        {/* Consentimiento IA — específico para el envío de esta imagen a Groq
            (proveedor externo), distinto del consentimiento general de T&C del
            formulario. Registro auditable en ConsentimientoIa al crear la cuenta. */}
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={consentIa}
            onChange={(e) => setConsentIa(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded"
            style={{ accentColor: "var(--pgo-primary)" }}
          />
          <span className="text-xs leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
            Acepto que la imagen de mi cédula sea enviada a nuestro proveedor de
            verificación de identidad por IA (Groq) exclusivamente para este análisis.
          </span>
        </label>

        {/* Botones */}
        <div className="flex gap-3">
          <DialogClose
            className="flex-1 rounded-xl px-4 py-3 text-sm font-medium pgo-btn transition-colors"
            style={{
              background: "var(--pgo-page)",
              color:      "var(--pgo-text-2)",
              border:     "1px solid var(--pgo-border-2)",
            }}
          >
            Cancelar
          </DialogClose>
          <button
            type="button"
            onClick={() => carnetFile && consentIa && onConfirmar(carnetFile, consentIa)}
            disabled={!carnetFile || !consentIa}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--pgo-primary)" }}
          >
            Verificar y crear cuenta
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Componente principal ─────────────────────────────────────────────────── */
export function RegistroForm() {
  const [state, formAction, pending] = useActionState(registroAction, null);
  const [showPwd, setShowPwd]            = useState(false);
  const [password, setPassword]          = useState("");
  const [nombre, setNombre]              = useState("");
  const [email, setEmail]                = useState("");
  const [rut, setRut]                    = useState("");
  // Cómo opera la corredora. Por defecto empresa, que es el caso mayoritario;
  // el independiente cambia la opción y deja de tener que tipear su RUT dos veces.
  const [esPersonaJuridica, setEsPersonaJuridica] = useState(true);
  const [rutEmpresa, setRutEmpresa]      = useState("");
  const [modalOpen, setModalOpen]        = useState(false);
  const [clientErrors, setClientErrors]  = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const rutClientError = rut.length > 3 && !validateRut(rut) ? "RUT inválido" : null;

  const nombreErr  = clientErrors.nombre || (state?.field === "nombre" ? state.error : null) || null;
  const rutErr     = rutClientError || clientErrors.rut || (state?.field === "rut" ? state.error : null) || null;
  const emailErr   = clientErrors.email  || (state?.field === "email"  ? state.error : null) || null;
  const empresaErr = clientErrors.empresa || null;
  const rutEmpresaClientError =
    esPersonaJuridica && rutEmpresa.length > 3 && !validateRut(rutEmpresa)
      ? "RUT inválido" : null;
  const rutEmpresaErr =
    rutEmpresaClientError || clientErrors.rutEmpresa ||
    (state?.field === "rutEmpresa" ? state.error : null) || null;
  const passwordErr = clientErrors.password || null;
  const consentErr  = clientErrors.consent  || null;

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9kK]/g, "");
    setRut(raw.length > 1 ? formatRut(raw) : raw);
    if (clientErrors.rut) setClientErrors((p) => ({ ...p, rut: "" }));
  }

  function handleRutEmpresaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9kK]/g, "");
    setRutEmpresa(raw.length > 1 ? formatRut(raw) : raw);
    if (clientErrors.rutEmpresa) setClientErrors((p) => ({ ...p, rutEmpresa: "" }));
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;

    const fd       = new FormData(formRef.current);
    const nombreV  = nombre.trim();
    const emailV   = email.trim();
    const empresa  = (fd.get("empresa")?.toString() ?? "").trim();
    const consent  = fd.get("consent")?.toString();

    const errs: Record<string, string> = {};
    if (!nombreV || nombreV.length < 2)
      errs.nombre = "Ingresa tu nombre completo (mínimo 2 caracteres).";
    if (!rut || !validateRut(rut))
      errs.rut = "El RUT no es válido. Verifica el dígito verificador.";
    if (!emailV || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailV))
      errs.email = "Ingresa un correo electrónico válido.";
    if (!empresa || empresa.length < 2)
      errs.empresa = "Ingresa el nombre de tu corredora (mínimo 2 caracteres).";
    // Solo se valida si opera como empresa: el independiente usa su propio RUT,
    // que ya se validó más arriba.
    if (esPersonaJuridica && (!rutEmpresa || !validateRut(rutEmpresa)))
      errs.rutEmpresa = "Ingresa el RUT de tu corredora con un dígito verificador válido.";
    const strength = evaluatePassword(password, { nombre: nombreV, email: emailV });
    if (!password || !strength.passes)
      errs.password = strength.suggestion || "Ingresa una contraseña.";
    if (!consent)
      errs.consent = "Debes aceptar los Términos de uso y la Política de privacidad.";

    if (Object.keys(errs).length > 0) {
      setClientErrors(errs);
      const firstField = ["nombre", "rut", "email", "empresa", "rutEmpresa", "password", "consent"].find(
        (f) => errs[f],
      );
      if (firstField) {
        document.getElementById(firstField === "password" ? "reg-password" : firstField)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setClientErrors({});
    setModalOpen(true);
  }

  function handleConfirmar(carnetFile: File, consentIa: boolean) {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.append("carnet", carnetFile);
    if (consentIa) fd.append("consentIa", "on");
    setModalOpen(false);
    startTransition(() => formAction(fd));
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-4" noValidate>

        {/* Nombre completo */}
        <div className="space-y-1.5">
          <label htmlFor="nombre" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            Nombre completo
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            required
            placeholder="Juan García López"
            disabled={pending}
            value={nombre}
            aria-invalid={nombreErr ? true : undefined}
            aria-describedby={nombreErr ? "nombre-error" : "nombre-hint"}
            style={inputStyle(!!nombreErr, pending)}
            onFocus={onFocus}
            onBlur={makeOnBlur(!!nombreErr)}
            onChange={(e) => {
              setNombre(e.target.value);
              if (clientErrors.nombre) setClientErrors((p) => ({ ...p, nombre: "" }));
            }}
          />
          <p id="nombre-hint" className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
            Ingresa tu nombre tal como aparece en tu Cédula de Identidad.
          </p>
          {nombreErr && (
            <p id="nombre-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {nombreErr}
            </p>
          )}
        </div>

        {/* RUT */}
        <div className="space-y-1.5">
          <label htmlFor="rut" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            RUT
          </label>
          <input
            id="rut"
            name="rut"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="12.345.678-9"
            maxLength={12}
            value={rut}
            onChange={handleRutChange}
            disabled={pending}
            aria-invalid={rutErr ? true : undefined}
            aria-describedby={rutErr ? "rut-error" : undefined}
            style={inputStyle(!!rutErr, pending)}
            onFocus={onFocus}
            onBlur={makeOnBlur(!!rutErr)}
          />
          {rutErr && (
            <p id="rut-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {rutErr}
            </p>
          )}
        </div>

        {/* Correo electrónico */}
        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            Correo electrónico
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="correo@empresa.cl"
            disabled={pending}
            value={email}
            aria-invalid={emailErr ? true : undefined}
            aria-describedby={emailErr ? "email-error" : undefined}
            style={inputStyle(!!emailErr, pending)}
            onFocus={onFocus}
            onBlur={makeOnBlur(!!emailErr)}
            onChange={(e) => {
              setEmail(e.target.value);
              if (clientErrors.email) setClientErrors((p) => ({ ...p, email: "" }));
            }}
          />
          {emailErr && (
            <p id="email-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {emailErr}
            </p>
          )}
        </div>

        {/* Nombre de la corredora */}
        <div className="space-y-1.5">
          <label htmlFor="empresa" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            Nombre de la corredora
          </label>
          <input
            id="empresa"
            name="empresa"
            type="text"
            autoComplete="organization"
            required
            placeholder="Corredora del Sur SpA"
            disabled={pending}
            aria-invalid={empresaErr ? true : undefined}
            aria-describedby={empresaErr ? "empresa-error" : undefined}
            style={inputStyle(!!empresaErr, pending)}
            onFocus={onFocus}
            onBlur={makeOnBlur(!!empresaErr)}
            onChange={() => { if (clientErrors.empresa) setClientErrors((p) => ({ ...p, empresa: "" })); }}
          />
          {empresaErr && (
            <p id="empresa-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {empresaErr}
            </p>
          )}
        </div>

        {/* Cómo opera la corredora. No es un dato administrativo: decide si la
            comisión que la corredora emite lleva IVA. */}
        <fieldset className="space-y-2">
          <legend className="mb-1 block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            ¿Cómo opera tu corredora?
          </legend>
          {[
            { juridica: true,  etiqueta: "Como empresa",
              detalle: "SpA, Ltda., EIRL u otra sociedad con RUT propio." },
            { juridica: false, etiqueta: "Como persona natural",
              detalle: "Corredor independiente: la corredora eres tú, con tu mismo RUT." },
          ].map((op) => (
            <label
              key={String(op.juridica)}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{
                background: esPersonaJuridica === op.juridica ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
                border: `1px solid ${esPersonaJuridica === op.juridica ? "var(--pgo-primary-bd)" : "var(--pgo-border-2)"}`,
                opacity: pending ? 0.6 : 1,
              }}
            >
              <input
                type="radio"
                name="esPersonaJuridica"
                value={op.juridica ? "juridica" : "natural"}
                checked={esPersonaJuridica === op.juridica}
                disabled={pending}
                onChange={() => {
                  setEsPersonaJuridica(op.juridica);
                  if (clientErrors.rutEmpresa) setClientErrors((p) => ({ ...p, rutEmpresa: "" }));
                }}
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ accentColor: "var(--pgo-primary)" }}
              />
              <span className="min-w-0">
                <span className="block text-sm" style={{ color: "var(--pgo-text-1)" }}>{op.etiqueta}</span>
                <span className="block text-xs" style={{ color: "var(--pgo-text-4)" }}>{op.detalle}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* RUT de la corredora. Solo se pide a la empresa: al independiente ya
            se lo pedimos arriba y volver a pedirlo solo daría ocasión de
            tipearlo distinto. */}
        {esPersonaJuridica && (
          <div className="space-y-1.5">
            <label htmlFor="rutEmpresa" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
              RUT de la corredora
            </label>
            <input
              id="rutEmpresa"
              name="rutEmpresa"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              placeholder="76.123.456-0"
              maxLength={12}
              value={rutEmpresa}
              onChange={handleRutEmpresaChange}
              disabled={pending}
              aria-invalid={rutEmpresaErr ? true : undefined}
              aria-describedby={rutEmpresaErr ? "rutEmpresa-error" : "rutEmpresa-hint"}
              style={inputStyle(!!rutEmpresaErr, pending)}
              onFocus={onFocus}
              onBlur={makeOnBlur(!!rutEmpresaErr)}
            />
            <p id="rutEmpresa-hint" className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
              Va en cada comprobante y liquidación que emitas. No es el tuyo.
            </p>
            {rutEmpresaErr && (
              <p id="rutEmpresa-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
                {rutEmpresaErr}
              </p>
            )}
          </div>
        )}

        {/* Contraseña con medidor de fuerza */}
        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
            Contraseña
          </label>
          <div className="relative">
            <input
              id="reg-password"
              name="password"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="••••••••••••••••"
              disabled={pending}
              value={password}
              aria-invalid={passwordErr ? true : undefined}
              aria-describedby={passwordErr ? "password-error" : "password-hint"}
              onChange={(e) => {
                setPassword(e.target.value);
                if (clientErrors.password) setClientErrors((p) => ({ ...p, password: "" }));
              }}
              style={{ ...inputStyle(!!passwordErr, pending), padding: "0 44px 0 14px" }}
              onFocus={onFocus}
              onBlur={makeOnBlur(!!passwordErr)}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="pgo-tap-target absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: "var(--pgo-text-4)" }}
            >
              {showPwd
                ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                : <Eye    className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <PasswordStrengthMeter password={password} nombre={nombre} email={email} />
          </div>
          <p id="password-hint" className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
            Mínimo 8 caracteres, con letras, números y un carácter especial. Evita tu nombre o correo.
          </p>
          {passwordErr && (
            <p id="password-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {passwordErr}
            </p>
          )}
        </div>

        {/* Consentimiento — Ley 21.719 Art. 4: NO premarcado */}
        <div className="space-y-1">
          <div className="flex items-start gap-3 pt-1">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              value="1"
              required
              disabled={pending}
              aria-invalid={consentErr ? true : undefined}
              aria-describedby={consentErr ? "consent-error" : undefined}
              className="mt-0.5 h-4 w-4 rounded shrink-0"
              style={{ accentColor: "var(--pgo-primary)", cursor: "pointer" }}
              onChange={() => { if (clientErrors.consent) setClientErrors((p) => ({ ...p, consent: "" })); }}
            />
            <label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer" style={{ color: "var(--pgo-text-3)" }}>
              He leído y acepto los{" "}
              <Link href="/terminos-uso" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 font-medium" style={{ color: "var(--pgo-primary)" }}>
                Términos de uso
              </Link>
              {" "}y la{" "}
              <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 font-medium" style={{ color: "var(--pgo-primary)" }}>
                Política de privacidad
              </Link>
              {" "}conforme a la Ley 21.719.
            </label>
          </div>
          {consentErr && (
            <p id="consent-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
              {consentErr}
            </p>
          )}
        </div>

        {/* Error general */}
        {state?.error && !state.field && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            role="alert"
            style={{
              background: "var(--pgo-danger-lt)",
              color:      "var(--pgo-danger)",
              border:     "1px solid var(--pgo-danger-bd)",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {state.error}
          </div>
        )}

        {/* Botón principal */}
        <button
          type="submit"
          disabled={pending}
          className="pgo-btn-primary w-full justify-center"
          style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Spinner />
              Verificando identidad…
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" aria-hidden="true" />
              Crear cuenta gratuita
            </>
          )}
        </button>

        {/* Link a login */}
        <p className="text-center text-sm" style={{ color: "var(--pgo-text-3)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "var(--pgo-primary)" }}>
            Inicia sesión
          </Link>
        </p>
      </form>

      {/* FIX UI-C7: Dialog de verificación de carnet.
          @base-ui/react gestiona automáticamente: role="dialog", aria-modal="true",
          aria-labelledby→DialogTitle, focus trap y cierre con Escape. */}
      <Dialog
        open={modalOpen && !pending}
        onOpenChange={(open) => { if (!open) setModalOpen(false); }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md gap-0 overflow-hidden p-0"
          style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)" }}
        >
          <CarnetModalBody onConfirmar={handleConfirmar} />
        </DialogContent>
      </Dialog>
    </>
  );
}
