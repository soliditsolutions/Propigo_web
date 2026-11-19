"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft, Building2, Camera, Check, IdCard, KeyRound, Lock, Mail, MailCheck, ShieldCheck, Upload, User,
} from "lucide-react";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { evaluatePassword } from "@/lib/password-strength";
import { formatRut, validateRut } from "@/lib/rut";
import { Aviso, Boton, Campo, CampoClave, PanelAnimado, formatoReloj, useCuentaRegresiva } from "./campos";
import { T } from "./textos";

/** Estado de la tarjeta, para el hilo de luz y el borde. */
export type EstadoCard = "reposo" | "cargando" | "ok" | "error";
/** Estados que la vista previa puede forzar para revisarlos sin esperar a que ocurran. */
export type EstadoDemo = "normal" | "error" | "pausa" | "enviado" | "camara" | "creada";

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ═════ Iniciar sesión ═════ */

export function FormLogin({
  demo, onEstado, irRecuperar, irRegistro, sinTitulo,
}: {
  demo: EstadoDemo;
  onEstado: (e: EstadoCard) => void;
  irRecuperar: () => void;
  /** La estructura ya pone el título (cabecera narrativa): no se repite. */
  sinTitulo?: boolean;
  /** Si falta, no se muestra el enlace a crear cuenta (la estructura con pestañas ya lo ofrece). */
  irRegistro?: () => void;
}) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [ok, setOk] = useState(false);
  const [falloGeneral, setFalloGeneral] = useState(demo === "error");
  const enPausa = demo === "pausa";
  const faltan = useCuentaRegresiva(5 * 60, enPausa);

  useEffect(() => { if (demo === "error") onEstado("error"); }, [demo, onEstado]);

  const errorCorreo = intentado && !CORREO_RE.test(correo.trim()) ? T.login.errorCorreo : null;
  const errorClave = intentado && !clave ? "Escribe tu contraseña." : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (!CORREO_RE.test(correo.trim()) || !clave) return;
    setFalloGeneral(false);
    setCargando(true);
    onEstado("cargando");
    await esperar(1100);
    setCargando(false);
    if (demo === "error") {
      setFalloGeneral(true);
      onEstado("error");
      return;
    }
    setOk(true);
    onEstado("ok");
    await esperar(1700);
    setOk(false);
    onEstado("reposo");
  }

  function alEditar() {
    if (falloGeneral) { setFalloGeneral(false); onEstado("reposo"); }
  }

  return (
    <form onSubmit={enviar} noValidate className="pgo-acc-cuerpo">
      {sinTitulo ? null : (
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.login.titulo}</h1>
          <p className="pgo-acc-sub">{T.login.sub}</p>
        </hgroup>
      )}

      {enPausa ? (
        <Aviso variante="pausa" titulo={T.login.pausaTitulo}>
          <p style={{ margin: "4px 0 0" }}>{T.login.pausaTexto}</p>
          <p style={{ margin: "8px 0 0" }}>
            {T.login.pausaFalta} <span className="pgo-acc-contador" aria-live="off">{formatoReloj(faltan)}</span>
          </p>
        </Aviso>
      ) : null}
      {falloGeneral && !enPausa ? <Aviso variante="error">{T.login.errorCredenciales}</Aviso> : null}

      <Campo
        id="acc-correo" etiqueta={T.login.correo} icono={Mail}
        type="email" name="email" autoComplete="email" inputMode="email" placeholder={T.login.correoPlaceholder}
        value={correo} onChange={(e) => { setCorreo(e.target.value); alEditar(); }}
        disabled={cargando || enPausa} error={errorCorreo} valido={CORREO_RE.test(correo.trim())}
      />
      <CampoClave
        id="acc-clave" etiqueta={T.login.clave} icono={Lock}
        name="password" autoComplete="current-password" placeholder="Tu contraseña"
        value={clave} onChange={(e) => { setClave(e.target.value); alEditar(); }}
        disabled={cargando || enPausa} error={errorClave}
        derecha={<button type="button" className="pgo-acc-enlace" onClick={irRecuperar}>{T.login.olvido}</button>}
      />

      <Boton type="submit" bloque cargando={cargando} variante={ok ? "ok" : "primario"} disabled={enPausa}>
        {ok ? <><Check className="h-4 w-4" aria-hidden="true" />{T.login.ctaOk}</> : cargando ? T.login.ctaCargando : T.login.cta}
      </Boton>

      {enPausa ? (
        <Boton variante="secundario" bloque onClick={irRecuperar}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Crear una contraseña nueva
        </Boton>
      ) : null}

      {irRegistro ? (
        <p className="pgo-acc-centrado">
          {T.login.primeraVez}{" "}
          <button type="button" className="pgo-acc-enlace" onClick={irRegistro}>{T.login.crear}</button>
        </p>
      ) : null}
    </form>
  );
}

/* ═════ Recuperar contraseña ═════ */

export function FormRecuperar({
  demo, onEstado, irLogin, sinTitulo,
}: {
  demo: EstadoDemo;
  onEstado: (e: EstadoCard) => void;
  irLogin: () => void;
  sinTitulo?: boolean;
}) {
  const Titulo = sinTitulo ? "h2" : "h1";
  const [correo, setCorreo] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(demo === "enviado");
  const faltan = useCuentaRegresiva(45, enviado);

  useEffect(() => { if (demo === "enviado") onEstado("ok"); }, [demo, onEstado]);

  const errorCorreo = intentado && !CORREO_RE.test(correo.trim()) ? T.login.errorCorreo : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (!CORREO_RE.test(correo.trim())) return;
    setCargando(true);
    onEstado("cargando");
    await esperar(1200);
    setCargando(false);
    setEnviado(true);
    onEstado("ok");
  }

  if (enviado) {
    return (
      <div className="pgo-acc-cuerpo pgo-acc-exito">
        <div className="pgo-acc-sello pgo-acc-sello--info"><MailCheck aria-hidden="true" /></div>
        <hgroup className="pgo-acc-cabecera">
          <Titulo className="pgo-acc-titulo">{T.recuperar.enviadoTitulo}</Titulo>
          <p className="pgo-acc-sub">{T.recuperar.enviadoTexto}</p>
        </hgroup>
        <p className="pgo-acc-ayuda">
          {T.recuperar.noLlego}.{" "}
          {faltan > 0
            ? <span>{T.recuperar.reenviarEn} <span className="pgo-acc-contador">{formatoReloj(faltan)}</span>.</span>
            : <button type="button" className="pgo-acc-enlace" onClick={() => { setEnviado(false); onEstado("reposo"); }}>{T.recuperar.reenviar}</button>}
        </p>
        <button type="button" className="pgo-acc-enlace" onClick={irLogin}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {T.recuperar.volver}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="pgo-acc-cuerpo">
      {sinTitulo ? <p className="pgo-acc-sub" style={{ margin: 0 }}>{T.recuperar.sub}</p> : (
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.recuperar.titulo}</h1>
          <p className="pgo-acc-sub">{T.recuperar.sub}</p>
        </hgroup>
      )}
      <Campo
        id="acc-rec-correo" etiqueta={T.login.correo} icono={Mail}
        type="email" name="email" autoComplete="email" inputMode="email" placeholder={T.login.correoPlaceholder}
        value={correo} onChange={(e) => setCorreo(e.target.value)}
        disabled={cargando} error={errorCorreo} valido={CORREO_RE.test(correo.trim())}
      />
      <Boton type="submit" bloque cargando={cargando}>
        {cargando ? T.recuperar.ctaCargando : T.recuperar.cta}
      </Boton>
      <button type="button" className="pgo-acc-enlace pgo-acc-enlace--suave" onClick={irLogin} style={{ justifySelf: "center" }}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {T.recuperar.volver}
      </button>
    </form>
  );
}

/* ═════ Crear cuenta ═════ */

export type ModoRegistro = "pasos" | "pagina";

/** Progreso en tres tramos: texto del paso actual y barra. */
export function ProgresoPasos({ paso, movil }: { paso: number; movil?: boolean }) {
  return (
    <div className={`pgo-acc-progreso${movil ? " pgo-acc-progreso--movil" : ""}`}>
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

export function FormRegistro({
  modo, paso, onPaso, demo, onEstado, irLogin, progreso = "dentro",
}: {
  modo: ModoRegistro;
  paso: number;
  onPaso: (n: number) => void;
  demo: EstadoDemo;
  onEstado: (e: EstadoCard) => void;
  irLogin: () => void;
  /** "dentro": barra dentro de la tarjeta; "movil": solo en pantallas sin panel lateral; "no": sin barra. */
  progreso?: "dentro" | "movil" | "no";
}) {
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [corredora, setCorredora] = useState("");
  const [tipo, setTipo] = useState<"juridica" | "natural">("juridica");
  const [rutCorredora, setRutCorredora] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [consentIa, setConsentIa] = useState(false);
  const [consentTerminos, setConsentTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [creada, setCreada] = useState(demo === "creada");
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const [direccion, setDireccion] = useState<"adelante" | "atras">("adelante");
  const irAPaso = (n: number) => { setDireccion(n >= paso ? "adelante" : "atras"); onPaso(n); };
  useEffect(() => { if (demo === "creada") onEstado("ok"); }, [demo, onEstado]);

  const marcar = (k: string) => setTocado((t) => ({ ...t, [k]: true }));

  const nombreOk = nombre.trim().split(/\s+/).filter((p) => p.length > 1).length >= 2;
  const rutOk = validateRut(rut);
  const correoOk = CORREO_RE.test(correo.trim());
  const claveOk = evaluatePassword(clave, { nombre, email: correo, rut }).passes;
  const paso1Ok = nombreOk && rutOk && correoOk && claveOk;
  const corredoraOk = corredora.trim().length >= 2;
  const rutCorredoraOk = tipo === "natural" || validateRut(rutCorredora);
  const paso2Ok = corredoraOk && rutCorredoraOk;
  const paso3Ok = !!foto && consentIa && consentTerminos;

  async function crear() {
    setCargando(true);
    onEstado("cargando");
    await esperar(1800);
    setCargando(false);
    setCreada(true);
    onEstado("ok");
  }

  /* ── Bloques de cada paso ── */
  const bloque1 = (
    <>
      <Campo
        id="acc-nombre" etiqueta={T.registro.nombre} icono={User}
        name="nombre" autoComplete="name" placeholder={T.registro.nombrePlaceholder}
        value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => marcar("nombre")}
        valido={nombreOk}
        error={tocado.nombre && !nombreOk ? "Escribe tu nombre y al menos un apellido." : null}
      />
      <Campo
        id="acc-rut" etiqueta={T.registro.rut} icono={IdCard} numeros
        name="rut" autoComplete="off" inputMode="text" placeholder={T.registro.rutPlaceholder}
        value={rut} onChange={(e) => setRut(formatRut(e.target.value))} onBlur={() => marcar("rut")}
        valido={rutOk} error={tocado.rut && rut && !rutOk ? T.registro.rutError : null}
      />
      <Campo
        id="acc-reg-correo" etiqueta={T.registro.correo} icono={Mail}
        type="email" name="email" autoComplete="email" inputMode="email" placeholder={T.login.correoPlaceholder}
        value={correo} onChange={(e) => setCorreo(e.target.value)} onBlur={() => marcar("correo")}
        valido={correoOk} error={tocado.correo && correo && !correoOk ? T.login.errorCorreo : null}
      />
      <div>
        <CampoClave
          id="acc-reg-clave" etiqueta={T.registro.clave} icono={Lock}
          name="password" autoComplete="new-password" placeholder="Crea una contraseña segura"
          value={clave} onChange={(e) => setClave(e.target.value)}
        />
        <PasswordStrengthMeter password={clave} nombre={nombre} email={correo} rut={rut} />
      </div>
    </>
  );

  const bloque2 = (
    <>
      <Campo
        id="acc-corredora" etiqueta={T.registro.corredora} icono={Building2}
        name="empresa" autoComplete="organization" placeholder={T.registro.corredoraPlaceholder}
        value={corredora} onChange={(e) => setCorredora(e.target.value)} valido={corredoraOk}
      />
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="pgo-acc-etiqueta" style={{ marginBottom: 8 }}>{T.registro.comoOpera}</legend>
        <div className="pgo-acc-opciones">
          <label className="pgo-acc-opcion">
            <input type="radio" name="tipo" checked={tipo === "juridica"} onChange={() => setTipo("juridica")} />
            <div><strong>{T.registro.empresa}</strong><span>{T.registro.empresaDetalle}</span></div>
          </label>
          <label className="pgo-acc-opcion">
            <input type="radio" name="tipo" checked={tipo === "natural"} onChange={() => setTipo("natural")} />
            <div><strong>{T.registro.natural}</strong><span>{T.registro.naturalDetalle}</span></div>
          </label>
        </div>
      </fieldset>
      {tipo === "juridica" ? (
        <Campo
          id="acc-rut-corredora" etiqueta={T.registro.rutCorredora} icono={IdCard} numeros
          name="rutEmpresa" autoComplete="off" placeholder="76.123.456-7" ayuda={T.registro.rutCorredoraAyuda}
          value={rutCorredora} onChange={(e) => setRutCorredora(formatRut(e.target.value))} onBlur={() => marcar("rutc")}
          valido={validateRut(rutCorredora)}
          error={tocado.rutc && rutCorredora && !validateRut(rutCorredora) ? T.registro.rutError : null}
        />
      ) : null}
    </>
  );

  const bloque3 = (
    <>
      <ul className="pgo-acc-razones">
        {T.registro.razones.map((r, i) => (
          <li key={r}>
            {i === 0 ? <ShieldCheck aria-hidden="true" /> : i === 1 ? <Lock aria-hidden="true" /> : <Check aria-hidden="true" />}
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {demo === "camara" ? <Aviso variante="info">{T.registro.camaraBloqueada}</Aviso> : null}
      {foto ? (
        <Aviso variante="ok" titulo="Foto lista">
          <span>{foto} · </span>
          <button type="button" className="pgo-acc-enlace" onClick={() => setFoto(null)}>Cambiar</button>
        </Aviso>
      ) : (
        <div className="pgo-acc-opciones" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Boton variante="secundario" onClick={() => setFoto("foto-de-camara.jpg")}>
            <Camera className="h-4 w-4" aria-hidden="true" />{T.registro.camara}
          </Boton>
          <Boton variante="secundario" onClick={() => setFoto("cedula.jpg")}>
            <Upload className="h-4 w-4" aria-hidden="true" />{T.registro.subir}
          </Boton>
        </div>
      )}
      <label className="pgo-acc-check">
        <input type="checkbox" checked={consentIa} onChange={(e) => setConsentIa(e.target.checked)} />
        <span>{T.registro.consentIa}</span>
      </label>
      <label className="pgo-acc-check">
        <input type="checkbox" checked={consentTerminos} onChange={(e) => setConsentTerminos(e.target.checked)} />
        <span>
          {T.registro.consentTerminos} <Link href="/terminos-uso">{T.registro.terminos}</Link> {T.registro.y}{" "}
          <Link href="/privacidad">{T.registro.privacidad}</Link> {T.registro.leyFin}
        </span>
      </label>
    </>
  );

  if (creada) {
    return (
      <div className="pgo-acc-cuerpo pgo-acc-exito">
        <div className="pgo-acc-sello">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.registro.exitoTitulo}</h1>
          <p className="pgo-acc-sub">{T.registro.exitoTexto}</p>
        </hgroup>
        <Boton bloque>{T.registro.exitoCta}</Boton>
      </div>
    );
  }

  const encabezados = [
    { t: T.registro.paso1Titulo, s: T.registro.paso1Sub },
    { t: T.registro.paso2Titulo, s: T.registro.paso2Sub },
    { t: T.registro.paso3Titulo, s: T.registro.paso3Sub },
  ];
  const bloques = [bloque1, bloque2, bloque3];

  const pie = (
    <>
      <div className="pgo-acc-plan">
        <span><strong>{T.planGratuito.nombre}</strong> · {T.planGratuito.detalle}</span>
        <span>
          {T.registro.yaTienes}{" "}
          <button type="button" className="pgo-acc-enlace" onClick={irLogin}>{T.registro.entrar}</button>
        </span>
      </div>
    </>
  );

  /* ── Una sola página: los tres bloques a la vista ── */
  if (modo === "pagina") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); if (paso1Ok && paso2Ok && paso3Ok) void crear(); }} noValidate className="pgo-acc-cuerpo">
        <div className="pgo-acc-secciones">
          {bloques.map((b, i) => (
            <section key={i} className="pgo-acc-seccion" aria-labelledby={`acc-sec-${i}`}>
              <h2 id={`acc-sec-${i}`} className="pgo-acc-seccion-titulo">
                <span className="pgo-acc-seccion-n" aria-hidden="true">{i + 1}</span>
                {encabezados[i].t}
              </h2>
              <p className="pgo-acc-ayuda" style={{ marginTop: -8 }}>{encabezados[i].s}</p>
              {b}
            </section>
          ))}
        </div>
        <Boton type="submit" bloque cargando={cargando} disabled={!(paso1Ok && paso2Ok && paso3Ok)}>
          {cargando ? T.registro.ctaCargando : T.registro.cta}
        </Boton>
        {pie}
      </form>
    );
  }

  /* ── Por pasos ── */
  const listos = [paso1Ok, paso2Ok, paso3Ok];
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (paso < 2) { if (listos[paso]) irAPaso(paso + 1); } else if (paso3Ok) void crear(); }}
      noValidate
      className="pgo-acc-cuerpo"
    >
      {progreso !== "no" ? <ProgresoPasos paso={paso} movil={progreso === "movil"} /> : null}
      <PanelAnimado clave={`paso-${paso}`} direccion={direccion}>
        <div className="pgo-acc-cuerpo">
          <hgroup className="pgo-acc-cabecera">
            <h1 className="pgo-acc-titulo">{encabezados[paso].t}</h1>
            <p className="pgo-acc-sub">{encabezados[paso].s}</p>
          </hgroup>
          {bloques[paso]}
        </div>
      </PanelAnimado>
      <div className="pgo-acc-fila" style={{ flexWrap: "nowrap" }}>
        {paso > 0 ? <Boton variante="secundario" onClick={() => irAPaso(paso - 1)}>{T.registro.atras}</Boton> : null}
        <div style={{ flex: 1 }}>
          <Boton type="submit" bloque cargando={cargando} disabled={!listos[paso]}>
            {paso < 2 ? T.registro.siguiente : cargando ? T.registro.ctaCargando : T.registro.cta}
          </Boton>
        </div>
      </div>
      {pie}
    </form>
  );
}
