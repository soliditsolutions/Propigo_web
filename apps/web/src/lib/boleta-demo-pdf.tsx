/**
 * Boleta de suscripción — DOCUMENTO DE EJEMPLO.
 *
 * No hay pasarela de pago conectada todavía (ADR-0014, Fase B en curso: sin
 * adaptador real de gateway, sin checkout, `Tenant.plan` sigue siendo un
 * string editado a mano). Esta boleta nunca representó un cobro real, así
 * que lleva la advertencia igual de visible que el resto de los documentos
 * legales del proyecto — nunca un documento ambiguo sobre su propia validez.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatRut } from "./rut";
import { clp } from "./format";

export type BoletaDemoData = {
  tenant: { nombre: string; rut: string | null };
  planNombre: string;
  periodoLabel: string;
  fechaEmision: Date;
  montoUf: number;
  netoClp: number;
  ivaClp: number;
  totalClp: number;
  valorUfClp: number;
};

const styles = StyleSheet.create({
  page: { padding: "56 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.5, color: "#1a1a1a" },
  marcaAgua: {
    position: "absolute", top: 260, left: -60, width: 700, textAlign: "center",
    fontSize: 46, fontFamily: "Helvetica-Bold", color: "#ef4444", opacity: 0.14,
    transform: "rotate(-28deg)",
  },
  avisoTop: { marginBottom: 20, padding: 10, border: "1 solid #b45309", backgroundColor: "#fef3c7" },
  avisoTopText: { fontSize: 9, color: "#92400e", fontFamily: "Helvetica-Bold" },
  emisorNombre: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  emisorLinea: { fontSize: 9, color: "#4b5563" },
  fechaLugar: { fontSize: 9, color: "#4b5563", textAlign: "right", marginBottom: 18 },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 8, marginBottom: 18, textTransform: "uppercase" },
  tabla: { marginTop: 12, border: "1 solid #d1d5db" },
  filaHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1 solid #d1d5db" },
  fila: { flexDirection: "row", borderBottom: "0.5 solid #e5e7eb" },
  celda: { padding: 8, fontSize: 9 },
  celdaConcepto: { flex: 3 },
  celdaMonto: { flex: 1, textAlign: "right" },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  totalFila: { flexDirection: "row", borderTop: "1 solid #1a1a1a", marginTop: 4, paddingTop: 6 },
  totalLabel: { flex: 3, fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "right", paddingRight: 8 },
  totalMonto: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "right" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6 },
});

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function BoletaDemoDocument({ data: d }: { data: BoletaDemoData }) {
  return (
    <Document title={`Boleta de ejemplo — ${d.periodoLabel}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.marcaAgua} fixed>EJEMPLO</Text>

        <View style={styles.avisoTop}>
          <Text style={styles.avisoTopText}>
            DOCUMENTO DE EJEMPLO — no es una boleta ni factura válida ante el SII.
          </Text>
          <Text style={{ fontSize: 8, color: "#92400e", marginTop: 3 }}>
            Housing SOLIDIT todavía no tiene una pasarela de pago real conectada para
            cobrar la suscripción de tu cuenta (ver ADR-0014). Ningún cobro descrito
            acá ocurrió de verdad — esta vista previa existe solo para mostrar cómo se
            verá el historial de pagos una vez que la facturación esté activa.
          </Text>
        </View>

        <View>
          <Text style={styles.emisorNombre}>Housing SOLIDIT</Text>
          <Text style={styles.emisorLinea}>Software de administración de arriendos</Text>
        </View>
        <Text style={styles.fechaLugar}>{fechaLarga(d.fechaEmision)}</Text>

        <Text style={styles.titulo}>Boleta de suscripción (ejemplo) — {d.periodoLabel}</Text>

        <View>
          <Text style={styles.emisorLinea}>Cliente: {d.tenant.nombre}</Text>
          {d.tenant.rut && <Text style={styles.emisorLinea}>RUT: {formatRut(d.tenant.rut)}</Text>}
        </View>

        <View style={styles.tabla}>
          <View style={styles.filaHeader}>
            <Text style={[styles.celda, styles.celdaConcepto, styles.headerText]}>Concepto</Text>
            <Text style={[styles.celda, styles.celdaMonto, styles.headerText]}>Monto</Text>
          </View>
          <View style={styles.fila}>
            <Text style={[styles.celda, styles.celdaConcepto]}>
              Suscripción {d.planNombre} — {d.periodoLabel} ({d.montoUf.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF a ${d.valorUfClp.toLocaleString("es-CL")})
            </Text>
            <Text style={[styles.celda, styles.celdaMonto]}>{clp(d.netoClp)}</Text>
          </View>
          <View style={styles.fila}>
            <Text style={[styles.celda, styles.celdaConcepto]}>IVA (19%)</Text>
            <Text style={[styles.celda, styles.celdaMonto]}>{clp(d.ivaClp)}</Text>
          </View>
        </View>

        <View style={styles.totalFila}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalMonto}>{clp(d.totalClp)}</Text>
        </View>

        <Text style={styles.footer}>
          Documento de ejemplo generado el {fechaLarga(d.fechaEmision)}. No representa un
          cobro real ni un documento tributario electrónico.
        </Text>
      </Page>
    </Document>
  );
}
