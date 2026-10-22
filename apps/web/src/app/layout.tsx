import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { runStartupChecks } from "@/lib/startup-check";
import { PGO_THEME_INIT_SCRIPT } from "@/lib/theme";
import { MARCA, ESLOGAN, DOMINIO } from "@/lib/marca";
import { MarcaDefs } from "@/components/public/Logo";
import "./globals.css";

// FIX A2: fail-fast en arranque — verifica variables de entorno críticas.
// Se ejecuta una sola vez al cargar el módulo del layout (proceso Next.js).
runStartupChecks();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPCION =
  "Software chileno para corredores de propiedades: administra contratos de arriendo, cobra la renta mensual y publica tu catálogo.";

export const metadata: Metadata = {
  // Base absoluta para la imagen de redes (opengraph-image.png) y enlaces canónicos.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? `https://${DOMINIO}`),
  title: `${MARCA} | ${ESLOGAN}`,
  description: DESCRIPCION,
  applicationName: MARCA,
  openGraph: {
    siteName: MARCA,
    title: `${MARCA} | ${ESLOGAN}`,
    description: DESCRIPCION,
    locale: "es_CL",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Leer el nonce inyectado por proxy.ts (propagado como request header x-nonce).
  // Next.js propagará este nonce a sus scripts inline de hidratación.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="es"
      nonce={nonce}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Anti-FOUC: fija data-theme antes del primer paint. nonce requerido
            por la CSP de proxy.ts (script-src 'nonce-...' 'strict-dynamic').
            suppressHydrationWarning: el navegador oculta el valor real del
            atributo nonce por seguridad (getAttribute devuelve ""), lo que
            genera un falso mismatch de hidratación — es esperado, no un bug. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: PGO_THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <MarcaDefs />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
