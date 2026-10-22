# ADR-0010 — Arriendos por días (Short-Term Rentals / "Renta Corta")

**Fecha:** 2026-06-07  
**Estado:** Propuesto — pendiente de decisión de alcance  
**Autores:** Propigo · sesión de análisis de mercado

---

## Contexto

El corredor de la corredora gestiona principalmente arriendos mensuales (Ley 18.101).
Sin embargo, el mercado de **renta corta (short-term rental, STR)** en Chile creció un 47 %
en 2024 (4,6 millones de noches reservadas; USD 350 M en ingresos) y proyecta +18 % en 2025.
Los retornos de STR son 2×–3× superiores al arriendo mensual en zonas turísticas.

Un corredor moderno recibe cada vez más mandatos de propietarios que quieren rentar por días
vía Airbnb, Booking.com o canales propios. La pregunta es: **¿debe Propigo soportar STR,
y en qué alcance?**

---

## Pregunta de decisión

¿Implementamos soporte de arriendos por días como parte de Propigo y en qué fase?

---

## Marco legal relevante (Chile)

| Aspecto | Arriendo mensual | Arriendo por días |
|---|---|---|
| Ley aplicable | Ley 18.101 | Código Civil + Ley 21.442 (copropiedad) |
| Desahucio | Procedimiento Ley 18.101 (30–60 días) | Vía civil ordinaria / Juzgado Policía Local |
| IVA | No aplica (sin muebles) | **19 % si amoblado** (base = tarifa − 11 % avalúo/año proporcional) |
| Condominios | Sin restricciones especiales | Ley 21.442 Art. 8j reconoce el uso; el reglamento puede restringir horarios, acceso y ocupación |
| Impuesto renta | Global Complementario / 1ª Categoría | Igual; mayor facturación puede cambiar tramo |
| Regulación municipal | Sin ordenanza específica | **Vacío legal** — no existe ordenanza municipal en Santiago ni en otras ciudades (a junio 2026) |

> **Riesgo regulatorio:** El vacío municipal puede cerrarse con legislación futura (modelo europeo).
> Propigo debe incluir un alerta configurable si se activa alguna restricción en la ciudad de la propiedad.

---

## Modelo de mercado — cómo operan AirBnB y Booking

### Cobro al momento de la reserva

| Plataforma | Anticipo/reserva | Cuándo recibe el anfitrión |
|---|---|---|
| **Airbnb (pago total)** | 100 % al confirmar | 24 h después del check-in |
| **Airbnb (pago en 2 cuotas)** | 50 % al reservar; 50 % aprox. 7–14 días antes del check-in | 24 h después del check-in |
| **Booking.com (online)** | 100 % al reservar (Booking retiene) | Liquidación mensual |
| **Booking.com (en propiedad)** | Sin anticipo online | Huésped paga al llegar |

> **Conclusión para Propigo:** el porcentaje de anticipo (reserva) **no es fijo por ley**; lo
> define cada plataforma/corredor. El estándar de mercado es **30 %–50 %** cuando se cobra
> anticipadamente en plataformas propias. El 100 % es común en Airbnb por su seguro AirCover.
>
> Cuando Propigo gestione reservas STR propias (sin integración Airbnb), debe permitir al
> corredor configurar un **% mínimo de reserva** (recomendado 30 %, obligatorio para proteger
> al propietario de cancelaciones de último minuto).

### Comisiones de mercado (2025-2026)

| Plataforma | Al anfitrión | Al huésped | Modelo |
|---|---|---|---|
| Airbnb | **15,5 %** del subtotal | 0 % (modelo host-only desde 2025) | Comisión única |
| Booking.com | **14 %–18 %** | 0 % | Solo al propietario |
| VRBO/Expedia | 8 %–10 % | 6 %–12 % | Split o host-only |
| Plataformas STR locales (HOM, Arrenta) | 12 %–18 % | — | Variable |

---

## Análisis de brecha técnica — qué falta en Propigo para STR

El schema y la lógica actual están **diseñados exclusivamente para arriendo mensual**.
Las brechas son estructurales y no menores:

### Capa de datos (Prisma schema)

| Elemento necesario | Estado actual | Trabajo requerido |
|---|---|---|
| `precioPorNoche` en Propiedad/STR | ❌ No existe | Nuevo campo o modelo |
| Calendario de disponibilidad (bloqueo por fechas) | ❌ No existe | Nuevo modelo `BloqueoFecha` (desde/hasta, motivo) |
| Reserva STR con check-in/out y anticipo | ❌ Reserva actual es solo un estado de Propiedad | Rediseño de `Reserva` o nuevo modelo `ReservaSTR` |
| Período de estadía (días, no meses) | ❌ `PeriodoPago` es mensual | Nuevo modelo `EstadiaSTR` |
| Cargo de limpieza por estadía | ❌ No existe | Campo en Contrato/Estadía o tabla de servicios |
| Política de cancelación (flexible/moderada/estricta) | ❌ No existe | Nuevo modelo `PoliticaCancelacion` |
| Asiento de IVA (19 %) en ledger | ❌ `TipoAsiento` sin IVA | Nuevo enum value `CARGO_IVA` |
| Depósito de daños separado de garantía mensual | ❌ Garantía actual es para arriendo mensual | Nuevo campo `depositoDanosCLP` |
| `TipoPropiedad` ampliado (cabaña STR, apart-hotel) | ⚠️ Solo `casa/departamento/cabana` | Revisar si `cabana` es suficiente |

### Lógica de dominio (`packages/core`)

| Función | Estado | Trabajo |
|---|---|---|
| Generación de calendario de pagos diarios | ❌ | Nueva función `generarEstadias()` |
| Cálculo de IVA sobre arriendo amoblado | ❌ | Nueva función `calcularIvaArriendo()` |
| Motor de cancelación con penalización | ❌ | Nueva función `calcularReembolso()` |
| Revenue metrics (ADR, RevPAR, ocupación) | ❌ | Dashboard completamente distinto |

### UI/UX

| Componente | Estado | Trabajo |
|---|---|---|
| Calendario de disponibilidad (visual, drag) | ❌ | Componente nuevo (picker de rango de fechas) |
| Wizard de reserva STR | ❌ | Nuevo wizard (fechas → huésped → condiciones → pago) |
| Gestión de check-in/out | ❌ | Nueva sección en panel |
| Dashboard STR (ocupación, RevPAR, ingresos/noche) | ❌ | Módulo completamente distinto |
| Factura con IVA (boleta/factura electrónica) | ❌ | Integración SII o generación manual |

### Integraciones (Fase 2+)

| Integración | Necesidad |
|---|---|
| **Channel Manager** (Airbnb/Booking API) | Sincronizar disponibilidad y tarifas en tiempo real |
| **Smart lock / caja de llaves** | Gestionar acceso sin presencia física |
| **SII (boleta/factura electrónica)** | IVA obligatorio para arriendos amoblados |

---

## Estimación de esfuerzo

| Fase | Contenido | Estimación |
|---|---|---|
| **STR Básico** | Schema STR, reserva con anticipo configurable, calendario visual simple, estadía con IVA en ledger | ~3–4 semanas de desarrollo |
| **STR Intermedio** | Políticas de cancelación, cargo de limpieza, depósito de daños, dashboard RevPAR/ADR | ~4–6 semanas adicionales |
| **STR con Integraciones** | Channel manager (Airbnb/Booking API sync), boleta electrónica SII, smart lock | ~8–12 semanas adicionales |

---

## Opciones consideradas

### Opción A — Posponer totalmente a Fase 2 (recomendado para MVP actual)
- **Ventaja:** MVP mensual se entrega completo y sin deuda técnica mixta.
- **Desventaja:** Corredoras con mandatos STR no tienen solución hoy.
- **Acción:** Documentar la brecha en el roadmap; dejar el schema preparado para extensión sin romper lo mensual.

### Opción B — STR Básico en paralelo al MVP mensual
- **Ventaja:** Captura el mercado STR antes que la competencia.
- **Desventaja:** Aumenta la complejidad del MVP actual en un 50–60 %; riesgo de retraso.

### Opción C — Módulo STR independiente (micro-frontend / dominio separado)
- **Ventaja:** No contamina la lógica mensual; se puede lanzar separado.
- **Desventaja:** Duplica infraestructura; más caro de mantener.

---

## Decisión propuesta

**Opción A — Posponer a Fase 2**, con las siguientes acciones inmediatas:

1. El schema mensual NO se modifica, pero se diseña con sufijos claros (`PeriodoPago`, `Contrato`) que lo distingan del futuro modelo STR.
2. Se agrega `modalidadArriendo: mensual | diario` en `Propiedad` (campo no nulo, default `mensual`) para distinguir el tipo de activo desde el CRUD.
3. Se documenta la brecha técnica completa en este ADR.
4. El próximo sprint de STR parte por **"STR Básico"**: schema de bloqueo de fechas + reserva con anticipo configurable + IVA en ledger.

---

## Próximos pasos para contratos (arriendo mensual)

Los siguientes ítems están pendientes en el módulo de contratos mensuales y deben completarse antes de iniciar STR:

| Prioridad | Ítem | Justificación |
|---|---|---|
| 🔴 Alta | **Portal de autoconsulta OTP** (arrendatario/propietario) | Prometido en ADR-0007 y roadmap; sin esto el MVP no está completo |
| 🔴 Alta | **Firma electrónica / activación de contrato** con fecha de registro documental | Aristas legales; permite adjuntar PDF del contrato firmado |
| 🟡 Media | **Anexos de contrato** (`Documento` con tipo `anexo`) | Corredores necesitan adjuntar modificaciones contractuales |
| 🟡 Media | **Recordatorios automáticos** (simulados, ADR-0008) | Cadencia de cobro: 5 días antes, día del vencimiento, 3 días después |
| 🟡 Media | **Reconocimiento de deuda** (generación de documento desde ledger) | ADR-0009; necesario para cobro judicial |
| 🟢 Baja | **Workflow morosidad** (estado `moroso`, avisos escalonados) | Fase 2 pero íntimamente ligado al dominio mensual |
| 🟢 Baja | **Renovación automática de calendario** (antes de los 90 días) | Hoy se generan 12 períodos; hay que generar N más cuando queden < 90 días |

---

## Referencias

- Ley 21.442 de Copropiedad Inmobiliaria (2022), Art. 8j — uso habitacional temporal
- Ley 18.101 sobre arrendamiento de predios urbanos
- SII — Circular sobre IVA en arriendos de inmuebles amoblados
- Airbnb: comisión host-only 15,5 % (modelo vigente desde 2025)
- Booking.com: comisión 14–18 % al anfitrión
- Mercado STR Chile 2024: 4,6 M noches, USD 350 M ingresos (El Diario Inmobiliario)
