# Producción — MVP interno

Módulo de solo lectura restringido temporalmente a `acabello@alte.cl`. Consulta OT abiertas de `productionOrders` paginadas de 25 en 25 y sus componentes con una única consulta `collectionGroup("components")` por página; no hay consultas N+1 ni lecturas de Planning, compras, timeline o comentarios.

La lista excluye `sap.Estado OT = "Cerrada"`. Los componentes se agregan por OT para calcular disponibilidad, faltantes, próxima llegada y semáforo. El total de OT abiertas usa `getCountFromServer`; los KPIs de materiales reflejan la página visible, porque Firestore no dispone de una agregación entre documentos padre e hijos sin un resumen gestionado por backend.

La consulta paginada requiere un índice compuesto de `sap.Estado OT` ascendente y `sap.Production Order` ascendente. Debe revisarse y aprobarse en Firestore si la consola lo solicita; no se creó ningún índice remoto.
