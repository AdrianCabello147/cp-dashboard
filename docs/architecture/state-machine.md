# Production State Machine

## Objetivo

La máquina de estados determina la etapa actual de cada Production Order.

Toda la lógica del sistema depende de esta etapa.

- Responsable
- Próxima acción
- Checklist
- Alertas
- KPIs
- Agenda
- Vistas por usuario

---

## Estados

| Estado | Responsable | Progreso |
|---------|-------------|----------|
| OT_CREATED | Adrián | 0% |
| ENGINEERING_REVIEW | Adrián | 10% |
| SUPPORTS | Juan Carlos | 20% |
| WAITING_MATERIALS | Compras / CS | 30% |
| PICKING | Julio / Hernán | 40% |
| MATERIALS_IN_WORKSHOP | Julio / Hernán | 50% |
| ASSEMBLY | David / Juan Carlos / Santiago | 60% |
| TESTING | PSI | 75% |
| DOCUMENTATION | Adrián | 90% |
| READY_TO_DISPATCH | Adrián | 95% |
| CLOSED | SAP | 100% |