## Nueva regla de trabajo

Prioridad: avanzar rápido y dejar la plataforma funcionando localmente.

Codex puede modificar varios archivos en una misma tarea si es necesario.

No pedir aprobación por cada cambio pequeño.

Sí debe respetar estas restricciones:

- No cambiar la estructura de carpetas.
- No renombrar archivos.
- No conectar Firestore todavía.
- No conectar Google Sheets al módulo Planificación todavía.
- No modificar Producción ni Cotizaciones salvo que sea necesario para que la app cargue.
- No hacer refactors grandes innecesarios.

Objetivo inmediato:

Dejar el módulo Planificación completamente funcional en memoria, incluyendo:

- Crear tarea.
- Editar tarea.
- Cambiar estado.
- Iniciar tarea.
- Pausar tarea.
- Reanudar tarea.
- Terminar tarea.
- Comentarios locales.
- Timeline local.
- KPIs básicos.
- Todo funcionando localmente sin Firestore.

Codex debe hacer cambios completos y luego indicar:

- Archivos modificados.
- Qué funcionalidad quedó lista.
- Cómo probarla localmente.