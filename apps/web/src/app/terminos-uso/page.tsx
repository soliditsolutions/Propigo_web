/**
 * /terminos-uso — Términos y Condiciones de Uso del Sitio Público Housing SOLIDIT
 *
 * Marco normativo aplicado:
 *  · Ley 19.496 – Protección al Consumidor (texto refundido, con mods. Ley 21.398)
 *  · Ley 21.719 – Protección de Datos Personales (en vigor 01/12/2026)
 *  · Código Civil arts. 1545, 1546, 2314-2334 (contratos y responsabilidad civil)
 *  · Ley 18.101 – Arrendamiento de Predios Urbanos
 *  · Ley 21.461 – Procedimiento de recuperación de inmueble (Devuélveme mi Casa)
 *  · Ley 20.009 – Fraudes con medios de pago electrónicos
 *  · Ley 21.096 – Protección de datos como derecho constitucional (art. 19 N°4)
 *  · Ley 20.453 – Principios de neutralidad e Internet libre
 *  · Circular SERNAC sobre plataformas digitales de servicios inmobiliarios (2025)
 */
import Link from "next/link";
import { ShieldCheck, AlertTriangle, Scale, Phone, Mail } from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";

export const metadata = {
  title: "Términos y Condiciones de Uso · Housing SOLIDIT",
  description:
    "Términos y condiciones de uso del sitio público de Housing SOLIDIT. Lea con atención antes de utilizar el marketplace o el portal de autoconsulta.",
};

// Fecha de última actualización
const ULTIMA_ACTUALIZACION = "1 de julio de 2026";
const RAZON_SOCIAL        = "SOLIDIT SpA";
const RUT_EMPRESA         = "77.000.000-0"; // Actualizar al RUT real
const DOMICILIO           = "Santiago, Región Metropolitana, Chile";
const EMAIL_CONTACTO      = "legal@solidit.cl";
const TELEFONO            = "+56 2 0000 0000"; // Actualizar al número real

function Section({ id, title, children }: {
  id: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10">
      <h2
        className="mb-4 text-xl font-bold"
        style={{ color: "var(--pf-navy)", letterSpacing: "-0.01em" }}
      >
        {title}
      </h2>
      <div
        className="space-y-4 text-base leading-relaxed"
        style={{ color: "var(--pf-text-body)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 font-semibold" style={{ color: "var(--pf-navy)" }}>{title}</h3>
      {children}
    </div>
  );
}

function LegalRef({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1 py-0.5 text-sm font-medium"
      style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
    >
      {children}
    </span>
  );
}

export default function TerminosUsoPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--pf-surface)" }}>

      <PublicNavbar />

      {/* Hero */}
      <div
        className="border-b pt-24 pb-12"
        style={{ background: "linear-gradient(160deg, var(--pf-hero-1) 0%, var(--pf-hero-2) 45%, var(--pf-surface) 100%)", borderColor: "var(--pf-border)" }}
      >
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--pf-purple)" }}>
            <Scale className="h-4 w-4" aria-hidden />
            <span className="font-semibold">Marco legal chileno 2026</span>
          </div>
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--pf-navy)", letterSpacing: "-0.02em" }}
          >
            Términos y Condiciones de Uso
          </h1>
          <p className="mt-3 text-lg" style={{ color: "var(--pf-text-body)" }}>
            Del sitio público Housing SOLIDIT — marketplace de arriendos y portal de autoconsulta.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--pf-text-muted)" }}>
            Última actualización: <strong>{ULTIMA_ACTUALIZACION}</strong>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex gap-12">

          {/* Índice lateral */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-text-muted)" }}>
                Contenido
              </p>
              <nav className="space-y-1.5 text-sm">
                {[
                  ["#identificacion",   "1. Identificación"],
                  ["#intermediacion",   "2. Carácter intermediario"],
                  ["#fraudes",          "3. Advertencia anti-fraude"],
                  ["#responsabilidad",  "4. Limitación de responsabilidad"],
                  ["#obligaciones",     "5. Obligaciones del usuario"],
                  ["#datos",            "6. Datos personales"],
                  ["#propiedad",        "7. Propiedad intelectual"],
                  ["#modificaciones",   "8. Modificaciones"],
                  ["#ley",              "9. Ley y jurisdicción"],
                  ["#contacto",         "10. Contacto"],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    className="block rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--pf-surface)]"
                    style={{ color: "var(--pf-text-muted)" }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Contenido */}
          <main className="min-w-0 flex-1">

            {/* Banner de advertencia fraudes — lo primero y más prominente */}
            <div
              className="mb-10 rounded-2xl p-6"
              style={{
                background: "var(--hw-warning-lt)",
                border: "2px solid var(--hw-warning-bd)",
              }}
            >
              <div className="flex items-start gap-4">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[var(--hw-warning)]" aria-hidden />
                <div>
                  <h2 className="mb-2 text-lg font-bold text-[var(--hw-warning-dk)]">
                    Advertencia importante sobre estafas en arriendos
                  </h2>
                  <p className="mb-3 text-sm text-[var(--hw-warning-dk)] leading-relaxed">
                    El fraude inmobiliario es frecuente en Chile. Housing SOLIDIT actúa únicamente
                    como plataforma intermediaria. <strong>Usted es responsable de verificar la
                    legitimidad de cualquier oferta antes de comprometer dinero o datos personales.</strong>
                  </p>
                  <ul className="space-y-1.5 text-sm text-[var(--hw-warning-dk)]">
                    <li>• <strong>Nunca transfiera dinero</strong> antes de visitar la propiedad presencialmente.</li>
                    <li>• <strong>Desconfíe de precios muy por debajo</strong> del valor de mercado de la zona.</li>
                    <li>• <strong>Exija identidad escrita</strong> del corredor y verifique su certificación Housing.</li>
                    <li>• <strong>No entregue documentos</strong> (cédula, liquidaciones) sin firma de contrato previo.</li>
                    <li>• <strong>Housing SOLIDIT nunca solicita</strong> pagos directos a la plataforma ni a cuentas personales.</li>
                    <li>• Ante cualquier sospecha, denuncie a <strong>PDI (134)</strong> o <strong>Carabineros (133)</strong>.</li>
                  </ul>
                </div>
              </div>
            </div>

            <Section id="identificacion" title="1. Identificación del titular">
              <p>
                El presente sitio web y sus servicios asociados son operados por{" "}
                <strong>{RAZON_SOCIAL}</strong>, RUT {RUT_EMPRESA}, con domicilio en{" "}
                {DOMICILIO}, en adelante <strong>«Housing SOLIDIT»</strong> o
                simplemente <strong>«la Plataforma»</strong>.
              </p>
              <p>
                Para efectos de lo dispuesto en el <LegalRef>artículo 3° letra b) de la
                Ley 19.496</LegalRef> de Protección al Consumidor, Housing SOLIDIT tiene
                la calidad de proveedor digital de servicios de intermediación inmobiliaria.
              </p>
              <p>
                Contacto: <strong>{EMAIL_CONTACTO}</strong> · {TELEFONO}
              </p>
            </Section>

            <Section id="intermediacion" title="2. Carácter de plataforma intermediaria">
              <p>
                Housing SOLIDIT es una <strong>plataforma de intermediación</strong>. Su función
                es conectar a corredores de propiedades certificados con potenciales arrendatarios.
                La Plataforma <strong>no es parte</strong> de ningún contrato de arrendamiento
                que se celebre entre un corredor/propietario y un arrendatario.
              </p>
              <Subsection title="2.1 Lo que Housing SOLIDIT SÍ hace">
                <ul className="list-inside list-disc space-y-1">
                  <li>Publicar avisos de propiedades enviados por corredores registrados y verificados.</li>
                  <li>Proporcionar un portal seguro de autoconsulta para arrendatarios con contratos vigentes.</li>
                  <li>Aplicar filtros de calidad y verificar la identidad de los corredores mediante RUT.</li>
                  <li>Mantener un canal de reportes de avisos fraudulentos o irregulares.</li>
                </ul>
              </Subsection>
              <Subsection title="2.2 Lo que Housing SOLIDIT NO hace">
                <ul className="list-inside list-disc space-y-1">
                  <li>No administra ni custodia dinero de arrendatarios o propietarios.</li>
                  <li>No verifica el estado físico ni jurídico de las propiedades publicadas.</li>
                  <li>No garantiza la disponibilidad real de la propiedad al momento de contacto.</li>
                  <li>No es parte en negociaciones de precio, condiciones ni firma de contratos.</li>
                  <li>No solicita pagos ni garantías directamente a potenciales arrendatarios.</li>
                </ul>
              </Subsection>
              <p>
                Los contratos de arrendamiento se rigen exclusivamente por la{" "}
                <LegalRef>Ley 18.101</LegalRef> de Arrendamiento de Predios Urbanos,
                la <LegalRef>Ley 21.461</LegalRef> y las normas del Código Civil,
                y son de responsabilidad exclusiva de las partes que los suscriben.
              </p>
            </Section>

            <Section id="fraudes" title="3. Advertencia sobre fraudes y estafas">
              <p>
                El fraude en el mercado inmobiliario es un delito tipificado en el{" "}
                <LegalRef>artículo 468 del Código Penal</LegalRef> (estafa) y en la{" "}
                <LegalRef>Ley 20.009</LegalRef> (fraudes con medios electrónicos).
                La Plataforma advierte expresamente los siguientes riesgos identificados por
                SERNAC y la PDI en el mercado de arriendos digital en Chile:
              </p>

              <Subsection title="3.1 Señales de alerta (red flags) que debe conocer">
                <ul className="list-inside list-disc space-y-2">
                  <li>
                    <strong>Solicitud de pago anticipado sin contrato:</strong> ningún corredor
                    legítimo exige garantía o mes de adelanto antes de que usted visite la
                    propiedad y firme un contrato.
                  </li>
                  <li>
                    <strong>Precio inusualmente bajo:</strong> las estafas más comunes ofrecen
                    arriendos 30–60 % bajo el precio de mercado para generar urgencia.
                  </li>
                  <li>
                    <strong>Imposibilidad de visitar la propiedad:</strong> el estafador siempre
                    tiene una excusa para no mostrar el inmueble presencialmente.
                  </li>
                  <li>
                    <strong>Transferencias a cuentas personales:</strong> los pagos legítimos
                    van a cuentas de empresa o corredora, nunca a cuentas de personas naturales.
                  </li>
                  <li>
                    <strong>Presión para decidir rápido:</strong> frases como «hay 5 personas
                    interesadas» o «la oferta vence hoy» son tácticas de presión fraudulenta.
                  </li>
                  <li>
                    <strong>Solicitud de documentos sensibles por mensaje:</strong> jamás envíe
                    escaneados de su cédula, liquidaciones o credenciales bancarias por
                    WhatsApp, email o formularios no oficiales.
                  </li>
                </ul>
              </Subsection>

              <Subsection title="3.2 Verificación del corredor">
                <p>
                  Todos los corredores publicados en Housing SOLIDIT han sido verificados
                  mediante RUT empresarial e identidad de su representante legal. Sin embargo,
                  <strong> le recomendamos verificar</strong>:
                </p>
                <ul className="list-inside list-disc space-y-1 mt-2">
                  <li>Que el corredor tenga correo corporativo (no Gmail/Hotmail personal).</li>
                  <li>Que el número de teléfono corresponda a la corredora publicada.</li>
                  <li>Que le entregue un comprobante escrito de toda gestión y pago.</li>
                  <li>
                    Puede verificar datos de la corredora en el Servicio de Impuestos Internos
                    en <span className="font-mono text-sm">www.sii.cl</span>.
                  </li>
                </ul>
              </Subsection>

              <Subsection title="3.3 Cómo denunciar">
                <ul className="list-inside list-disc space-y-1">
                  <li><strong>PDI — Brigada Cibercrimen:</strong> 134 o www.pdichiledenuncias.cl</li>
                  <li><strong>Carabineros:</strong> 133</li>
                  <li><strong>SERNAC:</strong> www.sernac.cl / 800 700 100</li>
                  <li><strong>Housing SOLIDIT:</strong> {EMAIL_CONTACTO} (aviso de corredor o publicación irregular)</li>
                </ul>
              </Subsection>

              <div
                className="mt-4 rounded-xl p-4 text-sm"
                style={{ background: "var(--pf-purple-tint)", color: "var(--pf-navy)" }}
              >
                <strong>Responsabilidad del usuario:</strong> Al utilizar este sitio, usted
                declara conocer estos riesgos y acepta que Housing SOLIDIT no puede ser
                responsabilizado por perjuicios derivados de actos fraudulentos de terceros
                que usted pueda sufrir como consecuencia de no observar las precauciones
                descritas en este apartado.
              </div>
            </Section>

            <Section id="responsabilidad" title="4. Limitación de responsabilidad">
              <p>
                La responsabilidad de Housing SOLIDIT se rige por el{" "}
                <LegalRef>artículo 16 de la Ley 19.496</LegalRef>, que establece como
                nulas aquellas cláusulas que exoneren al proveedor de responsabilidad por
                sus propios actos dolosos o culpa grave. En consecuencia, Housing SOLIDIT
                responde por:
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Daños directos causados por dolo o culpa grave de la Plataforma.</li>
                <li>Incumplimientos de las obligaciones explícitamente asumidas en estos Términos.</li>
                <li>Vulneraciones a sus derechos como consumidor conforme a la Ley 19.496.</li>
              </ul>

              <Subsection title="4.1 Responsabilidades que Housing SOLIDIT NO asume">
                <p>Conforme al marco legal vigente, la Plataforma <strong>no asume responsabilidad</strong> por:</p>
                <ul className="list-inside list-disc space-y-2 mt-2">
                  <li>
                    <strong>Fraudes de terceros:</strong> actos dolosos cometidos por corredores,
                    propietarios, arrendatarios u otras personas que utilicen la plataforma de
                    forma no autorizada o en contravención de estos Términos.
                  </li>
                  <li>
                    <strong>Exactitud de publicaciones:</strong> la veracidad, actualización y
                    exactitud de la información publicada por los corredores sobre las propiedades.
                  </li>
                  <li>
                    <strong>Negociaciones externas:</strong> comunicaciones, acuerdos o pagos
                    realizados fuera de los canales formales de la Plataforma y del corredor
                    certificado.
                  </li>
                  <li>
                    <strong>Daños indirectos o perjuicios económicos:</strong> pérdida de
                    ganancias, daño emergente o daño moral derivado del uso del sitio o de
                    contratos de arrendamiento celebrados entre usuarios, salvo dolo o culpa
                    grave de la Plataforma.
                  </li>
                  <li>
                    <strong>Disponibilidad continua:</strong> interrupciones de servicio por
                    mantenimiento, fuerza mayor o causas ajenas al control de la Plataforma.
                  </li>
                </ul>
              </Subsection>

              <Subsection title="4.2 Obligación del usuario de actuar con diligencia">
                <p>
                  El <LegalRef>artículo 3° letra b) de la Ley 19.496</LegalRef> reconoce
                  el derecho del consumidor a la libre elección pero también establece su
                  obligación de informarse. Al utilizar la Plataforma, usted reconoce que:
                </p>
                <ul className="list-inside list-disc space-y-1 mt-2">
                  <li>Ha leído y comprendido las advertencias anti-fraude de la Sección 3.</li>
                  <li>Actuará con la diligencia esperada de un contratante responsable (<LegalRef>Código Civil art. 1546</LegalRef> — buena fe contractual).</li>
                  <li>Verificará por sus propios medios la identidad de la contraparte antes de comprometer recursos económicos.</li>
                  <li>No responsabilizará a Housing SOLIDIT por perjuicios derivados de su propia negligencia.</li>
                </ul>
              </Subsection>
            </Section>

            <Section id="obligaciones" title="5. Obligaciones y conductas prohibidas del usuario">
              <p>
                Al acceder al sitio, usted se compromete a:
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Utilizar la Plataforma exclusivamente para búsqueda legítima de arriendos o consulta de su propio contrato.</li>
                <li>No publicar, distribuir ni reproducir información de la Plataforma con fines comerciales sin autorización.</li>
                <li>No intentar acceder a información de otros usuarios o manipular el sistema.</li>
                <li>No utilizar medios automatizados (bots, scrapers) para extraer datos de propiedades.</li>
                <li>No suplantar la identidad de corredores, propietarios u otros usuarios.</li>
              </ul>
              <p>
                El incumplimiento de estas obligaciones puede dar lugar a la suspensión del
                acceso, sin perjuicio de las acciones civiles y penales que correspondan
                conforme al <LegalRef>Código Civil art. 2314</LegalRef> y al Código Penal.
              </p>
            </Section>

            <Section id="datos" title="6. Tratamiento de datos personales">
              <p>
                Housing SOLIDIT trata datos personales conforme a la{" "}
                <LegalRef>Ley 21.719 de Protección de Datos Personales</LegalRef>{" "}
                (en vigor desde el 1 de diciembre de 2026) y al{" "}
                <LegalRef>artículo 19 N°4 de la Constitución Política</LegalRef>.
              </p>
              <Subsection title="6.1 Datos que se recopilan en el sitio público">
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    <strong>Marketplace:</strong> no se recopilan datos personales para la
                    mera navegación. No se utilizan cookies de seguimiento publicitario.
                  </li>
                  <li>
                    <strong>Portal de autoconsulta:</strong> se solicita RUT para verificar
                    identidad. El tratamiento tiene base legal en la ejecución del contrato
                    de arrendamiento (art. 13 letra b Ley 21.719).
                  </li>
                </ul>
              </Subsection>
              <Subsection title="6.2 Sus derechos">
                <p>Usted tiene derecho a acceder, rectificar, suprimir y oponerse al tratamiento
                de sus datos personales, así como a la portabilidad conforme al{" "}
                <LegalRef>Título IV de la Ley 21.719</LegalRef>. Para ejercerlos:
                contacte a <strong>{EMAIL_CONTACTO}</strong>.</p>
              </Subsection>
              <Subsection title="6.3 Seguridad">
                <p>Aplicamos medidas técnicas y organizativas conforme al estándar OWASP Top 10
                2021 y a las directrices del <LegalRef>NIST SP 800-53</LegalRef>. Las comunicaciones
                se cifran en tránsito (TLS 1.3) y los datos sensibles en reposo.</p>
              </Subsection>
            </Section>

            <Section id="propiedad" title="7. Propiedad intelectual">
              <p>
                El nombre «Housing SOLIDIT», el logotipo, el diseño del sitio y todos los
                contenidos desarrollados por la Plataforma son propiedad de {RAZON_SOCIAL}
                y están protegidos por la <LegalRef>Ley 17.336 de Propiedad Intelectual</LegalRef>.
                Queda prohibida su reproducción, distribución o modificación sin autorización
                expresa y escrita.
              </p>
              <p>
                Las imágenes y descripción de propiedades son aportadas por los corredores y
                son de su exclusiva responsabilidad. Housing SOLIDIT actúa como mero repositorio
                y no garantiza la propiedad intelectual de dichos contenidos.
              </p>
            </Section>

            <Section id="modificaciones" title="8. Modificaciones de los Términos">
              <p>
                Housing SOLIDIT puede modificar estos Términos en cualquier momento. Las
                modificaciones entrarán en vigor a los <strong>15 días hábiles</strong>{" "}
                de su publicación en esta página, conforme al{" "}
                <LegalRef>artículo 17 B de la Ley 19.496</LegalRef>.
              </p>
              <p>
                La continuación del uso del sitio después de la entrada en vigor de las
                modificaciones implica su aceptación. Si no está de acuerdo con los cambios,
                debe dejar de utilizar la Plataforma y, si corresponde, ejercer los derechos
                de retracto que le reconoce la Ley 19.496.
              </p>
            </Section>

            <Section id="ley" title="9. Ley aplicable y jurisdicción">
              <p>
                Los presentes Términos se rigen exclusivamente por las leyes de la{" "}
                <strong>República de Chile</strong>. Para la resolución de conflictos,
                las partes se someten a la competencia de los tribunales ordinarios de
                justicia del <strong>Primer Juzgado de Letras de Santiago</strong>,
                sin perjuicio del derecho del consumidor de recurrir a los tribunales
                de su domicilio conforme al{" "}
                <LegalRef>artículo 50 A de la Ley 19.496</LegalRef>.
              </p>
              <p>
                También puede recurrir a <strong>SERNAC</strong> (www.sernac.cl · 800 700 100)
                para mediación gratuita en conflictos de consumo digital, conforme a la{" "}
                <LegalRef>Ley 19.496 art. 58 y ss.</LegalRef>.
              </p>
            </Section>

            <Section id="contacto" title="10. Contacto y canal de denuncias">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Mail,  label: "Correo legal", value: EMAIL_CONTACTO },
                  { icon: Phone, label: "Teléfono",    value: TELEFONO       },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl p-4"
                    style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
                  >
                    <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--pf-purple)" }} aria-hidden />
                    <div>
                      <p className="text-xs" style={{ color: "var(--pf-text-muted)" }}>{label}</p>
                      <p className="font-semibold" style={{ color: "var(--pf-navy)" }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm" style={{ color: "var(--pf-text-muted)" }}>
                Para reportar publicaciones o corredores sospechosos, escriba a{" "}
                <strong>{EMAIL_CONTACTO}</strong> indicando el enlace de la publicación
                y una descripción del motivo de la sospecha. Investigaremos en un plazo
                máximo de <strong>5 días hábiles</strong>.
              </p>
            </Section>

            {/* Pie legal */}
            <div
              className="mt-10 rounded-2xl p-6 text-center text-sm"
              style={{
                background: "var(--pf-surface)",
                border: "1px solid var(--pf-border)",
                color: "var(--pf-text-muted)",
              }}
            >
              <ShieldCheck className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--pf-success-check)" }} aria-hidden />
              <p>
                Estos términos cumplen con la normativa vigente en Chile al{" "}
                <strong>{ULTIMA_ACTUALIZACION}</strong>. No constituyen asesoría legal.
                Para situaciones específicas, consulte a un abogado.
              </p>
              <p className="mt-2">
                <Link href="/marketplace" className="underline hover:no-underline" style={{ color: "var(--pf-purple)" }}>
                  ← Volver al marketplace
                </Link>
              </p>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
