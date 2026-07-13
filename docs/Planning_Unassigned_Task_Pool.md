# Bolsa de tareas disponibles de Planning

## Propósito

Permite crear tareas pendientes sin responsable y que un usuario activo y asignable las tome desde Planning. No crea usuarios ficticios ni modifica tareas antiguas durante la lectura.

## Pertenencia y compatibilidad

Una tarea pertenece a la bolsa si `deleted !== true`, su estado es `Pendiente`, no tiene responsable en ninguno de los campos históricos (`responsableId`, `responsibleUid`, `responsableNombre`, `responsibleName`, `responsableTaller` o `responsible`) y `disponibleParaAutoasignacion !== false`.

Las tareas antiguas que no tienen `disponibleParaAutoasignacion` siguen siendo elegibles cuando cumplen las demás condiciones. El selector guarda ausencia real como cadenas vacías en los campos de responsable y `disponibleParaAutoasignacion=true`; una asignación manual lo deja en `false`.

## Roles y transacción

- `admin`: conserva edición y asignación manual; también puede tomar tareas.
- `operator`: puede tomar una tarea disponible si `active === true` y `assignable === true`.
- `viewer` o usuarios inactivos/no asignables: no ven el botón ni pueden completar la operación.

`claimPlanningTask(taskId, currentUser)` vive en `auth/firestore.js`, se expone mediante `planning-services.js` y es llamada por `planning.js`; la UI no accede a Firestore.

La operación usa `runTransaction`: vuelve a leer la tarea, verifica estado pendiente, ausencia de responsable, no eliminación y disponibilidad. Después fija responsable, `assignedAt`, `assignedBy`, `assignmentMode="self"`, `updatedAt`, `updatedBy` y desactiva disponibilidad. El estado se conserva como `Pendiente`.

La misma transacción crea un evento `self_assigned` de timeline con usuario, responsable anterior/nuevo, estado anterior/nuevo y timestamp de servidor. Si otra persona ganó la carrera, la transacción aborta y el cliente recarga las tareas afectadas sin sobrescribir al responsable.

## UI y filtros

La bolsa se renderiza entre “Planificadas esta semana” y el tablero por colaboradores. Muestra código, actividad, OT/PSI, cliente, tipo, prioridad, complejidad/puntos, fechas, motivo, comentario y creación sin presentar valores nulos.

El filtro Responsable incorpora “Sin responsable”. “Todos” incluye asignadas y sin responsable; una tarea disponible se muestra solo en la bolsa para evitar duplicación. No se implementó liberar una tarea: queda como mejora futura.

## Reglas Firestore y validación pendiente

No existe un archivo de reglas Firestore versionado en este repositorio, por lo que no se desplegó ninguna regla. Antes de publicar, las reglas deben permitir una transacción de un usuario autenticado/activo/asignable que cambie solo los campos de autoasignación de una tarea pendiente sin responsable, y que cree únicamente el evento de timeline correspondiente. Deben impedir cambios a bloques SAP y tareas ya asignadas. Se recomienda probarlo con Emulator Suite y dos sesiones.

Validación manual pendiente: crear sin responsable, verificar bolsa, tomar con operator, confirmar traslado/estado/timeline, repetir con dos sesiones, probar filtros y responsive móvil.

## Rollback y despliegue

No se desplegó Firebase Hosting ni se ejecutaron importadores. Para rollback, revertir el commit de esta funcionalidad; no hay migración de datos. Antes de publicar mediante GitHub Pages, ejecutar la validación manual y actualizar el cache-busting de `index.html` solo tras aprobarla.
