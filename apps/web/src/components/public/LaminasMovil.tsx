/**
 * Fondos de la portada en teléfono y tablet: láminas de dibujo técnico del
 * mundo del arriendo, una por parada del recorrido. Reemplazan a las fotos
 * del recorrido de escritorio, que compuestas para una pantalla horizontal
 * quedaban como recortes sin escena en un teléfono.
 *
 * Son geometría, no ilustración: plano de planta, calendario de pagos, plano
 * de calles y fachadas. Trazo de 1 px que no escala (`non-scaling-stroke`),
 * color de marca desde los tokens (`.pgo-lamina` en globals.css), así siguen
 * el tema claro y el oscuro sin un archivo por tema y pesan unos cientos de
 * bytes. Decorativas: van dentro de un contenedor `aria-hidden`.
 */

const TRAZO = { vectorEffect: "non-scaling-stroke" } as const;

/** Inicio: plano de planta de un departamento de dos dormitorios. Se revela una vez al llegar. */
export function LaminaPlano() {
  return (
    <svg className="pgo-lamina pgo-lamina--trazo" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none">
      {/* Muros exteriores, con vanos para las ventanas */}
      <path style={TRAZO} className="pgo-lamina-muro" d="M40 120 H150 M210 120 H360 V230 M360 290 V700 H260 M200 700 H40 V560 M40 500 V120" />
      {/* Ventanas: doble línea en cada vano */}
      <path style={TRAZO} d="M150 116 H210 M150 124 H210 M356 230 V290 M364 230 V290 M200 696 H260 M200 704 H260 M36 500 V560 M44 500 V560" />
      {/* Tabiques */}
      <path style={TRAZO} d="M40 360 H128 M168 360 H360 M170 360 V500 M260 360 V430 M260 470 V500 M40 500 H96 M136 500 H244 M284 500 H360 M220 500 V700" />
      {/* Puertas: hoja y arco de giro */}
      <path style={TRAZO} className="pgo-lamina-acento" d="M128 360 V320 M128 320 A40 40 0 0 1 168 360 M96 500 V540 M96 540 A40 40 0 0 0 136 500 M244 500 V540 M244 540 A40 40 0 0 0 284 500 M260 430 H298 M298 430 A40 40 0 0 1 260 470" />
      {/* Muebles fijos: cocina y baño */}
      <path style={TRAZO} d="M48 368 H162 V392 H48 M60 380 h20 M100 380 h20 M178 368 h74 v44 h-74 z M196 452 a14 18 0 1 0 28 0 a14 18 0 1 0 -28 0" />
      {/* Sin cotas ni rótulos de recintos: medidas como «14,50 m» se leían
          como un dato de una propiedad real y no decían nada de Propigo. */}
    </svg>
  );
}

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"] as const;

/** «Lo que hace por ti»: un año de cobros, con el reajuste por IPC en el aniversario. */
export function LaminaCalendario() {
  const celda = { ancho: 100, alto: 150, x0: 50, y0: 110 };
  return (
    <svg className="pgo-lamina" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none">
      {MESES.map((mes, i) => {
        const x = celda.x0 + (i % 3) * celda.ancho;
        const y = celda.y0 + Math.floor(i / 3) * celda.alto;
        return (
          <g key={mes}>
            <rect style={TRAZO} x={x} y={y} width={celda.ancho} height={celda.alto} />
            <text className="pgo-lamina-rotulo" x={x + 10} y={y + 20}>{mes}</text>
            {/* Día de pago: el 5 de cada mes */}
            <circle style={TRAZO} className="pgo-lamina-acento" cx={x + celda.ancho - 18} cy={y + 18} r={5} />
          </g>
        );
      })}
      {/* Renta mes a mes: plana durante el año y un escalón en el reajuste */}
      <path style={TRAZO} className="pgo-lamina-acento pgo-lamina-grueso" d="M60 230 H340 M60 380 H340 M60 530 H340 M60 668 H230 V650 H340" />
      <text className="pgo-lamina-rotulo pgo-lamina-rotulo--acento" x="236" y="640">+ IPC</text>
    </svg>
  );
}

/** «Destacado»: plano de calles de una comuna, con una propiedad marcada. */
export function LaminaMapa() {
  const manzanas: [number, number][] = [];
  for (let fila = 0; fila < 6; fila++) {
    for (let col = 0; col < 4; col++) manzanas.push([20 + col * 100, 60 + fila * 120]);
  }
  return (
    <svg className="pgo-lamina" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none">
      <g transform="rotate(-12 200 400)">
        {manzanas.map(([x, y]) => (
          <rect key={`${x}-${y}`} style={TRAZO} x={x} y={y} width={80} height={100} rx={6} />
        ))}
        {/* Avenida principal */}
        <path style={TRAZO} className="pgo-lamina-grueso" d="M-40 285 H460 M-40 295 H460" />
        {/* Plaza */}
        <circle style={TRAZO} cx={160} cy={530} r={28} />
        <rect style={TRAZO} className="pgo-lamina-acento pgo-lamina-relleno" x={220} y={420} width={80} height={100} rx={6} />
      </g>
      {/* Marcador de la propiedad */}
      <path
        style={TRAZO}
        className="pgo-lamina-acento pgo-lamina-grueso"
        d="M276 352 c-17 0 -30 13 -30 30 c0 22 30 50 30 50 s30 -28 30 -50 c0 -17 -13 -30 -30 -30 z M276 372 a10 10 0 1 0 0.01 0"
      />
    </svg>
  );
}

/** «Planes»: fachadas de cuatro edificios en la base, para que la tabla de precios conserve la calma arriba. */
export function LaminaFachadas() {
  const edificios = [
    { x: 30, ancho: 70, pisos: 3 },
    { x: 115, ancho: 80, pisos: 5 },
    { x: 210, ancho: 70, pisos: 7 },
    { x: 295, ancho: 80, pisos: 9 },
  ];
  const base = 780;
  const altoPiso = 34;
  return (
    <svg className="pgo-lamina" viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice" fill="none">
      <path style={TRAZO} d={`M0 ${base} H400`} />
      {edificios.map(({ x, ancho, pisos }) => {
        const tope = base - pisos * altoPiso;
        return (
          <g key={x}>
            <rect style={TRAZO} x={x} y={tope} width={ancho} height={pisos * altoPiso} />
            {Array.from({ length: pisos }, (_, p) => (
              <path
                key={p}
                style={TRAZO}
                className={p === pisos - 1 ? "pgo-lamina-acento" : undefined}
                d={`M${x + 12} ${tope + p * altoPiso + 10} h${ancho / 2 - 18} v14 h-${ancho / 2 - 18} z M${x + ancho / 2 + 6} ${tope + p * altoPiso + 10} h${ancho / 2 - 18} v14 h-${ancho / 2 - 18} z`}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
