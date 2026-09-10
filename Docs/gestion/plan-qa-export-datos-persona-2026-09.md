# Plan de pruebas QA + Seguridad — export de datos personales (L-DP2 / L-DP3)

> **Alcance:** el ajuste del commit `fda4818` — el derecho de acceso y
> portabilidad: `lib/export-datos-persona.ts`, `lib/export-datos-persona-pdf.tsx`,
> `GET /api/panel/personas/[id]/export-datos`, y el disclosure en el detalle de
> contrato.
>
> **Por qué merece su propio plan:** es un **endpoint de salida masiva de datos
> personales**. El riesgo no es que falte un dato: es que salga uno de más —de la
> contraparte, de otra corredora, o de un tercero— o que un no-autorizado lo
> dispare.
>
> **Método:** igual que
> [plan-qa-seguridad-cambios-legales-2026-09.md](plan-qa-seguridad-cambios-legales-2026-09.md).
> Test automatizado contra Postgres real para el armado y el aislamiento;
> unitario con mocks para el gate de la ruta; navegador con sesión real para la
> verificación de punta a punta. Cualquier fallo se corrige en el acto.
>
> _Creado 2026-09-10._

---

## Superficie nueva

| Categoría | Elemento |
|---|---|
| **Ruta API** | `GET /api/panel/personas/[id]/export-datos?formato=json\|pdf` |
| **Núcleo** | `construirExportDatosPersona(tx, tenantId, personaId)` |
| **Documento** | `ExportDatosPersonaDocument` (PDF) |
| **UI** | `ExportDatosPersona` (disclosure en el detalle de contrato, manager-only) |
| **Datos que agrega el export** | identidad, contratos + períodos + comprobantes, cuentas bancarias, documentos, comunicaciones, `acceso_log`, `acceso_otp`, reservas, preferencia de notificación, valoraciones |
| **Escritura** | `auditoria_equipo` (`accion = "exportar_datos_persona"`) |

---

## Secciones

### A. Autenticación y autorización

| ID | Prueba | Esperado |
|---|---|---|
| A1 | La ruta sin sesión | `401`, sin cuerpo revelador |
| A2 | La ruta con sesión de **colaborador** | `403`, sin tocar la BD |
| A3 | Manager de la corredora X pide el export de una persona de la corredora Y | `404` (`PersonaNoEncontrada`), nunca datos |
| A4 | El disclosure de la UI aparece solo para el manager | sí |
| A5 | `getActor` lanza (sesión corrupta) → la ruta | `401`, no `500` |

### B. Aislamiento multi-tenant

| ID | Prueba | Esperado |
|---|---|---|
| B1 | `construirExportDatosPersona` con contexto de tenant B y personaId de tenant A | `PersonaNoEncontrada` |
| B2 | Cada consulta interna filtra por `tenantId` además de RLS | sí (revisión de código) |
| B3 | La ruta siempre pasa `actor.tenantId` a `withTenant` y a la función, nunca un valor del request | sí |

### C. Fuga de información — minimización de la contraparte

| ID | Prueba | Esperado |
|---|---|---|
| C1 | En el export de la parte A, la contraparte B aparece **solo por su nombre** | sin RUT, correo, teléfono ni cuenta de B |
| C2 | El export del **arrendatario** trae solo comprobantes de **pago**; el del **propietario**, solo de **liquidación** | sí — no se cruza el detalle de la comisión |
| C3 | Las **valoraciones** solo salen en el export del **arrendatario** (que es quien las deja) | el export del propietario no trae la opinión del arrendatario |
| C4 | Las **cuentas bancarias** del export son solo las de la persona (`personaId` = ella) | nunca la de la corredora ni la de la contraparte |
| C5 | El JSON completo no contiene el RUT/correo/teléfono de la contraparte en ningún campo | verificado por substring |
| C6 | `acceso_otp` se exporta sin el `codigo_hash` | solo fecha, canal, ip, si se usó |
| C7 | Documentos: se listan `nombre`/`tipo`/`fecha`, nunca los bytes | metadatos de documentos del propio contrato — aceptado |

### D. Inyección y validación de entrada

| ID | Prueba | Esperado |
|---|---|---|
| D1 | `[id]` no-UUID (`' OR 1=1--`, `../`, uuid falso) | `404`, sin tocar la BD, nunca `500` |
| D2 | `formato` con un valor arbitrario (`formato=../../etc`, `formato=<script>`) | se trata como `json`; sin efecto |
| D3 | Nombre / dirección de la persona con `<script>`, `</Text>`, `&`, `{}` en el **PDF** | react-pdf escapa; el render no rompe ni ejecuta |
| D4 | Mismos payloads en el **JSON** | quedan como texto literal (JSON.stringify escapa) |

### E. Integridad / auditoría

| ID | Prueba | Esperado |
|---|---|---|
| E1 | Cada export exitoso escribe una fila en `auditoria_equipo` con actor, rut, formato y persona | sí |
| E2 | Un export fallido (`PersonaNoEncontrada`) **no** escribe auditoría | sí |
| E3 | Rate limit: 20 exports/hora por usuario; el 21 | `429` con `Retry-After` |

### F. Correctitud del contenido

| ID | Prueba | Esperado |
|---|---|---|
| F1 | El export trae la identidad, los contratos, los períodos y los comprobantes de la persona | completo |
| F2 | El `meta` identifica al responsable (la corredora) y cita la Ley 21.719 | sí |
| F3 | El PDF se genera y es un PDF válido (multi-página, `%%EOF`) | sí |
| F4 | El JSON es parseable y su estructura es estable | sí |

### G. Documento PDF

| ID | Prueba | Esperado |
|---|---|---|
| G1 | Headers de la ruta (json y pdf) | `no-store, private` + `nosniff` + `Content-Disposition: attachment` |
| G2 | Nombre de archivo | `datos-personales-<rut>-<fecha>.<ext>` |
| G3 | Pie del PDF: "en ejercicio del derecho de acceso (Ley 21.719)" | presente |

---

## Resultados

_Ejecutado 2026-09-10. ✅ pasó · 🔧 falló y se corrigió · ⚠️ hallazgo._

### Cobertura

- `apps/web/src/lib/__tests__/export-datos-persona.test.ts` — 12 casos (armado
  contra Postgres real + minimización + inyección en el PDF con el componente real).
- `apps/web/src/app/api/panel/personas/[id]/export-datos/__tests__/route.test.ts`
  — 11 casos (gate, formato, 404, auditoría, rate limit).
- Navegador con sesión real de manager: los 4 endpoints, sin fuga cruzada.

### A. Autenticación y autorización

| ID | Resultado |
|---|---|
| A1 | ✅ Sin sesión → `401 {"error":"No autorizado."}`. |
| A2 | ✅ Colaborador → `403`, `construirExportDatosPersona` no se llama. |
| A3 | ✅ Manager de X con personaId de Y → `404` (`PersonaNoEncontrada`). |
| A4 | ✅ El disclosure solo se renderiza con `actor.rol === "manager"`. |
| A5 | ✅ `getActor` lanza → `catch` → `401`, no `500`. |

### B. Aislamiento multi-tenant

| ID | Resultado |
|---|---|
| B1 | ✅ Contexto tenant B + personaId tenant A → `PersonaNoEncontrada`. |
| B2 | ✅ Cada consulta interna lleva `tenantId` explícito además de RLS. |
| B3 | ✅ La ruta pasa `actor.tenantId` a `withTenant` y a la función; el request no aporta tenant. |

### C. Fuga de información — minimización de la contraparte

| ID | Resultado |
|---|---|
| C1 | ✅ La contraparte es `{ nombre }`. Verificado también en navegador: el export de Juan no trae el RUT ni el correo de Pedro, y viceversa. |
| C2 | 🔧 **Hallazgo #1**: `c.vouchers` traía **todos** los comprobantes del contrato. El arrendatario veía el folio y el monto de la **liquidación** (que refleja la comisión). **Corregido**: se filtra por `tipo` según el rol — arrendatario ve `pago`, propietario ve `liquidacion`. Mismo criterio que el portal (A3/A4 del plan anterior). Tests C2 / C2b. |
| C3 | 🔧 **Hallazgo #2**: las **valoraciones** se asociaban por `contratoId` de cualquier contrato de la persona. La valoración vía contrato la deja el **arrendatario**; en el export del **propietario** era la opinión de un tercero. **Corregido**: solo se incluyen las de contratos donde la persona es arrendatario. Test C3. |
| C4 | ✅ `cuentasBancarias` filtra por `personaId` = la persona; nunca la de la corredora (`personaId` null) ni la de la contraparte. Test C4. |
| C5 | ✅ El JSON completo no contiene RUT/correo/teléfono de la contraparte (substring, en test y en navegador). |
| C6 | ✅ `acceso_otp` se exporta sin `codigo_hash` (solo fecha, canal, ip, usado). |
| C7 | ✅ Documentos: solo `nombre`/`tipo`/`fecha`, nunca los bytes. Los tipos (`contrato`, `anexo`, `comprobante_pago`, `certificado_reserva`, `reconocimiento_deuda`, `otro`) son documentos del propio contrato, al que ambas partes tienen derecho — aceptado. |

### D. Inyección y validación de entrada

| ID | Resultado |
|---|---|
| D1 | ✅ `[id]` no-UUID → `404` sin tocar la BD (`idFiltro`). Test + navegador. |
| D2 | ✅ `formato=..%2F..%2Fetc%2Fpasswd` → se sirve JSON, sin efecto. Solo `"pdf"` exacto cambia el formato. |
| D3 | ✅ `<script>`, `</Text>`, `&`, `{}`, comillas en todos los campos de texto → el PDF se genera (`%PDF-`, > 1 KB), react-pdf escapa. |
| D4 | ✅ Los mismos payloads en el JSON quedan literales (round-trip `JSON.parse(JSON.stringify)`). |

### E. Integridad / auditoría

| ID | Resultado |
|---|---|
| E1 | ✅ Cada export exitoso → una fila en `auditoria_equipo` (`exportar_datos_persona`, rut · formato · persona, ip). Test + navegador. |
| E2 | ✅ Export fallido (`PersonaNoEncontrada`) → **no** escribe auditoría. |
| E3 | ✅ 21ª petición del mismo usuario en la hora → `429` con `Retry-After`. |

### F. Correctitud del contenido

| ID | Resultado |
|---|---|
| F1 | ✅ Identidad, contratos, períodos y comprobantes completos. |
| F2 | ✅ `meta.responsable` = la corredora; `meta.fundamento` cita la Ley 21.719 sin inventar números de artículo. |
| F3 | ✅ PDF válido, multi-página, `%%EOF` (3 páginas para una persona con 24 períodos). |
| F4 | ✅ JSON parseable, estructura estable (tipos explícitos en `ExportDatosPersona`). |

### G. Documento PDF

| ID | Resultado |
|---|---|
| G1 | ✅ json y pdf: `Cache-Control: no-store, private` + `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment`. |
| G2 | ✅ `datos-personales-<rut>-<AAAA-MM-DD>.<ext>`. |
| G3 | ✅ Pie: "en ejercicio del derecho de acceso (Ley 21.719)". |

### Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Media (fuga cruzada de detalle de comisión) | El export incluía comprobantes de ambos tipos; el arrendatario veía el folio/monto de la liquidación del propietario. | Filtro por `tipo` según el rol de la persona en el contrato. |
| 2 | Media (opinión de un tercero) | El export del propietario incluía la valoración dejada por el arrendatario. | Valoraciones solo en el export del arrendatario. |

Suites tras los cambios: **`apps/web` 862 ✅ · `@housing/core` 74 ✅**.
