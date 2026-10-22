/**
 * Generador de borrador de contrato de arriendo en PDF (ítem #9, ADR-0009 rev. 2026-07-30).
 *
 * Plantilla fija + datos reales del contrato — sin redacción libre de IA (decisión
 * confirmada con el usuario 2026-07-30). La estructura de cláusulas sigue el mismo
 * criterio que un contrato de arriendo real usado como referencia, adaptada y
 * parafraseada (no copiada textual), con dos correcciones deliberadas respecto a
 * esa referencia:
 *   1. Término anticipado: "renta del período faltante" (Art. 1489 Código Civil),
 *      no una multa fija — ver ADR-0009 y lib/contract-rules.ts.
 *   2. Firma: espacio para firma manuscrita, sin mencionar un proveedor de firma
 *      electrónica que Propigo no tiene integrado.
 *
 * Datos que el sistema no captura (domicilio de las partes, estado civil,
 * inscripción en el Conservador de Bienes Raíces) se dejan como placeholder
 * entre corchetes — nunca se inventan. Es un BORRADOR: el propio documento lo
 * declara y requiere revisión de un abogado antes de firmarse (ver memoria
 * "Contrato = borrador, no final").
 */
import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { Text } from "./pdf-base";
import { formatRut } from "./rut";
import { cantidad } from "./format";
import { MARCA } from "@/lib/marca";

export interface ContratoPdfData {
  tenantNombre: string;
  propietario: { nombre: string; rut: string; email: string | null };
  arrendatario: { nombre: string; rut: string; email: string | null };
  propiedad: {
    direccion: string;
    comuna: string | null;
    region: string | null;
    tipo: "casa" | "departamento" | "cabana";
    /** Rol de avalúo del SII. Identifica el inmueble ante Tesorería. */
    rol: string;
    /** Estacionamientos, bodegas u otras unidades con rol propio. */
    complementos: { tipo: "estacionamiento" | "bodega" | "otro"; rol: string; descripcion: string | null }[];
  };
  denominacion: "UF" | "CLP";
  valorArriendo: number;
  diaVencimiento: number;
  reajuste: "anual" | "semestral" | "ninguna";
  moraTasaPct: number;
  moraDiasGracia: number;
  garantiaMeses: number;
  garantiaDenominacion: "UF" | "CLP" | null;
  garantiaMontoBase: number | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  generadoEl: Date;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaEnPalabras(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} del año ${d.getUTCFullYear()}`;
}

function fechaCorta(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

const TIPO_LABEL: Record<ContratoPdfData["propiedad"]["tipo"], string> = {
  casa: "casa", departamento: "departamento", cabana: "cabaña",
};

type Complemento = ContratoPdfData["propiedad"]["complementos"][number];

/** Cómo se nombra cada unidad accesoria dentro de la cláusula. */
const COMPLEMENTO_NOMBRE: Record<Complemento["tipo"], { articulo: string; sustantivo: string }> = {
  estacionamiento: { articulo: "el", sustantivo: "estacionamiento" },
  bodega:          { articulo: "la", sustantivo: "bodega" },
  otro:            { articulo: "la", sustantivo: "unidad" },
};

/**
 * Nombra una unidad accesoria en prosa: "el estacionamiento 43", "la bodega".
 *
 * La descripción la escribe el corredor y el formulario le sugiere justamente
 * "Estacionamiento 43", así que lo normal es que ya traiga el sustantivo. Sin
 * este ajuste la cláusula queda "el estacionamiento Estacionamiento 43" — un
 * error que no se ve en los datos de ejemplo y sí en los reales.
 */
function nombrarComplemento(c: Complemento): string {
  const { articulo, sustantivo } = COMPLEMENTO_NOMBRE[c.tipo];
  const desc = c.descripcion?.trim() ?? "";
  if (!desc) return `${articulo} ${sustantivo}`;
  if (desc.toLowerCase().startsWith(sustantivo)) {
    // Va en minúscula porque queda a mitad de una oración, no al inicio.
    return `${articulo} ${desc[0].toLowerCase()}${desc.slice(1)}`;
  }
  return `${articulo} ${sustantivo} ${desc}`;
}

/**
 * Enumera en castellano: "a", "a y b", "a, b y c".
 *
 * El texto va dentro de una cláusula que puede leer un abogado o un juez, así
 * que una lista separada por comas hasta el final se leería como un descuido.
 */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Frase que suma las unidades accesorias al objeto del arriendo.
 *
 * En un edificio, el departamento, el estacionamiento y la bodega son inmuebles
 * distintos con rol propio. Un contrato que solo nombra el departamento deja sin
 * cubrir lo demás, y ahí es donde después aparece la discusión.
 */
function frasesComplementos(cs: ContratoPdfData["propiedad"]["complementos"]): string | null {
  if (cs.length === 0) return null;
  const partes = cs.map((c) => `${nombrarComplemento(c)}, Rol de Avalúo N° ${c.rol}`);
  return `Forma${cs.length > 1 ? "n" : ""} parte del arrendamiento ${enumerar(partes)}.`;
}

function montoTexto(valor: number, denom: "UF" | "CLP"): string {
  return denom === "UF"
    ? `${valor.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
    : valor.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  page: { padding: "60 56", fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4, color: "#1a1a1a" },
  bannerBorrador: {
    marginBottom: 18, padding: 8, textAlign: "center",
    border: "1 solid #b45309", backgroundColor: "#fef3c7",
  },
  bannerText: { fontSize: 9, color: "#92400e", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 11, textAlign: "center", marginBottom: 18 },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  clauseLabel: { fontFamily: "Helvetica-Bold" },
  placeholder: { color: "#b45309" },
  footer: {
    position: "absolute", bottom: 24, left: 56, right: 56,
    fontSize: 8, color: "#6b7280", textAlign: "center", borderTop: "0.5 solid #d1d5db", paddingTop: 6,
  },
  pageNumber: {
    position: "absolute", bottom: 24, right: 56, fontSize: 8, color: "#6b7280",
  },
  signBlock: { marginTop: 48, flexDirection: "row", justifyContent: "space-between" },
  signCol: { width: "45%", textAlign: "center" },
  signLine: { borderTop: "1 solid #1a1a1a", marginBottom: 4, marginTop: 40 },
});

/** Placeholder inline para datos que el sistema no captura — nunca se inventan. */
function P({ children }: { children: string }) {
  return <Text style={styles.placeholder}>[{children}]</Text>;
}

function Clausula({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <Text style={styles.paragraph}>
      <Text style={styles.clauseLabel}>{n}: </Text>
      {children}
    </Text>
  );
}

export function ContratoPdfDocument({ data }: { data: ContratoPdfData }) {
  const d = data;
  const plazoFijo = d.fechaFin !== null;
  const rentaTexto = montoTexto(d.valorArriendo, d.denominacion);
  const garantiaTexto = d.garantiaMeses > 0 && d.garantiaMontoBase !== null
    ? montoTexto(d.garantiaMontoBase, d.garantiaDenominacion ?? d.denominacion)
    : null;
  const complementos = frasesComplementos(d.propiedad.complementos);

  return (
    <Document title={`Borrador de contrato de arriendo — ${d.propiedad.direccion}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.bannerBorrador}>
          <Text style={styles.bannerText}>
            BORRADOR DE TRABAJO — no válido para firmar sin revisión de un abogado habilitado
          </Text>
        </View>

        <Text style={styles.title}>CONTRATO DE ARRIENDO</Text>
        <Text style={styles.subtitle}>{d.propietario.nombre} a {d.arrendatario.nombre}</Text>

        <Text style={styles.paragraph}>
          En <P>ciudad</P>, a {fechaEnPalabras(d.generadoEl)}, por una parte don/doña{" "}
          {d.propietario.nombre}, RUT {formatRut(d.propietario.rut)}, estado civil <P>estado civil</P>,
          domiciliado(a) en <P>domicilio no registrado</P>, correo electrónico{" "}
          {d.propietario.email ?? "[correo no registrado]"}; denominado indistintamente
          &quot;LA PARTE ARRENDADORA&quot;; y por la otra, don/doña {d.arrendatario.nombre}, RUT{" "}
          {formatRut(d.arrendatario.rut)}, estado civil <P>estado civil</P>, domiciliado(a) en{" "}
          <P>domicilio no registrado</P>, correo electrónico {d.arrendatario.email ?? "[correo no registrado]"};
          denominado indistintamente &quot;LA PARTE ARRENDATARIA&quot;; ambos mayores de edad, quienes
          acreditan su identidad con sus respectivas cédulas de identidad, exponen que vienen en
          celebrar el siguiente contrato de arrendamiento, el cual se regirá por las cláusulas
          siguientes y, en lo no previsto en ellas, por la Ley N° 18.101 sobre Arrendamiento de
          Predios Urbanos y, supletoriamente, por los artículos 1915 y siguientes del Código Civil.
        </Text>

        <Clausula n="PRIMERO">
          La parte Arrendadora es dueña del inmueble tipo {TIPO_LABEL[d.propiedad.tipo]} ubicado en{" "}
          {d.propiedad.direccion}
          {d.propiedad.comuna ? `, comuna de ${d.propiedad.comuna}` : ""}
          {d.propiedad.region ? `, ${d.propiedad.region}` : ""}
          {/* El rol de avalúo es lo que identifica al inmueble ante el SII y la
              Tesorería. Sin él, la cláusula describe una dirección y no un
              predio determinado, que es lo que un contrato necesita fijar. */}
          , Rol de Avalúo N° {d.propiedad.rol}, inscrito a su nombre en el
          Conservador de Bienes Raíces según <P>inscripción CBR no registrada</P>, en adelante
          &quot;el Inmueble&quot;. {complementos ? `${complementos} ` : ""}Por este acto la parte
          Arrendadora entrega en arrendamiento el Inmueble a la parte Arrendataria, quien lo recibe
          a su entera conformidad, para uso habitacional exclusivamente, quedando prohibido
          cualquier otro destino.
        </Clausula>

        <Clausula n="SEGUNDO">
          {plazoFijo
            ? <>El presente contrato tendrá una duración desde el {fechaCorta(d.fechaInicio)} hasta el{" "}
                {fechaCorta(d.fechaFin as Date)}. Si el contrato continuara vigente después de esa fecha,
                se entenderá renovado tácita, sucesiva y automáticamente por períodos de 12 meses, salvo
                que alguna de las partes manifieste su voluntad de ponerle término, dando aviso a la
                contraparte por correo electrónico o carta certificada con a lo menos 60 días de
                anticipación al vencimiento del plazo o su prórroga.</>
            : <>El presente contrato comenzará a regir el {fechaCorta(d.fechaInicio)}, con calendario de
                pagos generado en períodos de 12 meses renovables, salvo que alguna de las partes
                manifieste su voluntad de ponerle término, dando aviso a la contraparte por correo
                electrónico o carta certificada con a lo menos 60 días de anticipación.</>}
          {" "}Si la parte Arrendataria pusiera término al arriendo antes del plazo convenido,
          restituyendo la propiedad, deberá pagar las rentas correspondientes al período que falte
          para la terminación del contrato, a título de indemnización de perjuicios (Art. 1489 y
          1535 y siguientes del Código Civil).
        </Clausula>

        <Clausula n="TERCERO">
          La renta mensual de arrendamiento será de {rentaTexto}, pagadera dentro de los primeros{" "}
          {d.diaVencimiento} días de cada mes en forma anticipada.
          {d.reajuste === "anual" && " La renta se reajustará anualmente según la variación del Índice de Precios al Consumidor (IPC), sin que en ningún caso se rebaje por efecto de un IPC negativo."}
          {d.reajuste === "semestral" && " La renta se reajustará semestralmente según la variación del Índice de Precios al Consumidor (IPC), sin que en ningún caso se rebaje por efecto de un IPC negativo."}
          {d.reajuste === "ninguna" && " La renta no está sujeta a reajuste durante la vigencia del contrato."}
        </Clausula>

        <Clausula n="CUARTO">
          El atraso en el pago de la renta más allá del plazo establecido en la cláusula anterior,
          contados {cantidad(d.moraDiasGracia, "día", "días")} de gracia, dará derecho a la parte Arrendadora a cobrar
          una multa moratoria equivalente al {d.moraTasaPct}% de la renta por cada mes o fracción de
          atraso, sin perjuicio de su facultad para poner término al contrato. Los pagos y
          devoluciones en mora entre las partes se reajustarán según la variación de la Unidad de
          Fomento entre la fecha en que debieron efectuarse y aquella en que se realicen
          efectivamente (Art. 21, Ley N° 18.101).
        </Clausula>

        <Clausula n="QUINTO">
          La parte Arrendataria pagará con puntualidad las cuentas de energía eléctrica, gas, agua
          potable, gastos comunes y demás servicios asociados al Inmueble. El atraso de un mes en
          cualquiera de estos pagos dará derecho a la parte Arrendadora a poner término al contrato.
        </Clausula>

        <Clausula n="SEXTO">
          La parte Arrendadora entrega el Inmueble en buen estado de conservación y con sus
          instalaciones funcionando correctamente. La parte Arrendataria se obliga a mantener el
          Inmueble en buen estado de aseo y conservación, y a efectuar oportunamente y a su costo
          las reparaciones locativas que correspondan según la ley y el uso normal.
        </Clausula>

        <Clausula n="SÉPTIMO">
          Queda prohibido a la parte Arrendataria efectuar variaciones o modificaciones en el
          Inmueble sin autorización previa y por escrito de la parte Arrendadora, subarrendar o
          ceder el contrato, y destinar el Inmueble a un objeto distinto al pactado.
        </Clausula>

        <Clausula n="OCTAVO">
          Al término del contrato, por cualquier causa, la parte Arrendataria deberá restituir el
          Inmueble desocupado y en el mismo estado en que lo recibió, considerando el desgaste
          natural por el uso y el transcurso del tiempo.
        </Clausula>

        <Clausula n="NOVENO">
          {garantiaTexto
            ? <>A fin de garantizar la conservación del Inmueble y el cumplimiento de las
                obligaciones del presente contrato, la parte Arrendataria entrega en garantía la
                suma de {garantiaTexto} ({cantidad(d.garantiaMeses, "mes", "meses")} de renta), que la parte
                Arrendadora se obliga a devolver — debidamente reajustada (Art. 21, Ley N° 18.101)
                — tras la restitución del Inmueble, descontando el valor efectivo de los deterioros
                o perjuicios de cargo de la parte Arrendataria. Esta garantía no podrá imputarse en
                ningún caso al pago de rentas insolutas ni al arriendo del último o últimos meses.</>
            : <>Las partes dejan constancia de que no se ha pactado garantía en este contrato.</>}
        </Clausula>

        <Clausula n="DÉCIMO">
          Con el objeto de dar cumplimiento a la Ley N° 21.719 sobre Protección de Datos Personales,
          la parte Arrendataria autoriza a la parte Arrendadora a tratar sus datos personales
          exclusivamente para los fines de este contrato y, en caso de mora, a informarla a
          registros o bancos de datos de morosidad conforme a la ley.
        </Clausula>

        <Clausula n="UNDÉCIMO">
          Cualquier dificultad entre las partes respecto de la aplicación, interpretación o
          ejecución de este contrato será resuelta por los Tribunales Ordinarios de Justicia,
          fijando ambas partes su domicilio en <P>comuna</P>.
        </Clausula>

        <Text style={{ ...styles.paragraph, marginTop: 16 }}>
          El presente documento se suscribe en dos ejemplares del mismo tenor y fecha, quedando uno
          en poder de cada parte.
        </Text>

        <View style={styles.signBlock}>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text>{d.propietario.nombre}</Text>
            <Text>RUT {formatRut(d.propietario.rut)}</Text>
            <Text>ARRENDADOR(A)</Text>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text>{d.arrendatario.nombre}</Text>
            <Text>RUT {formatRut(d.arrendatario.rut)}</Text>
            <Text>ARRENDATARIO(A)</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Borrador generado automáticamente por {MARCA} el {fechaCorta(d.generadoEl)} a
          partir de los datos del contrato en el sistema. No constituye asesoría legal ni documento
          válido para uso sin revisión previa de un abogado habilitado — los campos entre corchetes
          deben completarse antes de firmar.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
