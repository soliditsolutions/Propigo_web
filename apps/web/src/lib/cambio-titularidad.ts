import { formatearRut } from "@housing/core";

/**
 * L-CM6 — aviso al arrendatario cuando la propiedad que ocupa cambia de
 * propietario. Solo informa el hecho: el contrato vigente sigue rigiendo tal
 * cual (no hay novación por el cambio de titular), y cualquier cambio en la
 * forma de pago (nueva cuenta bancaria) se comunica aparte cuando exista.
 */
export function construirAvisoCambioTitularidad(input: {
  direccion: string;
  propietarioNuevoNombre: string;
  propietarioNuevoRut: string;
  fechaEfecto: Date;
}): { asunto: string; cuerpo: string } {
  const fecha = input.fechaEfecto.toLocaleDateString("es-CL", {
    day: "numeric", month: "long", year: "numeric",
  });
  const asunto = `Cambio de propietario — ${input.direccion}`;
  const cuerpo = [
    `Te informamos que, a partir del ${fecha}, la propiedad que arriendas en ${input.direccion} cambió de propietario.`,
    "",
    `Nuevo propietario: ${input.propietarioNuevoNombre} (RUT ${formatearRut(input.propietarioNuevoRut)})`,
    "",
    "Las condiciones de tu contrato de arriendo vigente no se ven alteradas por este cambio. Si la forma de pago cambia, te lo informaremos por separado.",
  ].join("\n");
  return { asunto, cuerpo };
}
