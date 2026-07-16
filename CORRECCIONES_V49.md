# CORRECCIONES V49 — Billetera QUINO
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-04  
**Archivos nuevos/modificados:** `billetera.html` (nuevo), `billetera.js` (nuevo), `index.html`

---

## Qué es

Nueva sección "Billetera QUINO" accesible desde el sidebar. Muestra:

| Tarjeta | Qué muestra |
|---------|-------------|
| ✓ Comisión entregada | Suma de (Total neto − Costo manual − Flete) de pedidos entregados |
| ⏳ Pendiente por entregar | Misma fórmula para pedidos en tránsito/generados |
| ↩ Devoluciones | N devueltos × $23.000 (costo fijo) |
| 🏆 Ganancia final | Entregado − devoluciones |

Fórmula comisión por pedido: `Total neto − Costo manual − Valor flete guía inicial`

Estados del Excel:
- `Entregada a destino` → Entregado ✓
- `En transito`, `En reparto`, `Generada` → Pendiente ⏳
- Contiene "devolu" → Devolución ↩ (−$23.000 fijo)

---

## PASO 1 — Crear tabla en Supabase (SQL Editor)

```sql
CREATE TABLE IF NOT EXISTS remisiones_effi (
  id_remision   TEXT PRIMARY KEY,
  cliente       TEXT,
  telefono      TEXT,
  estado        TEXT,
  total_neto    NUMERIC DEFAULT 0,
  costo_manual  NUMERIC DEFAULT 0,
  valor_flete   NUMERIC DEFAULT 0,
  comision      NUMERIC DEFAULT 0,
  es_devolucion BOOLEAN DEFAULT FALSE,
  fecha_creacion TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## PASO 2 — Claude Code

> Los archivos ya están en la carpeta. Solo necesitas:
> `git add billetera.html billetera.js index.html && git commit -m "feat: billetera QUINO comisiones Effi V49" && git push origin master`

---

## Verificación

- [ ] El sidebar de la página principal muestra "💰 Billetera QUINO"
- [ ] Al hacer clic abre billetera.html
- [ ] Al subir el reporte de Effi aparecen las 4 tarjetas con datos
- [ ] Filtros "Entregados / Pendientes / Devueltos" funcionan
- [ ] Al subir el mismo reporte dos veces no duplica registros
