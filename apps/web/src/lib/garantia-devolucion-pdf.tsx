/**
 * Comprobante de devolución de garantía en PDF (L-CM5).
 *
 * La "boleta" del cierre: la garantía recibida, su reajuste, cada retención con
 * su motivo, y lo que se devuelve. Se dibuja al vuelo desde el snapshot del
 * voucher de garantía (L-CP7) — el archivo es representación, el snapshot es el dato.
 */
import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { Text } from "./pdf-base";
import { formatRut } from "./rut";
import { PIE_COMPROBANTE, type SnapshotGarantia } from "./comprobante";

const styles = StyleSheet.create({
  page: { padding: "48 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  emisorNombre: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  emisorLinea: { fontSize: 9, color: "#4b5563" },
  fecha: { fontSize: 9, color: "#4b5563", textAlign: "right" },
  folio: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 10, marginBottom: 14, textTransform: "uppercase" },
  divisor: { borderTop: "0.5 solid #d1d5db", marginVertical: 8 },
  seccion: { marginBottom: 10 },
  seccionTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 3 },
  dosCol: { flexDirection: "row", justifyContent: "space-between" },
  col: { width: "48%" },
  linea: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 4, paddingHorizontal: 6, marginBottom: 2, marginTop: 4 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#64748b", textTransform: "uppercase" },
  fila: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottom: "0.5 solid #e2e8f0" },
  cMotivo: { width: "70%" },
  cMonto: { width: "30%", textAlign: "right" },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1 solid #1a1a1a" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValor: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  aviso: { marginTop: 10, padding: 8, backgroundColor: "#fef3c7", fontSize: 9, color: "#92400e" },
  nota: { marginTop: 14, fontSize: 9, color: "#4b5563", textAlign: "justify" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6 },
});

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function fechaLarga(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

const CAUSAL_LABEL: Record<string, string> = {
  vencimiento_plazo: "vencimiento del plazo pactado",
  mutuo_acuerdo: "mutuo acuerdo de las partes",
  desahucio_arrendatario: "aviso de término del arrendatario",
  desahucio_arrendador: "aviso de término del arrendador",
  no_pago_renta: "no pago de la renta",
  incumplimiento_contrato: "incumplimiento de contrato",
  destruccion_inmueble: "destrucción o inhabitabilidad del inmueble",
  expiracion_derecho_arrendador: "extinción del derecho del arrendador",
  otra: "otra causal",
};

export function DevolucionGarantiaDocument({ snapshot }: { snapshot: SnapshotGarantia }) {
  const s = snapshot;
  return (
    <Document title={`Devolución de garantía — ${s.folio}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.emisorNombre}>{s.emisor.nombre}</Text>
            <Text style={styles.emisorLinea}>RUT {formatRut(s.emisor.rut)}</Text>
            {s.emisor.giro ? <Text style={styles.emisorLinea}>{s.emisor.giro}</Text> : null}
            {s.emisor.direccion ? <Text style={styles.emisorLinea}>{s.emisor.direccion}</Text> : null}
          </View>
          <View>
            <Text style={styles.folio}>{s.folio}</Text>
            <Text style={styles.fecha}>{fechaLarga(s.fecha)}</Text>
          </View>
        </View>

        <Text style={styles.titulo}>Comprobante de devolución de garantía</Text>

        <View style={styles.seccion}>
          <View style={styles.dosCol}>
            <View style={styles.col}>
              <Text style={styles.seccionTitulo}>Arrendatario</Text>
              <Text>{s.arrendatario.nombre}</Text>
              <Text style={styles.emisorLinea}>RUT {formatRut(s.arrendatario.rut)}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.seccionTitulo}>Propietario</Text>
              <Text>{s.propietario.nombre}</Text>
              <Text style={styles.emisorLinea}>RUT {formatRut(s.propietario.rut)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.seccionTitulo}>Inmueble</Text>
            <Text>{s.inmueble.direccion}{s.inmueble.comuna ? `, ${s.inmueble.comuna}` : ""}</Text>
            <Text style={styles.emisorLinea}>Rol de Avalúo N° {s.inmueble.rol}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.seccionTitulo}>Cierre del contrato</Text>
            <Text>
              Término {s.tipoTermino === "anticipado" ? "anticipado" : "normal"} el {fechaLarga(s.fechaTermino)}
              {" "}por {CAUSAL_LABEL[s.causalTermino] ?? s.causalTermino}.
            </Text>
          </View>
        </View>

        <View style={styles.divisor} />

        <View style={styles.seccion}>
          <View style={styles.linea}>
            <Text>Garantía recibida al inicio del contrato</Text>
            <Text>{clp(s.garantiaRecibidaClp)}</Text>
          </View>
          {s.garantiaDenominacion === "UF" && s.garantiaMontoBase != null ? (
            <Text style={styles.emisorLinea}>Pactada en {s.garantiaMontoBase} UF.</Text>
          ) : null}
          {s.reajusteClp !== 0 ? (
            <View style={styles.linea}>
              <Text>Reajuste UF a la fecha de restitución (Art. 21, Ley 18.101)</Text>
              <Text>{s.reajusteClp > 0 ? "+" : "−"} {clp(Math.abs(s.reajusteClp))}</Text>
            </View>
          ) : null}
          <View style={[styles.linea, { borderTop: "0.5 solid #d1d5db", marginTop: 3, paddingTop: 3 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Garantía a restituir</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{clp(s.garantiaDisponibleClp)}</Text>
          </View>
        </View>

        {s.retenciones.length > 0 ? (
          <>
            <View style={styles.th}>
              <Text style={[styles.thText, styles.cMotivo]}>Retención — motivo</Text>
              <Text style={[styles.thText, styles.cMonto]}>Monto</Text>
            </View>
            {s.retenciones.map((r, i) => (
              <View key={i} style={styles.fila}>
                <Text style={styles.cMotivo}>{r.descripcion}</Text>
                <Text style={styles.cMonto}>− {clp(r.montoClp)}</Text>
              </View>
            ))}
            <View style={styles.linea}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total retenciones</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>− {clp(s.retencionesTotalClp)}</Text>
            </View>
          </>
        ) : (
          <Text style={{ marginVertical: 4 }}>Sin retenciones: la garantía se devuelve íntegra.</Text>
        )}

        <View style={styles.totalFila}>
          <Text style={styles.totalLabel}>Se devuelve al arrendatario</Text>
          <Text style={styles.totalValor}>{clp(s.devolucionClp)}</Text>
        </View>

        {s.saldoPendienteArrendatarioClp > 0 ? (
          <View style={styles.aviso}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              Saldo pendiente de pago del arrendatario: {clp(s.saldoPendienteArrendatarioClp)}
            </Text>
            <Text style={{ marginTop: 2 }}>
              Las retenciones superan el monto de la garantía. Este saldo no se descuenta
              de la garantía —ya agotada— y su pago se gestiona directamente entre las partes.
            </Text>
          </View>
        ) : null}

        <Text style={styles.nota}>
          Este comprobante detalla la liquidación de la garantía de arrendamiento al término
          del contrato, con el motivo de cada retención, conforme a lo pactado entre las partes.
          Los montos en UF se reajustan a la unidad de la fecha de restitución (Art. 21, Ley 18.101).
        </Text>

        <Text style={styles.footer}>
          Documento emitido por {s.emisor.nombre}. {PIE_COMPROBANTE}
        </Text>
      </Page>
    </Document>
  );
}
