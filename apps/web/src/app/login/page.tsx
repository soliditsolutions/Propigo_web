import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { Aviso } from "@/components/acceso/campos";
import { titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Iniciar sesión"),
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <MarcoGuiado flujo="login">
      <LoginForm resetSuccess={reset === "1"} />
      {/* Solo fuera de producción: mostrar credenciales válidas en el login
          público de producción sería una exposición innecesaria. */}
      {process.env.NODE_ENV !== "production" ? (
        <div style={{ marginTop: 18 }}>
          <Aviso variante="info" titulo="Cuenta de demostración">
            <span>maria@corredorademo.cl · <code>Demo1234!</code></span>
          </Aviso>
        </div>
      ) : null}
    </MarcoGuiado>
  );
}
