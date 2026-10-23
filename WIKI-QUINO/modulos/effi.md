---
tipo: modulo
titulo: Estado en Effi
tags: [effi, logistica, entregas]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/sql/contacto-effi.sql", "quinchat/sql/effi-flete.sql", "quinchat/sql/effi-motivo.sql"]
---

# Estado en Effi

Sección del panel que muestra el **estado real de entrega** de cada pedido y el **flete**.

- Tabla: `effi_guias` (estado, flete, motivo).
- Migraciones relacionadas en `quinchat/sql/`: `contacto-effi.sql`, `effi-flete.sql`,
  `effi-motivo.sql`, `entrega-fallida.sql`.

Cierra el ciclo: [[pedidos]] → [[confirmacion-de-pedidos]] → despacho → Effi.

La opción de **recoger en oficina (Interrapidísimo)** con abono de $5.000 se decide en la
confirmación → [[confirmacion-de-pedidos]].
