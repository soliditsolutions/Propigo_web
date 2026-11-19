"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Camera, Check, IdCard, ImageUp, Lock, Mail, ShieldCheck, Upload, User } from "lucide-react";
import { registroAction } from "./actions";
import { accionDeFormulario } from "@/lib/fallo-accion";
import { evaluatePassword } from "@/lib/password-strength";
import { formatRut, validateRut } from "@/lib/rut";
import { diagnosticarCamara } from "@/lib/camara";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { Spinner } from "@/components/ui/spinner";
import { Aviso, Boton, Campo, CampoClave, PanelAnimado } from "@/components/acceso/campos";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";

// Un fallo de red o del servidor vuelve como { error } y no rompe la página.
const accionSegura = accionDeFormulario(registroAction);

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Detectado una sola vez: en jsdom (tests) y en navegadores sin getUserMedia
// (http no seguro, política que bloquea la cámara) queda solo la subida de archivo.
const CAMERA_SUPPORTED = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Paso en el que vive cada campo: un error del servidor lleva a ese paso. */
export const PASO_DEL_CAMPO: Record<string, number> = {
  nombre: 0, rut: 0, email: 0, password: 0,
  empresa: 1, rutEmpresa: 1,
  carnet: 2, consentIa: 2, consent: 2,
};

/** Id del control de cada campo, para llevar el foco al primer error. */
const ID_DEL_CAMPO: Record<string, string> = {
  nombre: "nombre", rut: "rut", email: "reg-email", password: "reg-password",
  empresa: "empresa", rutEmpresa: "rutEmpresa",
  carnet: "reg-carnet", consentIa: "consent-ia", consent: "consent",
};

export type Foto = { file: File; url: string };

type Datos = {
  nombre: string; rut: string; email: string; password: string;
  empresa: string; esPersonaJuridica: boolean; rutEmpresa: string;
  foto: Foto | null; consentIa: boolean; consent: boolean;
};

/** Errores de los campos de un paso. Misma regla que el servidor, para no llegar a él con datos que va a rechazar. */
export function erroresDelPaso(paso: number, d: Datos): Record<string, string> {
  const e: Record<string, string> = {};
  if (paso === 0) {
    if (d.nombre.trim().length < 2) e.nombre = T.registro.errorNombre;
    if (!validateRut(d.rut)) e.rut = T.registro.errorRut;
    if (!CORREO_RE.test(d.email.trim())) e.email = T.registro.errorCorreo;
    const fuerza = evaluatePassword(d.password, { nombre: d.nombre.trim(), email: d.email.trim(), rut: d.rut });
    if (!fuerza.passes) e.password = fuerza.suggestion || T.registro.errorClave;
  } else if (paso === 1) {
    if (d.empresa.trim().length < 2) e.empresa = T.registro.errorCorredora;
    if (d.esPersonaJuridica && !validateRut(d.rutEmpresa)) e.rutEmpresa = T.registro.errorRutCorredora;
  } else {
    if (!d.foto) e.carnet = T.registro.faltaFoto;
    if (!d.consentIa) e.consentIa = T.registro.faltaConsentIa;
    if (!d.consent) e.consent = T.registro.faltaTerminos;
  }
  return e;
}

/* ── Progreso (solo en pantallas sin panel de marca) ── */

function ProgresoPasos({ paso }: { paso: number }) {
  return (
    <div className="pgo-acc-progreso pgo-acc-progreso--movil">
      <div className="pgo-acc-progreso-texto">
        <span>Paso <strong>{paso + 1}</strong> de 3</span>
        <span>{T.registro.pasos[paso].titulo}</span>
      </div>
      <div className="pgo-acc-tramos" role="presentation">
        {[0, 1, 2].map((i) => <i key={i} className="pgo-acc-tramo" data-hecho={i <= paso} />)}
      </div>
    </div>
  );
}

/* ── Foto de la cédula: subida o cámara ── */

function CapturaCedula({
  foto, onFoto, error, deshabilitado,
}: {
  foto: Foto | null;
  onFoto: (f: File | null) => void;
  error: string | null;
  deshabilitado: boolean;
}) {
  const [modo, setModo] = useState<"archivo" | "camara">("archivo");
  const [arrastrando, setArrastrando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [camaraLista, setCamaraLista] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [reintentable, setReintentable] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);

  function procesar(file: File) {
    setErrorArchivo(null);
    if (!TIPOS_PERMITIDOS.includes(file.type)) { setErrorArchivo(T.registro.errorTipo); return; }
    if (file.size > MAX_BYTES) { setErrorArchivo(T.registro.errorTamano); return; }
    onFoto(file);
  }

  // La cámara se enciende solo cuando la persona la pide, y se apaga (luz del
  // navegador incluida) al tomar la foto, cambiar de modo o salir del paso.
  useEffect(() => {
    if (modo !== "camara" || foto) return;
    let cancelado = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        flujo.current = stream;
        if (video.current) {
          video.current.srcObject = stream;
          void video.current.play();
        }
        setCamaraLista(true);
        setErrorCamara(null);
      })
      .catch((e: unknown) => {
        // Permiso denegado, sin cámara, cámara ocupada o contexto no seguro: el
        // mensaje dice cuál. Nunca bloquea el registro: queda la subida de archivo.
        console.warn("[camara]", e instanceof Error ? e.name : "error desconocido");
        const d = diagnosticarCamara(e);
        setErrorCamara(d.mensaje);
        setReintentable(d.reintentable);
        setModo("archivo");
      });
    return () => {
      cancelado = true;
      flujo.current?.getTracks().forEach((t) => t.stop());
      flujo.current = null;
      setCamaraLista(false);
    };
  }, [modo, foto]);

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) procesar(new File([blob], `cedula-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  const errorVisible = errorArchivo ?? error;

  return (
    <div className="pgo-acc-cedula">
      {foto ? (
        <figure className="pgo-acc-foto">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por el optimizador */}
          <img src={foto.url} alt={T.registro.fotoAlt} />
          <figcaption>
            <span className="pgo-acc-foto-lista"><Check aria-hidden="true" />{T.registro.fotoLista}</span>
            <button type="button" className="pgo-acc-enlace" onClick={() => onFoto(null)} disabled={deshabilitado}>
              {T.registro.cambiarFoto}
            </button>
          </figcaption>
        </figure>
      ) : modo === "camara" ? (
        <div className="pgo-acc-cedula-camara">
          <div className="pgo-acc-visor">
            <video ref={video} autoPlay playsInline muted aria-label="Vista de la cámara" />
            {/* Marco guía con la proporción de la cédula chilena (85,6 × 54 mm) */}
            <div className="pgo-acc-visor-marco" aria-hidden="true"><span /></div>
            {!camaraLista ? <div className="pgo-acc-visor-carga"><Spinner className="h-6 w-6 text-white" /></div> : null}
          </div>
          <p className="pgo-acc-ayuda" style={{ margin: 0, textAlign: "center" }}>{T.registro.encuadre}</p>
          <div className="pgo-acc-fila" style={{ flexWrap: "nowrap" }}>
            <Boton variante="secundario" chico onClick={() => setModo("archivo")}>
              <ImageUp className="h-4 w-4" aria-hidden="true" />Subir una foto
            </Boton>
            <div style={{ flex: 1 }}>
              <Boton bloque chico onClick={capturar} disabled={!camaraLista}>
                <Camera className="h-4 w-4" aria-hidden="true" />{T.registro.capturar}
              </Boton>
            </div>
          </div>
        </div>
      ) : (
        <>
          {errorCamara ? <Aviso variante="pausa" alerta>{errorCamara}</Aviso> : null}
          <label
            className="pgo-acc-subida"
            data-arrastrando={arrastrando || undefined}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              const f = e.dataTransfer.files[0];
              if (f) procesar(f);
            }}
          >
            <Upload aria-hidden="true" />
            <strong>{T.registro.subirTitulo}</strong>
            <span>{T.registro.subirAyuda}</span>
            <input
              id="reg-carnet"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={T.registro.subirEtiqueta}
              aria-invalid={errorVisible ? true : undefined}
              aria-describedby={errorVisible ? "reg-carnet-error" : undefined}
              disabled={deshabilitado}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) procesar(f);
                e.target.value = "";
              }}
            />
          </label>
          {CAMERA_SUPPORTED && (!errorCamara || reintentable) ? (
            <Boton variante="secundario" bloque chico onClick={() => { setErrorCamara(null); setModo("camara"); }} disabled={deshabilitado}>
              <Camera className="h-4 w-4" aria-hidden="true" />
              {errorCamara ? T.registro.camaraReintentar : T.registro.camara}
            </Boton>
          ) : null}
        </>
      )}
      {errorVisible ? (
        <p id="reg-carnet-error" role="alert" className="pgo-acc-error-texto">{errorVisible}</p>
      ) : null}
    </div>
  );
}

/* ── Formulario ── */

export function RegistroForm() {
  const [state, formAction, pending] = useActionState(accionSegura, null);
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState<"adelante" | "atras">("adelante");

  // Controlados: los pasos se montan y desmontan, y un error del servidor no
  // debe obligar a escribir todo de nuevo. El envío arma el FormData desde aquí.
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");
  // Por defecto empresa, el caso mayoritario; el independiente no repite su RUT.
  const [esPersonaJuridica, setEsPersonaJuridica] = useState(true);
  const [rutEmpresa, setRutEmpresa] = useState("");
  const [foto, setFoto] = useState<Foto | null>(null);
  const [consentIa, setConsentIa] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // Un error del servidor lleva al paso del campo que lo causó.
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    const destino = state?.field ? PASO_DEL_CAMPO[state.field] : undefined;
    if (destino !== undefined && destino !== paso) {
      setDireccion(destino > paso ? "adelante" : "atras");
      setPaso(destino);
    }
  }

  // La vista previa usa una URL local: se libera al cambiarla o al salir.
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const datos: Datos = { nombre, rut, email, password, empresa, esPersonaJuridica, rutEmpresa, foto, consentIa, consent };
  const errorServidor = (campo: string) => (state?.field === campo ? state.error : null);
  // Un RUT que ya parece completo (8 o más caracteres) se revisa mientras se escribe.
  const rutCompletoInvalido = (v: string) => v.replace(/[^0-9kK]/g, "").length >= 8 && !validateRut(v);
  const enVivo: Record<string, string | null> = {
    rut: rutCompletoInvalido(rut) ? T.registro.errorRut : null,
    rutEmpresa: rutCompletoInvalido(rutEmpresa) ? T.registro.errorRutCorredora : null,
  };
  const errorDe = (campo: string) => errores[campo] || enVivo[campo] || errorServidor(campo) || null;
  const limpiar = (campo: string) => { if (errores[campo]) setErrores((p) => ({ ...p, [campo]: "" })); };

  function irAPaso(n: number) {
    setDireccion(n >= paso ? "adelante" : "atras");
    setPaso(n);
  }

  function enfocar(campo: string) {
    document.getElementById(ID_DEL_CAMPO[campo])?.focus();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const propios = erroresDelPaso(paso, datos);
    if (Object.keys(propios).length > 0) {
      setErrores(propios);
      enfocar(Object.keys(propios)[0]);
      return;
    }
    setErrores({});
    if (paso < 2) { irAPaso(paso + 1); return; }

    // Último paso: los anteriores pudieron cambiar al volver atrás.
    for (const n of [0, 1]) {
      const previos = erroresDelPaso(n, datos);
      if (Object.keys(previos).length > 0) { setErrores(previos); irAPaso(n); return; }
    }

    if (!foto) return; // ya validado en el paso 3; el guardia es para el tipo
    const fd = new FormData();
    fd.set("nombre", nombre.trim());
    fd.set("rut", rut);
    fd.set("email", email.trim());
    fd.set("password", password);
    fd.set("empresa", empresa.trim());
    fd.set("esPersonaJuridica", esPersonaJuridica ? "juridica" : "natural");
    if (esPersonaJuridica) fd.set("rutEmpresa", rutEmpresa);
    fd.set("consent", "1");
    fd.set("consentIa", "on");
    fd.set("carnet", foto.file);
    startTransition(() => formAction(fd));
  }

  function cambiarFoto(f: File | null) {
    setFoto(f ? { file: f, url: URL.createObjectURL(f) } : null);
    limpiar("carnet");
  }

  const rutConFormato = (v: string) => {
    const limpio = v.replace(/[^0-9kK]/g, "");
    return limpio.length > 1 ? formatRut(limpio) : limpio;
  };

  const encabezados = [
    { t: T.registro.paso1Titulo, s: T.registro.paso1Sub },
    { t: T.registro.paso2Titulo, s: T.registro.paso2Sub },
    { t: T.registro.paso3Titulo, s: T.registro.paso3Sub },
  ];

  const pasos = [
    <>
      <Campo
        id="nombre" etiqueta={T.registro.nombre} icono={User}
        name="nombre" autoComplete="name" required placeholder={T.registro.nombrePlaceholder}
        ayuda={T.registro.nombreAyuda}
        value={nombre} onChange={(e) => { setNombre(e.target.value); limpiar("nombre"); }}
        error={errorDe("nombre")}
      />
      <Campo
        id="rut" etiqueta={T.registro.rut} icono={IdCard} numeros
        name="rut" autoComplete="off" inputMode="text" maxLength={12} required placeholder={T.registro.rutPlaceholder}
        value={rut} onChange={(e) => { setRut(rutConFormato(e.target.value)); limpiar("rut"); }}
        valido={validateRut(rut)} error={errorDe("rut")}
      />
      <Campo
        id="reg-email" etiqueta={T.registro.correo} icono={Mail}
        type="email" name="email" autoComplete="email" inputMode="email" required placeholder={T.login.correoPlaceholder}
        value={email} onChange={(e) => { setEmail(e.target.value); limpiar("email"); }}
        valido={CORREO_RE.test(email.trim())} error={errorDe("email")}
      />
      <div className="pgo-acc-campo">
        <CampoClave
          id="reg-password" etiqueta={T.registro.clave} icono={Lock}
          name="password" autoComplete="new-password" required placeholder={T.registro.clavePlaceholder}
          ayuda={T.registro.claveAyuda}
          value={password} onChange={(e) => { setPassword(e.target.value); limpiar("password"); }}
          error={errorDe("password")}
        />
        <div aria-live="polite" aria-atomic="true">
          <PasswordStrengthMeter password={password} nombre={nombre} email={email} rut={rut} />
        </div>
      </div>
    </>,
    <>
      <Campo
        id="empresa" etiqueta={T.registro.corredora} icono={Building2}
        name="empresa" autoComplete="organization" required placeholder={T.registro.corredoraPlaceholder}
        value={empresa} onChange={(e) => { setEmpresa(e.target.value); limpiar("empresa"); }}
        error={errorDe("empresa")}
      />
      {/* Decide si la comisión que emite la corredora lleva IVA: no es un dato administrativo. */}
      <fieldset className="pgo-acc-grupo">
        <legend className="pgo-acc-etiqueta">{T.registro.comoOpera}</legend>
        <div className="pgo-acc-opciones">
          {[
            { juridica: true, titulo: T.registro.empresa, detalle: T.registro.empresaDetalle },
            { juridica: false, titulo: T.registro.natural, detalle: T.registro.naturalDetalle },
          ].map((o) => (
            <label key={String(o.juridica)} className="pgo-acc-opcion">
              <input
                type="radio" name="esPersonaJuridica" value={o.juridica ? "juridica" : "natural"}
                checked={esPersonaJuridica === o.juridica}
                onChange={() => { setEsPersonaJuridica(o.juridica); limpiar("rutEmpresa"); }}
              />
              <div><strong>{o.titulo}</strong><span>{o.detalle}</span></div>
            </label>
          ))}
        </div>
      </fieldset>
      {esPersonaJuridica ? (
        <Campo
          id="rutEmpresa" etiqueta={T.registro.rutCorredora} icono={IdCard} numeros
          name="rutEmpresa" autoComplete="off" inputMode="text" maxLength={12} required placeholder="76.123.456-0"
          ayuda={T.registro.rutCorredoraAyuda}
          value={rutEmpresa} onChange={(e) => { setRutEmpresa(rutConFormato(e.target.value)); limpiar("rutEmpresa"); }}
          valido={validateRut(rutEmpresa)} error={errorDe("rutEmpresa")}
        />
      ) : null}
    </>,
    <>
      <ul className="pgo-acc-razones">
        {T.registro.razones.map((r, i) => (
          <li key={r}>
            {i === 0 ? <ShieldCheck aria-hidden="true" /> : i === 1 ? <Lock aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <CapturaCedula foto={foto} onFoto={cambiarFoto} error={errorDe("carnet")} deshabilitado={pending} />
      <div className="pgo-acc-campo">
        <label className="pgo-acc-check">
          <input
            id="consent-ia" type="checkbox" checked={consentIa} disabled={pending}
            aria-invalid={errorDe("consentIa") ? true : undefined}
            aria-describedby={errorDe("consentIa") ? "consent-ia-error" : undefined}
            onChange={(e) => { setConsentIa(e.target.checked); limpiar("consentIa"); }}
          />
          <span>{T.registro.consentIa}</span>
        </label>
        {errorDe("consentIa") ? <p id="consent-ia-error" role="alert" className="pgo-acc-error-texto">{errorDe("consentIa")}</p> : null}
      </div>
      {/* Ley 21.719: consentimiento explícito, nunca premarcado */}
      <div className="pgo-acc-campo">
        <label className="pgo-acc-check">
          <input
            id="consent" name="consent" type="checkbox" checked={consent} disabled={pending}
            aria-invalid={errorDe("consent") ? true : undefined}
            aria-describedby={errorDe("consent") ? "consent-error" : undefined}
            onChange={(e) => { setConsent(e.target.checked); limpiar("consent"); }}
          />
          <span>
            {T.registro.consentTerminos}{" "}
            <Link href="/terminos-uso" target="_blank" rel="noopener noreferrer">{T.registro.terminos}</Link>{" "}
            {T.registro.y}{" "}
            <Link href="/privacidad" target="_blank" rel="noopener noreferrer">{T.registro.privacidad}</Link>{" "}
            {T.registro.leyFin}
          </span>
        </label>
        {errorDe("consent") ? <p id="consent-error" role="alert" className="pgo-acc-error-texto">{errorDe("consent")}</p> : null}
      </div>
      {state?.error && !state.field ? <Aviso variante="error">{state.error}</Aviso> : null}
    </>,
  ];

  return (
    <MarcoGuiado flujo="registro" paso={paso}>
      <form onSubmit={enviar} noValidate className="pgo-acc-cuerpo" aria-label="Crear tu cuenta">
        <ProgresoPasos paso={paso} />
        <PanelAnimado clave={`paso-${paso}`} direccion={direccion}>
          <div className="pgo-acc-cuerpo">
            <hgroup className="pgo-acc-cabecera">
              <h1 className="pgo-acc-titulo">{encabezados[paso].t}</h1>
              <p className="pgo-acc-sub">{encabezados[paso].s}</p>
            </hgroup>
            {pasos[paso]}
          </div>
        </PanelAnimado>
        <div className="pgo-acc-fila" style={{ flexWrap: "nowrap" }}>
          {paso > 0 ? (
            <Boton variante="secundario" onClick={() => { setErrores({}); irAPaso(paso - 1); }} disabled={pending}>
              {T.registro.atras}
            </Boton>
          ) : null}
          <div style={{ flex: 1 }}>
            <Boton type="submit" bloque cargando={pending}>
              {paso < 2 ? T.registro.siguiente : pending ? T.registro.ctaCargando : T.registro.cta}
            </Boton>
          </div>
        </div>
        <div className="pgo-acc-plan">
          <span><strong>{T.planGratuito.nombre}</strong> · {T.planGratuito.detalle}</span>
          <span>{T.registro.yaTienes} <Link href="/login" className="pgo-acc-enlace">{T.registro.entrar}</Link></span>
        </div>
      </form>
    </MarcoGuiado>
  );
}
