# Visión y alcance

## Objetivo

Propigo es una aplicación web para la **gestión de arriendos** de casas, departamentos y cabañas en Chile, dirigida a **corredores de propiedades** y dueños de inmuebles. Soporta arriendos de **periodo largo** (contratos anuales, indexados a UF/IPC) y **periodo corto** (días, tipo Airbnb).

Modelo de negocio: **suscripción SaaS en UF** (mensual/trimestral/anual), con precio escalonado según la cantidad de propiedades gestionadas.

## El problema (dolores del competidor "Leasity")

Del levantamiento con la usuaria (Caro), los fallos concretos a resolver:

| # | Dolor de Leasity | Qué exige a Propigo |
|---|---|---|
| 1 | El sistema solo reconoce el pago cuando el corredor "liquida" manualmente. Si vence el día 5 y liquida el 7, marca 2 días de atraso y cobra intereses injustos. | **Detección/conciliación automática del pago con su fecha real.** |
| 2 | No se pueden personalizar fechas ni montos de pago. | **Fechas y montos configurables por contrato.** |
| 3 | Sin infraestructura elástica: se cae en periodos de uso intenso. | **Arquitectura elástica;** picos de pago no deben tumbar el sistema. |
| 4 | Procesos engorrosos: ingresar una liquidación puede tomar horas. | **UX simple para usuarios no técnicos;** cálculo automático. |
| 5 | Al cambiar de arrendatario, se arrastran los vouchers del anterior. | **Vouchers aislados por contrato/arrendatario;** inmutables. |
| 6 | Cálculos manuales (valor arriendo, % comisión, etc.). | **Motor de cálculo automático.** |
| 7 | El reajuste de IPC se aplica a todos los contratos una vez al año, sin importar la fecha de inicio de cada uno. | **Reajuste de IPC en el aniversario de CADA contrato.** |
| 8 | Sin filtros para revisar vouchers (rango de fechas, arrendatario, etc.). | **Búsqueda y filtros sobre el historial financiero.** |

Lo que **sí** valoran de Leasity (a conservar):

- Control de liquidaciones; envío de comprobantes (boucher) y liquidaciones por correo a arrendatario y arrendador al pagar.
- Recordatorios automáticos de pago.
- Cuenta recaudadora / billetera (saldo acumulado que se retira a fin de mes).

## Nuestra propuesta

1. **Gestión de arriendos** diarios y por contrato, resolviendo los 8 fallos anteriores.
2. **Marketplace público** de viviendas en arriendo, con contacto directo al corredor.
3. **Pagos**: PAC (pago automático de cuenta) + "pago fácil" (pago directo desde la web con registro inmediato).
4. **Gestión de publicaciones**: CRUD de imágenes, precios, arrendatarios y datos — solo sobre propiedades sin contrato vigente o arriendo en curso.
5. **UX amigable** para clientes que no se manejan con tecnología. Interfaz responsiva.
6. **Seguridad** de datos financieros y personales (información altamente sensible).

## Roles de usuario

- **Corredor** (administrador del tenant en el SaaS).
- **Propietario** (dueño del inmueble).
- **Arrendatario** (paga el arriendo; usa "pago fácil"/PAC).
- **Público** (visitante del marketplace; aún no autenticado).

## Fuera de alcance del MVP

Ver [Roadmap del MVP](../gestion/roadmap-mvp.md). En resumen: el MVP local prioriza el **núcleo financiero del SaaS B2B**; el marketplace público y los arriendos diarios se abordan en fases posteriores.
