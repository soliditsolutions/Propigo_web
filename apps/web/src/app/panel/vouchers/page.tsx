import { getActor, getVouchers, getContratosSelect, propiedadIdsVisibles } from "@/lib/queries";
import { clp, fecha } from "@/lib/format";
import { PageTitle } from "@/components/panel/ui";
import { FiltrosClient } from "./filtros-client";
import { ReceiptText, FileText, Download } from "lucide-react";

export const dynamic = "force-dynamic";

const TIPO_LABEL = {
  pago:        { label: "Pago",        color: "var(--hw-primary)" },
  liquidacion: { label: "Liquidación", color: "var(--hw-success)" },
  garantia:    { label: "Devolución de garantía", color: "var(--hw-warning)" },
} as const;

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; desde?: string; hasta?: string; contratoId?: string }>;
}) {
  const actor   = await getActor();
  const params  = await searchParams;
  const propiedadIds = await propiedadIdsVisibles(actor);

  const tipo = (params.tipo === "pago" || params.tipo === "liquidacion" || params.tipo === "garantia")
    ? params.tipo : undefined;

  const [vouchers, contratos] = await Promise.all([
    getVouchers(actor.tenantId, {
      tipo,
      desde:      params.desde,
      hasta:      params.hasta,
      contratoId: params.contratoId,
    }, propiedadIds),
    getContratosSelect(actor.tenantId, propiedadIds),
  ]);

  return (
    <>
      <PageTitle
        title="Historial de vouchers"
        subtitle="Comprobantes de pago y liquidaciones emitidos por el sistema."
      />

      <FiltrosClient
        contratos={contratos}
        tipoActivo={tipo}
        desdeActivo={params.desde}
        hastaActivo={params.hasta}
        contratoIdActivo={params.contratoId}
      />

      {vouchers.length === 0 ? (
        <div
          className="mt-4 flex flex-col items-center justify-center rounded-2xl py-16 text-center"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)" }}
        >
          <ReceiptText className="h-10 w-10 mb-3" style={{ color: "var(--hw-text-4)" }} aria-hidden />
          <p className="font-medium" style={{ color: "var(--hw-text-2)" }}>Sin vouchers</p>
          <p className="mt-1 text-sm" style={{ color: "var(--hw-text-4)" }}>
            Cambia los filtros o concilia un pago para generar el primer voucher.
          </p>
        </div>
      ) : (
        <div
          className="mt-4 overflow-hidden rounded-2xl"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--hw-surface-2)", borderBottom: "1px solid var(--hw-border)" }}>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Arrendatario
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Propiedad
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Monto CLP
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v, i) => {
                  const tipoInfo = TIPO_LABEL[v.tipo] ?? { label: v.tipo, color: "var(--hw-text-3)" };
                  return (
                    <tr
                      key={v.id}
                      className="hw-row-hover"
                      style={{ borderBottom: i < vouchers.length - 1 ? "1px solid var(--hw-border)" : "none" }}
                    >
                      <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "var(--hw-text-3)" }}>
                        {fecha(v.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: `${tipoInfo.color}18`, color: tipoInfo.color }}
                        >
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--hw-text-2)" }}>
                        {v.arrendatario.nombre}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--hw-text-3)" }}>
                        {v.propiedad.direccion}
                        {v.propiedad.comuna && (
                          <span className="ml-1 text-xs" style={{ color: "var(--hw-text-4)" }}>
                            · {v.propiedad.comuna}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums hw-num" style={{ color: "var(--hw-text-1)" }}>
                        {clp(v.montoClp)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {v.folio && (
                            <a
                              href={`/api/panel/vouchers/${v.id}/pdf`}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--hw-surface-2)]"
                              style={{ color: "var(--hw-primary)" }}
                              aria-label={`Descargar comprobante ${v.folio}`}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              PDF
                            </a>
                          )}
                          <a
                            href={`/panel/contratos/${v.contratoId}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--hw-surface-2)]"
                            style={{ color: "var(--hw-text-3)" }}
                            aria-label={`Ver contrato de ${v.arrendatario.nombre}`}
                          >
                            <FileText className="h-3.5 w-3.5" aria-hidden />
                            Contrato
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid var(--hw-border)", background: "var(--hw-surface-2)" }}
          >
            <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
              {vouchers.length} voucher{vouchers.length !== 1 ? "s" : ""}
              {tipo && ` · solo ${TIPO_LABEL[tipo].label.toLowerCase()}`}
            </p>
            <p className="text-xs font-semibold tabular-nums hw-num" style={{ color: "var(--hw-text-2)" }}>
              Total: {clp(vouchers.reduce((s, v) => s + v.montoClp, 0))}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
