
## Remisiones de venta (04-nov-2026)
- `GET /api/remision_v?desde&hasta&pagina&por_pagina` (mismo Bearer). Teléfono en `telefono_cliente`; guía en `guia` / `id_guia_transporte`.
- `hasta` es EXCLUSIVO (igual que en guías): se pide hasta MAÑANA.
- Se copian los últimos 20 días en `effi_remisiones_api` dentro de la misma sincronización (si fallan, las guías no se caen; queda en `effi_sync_log.error_remisiones`).
- Panel "Estado en Effi": guía → 🟢/🟡 · remisión sin guía → 🔵 "Subida · sin guía" · nada → 🟠 sin subir.
- Anulada = `estado` contiene "anulad". `vigente` se guarda pero NO se usa aún (en el ejemplo de la doc venía "0" en remisiones normales); revisar con datos reales.
