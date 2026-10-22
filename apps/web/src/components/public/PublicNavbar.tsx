import { Logo } from "./Logo";
import { PublicNavLinks, PublicNavLink } from "./PublicNavLinks";
import { PublicNavMenu } from "./PublicNavMenu";
import { getSession } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

/**
 * Navbar del sitio público (home, marketplace, fichas de propiedad, portal).
 * Grid de 3 columnas simétricas: logo (izq) — enlaces en píldora glass
 * (centrado real) — acciones de cuenta (der). Server component: lee la
 * sesión para alternar entre invitado (Iniciar sesión/Registrarse) y
 * corredor autenticado (Ir al panel/Cerrar sesión).
 */
export async function PublicNavbar() {
  const session = await getSession();

  return (
    <header className="pf-navbar">
      <div className="pf-navbar-grid mx-auto w-full max-w-7xl">
        <PublicNavLink href="/" className="pf-navbar-logo inline-flex items-center" aria-label={`${MARCA} — inicio`}>
          <Logo />
        </PublicNavLink>
        <PublicNavLinks />
        <PublicNavMenu isLoggedIn={!!session} />
      </div>
    </header>
  );
}
