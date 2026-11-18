"use client";

import { useCallback, useEffect, useState } from "react";
import { ESTRUCTURAS } from "@/components/acceso/estructuras";
import type { EstadoDemo } from "@/components/acceso/forms";
import type { Flujo } from "@/components/acceso/textos";

const FLUJOS: { id: Flujo; nombre: string }[] = [
  { id: "login", nombre: "Ingresar" },
  { id: "recuperar", nombre: "Recuperar" },
  { id: "registro", nombre: "Crear cuenta" },
];

/** Estados que se pueden forzar para revisarlos sin esperar a que ocurran. */
const ESTADOS: Record<Flujo, { id: EstadoDemo; nombre: string }[]> = {
  login: [
    { id: "normal", nombre: "Normal" },
    { id: "error", nombre: "Credenciales incorrectas" },
    { id: "pausa", nombre: "Pausa de seguridad" },
  ],
  recuperar: [
    { id: "normal", nombre: "Normal" },
    { id: "enviado", nombre: "Enlace enviado" },
  ],
  registro: [
    { id: "normal", nombre: "Normal" },
    { id: "camara", nombre: "Cámara bloqueada" },
    { id: "creada", nombre: "Cuenta creada" },
  ],
};

type Inicial = { e?: string; f?: string; s?: string; p?: string; barra?: string };

/** Estado inicial desde la dirección (?e=tabs&f=login&s=normal&p=0&barra=0): permite compartir y capturar cada vista. */
export function PreviewAcceso({ inicial }: { inicial: Inicial }) {
  const [estructura, setEstructura] = useState(ESTRUCTURAS.some((x) => x.id === inicial.e) ? inicial.e! : "tabs");
  const [flujo, setFlujo] = useState<Flujo>(FLUJOS.some((x) => x.id === inicial.f) ? (inicial.f as Flujo) : "login");
  const [demo, setDemo] = useState<EstadoDemo>(
    ESTADOS[FLUJOS.some((x) => x.id === inicial.f) ? (inicial.f as Flujo) : "login"].some((x) => x.id === inicial.s) ? (inicial.s as EstadoDemo) : "normal",
  );
  const [paso, setPaso] = useState(Number(inicial.p) >= 0 && Number(inicial.p) <= 2 ? Number(inicial.p) : 0);
  const barra = inicial.barra !== "0";

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("e", estructura); q.set("f", flujo); q.set("s", demo); q.set("p", String(paso));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [estructura, flujo, demo, paso]);

  const cambiarFlujo = useCallback((f: Flujo) => { setFlujo(f); setDemo("normal"); setPaso(0); }, []);
  const actual = ESTRUCTURAS.find((x) => x.id === estructura) ?? ESTRUCTURAS[0];
  const Estructura = actual.Componente;

  return (
    <>
      <Estructura flujo={flujo} onFlujo={cambiarFlujo} demo={demo} paso={paso} onPaso={setPaso} />

      {barra ? (
        <div className="pgo-prev-barra" role="toolbar" aria-label="Controles de la vista previa">
          <div className="pgo-prev-grupo">
            <span>Estructura</span>
            {ESTRUCTURAS.map((x) => (
              <button key={x.id} type="button" aria-pressed={estructura === x.id} onClick={() => setEstructura(x.id)}>{x.nombre}</button>
            ))}
          </div>
          <div className="pgo-prev-grupo">
            <span>Pantalla</span>
            {FLUJOS.map((x) => (
              <button key={x.id} type="button" aria-pressed={flujo === x.id} onClick={() => cambiarFlujo(x.id)}>{x.nombre}</button>
            ))}
          </div>
          <div className="pgo-prev-grupo">
            <label htmlFor="prev-estado"><span>Estado</span></label>
            <select id="prev-estado" value={demo} onChange={(e) => setDemo(e.target.value as EstadoDemo)}>
              {ESTADOS[flujo].map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
          {flujo === "registro" ? (
            <div className="pgo-prev-grupo">
              <span>Paso</span>
              {[0, 1, 2].map((n) => (
                <button key={n} type="button" aria-pressed={paso === n} onClick={() => setPaso(n)}>{n + 1}</button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
