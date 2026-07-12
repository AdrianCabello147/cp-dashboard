# Firestore — índices y auditoría de Producción

Fecha de auditoría: 2026-07-12. Alcance: revisión estática del portal y comparación con los contratos V1 de GBS. No se consultó ni modificó Firestore remoto.

## Índices propuestos (no creados)

| Consulta | Campos | Índice requerido | Motivo |
|---|---|---|---|
| Lista paginada de OT abiertas | `sap.Estado OT != "Cerrada"`; `orderBy(sap.Estado OT)`; `orderBy(sap.Production Order)` | Compuesto ascendente: `sap.Estado OT`, `sap.Production Order` | Firestore exige ordenar primero el campo de desigualdad y requiere índice compuesto al añadir el segundo orden. |
| Conteo de OT abiertas | `sap.Estado OT != "Cerrada"` | Índice de campo único ascendente de `sap.Estado OT` (normalmente automático) | Respalda `getCountFromServer` con el filtro de desigualdad. |
| Componentes de la página | `collectionGroup("components")` + `sap.Prod_DocEntry in [...]` | Índice de grupo de colección para `sap.Prod_DocEntry` ascendente, si Firestore lo solicita | Obtiene los componentes de hasta 25 OT en una sola consulta, sin N+1. |

No crear estos índices automáticamente. La consola de Firebase entregará el enlace exacto si alguno no existe; se debe revisar y aprobar antes de crearlo.

## Configuración Firebase encontrada

- Proyecto: `alte-psi`.
- Web SDK: Firebase modular `12.15.0` cargado desde `gstatic`.
- Auth: inicializado mediante `getAuth(app)`.
- Firestore: inicializado mediante `getFirestore(app)`.
- Hosting: no verificable desde el repositorio. No existen `firebase.json` ni `.firebaserc`; `CNAME` contiene `altepsi.cl` y el remoto Git es GitHub. Se requiere confirmar el proveedor y la configuración real de Hosting.
- No se encontró Firebase Admin SDK en el portal.

## Consultas Production revisadas

1. `productionOrders`: paginación con `where("sap.Estado OT", "!=", "Cerrada")`, dos `orderBy`, cursores y límite 26 para mostrar 25.
2. `components`: `collectionGroup("components")` filtrada por `sap.Prod_DocEntry in [...]`.
3. KPI: `getCountFromServer` sobre `productionOrders` con el mismo filtro de OT abierta.

No hay consultas Production a `pickings`, `purchases`, `purchaseOrderLines`, Planning, timeline ni comentarios. El uso de `components` como `collectionGroup` es compatible con la ruta aprobada `productionOrders/{Prod_DocEntry}/components/{componentId}`.

## Compatibilidad con el contrato V1

| Elemento | Resultado | Observación |
|---|---|---|
| Ruta OT `productionOrders/{Prod_DocEntry}` | Compatible | El módulo usa el ID del documento como `Prod_DocEntry`; el contrato fija ese ID como texto. |
| Bloques `sap` y `portal` | Compatible | Se lee `sap` para la operación y, de forma opcional, `portal.responsableNombre`, `portal.responsableId` y `portal.prioridad`; no se escriben. |
| Ruta de componentes | Compatible | `collectionGroup("components")` solo abarca las subcolecciones `components` existentes. |
| Campos OT | Compatible nominalmente | `Production Order`, `Estado OT`, `Nombre Cliente`, `Descripcion Producto` y `Fecha Comprometida SO` coinciden con el contrato productivo. |
| Campos componente | Compatible nominalmente | `Prod_DocEntry`, `Item No.`, `Descripción Componente`, `Cantidad Requerida`, `Cantidad Pendiente`, `Stock Disponible`, `Fecha Estimada Llegada` y `Estado Componente` existen en el contrato. |
| Pickings y purchases | Fuera de alcance | El módulo no los consulta; esto es consistente con el MVP solicitado. |

## Problemas e inconsistencias que deben validarse manualmente

1. **Tipo de `sap.Prod_DocEntry`: bloqueo potencial.** El contrato acepta número o texto entero. El módulo convierte IDs numéricos a número antes del filtro `in`; si la carga productiva almacenó ese campo como texto, la consulta de componentes no devolverá resultados. Confirmar el tipo real en Firestore con una OT conocida antes de operar.
2. **Semántica de llegada.** El contrato define `Fecha Estimada Llegada` como fecha de compra explícita y permite `NULL` sin compra. El módulo la presenta como llegada al taller; esa equivalencia no está establecida por el contrato y requiere validación funcional.
3. **OT abiertas.** El filtro excluye únicamente el texto exacto `Cerrada`. El contrato admite “Planificada/Liberada/Cerrada u otro SAP documentado”; deben confirmarse estados adicionales que deban considerarse cerrados o excluidos.
4. **Reglas remotas desconocidas.** No existe copia de `firestore.rules` en este repositorio. Debe verificarse que el usuario autenticado pueda leer tanto `productionOrders` como los documentos de `components` mediante consulta de grupo.
5. **Restricción temporal no es autorización de servidor.** `PRODUCTION_ALLOWED_USERS` oculta y bloquea la UI para `acabello@alte.cl`, pero vive en JavaScript cliente. Las reglas Firestore o custom claims deben restringir la lectura real antes de extender el acceso.
6. **Escrituras de autenticación existentes.** Production no contiene APIs de escritura, pero `auth/auth.js` invoca `ensureUserProfile`; `auth/firestore.js` hace `setDoc` al crear perfiles y `updateDoc` de `lastLogin` al iniciar sesión. Esto contradice una interpretación global de “cero escrituras Firestore” para la sesión completa, aunque no pertenece al módulo Production.
7. **Lista permitida depende del perfil Firestore.** La comprobación compara `window.currentUserProfile.email`, no directamente `auth.currentUser.email`. Si un perfil existente en `users/{uid}` no tiene `email` o está desactualizado, `acabello@alte.cl` no verá Producción aunque Firebase Auth lo autentique correctamente.

## Checklist de producción

- [x] Firebase configurado en cliente para el proyecto `alte-psi`.
- [x] Auth inicializado con Firebase Web SDK.
- [x] Firestore inicializado con Firebase Web SDK.
- [ ] Hosting confirmado: falta configuración/versionado local de Firebase Hosting.
- [ ] `productionOrders` encontrada remotamente: pendiente de consulta manual autorizada.
- [ ] `components` encontrada remotamente: pendiente de consulta manual autorizada.
- [x] Consultas compatibles nominalmente con el modelo V1.
- [x] Production no usa `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `writeBatch` ni `runTransaction`.
- [x] Production no usa Admin SDK ni dependencias del importador GBS.
- [ ] Solo lectura de sesión completa: pendiente mientras Auth mantenga escrituras de perfil/login.

## Pasos manuales para dejar el MVP operativo

1. Iniciar sesión como `acabello@alte.cl` y confirmar que aparece la pestaña Producción; repetir con otro usuario para confirmar “Acceso restringido”.
2. En Firestore Console, inspeccionar una OT real y un componente para confirmar que `sap.Prod_DocEntry` tiene el mismo tipo usado por la consulta y que los nombres de campo coinciden exactamente.
3. Ejecutar la lista y aprobar únicamente el índice que Firestore solicite para la consulta de OT abiertas.
4. Verificar reglas remotas: usuario autenticado autorizado debe leer OT y componentes; no autorizado debe ser denegado; ningún cliente debe escribir documentos SAP.
5. Definir si `Fecha Estimada Llegada` representa realmente la llegada al taller y qué estados SAP, además de `Cerrada`, dejan de ser OT abiertas.
6. Confirmar la plataforma de Hosting y configurar un flujo de despliegue/rollback separado antes de publicar el MVP.
