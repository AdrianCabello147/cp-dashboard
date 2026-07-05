# Business Rules

## Objetivo

Este documento define las reglas de negocio oficiales del Asistente de Producción PSI.

Todo cambio en el sistema debe respetar estas reglas.

---

# Reglas Generales

## BR-001

Toda Production Order debe tener una etapa actual.

---

## BR-002

Toda Production Order debe tener un responsable.

---

## BR-003

Toda Production Order debe tener una próxima acción.

---

## BR-004

No se puede avanzar de etapa sin cumplir las condiciones de la etapa actual.

---

## BR-005

Toda tarea tiene una fecha objetivo.

---

## BR-006

Toda tarea vencida genera una alerta.

---

## BR-007

No se puede cerrar una Production Order si la documentación está incompleta.

---

## BR-008

No se puede despachar un equipo mientras la Production Order permanezca abierta en SAP.

---

## BR-009

Todo cambio de etapa debe actualizar automáticamente:

- Responsable
- Próxima acción
- Agenda
- KPIs
- Alertas
- Checklist