"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { canonicalRut } from "@/lib/rut";
import { validarCuentaBancaria, normalizarNumeroCuenta } from "@/lib/cuenta-bancaria";

export type ResultadoCorredora =
  | { ok: true }
  | { ok: false; error: string; field?: string };

/**
 * Datos de facturación de la corredora: los que van en todo documento que emite
 * (giro y domicilio) y el que decide si su comisión lleva IVA. El RUT no se
 * toca acá — identifica la cuenta y se fijó en el registro.
 *
 * Manager-only: se verifica en la función, no solo en la navegación (el proxy
 * también gatea /panel/corredora).
 */
export async function guardarDatosCorredora(data: {
  esPersonaJuridica: boolean;
  giro: string;
  direccion: string;
}): Promise<ResultadoCorredora> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager") {
      return { ok: false, error: "Solo el administrador de la cuenta puede editar los datos de la corredora." };
    }

    const giro = data.giro.trim();
    const direccion = data.direccion.trim();
    if (giro.length > 120) return { ok: false, error: "El giro es demasiado largo.", field: "giro" };
    if (direccion.length > 200) return { ok: false, error: "La dirección es demasiado larga.", field: "direccion" };

    await withTenant(actor.tenantId, (tx) => tx.tenant.update({
      where: { id: actor.tenantId },
      data: {
        esPersonaJuridica: data.esPersonaJuridica,
        giro: giro || null,
        direccion: direccion || null,
      },
    }));

    revalidatePath("/panel/corredora");
    return { ok: true };
  } catch (e) {
    logError("guardarDatosCorredora", e);
    return { ok: false, error: "No se pudieron guardar los datos. Intenta de nuevo." };
  }
}

/**
 * Cuenta bancaria de la corredora — la que se le indica al arrendatario en el
 * recordatorio de pago (L-DT5, L-CM7). Una por corredora: `personaId` es nulo y
 * el índice único parcial de setup.sql lo asegura, así que esto es un upsert
 * sobre esa única fila.
 */
export async function guardarCuentaCorredora(data: {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rutTitular: string;
  email: string;
}): Promise<ResultadoCorredora> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager") {
      return { ok: false, error: "Solo el administrador de la cuenta puede editar la cuenta bancaria." };
    }

    const error = validarCuentaBancaria(data);
    if (error) return { ok: false, error };

    const email = data.email.trim() || null;

    await withTenant(actor.tenantId, async (tx) => {
      const existente = await tx.cuentaBancaria.findFirst({
        where: { tenantId: actor.tenantId, personaId: null },
        select: { id: true },
      });
      const payload = {
        banco: data.banco.trim(),
        tipo: data.tipo as never,
        numero: normalizarNumeroCuenta(data.numero),
        titular: data.titular.trim(),
        rutTitular: canonicalRut(data.rutTitular.trim()),
        email,
      };
      if (existente) {
        await tx.cuentaBancaria.update({ where: { id: existente.id }, data: payload });
      } else {
        await tx.cuentaBancaria.create({
          data: { tenantId: actor.tenantId, personaId: null, ...payload },
        });
      }
    });

    revalidatePath("/panel/corredora");
    return { ok: true };
  } catch (e) {
    logError("guardarCuentaCorredora", e);
    return { ok: false, error: "No se pudo guardar la cuenta bancaria. Intenta de nuevo." };
  }
}

/** Elimina la cuenta bancaria de la corredora. */
export async function eliminarCuentaCorredora(): Promise<ResultadoCorredora> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager") {
      return { ok: false, error: "Solo el administrador de la cuenta puede eliminar la cuenta bancaria." };
    }
    await withTenant(actor.tenantId, (tx) => tx.cuentaBancaria.deleteMany({
      where: { tenantId: actor.tenantId, personaId: null },
    }));
    revalidatePath("/panel/corredora");
    return { ok: true };
  } catch (e) {
    logError("eliminarCuentaCorredora", e);
    return { ok: false, error: "No se pudo eliminar la cuenta bancaria." };
  }
}
