import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Cliente de pg que ejecuta en fila las consultas de una misma conexión.
 *
 * Dentro de una transacción interactiva, el motor de Prisma lanza varias
 * consultas en paralelo sobre la MISMA conexión (p. ej. al resolver relaciones
 * anidadas). pg 8 las encola por dentro pero emite un DeprecationWarning, y en
 * pg 9 ese encolado desaparece y pasa a ser un error. Encolarlas acá conserva
 * exactamente el mismo orden de ejecución que hoy, sin depender de él.
 * Solo se intercepta la forma con promesa (la que usa el adaptador de Prisma);
 * callbacks y objetos "submittable" (cursores) pasan sin cambios.
 */
export class ClienteSerializado extends pg.Client {
  #cola: Promise<unknown> = Promise.resolve();

  // La firma de pg.Client.query tiene muchas sobrecargas; esta implementación
  // solo las reenvía, por eso se tipa de forma genérica.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override query(...args: any[]): any {
    const ultimo = args.at(-1);
    const conCallback = typeof ultimo === "function";
    const esSubmittable = typeof args[0]?.submit === "function";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (conCallback || esSubmittable) return (super.query as any)(...args);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ejecucion = this.#cola.then(() => (super.query as any)(...args));
    this.#cola = ejecucion.catch(() => undefined);
    return ejecucion;
  }
}

/** Adaptador de Prisma sobre un pool cuyas conexiones son ClienteSerializado. */
export function adaptadorPg(connectionString: string | undefined): PrismaPg {
  return new PrismaPg(new pg.Pool({ connectionString, Client: ClienteSerializado }));
}
