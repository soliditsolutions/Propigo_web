/**
 * Tests: evaluatePassword() — política 2026-07-31 (mínimo 8, composición
 * mixta, blocklist investigada, sin información personal).
 */
import { describe, it, expect } from "vitest";
import { evaluatePassword, PASSWORD_MIN_LENGTH } from "../password-strength";

describe("evaluatePassword() — largo mínimo", () => {
  it("rechaza contraseñas de menos de 8 caracteres", () => {
    const r = evaluatePassword("Ab1!xy");
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/8 caracteres/);
  });

  it(`PASSWORD_MIN_LENGTH es ${8}`, () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("cadena vacía no pasa y no lanza error", () => {
    expect(evaluatePassword("").passes).toBe(false);
  });
});

describe("evaluatePassword() — composición: letra + número + carácter especial", () => {
  it("rechaza contraseña sin carácter especial", () => {
    const r = evaluatePassword("Zqmxpr41");
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/carácter especial/);
  });

  it("rechaza contraseña sin número", () => {
    const r = evaluatePassword("Zqmxpr!!");
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/número/);
  });

  it("rechaza contraseña sin letras (solo números y símbolos)", () => {
    const r = evaluatePassword("80417293!!");
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/letra/);
  });

  it("acepta con letra + número + especial, largo mínimo", () => {
    expect(evaluatePassword("Xk7#mQ2p").passes).toBe(true);
  });
});

describe("evaluatePassword() — contraseñas comunes investigadas (NordPass / BioBioChile Chile 2025-2026)", () => {
  it.each([
    "Password1!", "Qwerty123!", "Admin123!", "Welcome123!",
    "Colocolo1!", "Benjamin1!", "Santiago12!", "Hola1234!",
  ])("rechaza variante compuesta de contraseña común: %s", (pwd) => {
    const r = evaluatePassword(pwd);
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/común o predecible/);
  });

  it("detecta variantes leet-speak (P@ssw0rd → password)", () => {
    expect(evaluatePassword("P@ssw0rd1!").passes).toBe(false);
  });
});

describe("evaluatePassword() — secuencias y repeticiones", () => {
  it("rechaza secuencia ascendente de 4+ (1234)", () => {
    const r = evaluatePassword("Ab1234!!");
    expect(r.passes).toBe(false);
  });

  it("rechaza secuencia de letras (abcd)", () => {
    const r = evaluatePassword("abcdEF1!");
    expect(r.passes).toBe(false);
  });

  it("rechaza carácter repetido 4+ veces seguidas", () => {
    const r = evaluatePassword("aaaaB1!x");
    expect(r.passes).toBe(false);
  });

  it("no rechaza una corrida corta de 3 (no es secuencia obvia)", () => {
    // "123" es corrida de 3, no de 4 — no debería activar el detector de secuencia
    // (igual podría fallar por blocklist si coincide con otra entrada, por eso
    // se arma con un final poco común)
    const r = evaluatePassword("Mi123Zqx!");
    expect(r.passes).toBe(true);
  });
});

describe("evaluatePassword() — información personal", () => {
  it("rechaza si contiene el nombre del usuario", () => {
    const r = evaluatePassword("Benjamin82!", { nombre: "Benjamin Soto" });
    expect(r.passes).toBe(false);
    expect(r.suggestion).toMatch(/nombre, correo o RUT/);
  });

  it("rechaza si contiene el nombre sin importar mayúsculas/tildes", () => {
    const r = evaluatePassword("nicoLAS99!!", { nombre: "Nicolás Pérez" });
    expect(r.passes).toBe(false);
  });

  it("rechaza si contiene el local-part del correo", () => {
    const r = evaluatePassword("jperez2026!", { email: "jperez@corredora.cl" });
    expect(r.passes).toBe(false);
  });

  it("rechaza si contiene los dígitos del RUT", () => {
    const r = evaluatePassword("Clave19283746!", { rut: "19.283.746-5" });
    expect(r.passes).toBe(false);
  });

  it("no rechaza por coincidencias cortas (<3 caracteres) del nombre", () => {
    // "Yo" como parte del nombre no debería bloquear cualquier contraseña
    // que por azar contenga esas dos letras.
    const r = evaluatePassword("Xk7#mQ2p", { nombre: "Yo" });
    expect(r.passes).toBe(true);
  });

  it("acepta una contraseña sólida que no contiene datos personales", () => {
    const r = evaluatePassword("Tr8!zQmPx", { nombre: "Benjamin Soto", email: "bsoto@corredora.cl", rut: "19283746-5" });
    expect(r.passes).toBe(true);
  });
});

describe("evaluatePassword() — graduación del medidor para contraseñas válidas", () => {
  it("largo 8-11 → score 2 (Aceptable)", () => {
    const r = evaluatePassword("Xk7#mQ2p");
    expect(r.passes).toBe(true);
    expect(r.score).toBe(2);
  });

  it("largo 12-15 → score 3 (Buena)", () => {
    const r = evaluatePassword("Xk7#mQ2pVwLr");
    expect(r.passes).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });

  it("largo 16+ → score 4 (Excelente)", () => {
    const r = evaluatePassword("Xk7#mQ2pVwLr9!Zt");
    expect(r.passes).toBe(true);
    expect(r.score).toBe(4);
  });
});
