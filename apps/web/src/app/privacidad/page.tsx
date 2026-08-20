/**
 * /privacidad — Política de Privacidad y Protección de Datos Personales
 *
 * Marco normativo:
 *  · Ley 21.719 – Protección de Datos Personales (vigente 01/12/2026)
 *  · Ley 21.096 – Protección de datos como derecho constitucional (art. 19 N°4)
 *  · Ley 19.628 – Ley anterior de datos personales (sigue vigente en lo compatible)
 *  · Reglamento Ley 21.719 (DS en tramitación)
 */
import Link from "next/link";
import { ShieldCheck, Eye, Database, Mail, Clock, Globe, AlertTriangle } from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";

export const metadata = {
  title: "Política de Privacidad · Housing SOLIDIT",
  description:
    "Política de privacidad y protección de datos personales de Housing SOLIDIT. Conozca cómo tratamos sus datos conforme a la Ley 21.719.",
};

const ULTIMA_ACTUALIZACION = "1 de julio de 2026";
const RAZON_SOCIAL         = "SOLIDIT SpA";
const RUT_EMPRESA          = "77.000.000-0"; // Actualizar al RUT real
const EMAIL_DATOS          = "privacidad@solidit.cl";
const DOMICILIO            = "Santiago, Región Metropolitana, Chile";

const SECCIONES = [
  { id: "responsable",  label: "Responsable del tratamiento" },
  { id: "datos",        label: "Datos que tratamos" },
  { id: "finalidades",  label: "Finalidades y base legal" },
  { id: "retencion",    label: "Períodos de retención" },
  { id: "terceros",     label: "Transferencia a terceros" },
  { id: "derechos",     label: "Sus derechos (ARCO+)" },
  { id: "cookies",      label: "Cookies y tecnologías" },
  { id: "menores",      label: "Menores de edad" },
  { id: "cambios",      label: "Cambios a esta política" },
  { id: "contacto",     label: "Contacto" },
];

function Section({ id, icon, title, children }: {
  id: string; icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
        >
          {icon}
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--pf-navy)", letterSpacing: "-0.01em" }}>
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-base leading-relaxed pl-12" style={{ color: "var(--pf-text-body)" }}>
        {children}
      </div>
    </section>
  );
}

function DerechoCard({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
    >
      <p className="font-semibold text-sm mb-1" style={{ color: "var(--pf-navy)" }}>{titulo}</p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--pf-text-body)" }}>{descripcion}</p>
    </div>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--pf-surface)" }}>
      <PublicNavbar />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">

          {/* Índice lateral */}
          <aside className="hidden lg:block">
            <div
              className="sticky top-6 rounded-2xl p-5"
              style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>
                Contenido
              </p>
              <nav className="space-y-1">
                {SECCIONES.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:opacity-70"
                    style={{ color: "var(--pf-text-body)" }}
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
              <div
                className="mt-4 rounded-xl p-3 flex items-start gap-2"
                style={{ background: "var(--pf-purple-tint)" }}
              >
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--pf-purple)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--pf-navy)" }}>
                  Actualizada el {ULTIMA_ACTUALIZACION}.<br />
                  Cumple Ley 21.719.
                </p>
              </div>
            </div>
          </aside>

          {/* Contenido principal */}
          <main>
            {/* Título */}
            <div className="mb-10">
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)", border: "1px solid var(--hw-primary-bd)" }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Ley 21.719 · Protección de Datos Personales
              </div>
              <h1
                className="text-3xl font-bold tracking-tight mb-3"
                style={{ color: "var(--pf-navy)", letterSpacing: "-0.02em" }}
              >
                Política de Privacidad
              </h1>
              <p className="text-base" style={{ color: "var(--pf-text-body)" }}>
                En <strong>{RAZON_SOCIAL}</strong> nos comprometemos a proteger su privacidad y tratar sus
                datos personales con transparencia, conforme a la legislación chilena vigente.
                Lea esta política con atención antes de utilizar nuestra plataforma.
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--pf-text-light)" }}>
                Última actualización: {ULTIMA_ACTUALIZACION}
              </p>
            </div>

            {/* Alerta Ley 21.719 */}
            <div
              className="mb-8 flex items-start gap-3 rounded-2xl p-4"
              style={{ background: "var(--pf-purple-tint)", border: "1px solid var(--hw-primary-bd)" }}
            >
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--pf-purple)" }} />
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--pf-navy)" }}>
                  Consentimiento informado
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--pf-text-body)" }}>
                  Al utilizar Housing SOLIDIT usted declara haber leído y comprendido esta política,
                  y consiente expresamente el tratamiento de sus datos conforme a lo aquí descrito
                  (art. 12 Ley 21.719). Puede retirar su consentimiento en cualquier momento
                  escribiendo a <a href={`mailto:${EMAIL_DATOS}`} style={{ color: "var(--pf-purple)", fontWeight: 500 }}>{EMAIL_DATOS}</a>.
                </p>
              </div>
            </div>

            {/* §1 */}
            <Section id="responsable" icon={<Database className="h-4 w-4" />} title="1. Responsable del tratamiento">
              <p>
                El responsable del tratamiento de sus datos personales es:
              </p>
              <div
                className="rounded-xl p-4 text-sm space-y-1"
                style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
              >
                <p><strong>Razón social:</strong> {RAZON_SOCIAL}</p>
                <p><strong>RUT:</strong> {RUT_EMPRESA}</p>
                <p><strong>Domicilio:</strong> {DOMICILIO}</p>
                <p><strong>Correo datos personales:</strong>{" "}
                  <a href={`mailto:${EMAIL_DATOS}`} style={{ color: "var(--pf-purple)" }}>{EMAIL_DATOS}</a>
                </p>
              </div>
            </Section>

            {/* §2 */}
            <Section id="datos" icon={<Eye className="h-4 w-4" />} title="2. Datos que tratamos">
              <p>Según el contexto de uso, tratamos las siguientes categorías de datos:</p>
              <div className="space-y-3">
                {[
                  {
                    grupo: "Datos de identificación (corredores y propietarios)",
                    items: ["Nombre completo", "RUT", "Correo electrónico", "Teléfono", "Fecha de nacimiento", "Fotografía de perfil (opcional)"],
                  },
                  {
                    grupo: "Datos de arrendatarios y propietarios (para gestión de contratos)",
                    items: ["Nombre completo", "RUT", "Correo electrónico", "Teléfono"],
                  },
                  {
                    grupo: "Datos de uso de la plataforma",
                    items: ["Dirección IP", "Tipo de dispositivo y navegador", "Fecha y hora de acceso", "Acciones realizadas (audit log)"],
                  },
                  {
                    grupo: "Datos contractuales y financieros",
                    items: ["Montos de arriendo y garantías", "Historial de pagos", "Comprobantes de pago", "Documentos adjuntos (contratos, anexos)"],
                  },
                ].map(({ grupo, items }) => (
                  <div key={grupo}
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
                  >
                    <p className="font-semibold mb-2" style={{ color: "var(--pf-navy)" }}>{grupo}</p>
                    <ul className="space-y-0.5">
                      {items.map((i) => (
                        <li key={i} className="flex items-start gap-2" style={{ color: "var(--pf-text-body)" }}>
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--pf-purple)" }} />
                          {i}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-sm" style={{ color: "var(--pf-text-light)" }}>
                No tratamos datos sensibles en los términos del art. 16 de la Ley 21.719 (datos de salud, origen étnico, opiniones políticas, etc.).
              </p>
            </Section>

            {/* §3 */}
            <Section id="finalidades" icon={<ShieldCheck className="h-4 w-4" />} title="3. Finalidades y base legal">
              <p>Tratamos sus datos con las siguientes finalidades y bases de legitimación:</p>
              <div className="space-y-3">
                {[
                  { fin: "Prestación del servicio", base: "Ejecución de contrato (art. 13 a) Ley 21.719)", desc: "Gestión de propiedades, contratos, cobros y portal de autoconsulta." },
                  { fin: "Autenticación y seguridad", base: "Interés legítimo (art. 13 f) Ley 21.719)", desc: "Verificación de identidad, dispositivos confiables, prevención de fraudes." },
                  { fin: "Cumplimiento legal", base: "Obligación legal (art. 13 c) Ley 21.719)", desc: "Audit log requerido por Ley 19.628 y 21.719; conservación de registros contables." },
                  { fin: "Comunicaciones transaccionales", base: "Ejecución de contrato", desc: "Envío de códigos OTP, vouchers de pago, recordatorios de vencimiento." },
                  { fin: "Mejora del servicio", base: "Interés legítimo", desc: "Análisis de uso agregado y anónimo para mejorar funcionalidades." },
                ].map(({ fin, base, desc }) => (
                  <div key={fin}
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <p className="font-semibold" style={{ color: "var(--pf-navy)" }}>{fin}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
                      >
                        {base}
                      </span>
                    </div>
                    <p style={{ color: "var(--pf-text-body)" }}>{desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* §4 */}
            <Section id="retencion" icon={<Clock className="h-4 w-4" />} title="4. Períodos de retención">
              <p>
                Conservamos sus datos durante el tiempo necesario para las finalidades descritas y
                los plazos legales aplicables:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--pf-border)" }}>
                      <th className="py-2 pr-4 text-left font-semibold" style={{ color: "var(--pf-navy)" }}>Categoría de dato</th>
                      <th className="py-2 text-left font-semibold" style={{ color: "var(--pf-navy)" }}>Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ color: "var(--pf-text-body)" }}>
                    {[
                      ["Datos de cuenta (corredor)", "Mientras la cuenta esté activa + 5 años"],
                      ["Contratos y documentos", "10 años desde término (Código Civil art. 2514)"],
                      ["Registros de pagos y asientos contables", "7 años (Código Tributario art. 200)"],
                      ["Audit log (accesos al portal)", "3 años (Ley 21.719 art. 3)"],
                      ["Códigos OTP", "Eliminados automáticamente al expirar (10 min)"],
                      ["Tokens de dispositivo", "Hasta revocación o cierre de cuenta"],
                      ["Logs de IP y navegación", "90 días"],
                    ].map(([cat, periodo]) => (
                      <tr key={cat}>
                        <td className="py-2.5 pr-4 font-medium">{cat}</td>
                        <td className="py-2.5">{periodo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Transcurridos estos plazos, los datos se eliminan o anonimizamos de forma irreversible.
              </p>
            </Section>

            {/* §5 */}
            <Section id="terceros" icon={<Globe className="h-4 w-4" />} title="5. Transferencia a terceros">
              <p>
                Housing SOLIDIT no vende ni cede sus datos a terceros con fines comerciales.
                Únicamente los compartimos con:
              </p>
              <div className="space-y-3">
                {[
                  {
                    nombre: "Resend Inc. (EE.UU.)",
                    rol: "Proveedor de correo transaccional",
                    datos: "Nombre y dirección de correo para envío de notificaciones",
                    garantia: "Cláusulas contractuales estándar (SCCs). Política: resend.com/privacy",
                  },
                  {
                    nombre: "Groq Inc. (EE.UU.)",
                    rol: "Proveedor de IA para validación de contratos",
                    datos: "Texto del contrato (sin datos de pago ni identificación directa)",
                    garantia: "Datos procesados y no almacenados por Groq. Política: groq.com/privacy",
                  },
                  {
                    nombre: "Proveedor de infraestructura cloud",
                    rol: "Hosting de base de datos y aplicación",
                    datos: "Todos los datos de la plataforma (cifrados en tránsito y en reposo)",
                    garantia: "Certificación SOC 2. Contrato de procesamiento de datos (DPA) firmado",
                  },
                  {
                    nombre: "OpenStreetMap Foundation — Nominatim (Reino Unido)",
                    rol: "Geocodificación de direcciones para el mapa de propiedades",
                    datos: "Dirección, comuna y región de la propiedad (sin datos del propietario ni del arrendatario)",
                    garantia: "Servicio gratuito de código abierto. Política: osmfoundation.org/wiki/Privacy_Policy. Por defecto, el marketplace público solo muestra un área aproximada; la dirección exacta y el pin solo se publican si el corredor lo autoriza expresamente junto al propietario.",
                  },
                ].map(({ nombre, rol, datos, garantia }) => (
                  <div key={nombre}
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
                  >
                    <p className="font-semibold mb-0.5" style={{ color: "var(--pf-navy)" }}>{nombre}</p>
                    <p className="text-xs mb-2" style={{ color: "var(--pf-text-light)" }}>{rol}</p>
                    <p><strong>Datos compartidos:</strong> {datos}</p>
                    <p className="mt-1"><strong>Garantía de protección:</strong> {garantia}</p>
                  </div>
                ))}
              </div>
              <p>
                No realizamos transferencias internacionales fuera de los proveedores listados sin su consentimiento previo.
              </p>
            </Section>

            {/* §6 */}
            <Section id="derechos" icon={<ShieldCheck className="h-4 w-4" />} title="6. Sus derechos (ARCO+)">
              <p>
                Conforme al Título III de la Ley 21.719, usted tiene derecho a:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DerechoCard
                  titulo="Acceso"
                  descripcion="Solicitar confirmación de si tratamos sus datos y obtener una copia de ellos."
                />
                <DerechoCard
                  titulo="Rectificación"
                  descripcion="Pedir que corrijamos datos inexactos o incompletos."
                />
                <DerechoCard
                  titulo="Supresión (cancelación)"
                  descripcion="Solicitar la eliminación de sus datos cuando no sean necesarios para los fines para los que fueron recabados."
                />
                <DerechoCard
                  titulo="Oposición"
                  descripcion="Oponerse al tratamiento basado en interés legítimo en determinadas circunstancias."
                />
                <DerechoCard
                  titulo="Portabilidad"
                  descripcion="Recibir sus datos en formato estructurado, legible por máquina, y transmitirlos a otro responsable."
                />
                <DerechoCard
                  titulo="Limitación del tratamiento"
                  descripcion="Solicitar que suspendamos temporalmente el tratamiento mientras se resuelve una impugnación."
                />
                <DerechoCard
                  titulo="Revocación del consentimiento"
                  descripcion="Retirar su consentimiento en cualquier momento, sin afectar la licitud del tratamiento previo."
                />
                <DerechoCard
                  titulo="Reclamación ante la Agencia"
                  descripcion="Presentar reclamaciones ante la Agencia de Protección de Datos Personales (art. 58 Ley 21.719) si considera que vulneramos sus derechos."
                />
              </div>
              <div
                className="rounded-xl p-4 text-sm"
                style={{ background: "var(--pf-purple-tint)", border: "1px solid var(--hw-primary-bd)" }}
              >
                <p className="font-semibold mb-1" style={{ color: "var(--pf-navy)" }}>¿Cómo ejercer sus derechos?</p>
                <p style={{ color: "var(--pf-text-body)" }}>
                  Envíe su solicitud a <a href={`mailto:${EMAIL_DATOS}`} style={{ color: "var(--pf-purple)", fontWeight: 500 }}>{EMAIL_DATOS}</a> indicando
                  su nombre completo, RUT y el derecho que desea ejercer. Responderemos dentro
                  de <strong>15 días hábiles</strong> conforme al art. 28 de la Ley 21.719.
                </p>
              </div>
            </Section>

            {/* §7 */}
            <Section id="cookies" icon={<Database className="h-4 w-4" />} title="7. Cookies y tecnologías similares">
              <p>
                Housing SOLIDIT utiliza las siguientes tecnologías de almacenamiento en su dispositivo:
              </p>
              <div className="space-y-3">
                {[
                  {
                    nombre: "hw_session / __Host-hw_session",
                    tipo: "Cookie de sesión (httpOnly)",
                    finalidad: "Autenticación del corredor. Sin ella no puede acceder al panel.",
                    duracion: "8 horas (se renueva automáticamente con cada uso)",
                    esencial: true,
                  },
                  {
                    nombre: "hw_device",
                    tipo: "Cookie de dispositivo confiable (httpOnly)",
                    finalidad: "Evitar solicitar 2FA en dispositivos ya verificados.",
                    duracion: "1 año",
                    esencial: true,
                  },
                  {
                    nombre: "hw_portal_session",
                    tipo: "Cookie de sesión portal (httpOnly)",
                    finalidad: "Autenticación de arrendatarios en el portal de autoconsulta.",
                    duracion: "30 minutos",
                    esencial: true,
                  },
                  {
                    nombre: "hw_tos_v2",
                    tipo: "localStorage",
                    finalidad: "Registro de que el usuario aceptó los términos de uso (Ley 21.719 art. 4).",
                    duracion: "Persistente hasta borrar datos del navegador",
                    esencial: true,
                  },
                ].map(({ nombre, tipo, finalidad, duracion, esencial }) => (
                  <div key={nombre}
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--pf-border)", color: "var(--pf-navy)" }}>
                        {nombre}
                      </code>
                      {esencial && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}>
                          Esencial
                        </span>
                      )}
                    </div>
                    <p className="text-xs mb-1" style={{ color: "var(--pf-text-light)" }}>{tipo}</p>
                    <p><strong>Finalidad:</strong> {finalidad}</p>
                    <p className="mt-1"><strong>Duración:</strong> {duracion}</p>
                  </div>
                ))}
              </div>
              <p>
                No utilizamos cookies de rastreo, publicidad ni analítica de terceros.
                Todas las cookies son estrictamente necesarias para el funcionamiento del servicio.
              </p>
            </Section>

            {/* §8 */}
            <Section id="menores" icon={<AlertTriangle className="h-4 w-4" />} title="8. Menores de edad">
              <p>
                Housing SOLIDIT no está dirigido a menores de 18 años. No recopilamos
                intencionalmente datos de menores. Si tiene conocimiento de que un menor
                ha proporcionado datos personales a través de nuestra plataforma, le rogamos
                que nos lo comunique a{" "}
                <a href={`mailto:${EMAIL_DATOS}`} style={{ color: "var(--pf-purple)", fontWeight: 500 }}>{EMAIL_DATOS}</a>{" "}
                para proceder a su eliminación inmediata.
              </p>
            </Section>

            {/* §9 */}
            <Section id="cambios" icon={<Clock className="h-4 w-4" />} title="9. Cambios a esta política">
              <p>
                Podemos actualizar esta política para reflejar cambios en la legislación o en
                nuestras prácticas de tratamiento. Cuando los cambios sean significativos,
                se lo notificaremos por correo electrónico con al menos{" "}
                <strong>15 días hábiles de anticipación</strong> conforme al art. 15 de la
                Ley 19.496. La versión vigente siempre estará disponible en{" "}
                <Link href="/privacidad" style={{ color: "var(--pf-purple)", fontWeight: 500 }}>
                  housing.solidit.cl/privacidad
                </Link>.
              </p>
              <p>
                El uso continuado del servicio tras la entrada en vigencia de los cambios
                implica la aceptación de la nueva versión de la política.
              </p>
            </Section>

            {/* §10 */}
            <Section id="contacto" icon={<Mail className="h-4 w-4" />} title="10. Contacto">
              <p>Para cualquier consulta sobre esta política o el ejercicio de sus derechos:</p>
              <div
                className="rounded-xl p-4 text-sm space-y-2"
                style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
              >
                <p><strong>Encargado de datos personales:</strong> {RAZON_SOCIAL}</p>
                <p>
                  <strong>Correo:</strong>{" "}
                  <a href={`mailto:${EMAIL_DATOS}`} style={{ color: "var(--pf-purple)" }}>{EMAIL_DATOS}</a>
                </p>
                <p><strong>Domicilio:</strong> {DOMICILIO}</p>
                <p><strong>Plazo de respuesta:</strong> 15 días hábiles</p>
              </div>
              <p>
                Si no recibe respuesta satisfactoria, puede acudir a la{" "}
                <strong>Agencia de Protección de Datos Personales de Chile</strong> una vez
                que entre en funcionamiento (Ley 21.719 Título VI), o a los Tribunales ordinarios
                de Justicia con asiento en la ciudad de Santiago.
              </p>
            </Section>

            {/* Footer legal */}
            <div
              className="mt-10 rounded-2xl p-6 text-sm"
              style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4" style={{ color: "var(--pf-purple)" }} />
                <span className="font-semibold" style={{ color: "var(--pf-navy)" }}>Marco normativo aplicado</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Ley 21.719", "Ley 19.628", "Ley 21.096", "Ley 19.496", "Código Civil", "Chile 2026"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: "var(--pf-text-light)" }}>
                <Link href="/terminos-uso" className="hover:opacity-70">Términos de uso</Link>
                <Link href="/marketplace" className="hover:opacity-70">Marketplace</Link>
                <Link href="/portal" className="hover:opacity-70">Consulta tu arriendo</Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
