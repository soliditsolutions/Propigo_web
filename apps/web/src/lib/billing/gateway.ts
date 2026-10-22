/**
 * Puerto de pasarela de pago — ADR-0014, fila P-A1 del rowMap.
 *
 * El dominio de billing habla SOLO con esta interfaz, nunca con el SDK de un
 * proveedor. Eso permite construir toda la Fase A antes de decidir entre Flow,
 * Transbank u otro (decisión D-02, todavía abierta) y cambiar de proveedor más
 * adelante sin tocar la lógica de negocio.
 *
 * Dos reglas de diseño que hacen que el resto del sistema pueda ser correcto:
 *
 * 1. **Los fallos de negocio NO se lanzan como excepción.** Una tarjeta
 *    rechazada no es un error del programa: es un resultado esperado que el
 *    dunning tiene que poder leer y decidir qué hacer. Por eso `cobrar()`
 *    devuelve un union discriminado en vez de tirar. Se reserva `throw` para
 *    fallas de infraestructura (red caída, respuesta ilegible).
 *
 * 2. **Todo error de cobro dice si vale la pena reintentar.** Reintentar un
 *    "fondos insuficientes" molesta al cliente y no cambia nada; no reintentar
 *    un timeout de red pierde plata. Sin esta distinción el dunning no puede
 *    ser correcto, y es justo lo que las APIs de pasarela suelen dejar mezclado
 *    en un string de error. Ver `CategoriaErrorCobro`.
 */

// ── Dinero ────────────────────────────────────────────────────────────────
// CLP siempre entero (no existe el centavo). Números en pesos, nunca float
// para acumular — mismo criterio que el resto del sistema, donde los montos
// viven como Decimal(14,0) en la base.

/** Monto en pesos chilenos, entero. */
export type MontoClp = number;

/**
 * Desglose de un cobro. Se guarda completo en `CargoBilling` porque el DTE
 * necesita neto e IVA por separado, y porque la suscripción se cotiza en UF
 * pero se cobra en CLP: sin registrar la UF aplicada no se puede explicar
 * después por qué el cargo de marzo fue distinto al de febrero.
 */
export type DesgloseMonto = {
  netoClp: MontoClp;
  ivaClp: MontoClp;
  /** Lo que efectivamente se le cobra a la tarjeta. */
  totalClp: MontoClp;
  /** Solo en cargos cotizados en UF (suscripción). Null en comisiones, que son CLP fijo. */
  montoUf: number | null;
  /** Valor de la UF congelado al emitir el cargo — decisión N-03. */
  ufAplicada: number | null;
};

// ── Inscripción de medio de pago ──────────────────────────────────────────

export type SolicitudInscripcion = {
  tenantId: string;
  /** Identificador del pagador ante el proveedor (suele ser el correo o el RUT). */
  referenciaCliente: string;
  /** URL a la que el proveedor devuelve al usuario tras inscribir la tarjeta. */
  urlRetorno: string;
};

export type ResultadoInscripcion =
  | {
      estado: "redireccion_requerida";
      /** El usuario debe ir acá a ingresar los datos de su tarjeta. */
      urlRedireccion: string;
      /** Token de la inscripción en curso, para confirmarla al volver. */
      tokenInscripcion: string;
    }
  | { estado: "error"; categoria: CategoriaErrorCobro; mensaje: string };

/**
 * Medio de pago ya inscrito y reutilizable. Propigo **nunca** almacena el
 * número de tarjeta: solo esta referencia opaca del proveedor y datos no
 * sensibles para mostrarle al usuario cuál tarjeta tiene registrada.
 */
export type MedioPagoInscrito = {
  /** Token/identificador del proveedor con el que se dispara cada cobro. */
  referencia: string;
  /** Últimos 4 dígitos — solo para que el usuario reconozca su tarjeta. */
  ultimos4: string | null;
  marca: string | null;
};

// ── Cobro ─────────────────────────────────────────────────────────────────

export type SolicitudCobro = {
  /**
   * Clave de idempotencia generada por Propigo (no por el proveedor).
   * Reintentar con la misma clave debe cobrar UNA sola vez. Es la defensa
   * contra el doble cobro cuando la red falla justo después de que el
   * proveedor ya procesó pero antes de que nos llegue la respuesta.
   */
  idempotencyKey: string;
  tenantId: string;
  /** Referencia del medio de pago inscrito (ver MedioPagoInscrito). */
  medioPago: string;
  monto: DesgloseMonto;
  /** Texto que verá el cliente en su estado de cuenta. */
  descripcion: string;
};

/**
 * Por qué falló un cobro, y — lo importante — si reintentar puede servir.
 *
 * - `rechazo`: el emisor dijo que no (sin fondos, tarjeta bloqueada, tope
 *   excedido). Reintentar YA no sirve; sirve reintentar en días, que es
 *   exactamente lo que hace el dunning.
 * - `medio_invalido`: la tarjeta venció o la inscripción ya no vale.
 *   Reintentar nunca sirve: hay que pedirle al cliente que inscriba otra.
 * - `temporal`: timeout, 5xx, proveedor caído. Reintentar pronto sí sirve.
 * - `configuracion`: credenciales malas, monto fuera de rango, comercio mal
 *   configurado. Es un bug nuestro — reintentar nunca sirve y hay que avisar
 *   a un humano, no al cliente.
 */
export type CategoriaErrorCobro = "rechazo" | "medio_invalido" | "temporal" | "configuracion";

/** Si vale la pena reintentar más tarde un cobro que falló con esta categoría. */
export function esReintentable(categoria: CategoriaErrorCobro): boolean {
  return categoria === "rechazo" || categoria === "temporal";
}

export type ResultadoCobro =
  | {
      estado: "aprobado";
      /** Identificador de la transacción en el proveedor, para conciliar y reembolsar. */
      referenciaTransaccion: string;
      /** Momento en que el proveedor autorizó — puede diferir del nuestro. */
      autorizadoEn: Date;
      /** Código de autorización del emisor, si el proveedor lo entrega. */
      codigoAutorizacion: string | null;
    }
  | {
      estado: "rechazado";
      categoria: CategoriaErrorCobro;
      /** Mensaje del proveedor, para el log. NO se le muestra tal cual al usuario. */
      mensaje: string;
      /** Código crudo del proveedor, para diagnosticar sin adivinar. */
      codigoProveedor: string | null;
    };

// ── Reembolso ─────────────────────────────────────────────────────────────

export type SolicitudReembolso = {
  idempotencyKey: string;
  /** Transacción original a reembolsar. */
  referenciaTransaccion: string;
  /**
   * Monto a devolver. Puede ser menor al original (reembolso parcial), nunca
   * mayor — el dominio lo valida antes de llegar acá, y además es un invariante
   * con test propio (P-A4).
   */
  montoClp: MontoClp;
};

export type ResultadoReembolso =
  | { estado: "reembolsado"; referenciaReembolso: string; reembolsadoEn: Date }
  | { estado: "rechazado"; categoria: CategoriaErrorCobro; mensaje: string };

// ── Webhooks ──────────────────────────────────────────────────────────────

/**
 * Evento del proveedor ya normalizado al vocabulario de Propigo. Cada
 * adaptador traduce su propio formato a esta forma, de modo que el handler
 * del webhook no sepa de qué proveedor viene.
 */
export type EventoNormalizado = {
  /**
   * Identificador del evento EN EL PROVEEDOR. Es la clave de idempotencia del
   * webhook: los proveedores reenvían el mismo evento si no reciben un 200 a
   * tiempo, y procesarlo dos veces no debe cobrar/acreditar dos veces.
   * Se persiste con índice único en `EventoGatewayPago`.
   */
  idExterno: string;
  tipo: "cobro_aprobado" | "cobro_rechazado" | "reembolso_aplicado" | "medio_pago_expirado" | "desconocido";
  /** Transacción a la que se refiere, si aplica. */
  referenciaTransaccion: string | null;
  /** Momento del evento según el proveedor — se usa para descartar replays viejos. */
  ocurridoEn: Date;
};

/**
 * Contrato que implementa cada proveedor. Todo lo que el dominio necesita de
 * una pasarela cabe acá; si un adaptador necesita algo más, es señal de que
 * está filtrando detalles del proveedor al dominio.
 */
export interface BillingGateway {
  /** Nombre corto del proveedor ("flow", "transbank", "fake") — se guarda en el log de eventos. */
  readonly nombre: string;

  /** Inicia la inscripción de una tarjeta. El flujo real siempre redirige: Propigo nunca ve los datos. */
  inscribirMedioPago(input: SolicitudInscripcion): Promise<ResultadoInscripcion>;

  /** Confirma la inscripción cuando el usuario vuelve del proveedor. */
  confirmarInscripcion(tokenInscripcion: string): Promise<MedioPagoInscrito | null>;

  /** Cobra contra un medio ya inscrito. Idempotente por `idempotencyKey`. */
  cobrar(input: SolicitudCobro): Promise<ResultadoCobro>;

  /** Devuelve total o parcialmente una transacción aprobada. */
  reembolsar(input: SolicitudReembolso): Promise<ResultadoReembolso>;

  /**
   * Verifica que el webhook venga de verdad del proveedor.
   * Se le pasa el cuerpo CRUDO (sin parsear) porque la firma se calcula sobre
   * los bytes exactos: re-serializar el JSON cambia el resultado y la firma
   * deja de validar.
   */
  verificarFirmaWebhook(cuerpoCrudo: string, headers: Record<string, string>): boolean;

  /** Traduce el payload del proveedor al vocabulario de Propigo. `null` si no es interpretable. */
  parsearEvento(cuerpoCrudo: string): EventoNormalizado | null;
}
