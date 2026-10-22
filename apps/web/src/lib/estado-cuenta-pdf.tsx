/**
 * Estado de cuenta de deuda en PDF (L-CM1).
 *
 * El documento que respalda la demanda monitoria: cada deuda con su forma
 * (arriendo / gasto común / mora), su fecha (vencimiento del período) y su lugar
 * (el inmueble). Se arma desde el estado de cuenta ya calculado (lib/estado-cuenta).
 */
import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { Text } from "./pdf-base";
import { formatRut } from "./rut";
import type { EstadoCuenta } from "./estado-cuenta";

export type EstadoCuentaData = {
  emisor: { nombre: string; rut: string; giro: string | null; direccion: string | null };
  arrendatario: { nombre: string; rut: string };
  propietario: { nombre: string; rut: string };
  inmueble: { direccion: string; comuna: string | null; rol: string };
  estadoCuenta: EstadoCuenta;
};

const styles = StyleSheet.create({
  page: { padding: "48 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  emisorNombre: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  emisorLinea: { fontSize: 9, color: "#4b5563" },
  fecha: { fontSize: 9, color: "#4b5563", textAlign: "right" },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 10, marginBottom: 14, textTransform: "uppercase" },
  divisor: { borderTop: "0.5 solid #d1d5db", marginVertical: 8 },
  seccion: { marginBottom: 10 },
  seccionTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 3 },
  dosCol: { flexDirection: "row", justifyContent: "space-between" },
  col: { width: "48%" },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 4, paddingHorizontal: 6, marginBottom: 2 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#64748b", textTransform: "uppercase" },
  fila: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottom: "0.5 solid #e2e8f0" },
  cConcepto: { width: "55%" },
  cFecha: { width: "22%" },
  cMonto: { width: "23%", textAlign: "right" },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1 solid #1a1a1a" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValor: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  nota: { marginTop: 14, fontSize: 9, color: "#4b5563", textAlign: "justify" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6 },
});

function clp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fechaCorta(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}
function fechaLarga(d: Date): string {
  const m = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getUTCDate()} de ${m[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function EstadoCuentaDocument({ data }: { data: EstadoCuentaData }) {
  const d = data;
  const ec = d.estadoCuenta;
  return (
    <Document title={`Estado de cuenta — ${d.inmueble.direccion}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.emisorNombre}>{d.emisor.nombre}</Text>
            <Text style={styles.emisorLinea}>RUT {formatRut(d.emisor.rut)}</Text>
            {d.emisor.giro ? <Text style={styles.emisorLinea}>{d.emisor.giro}</Text> : null}
            {d.emisor.direccion ? <Text style={styles.emisorLinea}>{d.emisor.direccion}</Text> : null}
          </View>
          <Text style={styles.fecha}>Al {fechaLarga(ec.fechaCorte)}</Text>
        </View>

        <Text style={styles.titulo}>Estado de cuenta de deuda</Text>

        <View style={styles.seccion}>
          <View style={styles.dosCol}>
            <View style={styles.col}>
              <Text style={styles.seccionTitulo}>Deudor (arrendatario)</Text>
              <Text>{d.arrendatario.nombre}</Text>
              <Text style={styles.emisorLinea}>RUT {formatRut(d.arrendatario.rut)}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.seccionTitulo}>Acreedor (propietario)</Text>
              <Text>{d.propietario.nombre}</Text>
              <Text style={styles.emisorLinea}>RUT {formatRut(d.propietario.rut)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.seccionTitulo}>Inmueble (lugar en que se contrajo la deuda)</Text>
            <Text>
              {d.inmueble.direccion}{d.inmueble.comuna ? `, ${d.inmueble.comuna}` : ""}
            </Text>
            <Text style={styles.emisorLinea}>Rol de Avalúo N° {d.inmueble.rol}</Text>
          </View>
        </View>

        <View style={styles.divisor} />

        <View style={styles.th}>
          <Text style={[styles.thText, styles.cConcepto]}>Concepto</Text>
          <Text style={[styles.thText, styles.cFecha]}>Vencimiento</Text>
          <Text style={[styles.thText, styles.cMonto]}>Monto</Text>
        </View>
        {ec.lineas.map((l, i) => (
          <View key={i} style={styles.fila}>
            <Text style={styles.cConcepto}>{l.descripcion}</Text>
            <Text style={styles.cFecha}>{fechaCorta(l.fechaVencimiento)}</Text>
            <Text style={styles.cMonto}>{clp(l.montoClp)}</Text>
          </View>
        ))}

        <View style={styles.totalFila}>
          <Text style={styles.totalLabel}>Total adeudado</Text>
          <Text style={styles.totalValor}>{clp(ec.totalClp)}</Text>
        </View>

        <Text style={styles.nota}>
          El presente estado de cuenta detalla la forma, fecha y lugar en que se
          contrajo cada obligación adeudada, conforme a lo exigido por el
          procedimiento monitorio de la Ley 21.461. Los montos se encuentran
          calculados al {fechaLarga(ec.fechaCorte)} e incluyen los intereses por
          mora devengados a esa fecha.
        </Text>

        <Text style={styles.footer}>
          Documento de gestión emitido por {d.emisor.nombre}. No constituye documento tributario.
        </Text>
      </Page>
    </Document>
  );
}
