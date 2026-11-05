import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getActor, type Actor } from "@/lib/queries";
import { logError } from "@/lib/logger";

/**
 * getActor() para rutas API: devuelve el actor o la respuesta de error lista.
 *
 * getActor señala "sin sesión" con redirect(), que Next implementa lanzando
 * un error propio. Las rutas lo capturaban junto con cualquier otro fallo y
 * respondían siempre lo mismo: una base caída se veía como "No autorizado" (y
 * no quedaba en el log) o la falta de sesión como "Servicio no disponible".
 * Aquí se separan: sin sesión → 401; cualquier otra cosa → log + 503.
 */
export async function actorDeRuta(contexto: string): Promise<Actor | NextResponse> {
  try {
    return await getActor();
  } catch (err) {
    if (esControlDeNext(err)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    logError(contexto, err);
    return NextResponse.json(
      { error: "Servicio no disponible. Intenta de nuevo en unos minutos." },
      { status: 503 },
    );
  }
}

/** true si el error es un redirect()/notFound() de Next y no un fallo real. */
function esControlDeNext(err: unknown): boolean {
  try {
    unstable_rethrow(err);
    return false;
  } catch {
    return true;
  }
}
