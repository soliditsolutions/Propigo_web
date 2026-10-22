/**
 * Template del panel — se re-monta en cada navegación (a diferencia del
 * layout), por lo que la animación de entrada corre en cada cambio de página.
 */
export default function PanelTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pgo-enter">{children}</div>;
}
