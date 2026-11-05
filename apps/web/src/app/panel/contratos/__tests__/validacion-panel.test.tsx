// @vitest-environment jsdom
/** M-08: un 504 sin JSON en la validación IA no se presenta como falla de la red del usuario. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ValidacionPanel } from "../validacion-panel";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

function montar() {
  render(
    <ValidacionPanel contratoId="c1" fase="pre_firma" resultadoPrevio={null} estadoPrevio={null}
      validacionAt={null} confirmadaAt={null} cupoIa={null} />,
  );
  return screen.getByRole("button", { name: /Analizar contrato con IA/ });
}

describe("ValidacionPanel — errores", () => {
  it("504 con HTML del proxy: problema nuestro, anunciado", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Gateway Timeout</html>", { status: 504 }));
    fireEvent.click(montar());
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/problema de nuestro lado/);
    expect(alerta).not.toHaveTextContent(/conexión/);
  });
  it("motivo del servidor tal cual", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "El contrato no tiene texto que revisar." }), { status: 422 }));
    fireEvent.click(montar());
    expect(await screen.findByRole("alert")).toHaveTextContent("El contrato no tiene texto que revisar.");
  });
  it("fetch rechazado: problema de comunicación", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    fireEvent.click(montar());
    expect(await screen.findByRole("alert")).toHaveTextContent(/comunicarnos con el servidor|Sin conexión/);
  });
});
