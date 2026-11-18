import { Check, Clock, Landmark, ShieldCheck } from "lucide-react";

/**
 * Un mes de arriendo de principio a fin, con datos de ejemplo. No es una captura
 * ni una promesa de cifras: muestra el recorrido real del producto (detectar el
 * pago, aplicar el reajuste del IPC, emitir un comprobante que no se altera).
 *
 * El ciclo dura 14 s y se repite; con movimiento reducido queda el estado final.
 */
const MESES = ["Jun", "Jul", "Ago", "Sep", "Oct", "Nov"];

export function EscenaProducto() {
  return (
    <div className="esc esc--vivo esc--fin" role="img" aria-label="Ejemplo: un pago detectado, el reajuste del IPC aplicado y el comprobante emitido">
      <div className="esc-aviso">
        <Landmark aria-hidden="true" />
        <span>Detectamos una transferencia de <b>$452.700</b></span>
      </div>

      <div className="esc-meses">
        {MESES.map((m, i) => (
          <div key={m} className={`esc-mes${i === MESES.length - 1 ? " esc-mes--ahora" : ""}`}>
            <i>
              {i === MESES.length - 1 ? (
                <>
                  <Clock className="esc-i-pend" aria-hidden="true" />
                  <Check className="esc-i-ok" aria-hidden="true" />
                </>
              ) : (
                <Check aria-hidden="true" />
              )}
            </i>
            {m}
          </div>
        ))}
      </div>

      <div className="esc-cabeza">
        <div>
          <strong>Depto. 502, Providencia</strong>
          <small>Arriendo de noviembre · vence el día 5</small>
        </div>
        <div className="esc-estado" aria-hidden="true">
          <span className="esc-e-pend"><Clock aria-hidden="true" />Pendiente</span>
          <span className="esc-e-ok"><Check aria-hidden="true" />Conciliado</span>
        </div>
      </div>

      <div className="esc-fila"><span>Arriendo base</span><b>$450.000</b></div>
      <div className="esc-fila esc-reajuste"><span>Reajuste por IPC (+0,6 %)</span><b>+ $2.700</b></div>
      <div className="esc-fila esc-fila--total"><span>Total del mes</span><b>$452.700</b></div>

      <div className="esc-comprobante">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Comprobante CP-2026-00001</strong>
          <small>Se emite al conciliar y no se puede modificar.</small>
        </div>
      </div>
    </div>
  );
}
