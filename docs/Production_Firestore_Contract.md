# Contrato Firestore de Produccion

## Decision de arquitectura

`GBS` es la capa oficial de importacion y gobierno de datos productivos.
`cp-dashboard` es la interfaz principal para el equipo PSI.

El flujo acordado es:

```text
SAP Business One
  -> SQL / Excel Maestro
  -> GBS importer
  -> Firestore
  -> cp-dashboard
```

## Coleccion principal

`cp-dashboard` consume la coleccion:

```text
productionOrders/{Prod_DocEntry}
```

El ID del documento es `Prod_DocEntry` como texto. No se usa el numero visible de OT como ID tecnico.

## Bloques del documento

Cada documento de `productionOrders` se considera dividido en bloques de propiedad:

```text
sap       Datos provenientes de SAP. Solo lectura para cp-dashboard.
portal    Datos internos de PSI Operations Platform. Editable en fases futuras.
planning  Vinculo futuro con Planning. No editable por Produccion en esta fase.
metadata  Metadata tecnica del importador. Solo lectura para cp-dashboard.
```

## Subcolecciones consumidas

La interfaz de Produccion puede leer:

```text
productionOrders/{Prod_DocEntry}/components/{componentId}
productionOrders/{Prod_DocEntry}/pickings/{pickingId}
productionOrders/{Prod_DocEntry}/purchases/{purchaseId}
```

En el MVP actual de `cp-dashboard`, Produccion consulta `components` mediante `collectionGroup("components")` para la pagina visible.

## Campos usados por cp-dashboard Produccion

### Desde `sap`

- `Production Order`
- `Estado OT`
- `Nombre Cliente`
- `Codigo Cliente`
- `Vendedor`
- `Descripcion Producto`
- `Fecha Comprometida SO`
- `Target Day OT`
- `Fecha Termino Real`
- `Cumplimiento OTD`
- `Dias de Atraso`

### Desde `portal`

- `responsableId`
- `responsableNombre`
- `prioridad`

Estos campos son internos del Portal. El importador GBS debe preservarlos.

### Desde `components.sap`

- `Prod_DocEntry`
- `Item No.`
- `Descripcion Componente`
- `Cantidad Requerida`
- `Cantidad Pendiente`
- `Stock Disponible`
- `Estado Componente`
- `Fecha Estimada Llegada`
- `Target Day Compra`

## Reglas de propiedad

- `GBS` puede crear y actualizar `sap` y metadata de importacion.
- `GBS` no debe sobrescribir `portal`.
- `GBS` no debe sobrescribir `planning`.
- `cp-dashboard` no debe escribir en `sap`.
- `cp-dashboard` no debe modificar `metadata`.
- `cp-dashboard` no debe eliminar documentos de `productionOrders`.

## Estado actual

Produccion en `cp-dashboard` es de solo lectura.

Lee OT abiertas desde Firestore, excluyendo `sap.Estado OT = "Cerrada"`, muestra hasta 25 OT por pagina y calcula disponibilidad de materiales sobre la pagina visible.

## Fases futuras

Antes de habilitar escrituras desde Produccion se deben definir reglas Firestore para permitir solo campos controlados dentro de `portal`, manteniendo `sap`, `planning` y `metadata` protegidos.
