import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compila el paquete de dominio del workspace (sin pre-build).
  transpilePackages: ["@propigo/core"],
  // Prisma 7 + driver adapter: dejar como externos en el servidor.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // SEC: headers de seguridad para todas las rutas.
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          // Bloquea embeber la app en iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // El browser no debe adivinar tipos MIME (sniffing)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtrar la URL de origen a sitios externos
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app no usa cámara/micrófono/geolocalización
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: solo en prod (dev usa HTTP). 2 años + subdomains + preload.
          ...(isProd ? [{
            key:   "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          }] : []),
          // CSP dinámica con nonce: gestionada por proxy.ts (se genera por request).
          // Este fallback solo aplica a rutas no cubiertas por el proxy matcher.
          // En dev se incluye 'unsafe-eval' — React lo necesita para reconstruir
          // call stacks en modo desarrollo (jamás se incluye en producción).
          {
            key:   "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline'",
              // *.tile.openstreetmap.org: tiles del mapa de ubicación en el marketplace público
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // /nueva-contrasena lleva el token de recuperación en la URL query string.
        // Referrer-Policy: no-referrer previene que el token se filtre via Referer — CWE-640.
        source: "/nueva-contrasena",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Los uploads jamás deben ejecutar scripts ni cargar recursos externos.
        // FIX A1: "style-src 'unsafe-inline'" permite los estilos inline del
        //   documento HTML de reconocimiento de deuda, que fue saneado con esc().
        //   "sandbox allow-same-origin" mantiene el aislamiento sin romper el render.
        // Imágenes (jpg/png/pdf): "default-src 'none'" + sandbox basta.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; style-src 'unsafe-inline'; sandbox allow-same-origin",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cachear uploads públicos agresivamente (son inmutables: UUID.ext)
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
