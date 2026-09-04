/**
 * Comprobante de pago y liquidación en PDF (L-CP5, L-CP6, L-CP10).
 *
 * El documento se arma **desde el snapshot** del voucher, nunca desde las tablas
 * vivas (L-CP7): así el comprobante de un mes pasado sigue mostrando el RUT, la
 * dirección y los montos que tenía cuando se emitió, aunque hoy hayan cambiado.
 * Por eso este componente recibe el snapshot ya construido y solo lo dibuja.
 *
 * Lleva el pie obligatorio (L-CP10): es un comprobante de gestión de la
 * corredora, no un documento tributario. El DTE lo emite el SII por otra vía.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatRut } from "./rut";
import { PIE_COMPROBANTE, type SnapshotPago, type SnapshotLiquidacion } from "./comprobante";

const styles = StyleSheet.create({
  page: { padding: "48 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  emisorNombre: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  emisorLinea: { fontSize: 9, color: "#4b5563" },
  folioBox: { textAlign: "right" },
  folioLabel: { fontSize: 8, color: "#6b7280" },
  folioValor: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 10, marginBottom: 14, textTransform: "uppercase" },
  divisor: { borderTop: "0.5 solid #d1d5db", marginVertical: 8 },
  seccion: { marginBottom: 10 },
  seccionTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", marginBottom: 3 },
  fila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  filaLabel: { color: "#4b5563" },
  filaValor: { fontFamily: "Helvetica-Bold" },
  dosCol: { flexDirection: "row", justifyContent: "space-between" },
  col: { width: "48%" },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1 solid #1a1a1a" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValor: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  ajusteFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  footer: {
    position: "absolute", bottom: 28, left: 56, right: 56,
    fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6,
  },
});

/** Formatea un entero como pesos chilenos: 450000 → "$450.000". */
function clp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function fechaLarga(iso: string): string {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const d = new Date(iso);
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaLabel}>{label}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  );
}

function Encabezado({ snap }: { snap: SnapshotPago | SnapshotLiquidacion }) {
  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.emisorNombre}>{snap.emisor.nombre}</Text>
          <Text style={styles.emisorLinea}>RUT {formatRut(snap.emisor.rut)}</Text>
          {snap.emisor.giro ? <Text style={styles.emisorLinea}>{snap.emisor.giro}</Text> : null}
          {snap.emisor.direccion ? <Text style={styles.emisorLinea}>{snap.emisor.direccion}</Text> : null}
        </View>
        <View style={styles.folioBox}>
          <Text style={styles.folioLabel}>Folio</Text>
          <Text style={styles.folioValor}>{snap.folio}</Text>
          <Text style={styles.emisorLinea}>{fechaLarga(snap.fecha)}</Text>
        </View>
      </View>
    </View>
  );
}

function Partes({ snap }: { snap: SnapshotPago | SnapshotLiquidacion }) {
  return (
    <View style={styles.seccion}>
      <View style={styles.dosCol}>
        <View style={styles.col}>
          <Text style={styles.seccionTitulo}>Arrendatario</Text>
          <Text>{snap.arrendatario.nombre}</Text>
          <Text style={styles.emisorLinea}>RUT {formatRut(snap.arrendatario.rut)}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.seccionTitulo}>Propietario</Text>
          <Text>{snap.propietario.nombre}</Text>
          <Text style={styles.emisorLinea}>RUT {formatRut(snap.propietario.rut)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 8 }}>
        <Text style={styles.seccionTitulo}>Inmueble</Text>
        <Text>
          {snap.inmueble.direccion}
          {snap.inmueble.comuna ? `, ${snap.inmueble.comuna}` : ""}
        </Text>
        <Text style={styles.emisorLinea}>
          Rol de Avalúo N° {snap.inmueble.rol}
          {snap.inmueble.avaluoFiscalClp != null ? ` · Avalúo fiscal ${clp(snap.inmueble.avaluoFiscalClp)}` : ""}
        </Text>
      </View>
    </View>
  );
}

function Pie() {
  return <Text style={styles.footer}>{PIE_COMPROBANTE}</Text>;
}

function ComprobantePago({ snap }: { snap: SnapshotPago }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Encabezado snap={snap} />
      <Text style={styles.titulo}>Comprobante de pago</Text>
      <Partes snap={snap} />
      <View style={styles.divisor} />
      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Detalle del período {snap.periodoNumero}</Text>
        <Fila label="Arriendo" valor={clp(snap.arriendoClp)} />
        {snap.montoGastoComunClp > 0 ? <Fila label="Gasto común" valor={clp(snap.montoGastoComunClp)} /> : null}
        {snap.interesClp > 0 ? (
          <Fila label={`Interés por mora (${snap.diasAtraso} días)`} valor={clp(snap.interesClp)} />
        ) : null}
        {snap.ajustes.map((a, i) => (
          <View key={i} style={styles.ajusteFila}>
            <Text style={styles.filaLabel}>{a.descripcion}</Text>
            <Text style={styles.filaValor}>{clp(a.montoClp)}</Text>
          </View>
        ))}
        <View style={styles.totalFila}>
          <Text style={styles.totalLabel}>Total pagado</Text>
          <Text style={styles.totalValor}>{clp(snap.totalClp)}</Text>
        </View>
      </View>
      <Pie />
    </Page>
  );
}

function ComprobanteLiquidacion({ snap }: { snap: SnapshotLiquidacion }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Encabezado snap={snap} />
      <Text style={styles.titulo}>Liquidación al propietario</Text>
      <Partes snap={snap} />
      <View style={styles.divisor} />
      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Distribución del período {snap.periodoNumero}</Text>
        <Fila label="Arriendo recaudado" valor={clp(snap.arriendoClp)} />
        <Fila label="Comisión corredora" valor={`- ${clp(snap.comisionClp)}`} />
        {snap.comisionAfectaIva ? (
          <Fila label="IVA de la comisión (19%)" valor={`- ${clp(snap.ivaComisionClp)}`} />
        ) : (
          <View style={styles.ajusteFila}>
            <Text style={styles.filaLabel}>IVA de la comisión</Text>
            <Text style={styles.emisorLinea}>Exenta (Art. 12° E N°8 LIVS)</Text>
          </View>
        )}
        {snap.ajustes.map((a, i) => (
          <View key={i} style={styles.ajusteFila}>
            <Text style={styles.filaLabel}>{a.descripcion}</Text>
            <Text style={styles.filaValor}>- {clp(a.montoClp)}</Text>
          </View>
        ))}
        <View style={styles.totalFila}>
          <Text style={styles.totalLabel}>Neto al propietario</Text>
          <Text style={styles.totalValor}>{clp(snap.netoPropietarioClp)}</Text>
        </View>
      </View>
      <Pie />
    </Page>
  );
}

/**
 * Documento del comprobante, decidido por el `tipo` del snapshot. Un tipo
 * desconocido no debe generar un PDF vacío en silencio: lanza, y la ruta lo
 * traduce a un error visible.
 */
export function ComprobantePdfDocument({ snapshot }: { snapshot: SnapshotPago | SnapshotLiquidacion }) {
  const titulo = `${snapshot.tipo === "pago" ? "Comprobante de pago" : "Liquidación"} ${snapshot.folio}`;
  if (snapshot.tipo === "pago") {
    return <Document title={titulo}><ComprobantePago snap={snapshot} /></Document>;
  }
  if (snapshot.tipo === "liquidacion") {
    return <Document title={titulo}><ComprobanteLiquidacion snap={snapshot} /></Document>;
  }
  throw new Error(`Tipo de comprobante desconocido: ${(snapshot as { tipo: string }).tipo}`);
}
