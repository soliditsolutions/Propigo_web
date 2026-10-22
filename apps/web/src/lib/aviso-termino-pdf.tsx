/**
 * Aviso de término de contrato de arriendo en PDF (L-CM2, L-CM3).
 *
 * Formaliza el término: deja por escrito la causal, la fecha y —cuando el
 * arrendador desahucia— el plazo de restitución que le corresponde al
 * arrendatario por la Ley 18.101 (Art. 3), calculado desde la notificación.
 *
 * Lleva la advertencia obligatoria (L-CM3): este documento NO surte efecto legal
 * por sí solo ni por correo. El desahucio, para ser oponible, debe notificarse
 * judicialmente o por un notario. El aviso es la comunicación de gestión, no la
 * notificación legal.
 */
import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { Text } from "./pdf-base";
import { formatRut } from "./rut";
import { plazoRestitucionDesahucio } from "@propigo/core";
import type { CausalTermino } from "@/generated/prisma/enums";

/** Cómo se redacta cada causal en el aviso. */
const CAUSAL_TEXTO: Record<CausalTermino, string> = {
  mutuo_acuerdo:                 "por mutuo acuerdo de las partes",
  vencimiento_plazo:             "por vencimiento del plazo pactado",
  desahucio_arrendador:          "por desahucio del arrendador",
  desahucio_arrendatario:        "por aviso de término del arrendatario",
  no_pago_renta:                 "por no pago de la renta (Art. 1977 del Código Civil)",
  incumplimiento_contrato:       "por incumplimiento de las obligaciones del contrato",
  destruccion_inmueble:          "por destrucción o inhabitabilidad del inmueble",
  expiracion_derecho_arrendador: "por extinción del derecho del arrendador sobre el inmueble",
  otra:                          "por la causal indicada por la corredora",
};

export type AvisoTerminoData = {
  emisor: { nombre: string; rut: string; giro: string | null; direccion: string | null };
  arrendatario: { nombre: string; rut: string };
  propietario: { nombre: string; rut: string };
  inmueble: { direccion: string; comuna: string | null; rol: string };
  causal: CausalTermino;
  fechaTermino: Date;
  fechaInicio: Date;
  /** Solo en desahucios; null en las demás causales. */
  fechaNotificacionDesahucio: Date | null;
  generadoEl: Date;
};

const styles = StyleSheet.create({
  page: { padding: "56 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.5, color: "#1a1a1a" },
  emisorNombre: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  emisorLinea: { fontSize: 9, color: "#4b5563" },
  fechaLugar: { fontSize: 9, color: "#4b5563", textAlign: "right", marginBottom: 18 },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 8, marginBottom: 18, textTransform: "uppercase" },
  parrafo: { marginBottom: 10, textAlign: "justify" },
  bold: { fontFamily: "Helvetica-Bold" },
  plazoBox: { marginVertical: 8, padding: 10, border: "1 solid #1a1a1a" },
  aviso: { marginTop: 16, padding: 10, border: "1 solid #b45309", backgroundColor: "#fef3c7" },
  avisoText: { fontSize: 9, color: "#92400e" },
  firma: { marginTop: 48 },
  firmaLinea: { borderTop: "1 solid #1a1a1a", width: "50%", marginTop: 40, marginBottom: 4 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6 },
});

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function AvisoTerminoDocument({ data }: { data: AvisoTerminoData }) {
  const d = data;
  const esDesahucioArrendador = d.causal === "desahucio_arrendador";
  // El plazo de restitución solo se calcula en el desahucio del arrendador y si
  // hay fecha de notificación; en las demás causales no aplica.
  const plazo = esDesahucioArrendador && d.fechaNotificacionDesahucio
    ? plazoRestitucionDesahucio(d.fechaInicio, d.fechaNotificacionDesahucio)
    : null;

  return (
    <Document title={`Aviso de término — ${d.inmueble.direccion}`}>
      <Page size="A4" style={styles.page} wrap>
        <View>
          <Text style={styles.emisorNombre}>{d.emisor.nombre}</Text>
          <Text style={styles.emisorLinea}>RUT {formatRut(d.emisor.rut)}</Text>
          {d.emisor.giro ? <Text style={styles.emisorLinea}>{d.emisor.giro}</Text> : null}
          {d.emisor.direccion ? <Text style={styles.emisorLinea}>{d.emisor.direccion}</Text> : null}
        </View>
        <Text style={styles.fechaLugar}>{fechaLarga(d.generadoEl)}</Text>

        <Text style={styles.titulo}>Aviso de término de contrato de arriendo</Text>

        <Text style={styles.parrafo}>
          Por el presente, se comunica a <Text style={styles.bold}>{d.arrendatario.nombre}</Text>,
          RUT {formatRut(d.arrendatario.rut)}, en su calidad de arrendatario del inmueble
          ubicado en <Text style={styles.bold}>{d.inmueble.direccion}
          {d.inmueble.comuna ? `, ${d.inmueble.comuna}` : ""}</Text> (Rol de Avalúo
          N° {d.inmueble.rol}), que el contrato de arriendo celebrado con
          {" "}<Text style={styles.bold}>{d.propietario.nombre}</Text>, RUT {formatRut(d.propietario.rut)},
          se da por terminado <Text style={styles.bold}>{CAUSAL_TEXTO[d.causal]}</Text>,
          con fecha <Text style={styles.bold}>{fechaLarga(d.fechaTermino)}</Text>.
        </Text>

        {d.fechaNotificacionDesahucio ? (
          <Text style={styles.parrafo}>
            El desahucio fue notificado con fecha{" "}
            <Text style={styles.bold}>{fechaLarga(d.fechaNotificacionDesahucio)}</Text>.
          </Text>
        ) : null}

        {plazo ? (
          <View style={styles.plazoBox}>
            <Text style={styles.parrafo}>
              De acuerdo con el Art. 3 de la Ley 18.101, considerando{" "}
              <Text style={styles.bold}>{plazo.aniosOcupados} {plazo.aniosOcupados === 1 ? "año completo" : "años completos"}</Text>{" "}
              de ocupación, el arrendatario dispone de un plazo de{" "}
              <Text style={styles.bold}>{plazo.mesesPlazo} {plazo.mesesPlazo === 1 ? "mes" : "meses"}</Text>{" "}
              contado desde la notificación para restituir el inmueble, esto es, a más tardar el{" "}
              <Text style={styles.bold}>{fechaLarga(plazo.fechaRestitucion)}</Text>.
              {plazo.alcanzoTope ? " Este plazo corresponde al máximo legal de seis meses." : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.aviso}>
          <Text style={styles.avisoText}>
            Importante: este aviso es una comunicación de gestión y no surte efecto
            legal por sí solo ni por correo electrónico. Para ser oponible, el
            desahucio o el término debe notificarse judicialmente o mediante notario,
            conforme a la Ley 18.101.
          </Text>
        </View>

        <View style={styles.firma}>
          <View style={styles.firmaLinea} />
          <Text>{d.emisor.nombre}</Text>
          <Text style={styles.emisorLinea}>Por el arrendador</Text>
        </View>

        <Text style={styles.footer}>
          Documento generado por {d.emisor.nombre} el {fechaLarga(d.generadoEl)}.
        </Text>
      </Page>
    </Document>
  );
}
