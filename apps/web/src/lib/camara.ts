/**
 * Por qué falló la cámara y qué puede hacer la persona. getUserMedia rechaza con
 * un error cuyo nombre distingue la causa: un mensaje único («no pudimos acceder»)
 * deja a quien se registra sin saber si debe cambiar un permiso, cerrar otra
 * aplicación o simplemente subir un archivo.
 */
export type DiagnosticoCamara = {
  mensaje: string;
  /** Si tiene sentido ofrecer «Reintentar» (el permiso o el uso de la cámara pueden cambiar). */
  reintentable: boolean;
};

const SUBIR = "Puedes subir una foto en su lugar.";

export function diagnosticarCamara(error: unknown): DiagnosticoCamara {
  const nombre = error instanceof Error || (typeof error === "object" && error !== null && "name" in error)
    ? String((error as { name: unknown }).name)
    : "";

  switch (nombre) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        mensaje:
          "El navegador bloqueó la cámara. Permítela desde el candado junto a la dirección y reintenta. " +
          "Si abriste esta página dentro de otra aplicación, ábrela en Chrome o Edge. " + SUBIR,
        reintentable: true,
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return { mensaje: "No encontramos una cámara en este equipo. " + SUBIR, reintentable: false };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return {
        mensaje: "Otra aplicación está usando la cámara. Ciérrala y reintenta. " + SUBIR,
        reintentable: true,
      };
    case "SecurityError":
      return {
        mensaje: "El navegador solo permite la cámara en conexiones seguras (https). " + SUBIR,
        reintentable: false,
      };
    default:
      return { mensaje: "No pudimos acceder a la cámara. " + SUBIR, reintentable: true };
  }
}
