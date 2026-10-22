import type { MetadataRoute } from "next";
import { MARCA, ESLOGAN } from "@/lib/marca";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA,
    short_name: MARCA,
    description: ESLOGAN,
    start_url: "/",
    display: "standalone",
    background_color: "#0F1B3D",
    theme_color: "#1E6FE8",
    lang: "es-CL",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/brand/propigo-icon-192.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/brand/propigo-icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
