/**
 * Adaptador *fake* de pasarela — ADR-0014, fila P-A5.
 *
 * Implementa `BillingGateway` en memoria, sin red. Sirve para dos cosas:
 *
 * - **Desarrollo local** sin credenciales de ningún proveedor (D-02 sigue
 *   abierta: todavía no se decide entre Flow y Transbank).
 * - **Tests**: permite forzar cada rama que el dunning tiene que manejar
 *   (rechazo, tarjeta vencida, timeout, error de configuración) sin depender
 *   de un sandbox externo ni de la suerte.
 *
 * NO va a producción. `crearGatewayDeEntorno()` (más abajo) lo impide.
 */
import {
  type BillingGateway,
  type CategoriaErrorCobro,
  type EventoNormalizado,
  type MedioPagoInscrito,
  type ResultadoCobro,
  type ResultadoInscripcion,
  type ResultadoReembolso,
  type SolicitudCobro,
  type SolicitudInscripcion,
  type SolicitudReembolso,
} from "./gateway";

/** Qué debe pasar en el próximo cobro. `aprobar` es el comportamiento normal. */
export type ComportamientoFake =
  | { tipo: "aprobar" }
  | { tipo: "rechazar"; categoria: CategoriaErrorCobro; mensaje?: string }
  /** Simula que el proveedor no responde: la promesa rechaza (falla de infra, no de negocio). */
  | { tipo: "lanzar_excepcion"; mensaje?: string };

type CobroRegistrado = {
  idempotencyKey: string;
  referenciaTransaccion: string;
  totalClp: number;
  /** Cuánto se lleva reembolsado — para que el fake también respete "reembolso ≤ cobrado". */
  reembolsadoClp: number;
};

export class FakeBillingGateway implements BillingGateway {
  readonly nombre = "fake";

  private comportamiento: ComportamientoFake = { tipo: "aprobar" };
  /** Cobros por idempotencyKey — la base de la idempotencia (ver `cobrar`). */
  private readonly cobros = new Map<string, CobroRegistrado>();
  private readonly cobrosPorReferencia = new Map<string, CobroRegistrado>();
  private secuencia = 0;

  /** Cuántas veces se llamó realmente a cobrar (incluye las que devolvió cacheadas). */
  llamadasACobrar = 0;

  /** Define qué pasará en los próximos cobros. */
  configurar(comportamiento: ComportamientoFake): void {
    this.comportamiento = comportamiento;
  }

  /** Vuelve al estado inicial — útil entre tests. */
  reiniciar(): void {
    this.comportamiento = { tipo: "aprobar" };
    this.cobros.clear();
    this.cobrosPorReferencia.clear();
    this.secuencia = 0;
    this.llamadasACobrar = 0;
  }

  private siguienteId(prefijo: string): string {
    this.secuencia += 1;
    return `${prefijo}_${String(this.secuencia).padStart(6, "0")}`;
  }

  async inscribirMedioPago(input: SolicitudInscripcion): Promise<ResultadoInscripcion> {
    if (this.comportamiento.tipo === "rechazar") {
      return {
        estado: "error",
        categoria: this.comportamiento.categoria,
        mensaje: this.comportamiento.mensaje ?? "Inscripción rechazada (fake)",
      };
    }
    const token = this.siguienteId("insc");
    return {
      estado: "redireccion_requerida",
      urlRedireccion: `${input.urlRetorno}?fake_token=${token}`,
      tokenInscripcion: token,
    };
  }

  async confirmarInscripcion(tokenInscripcion: string): Promise<MedioPagoInscrito | null> {
    if (!tokenInscripcion.startsWith("insc_")) return null;
    return {
      referencia: tokenInscripcion.replace("insc_", "medio_"),
      ultimos4: "4242",
      marca: "Visa",
    };
  }

  async cobrar(input: SolicitudCobro): Promise<ResultadoCobro> {
    this.llamadasACobrar += 1;

    // Idempotencia: reintentar con la misma clave devuelve el MISMO resultado
    // sin volver a cobrar. Es el comportamiento que se le exige a un proveedor
    // real, y el fake lo replica para que los tests de idempotencia prueben
    // algo de verdad y no solo que "no explotó".
    const previo = this.cobros.get(input.idempotencyKey);
    if (previo) {
      return {
        estado: "aprobado",
        referenciaTransaccion: previo.referenciaTransaccion,
        autorizadoEn: new Date(),
        codigoAutorizacion: "FAKE-OK",
      };
    }

    if (this.comportamiento.tipo === "lanzar_excepcion") {
      throw new Error(this.comportamiento.mensaje ?? "Timeout del proveedor (fake)");
    }

    if (this.comportamiento.tipo === "rechazar") {
      return {
        estado: "rechazado",
        categoria: this.comportamiento.categoria,
        mensaje: this.comportamiento.mensaje ?? "Cobro rechazado (fake)",
        codigoProveedor: "FAKE-RECHAZO",
      };
    }

    const registro: CobroRegistrado = {
      idempotencyKey: input.idempotencyKey,
      referenciaTransaccion: this.siguienteId("trx"),
      totalClp: input.monto.totalClp,
      reembolsadoClp: 0,
    };
    this.cobros.set(registro.idempotencyKey, registro);
    this.cobrosPorReferencia.set(registro.referenciaTransaccion, registro);

    return {
      estado: "aprobado",
      referenciaTransaccion: registro.referenciaTransaccion,
      autorizadoEn: new Date(),
      codigoAutorizacion: "FAKE-OK",
    };
  }

  async reembolsar(input: SolicitudReembolso): Promise<ResultadoReembolso> {
    const registro = this.cobrosPorReferencia.get(input.referenciaTransaccion);
    if (!registro) {
      return {
        estado: "rechazado",
        categoria: "configuracion",
        mensaje: "La transacción no existe (fake)",
      };
    }
    // El fake también hace respetar "no devolver más de lo cobrado". Que el
    // dominio lo valide antes no quita que el proveedor real lo rechace: si el
    // fake fuera más permisivo, un bug pasaría los tests y fallaría en prod.
    const disponible = registro.totalClp - registro.reembolsadoClp;
    if (input.montoClp > disponible) {
      return {
        estado: "rechazado",
        categoria: "configuracion",
        mensaje: `Reembolso (${input.montoClp}) mayor al disponible (${disponible})`,
      };
    }
    registro.reembolsadoClp += input.montoClp;
    return {
      estado: "reembolsado",
      referenciaReembolso: this.siguienteId("ref"),
      reembolsadoEn: new Date(),
    };
  }

  /**
   * En el fake la "firma" es un header fijo. Igual se valida en vez de
   * devolver `true` siempre: así el test de "webhook sin firma se rechaza"
   * ejercita el mismo camino que en producción.
   */
  verificarFirmaWebhook(_cuerpoCrudo: string, headers: Record<string, string>): boolean {
    return headers["x-fake-signature"] === "firma-valida";
  }

  parsearEvento(cuerpoCrudo: string): EventoNormalizado | null {
    try {
      const raw = JSON.parse(cuerpoCrudo) as Record<string, unknown>;
      if (typeof raw.id !== "string" || typeof raw.tipo !== "string") return null;
      const tiposValidos: EventoNormalizado["tipo"][] = [
        "cobro_aprobado",
        "cobro_rechazado",
        "reembolso_aplicado",
        "medio_pago_expirado",
      ];
      const tipo = tiposValidos.find((t) => t === raw.tipo) ?? "desconocido";
      return {
        idExterno: raw.id,
        tipo,
        referenciaTransaccion: typeof raw.trx === "string" ? raw.trx : null,
        ocurridoEn: typeof raw.ts === "string" ? new Date(raw.ts) : new Date(),
      };
    } catch {
      return null;
    }
  }
}

/**
 * Selector de adaptador por entorno.
 *
 * Falla ruidosamente si alguien intenta usar el fake en producción: un cobro
 * que "funciona" sin mover plata es peor que un error, porque se descubre
 * cuando el cliente reclama que le dimos servicio gratis (o que le cobramos
 * sin registrar). Mientras D-02 siga abierta, producción simplemente no tiene
 * pasarela y eso también es explícito.
 */
export function crearGatewayDeEntorno(): BillingGateway {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No hay pasarela de pago configurada para producción. " +
        "El adaptador fake NUNCA debe usarse ahí (ver ADR-0014, decisión D-02 pendiente).",
    );
  }
  return new FakeBillingGateway();
}
