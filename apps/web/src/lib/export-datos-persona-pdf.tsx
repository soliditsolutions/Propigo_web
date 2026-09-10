/**
 * Derecho de acceso — copia legible de los datos personales (L-DP2).
 *
 * La entrega "intelligible" que exige el derecho de acceso: el mismo contenido
 * que el JSON de portabilidad, pero en un PDF que la persona pueda leer sin
 * herramientas. Se dibuja al vuelo desde `ExportDatosPersona`.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatRut } from "./rut";
import type { ExportDatosPersona } from "./export-datos-persona";

const styles = StyleSheet.create({
  page: { padding: "44 52", fontSize: 9.5, fontFamily: "Helvetica", lineHeight: 1.4, color: "#1a1a1a" },
  h1: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 8.5, color: "#4b5563" },
  meta: { fontSize: 8.5, color: "#4b5563", marginTop: 6, textAlign: "justify" },
  divisor: { borderTop: "0.5 solid #d1d5db", marginVertical: 10 },
  secTitulo: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5, textTransform: "uppercase", color: "#111827" },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: "34%", color: "#6b7280" },
  valor: { width: "66%" },
  vacio: { fontSize: 8.5, color: "#9ca3af" },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 3, paddingHorizontal: 5, marginBottom: 2, marginTop: 3 },
  thText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#64748b", textTransform: "uppercase" },
  td: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 5, borderBottom: "0.5 solid #e5e7eb" },
  cardTitulo: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  footer: { position: "absolute", bottom: 24, left: 52, right: 52, fontSize: 7.5, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 5 },
});

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const m = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getUTCDate()} de ${m[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
const clp = (s: string) => `$${Math.round(Number(s)).toLocaleString("es-CL")}`;

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valor}>{valor && valor.length ? valor : "—"}</Text>
    </View>
  );
}

function Seccion({ titulo, children, vacia }: { titulo: string; children?: React.ReactNode; vacia?: boolean }) {
  return (
    <View wrap={false}>
      <Text style={styles.secTitulo}>{titulo}</Text>
      {vacia ? <Text style={styles.vacio}>Sin registros.</Text> : children}
    </View>
  );
}

export function ExportDatosPersonaDocument({ data }: { data: ExportDatosPersona }) {
  const d = data;
  return (
    <Document title={`Datos personales — ${d.identidad.nombre}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>Copia de datos personales</Text>
        <Text style={styles.sub}>
          Responsable del tratamiento: {d.meta.responsable.nombre} · RUT {formatRut(d.meta.responsable.rut)}
        </Text>
        <Text style={styles.sub}>Generado el {fechaLegible(d.meta.generadoEl)}</Text>
        <Text style={styles.meta}>
          {d.meta.fundamento} {d.meta.alcance}
        </Text>

        <View style={styles.divisor} />

        <Seccion titulo="Identidad">
          <Campo label="Nombre" valor={d.identidad.nombre} />
          <Campo label="RUT" valor={formatRut(d.identidad.rut)} />
          <Campo label="Correo electrónico" valor={d.identidad.email} />
          <Campo label="Teléfono" valor={d.identidad.telefono} />
          <Campo label="Canal de acceso preferido" valor={d.identidad.canalDeAccesoPreferido} />
          <Campo label="Registrada el" valor={fechaLegible(d.identidad.registradaEl)} />
        </Seccion>

        <Seccion titulo="Contratos" vacia={d.contratos.length === 0}>
          {d.contratos.map((c, i) => (
            <View key={i} wrap={false}>
              <Text style={styles.cardTitulo}>
                {c.inmueble.direccion}{c.inmueble.comuna ? `, ${c.inmueble.comuna}` : ""} — {c.rol}
              </Text>
              <Campo label="Estado" valor={c.estado} />
              <Campo label="Contraparte" valor={c.contraparte.nombre} />
              <Campo label="Renta" valor={`${c.denominacion} ${c.valorArriendo}${c.cobraGastoComun ? " + gasto común" : ""}`} />
              <Campo label="Comisión corredora" valor={`${c.comisionCorredorPct}%`} />
              <Campo label="Amoblado" valor={c.esAmoblado ? "Sí" : "No"} />
              <Campo label="Vigencia" valor={`${fechaLegible(c.fechaInicio)} — ${c.fechaFin ? fechaLegible(c.fechaFin) : "indefinida"}`} />
              {c.fechaTermino ? <Campo label="Terminado el" valor={`${fechaLegible(c.fechaTermino)}${c.causalTermino ? ` (${c.causalTermino})` : ""}`} /> : null}
              <Campo label="Rol de avalúo" valor={c.inmueble.rolAvaluo} />
              <Campo label="Firmado ante notario" valor={c.firmadoAnteNotario ? "Sí" : "No"} />

              {c.periodos.length > 0 ? (
                <>
                  <View style={styles.th}>
                    <Text style={[styles.thText, { width: "10%" }]}>N°</Text>
                    <Text style={[styles.thText, { width: "28%" }]}>Vencimiento</Text>
                    <Text style={[styles.thText, { width: "24%" }]}>Arriendo</Text>
                    <Text style={[styles.thText, { width: "20%" }]}>Estado</Text>
                    <Text style={[styles.thText, { width: "18%" }]}>Pagado</Text>
                  </View>
                  {c.periodos.map((p) => (
                    <View key={p.numero} style={styles.td}>
                      <Text style={{ width: "10%" }}>{p.numero}</Text>
                      <Text style={{ width: "28%" }}>{fechaLegible(p.vencimiento)}</Text>
                      <Text style={{ width: "24%" }}>{clp(p.montoBase)}</Text>
                      <Text style={{ width: "20%" }}>{p.estado}</Text>
                      <Text style={{ width: "18%" }}>{p.pagadoEl ? fechaLegible(p.pagadoEl) : "—"}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {c.comprobantes.length > 0 ? (
                <>
                  <View style={styles.th}>
                    <Text style={[styles.thText, { width: "26%" }]}>Folio</Text>
                    <Text style={[styles.thText, { width: "26%" }]}>Tipo</Text>
                    <Text style={[styles.thText, { width: "28%" }]}>Fecha</Text>
                    <Text style={[styles.thText, { width: "20%" }]}>Monto</Text>
                  </View>
                  {c.comprobantes.map((v, j) => (
                    <View key={j} style={styles.td}>
                      <Text style={{ width: "26%" }}>{v.folio ?? "—"}</Text>
                      <Text style={{ width: "26%" }}>{v.tipo}</Text>
                      <Text style={{ width: "28%" }}>{fechaLegible(v.fecha)}</Text>
                      <Text style={{ width: "20%" }}>{clp(v.montoCLP)}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ))}
        </Seccion>

        <Seccion titulo="Cuentas bancarias" vacia={d.cuentasBancarias.length === 0}>
          {d.cuentasBancarias.map((c, i) => (
            <View key={i} wrap={false}>
              <Campo label="Banco" valor={`${c.banco} — ${c.tipo}`} />
              <Campo label="Número" valor={c.numero} />
              <Campo label="Titular" valor={`${c.titular} (${formatRut(c.rutTitular)})`} />
              <Campo label="Correo de aviso" valor={c.email} />
            </View>
          ))}
        </Seccion>

        <Seccion titulo="Documentos" vacia={d.documentos.length === 0}>
          {d.documentos.map((doc, i) => (
            <Campo key={i} label={fechaLegible(doc.fecha)} valor={`${doc.nombre} (${doc.tipo})`} />
          ))}
        </Seccion>

        <Seccion titulo="Comunicaciones enviadas" vacia={d.comunicaciones.length === 0}>
          {d.comunicaciones.map((c, i) => (
            <Campo key={i} label={fechaLegible(c.fecha)} valor={`${c.asunto} — ${c.canal} (${c.estado})`} />
          ))}
        </Seccion>

        <Seccion titulo="Registros de acceso" vacia={d.registrosDeAcceso.length === 0}>
          {d.registrosDeAcceso.map((a, i) => (
            <Campo key={i} label={fechaLegible(a.fecha)} valor={`${a.accion}${a.ip ? ` · ${a.ip}` : ""}`} />
          ))}
        </Seccion>

        <Seccion titulo="Solicitudes de código de acceso" vacia={d.solicitudesDeCodigoDeAcceso.length === 0}>
          {d.solicitudesDeCodigoDeAcceso.map((s, i) => (
            <Campo key={i} label={fechaLegible(s.fecha)} valor={`${s.canal}${s.ip ? ` · ${s.ip}` : ""} · ${s.usado ? "usado" : "no usado"}`} />
          ))}
        </Seccion>

        <Seccion titulo="Reservas" vacia={d.reservas.length === 0}>
          {d.reservas.map((r, i) => (
            <Campo key={i} label={fechaLegible(r.fechaReserva)} valor={`${r.inmueble} — ${r.estado}`} />
          ))}
        </Seccion>

        <Seccion titulo="Preferencia de notificación" vacia={!d.preferenciaDeNotificacion}>
          {d.preferenciaDeNotificacion ? (
            <>
              <Campo label="Suscrito a avisos" valor={d.preferenciaDeNotificacion.suscrito ? "Sí" : "No"} />
              <Campo label="Baja hasta" valor={d.preferenciaDeNotificacion.bajaHasta ? fechaLegible(d.preferenciaDeNotificacion.bajaHasta) : null} />
              <Campo label="Motivo" valor={d.preferenciaDeNotificacion.motivo} />
            </>
          ) : null}
        </Seccion>

        <Seccion titulo="Valoraciones dejadas" vacia={d.valoraciones.length === 0}>
          {d.valoraciones.map((v, i) => (
            <Campo key={i} label={fechaLegible(v.fecha)} valor={`${v.estrellas}★ ${v.comentario ?? ""}`.trim()} />
          ))}
        </Seccion>

        <Text style={styles.footer}>
          Copia emitida por {d.meta.responsable.nombre} en ejercicio del derecho de acceso (Ley 21.719).
          Los datos de terceros se limitan a lo indispensable.
        </Text>
      </Page>
    </Document>
  );
}
