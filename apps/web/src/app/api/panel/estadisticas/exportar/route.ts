import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenant, getProyeccionesRiesgo } from "@/lib/queries";
import { puedeExportar } from "@/lib/plans";

/**
 * Exportación CSV de "Proyecciones y Riesgo" — exclusiva Diamond (dentro del
 * tier avanzada, que también cubre Gold). Gateada aparte de tierIndex porque
 * es la única diferencia funcional entre Gold y Diamond (ver arquitectura,
 * Fase 2.4): ambos ven los mismos paneles, solo Diamond puede exportarlos.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  // ADR-0013 (Fase D) — Estadísticas es exclusiva del Manager; esta ruta no
  // pasa por el matcher de proxy.ts (solo cubre /panel/:path*, no /api/panel/*),
  // así que el guard va aquí directamente.
  if (session.rol !== "manager") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  let tenant;
  try {
    tenant = await getTenant();
  } catch {
    return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 });
  }

  // La capacidad vive en la definición del plan (lib/plans.ts), no en una
  // comparación de strings acá: los planes cambiaron y la exportación pasó a
  // estar incluida desde Gold. Con el helper, mover esa línea es editar un
  // campo del plan, no cazar literales "diamond" repartidos por el código.
  if (!puedeExportar(tenant.plan)) {
    return NextResponse.json(
      { error: "La exportación de información está disponible desde el plan Gold." },
      { status: 403 },
    );
  }

  const data = await getProyeccionesRiesgo(tenant.id);

  const filas: string[] = [];
  filas.push("Sección,Mes,Cobrado (CLP),Proyectado (CLP),Aproximado");
  for (const p of data.proyeccionIngresos) {
    filas.push(`Proyección de ingresos,${p.mes},${p.realizadoClp},${p.proyectadoClp},${p.esAproximado ? "Sí" : "No"}`);
  }
  filas.push("");
  filas.push("Sección,Tasa actual (%),Tasa proyectada (%),Tendencia");
  filas.push(`Riesgo de mora,${data.riesgoMora.tasaActualPct},${data.riesgoMora.tasaProyectadaPct},${data.riesgoMora.tendencia}`);
  filas.push("");
  filas.push("Sección,Propiedad,Arrendatario,Vence,Días restantes");
  for (const a of data.alertasRenovacion) {
    filas.push(`Alerta de renovación,"${a.direccion.replace(/"/g, '""')}","${a.arrendatario.replace(/"/g, '""')}",${a.fechaFin.toISOString().slice(0, 10)},${a.diasRestantes}`);
  }

  const csv = "﻿" + filas.join("\n"); // BOM — Excel abre UTF-8 con tildes correctamente
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proyecciones-riesgo-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
