// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const { SetupDialog } = await import("../setup-dialog");

beforeEach(() => replace.mockReset());

describe("SetupDialog", () => {
  it("es un diálogo modal con nombre y descripción, y su título es h2 (el h1 es el de la página)", async () => {
    render(<SetupDialog />);
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Configura tu perfil para comenzar" }).tagName).toBe("H2");
    expect(document.querySelector("h1")).toBeNull();
  });

  it("el botón cierra el aviso y limpia ?setup=1", async () => {
    render(<SetupDialog />);
    fireEvent.click(await screen.findByRole("button", { name: /Completar mi perfil/ }));
    expect(replace).toHaveBeenCalledWith("/panel/perfil", { scroll: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Esc también lo cierra y limpia el parámetro", async () => {
    render(<SetupDialog />);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/panel/perfil", { scroll: false }));
  });
});
