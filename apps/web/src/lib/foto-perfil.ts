/**
 * Una foto de perfil solo puede ser una URL que entregó /api/upload?type=perfil:
 * nombre UUID y extensión de imagen. Así no se guarda una URL externa
 * (`//otro-sitio/x.png` empieza con "/"), un esquema `javascript:` ni una ruta
 * que salga de la carpeta.
 */
const FOTO_PERFIL_RE =
  /^\/uploads\/perfil\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp|gif)$/;

export function esFotoPerfilValida(url: string): boolean {
  return FOTO_PERFIL_RE.test(url);
}
