---
tipo: regla
titulo: Horas pico y ventana de mantenimiento
tags: [reglas, operacion, supabase, mantenimiento]
actualizado: 2026-11-06
estado: vigente
---

# Horas pico y ventana de mantenimiento

**Para todo el equipo (personas y agentes).** Hora de Colombia. Medido sobre los mensajes de
WhatsApp y los pedidos reales de los últimos 14 días (24-oct al 6-nov-2026).

## Por qué importa

El 6-nov-2026 la base de datos (Supabase, tamaño **Nano**) se saturó a las **12:04 p. m.** y
durante unos 20 minutos se colgaron el panel, el bot y los crons; hubo que reiniciar el proyecto.
En horas pico cualquier trabajo pesado extra (conversiones de fotos, cargas masivas,
migraciones, sincronizaciones grandes, consultas de diagnóstico sobre tablas grandes) puede
tumbar todo mientras hay campañas activas.

## El día en franjas

| Hora (Colombia) | Nivel | Mensajes/hora (prom.) | Qué está pasando |
|---|---|---|---|
| **2:00 – 5:00 a. m.** | 🟢 **Valle** | 11–15 | Casi nadie escribe. **Ventana de mantenimiento.** |
| 1:00 – 2:00 a. m. · 5:00 – 6:00 a. m. | 🟢 Bajo | 25–44 | Aceptable para trabajos cortos. |
| 11:00 p. m. – 1:00 a. m. | 🟡 Medio-bajo | 32–48 | Aún entran pedidos (~20 en 14 días a las 12 a. m.). |
| 6:00 – 8:00 a. m. | 🟡 Medio | ~90 | Arranca el día. |
| **8:00 – 11:00 a. m.** | 🔴 **Pico** | 127–168 | **El pico más alto del día es a las 8 a. m.** |
| 11:00 a. m. – 12:00 m. | 🟡 Medio | ~96 | |
| **12:00 m. – 1:00 p. m.** | 🔴 **Pico** | ~156 | Hora del almuerzo. Fue la hora de la caída del 6-nov. |
| 1:00 – 2:00 p. m. | 🟡 Medio | ~93 | Muchos pedidos (39 en 14 días). |
| **2:00 – 3:00 p. m.** | 🔴 **Pico** | ~131 | |
| 3:00 – 6:00 p. m. | 🟡 Medio | 76–107 | |
| **6:00 – 9:00 p. m.** | 🔴 **Pico** | 151–154 | **Más pedidos del día: 8 p. m.** (60 en 14 días). |
| 9:00 – 11:00 p. m. | 🟡 Medio-alto | 92–104 | Fines de semana sube (126/h a las 9 p. m.). |

**Lunes a viernes** son más intensos que el fin de semana en la mañana y al mediodía.
**Sábados y domingos** el pico fuerte es en la noche (8–10 p. m.).

## Reglas de operación

1. **Mantenimiento pesado solo de 2:00 a 5:00 a. m.**: subir o bajar el tamaño de Supabase,
   reiniciar el proyecto (salvo emergencia), conversiones o cargas masivas de fotos, migraciones
   que reescriban tablas, sincronizaciones grandes y limpiezas de datos.
2. **Nunca en pico** (8–11 a. m., 12–1 p. m., 2–3 p. m., 6–9 p. m.): nada de lo anterior.
   Tampoco consultas de diagnóstico sobre `messages`, `conversations` completas o
   `storage.objects` (un `count(*)` sobre `conversations` llegó a tardar 84 s el 6-nov).
3. **Publicar código en Vercel sí se puede a cualquier hora**: no apaga nada. Aun así, si el
   cambio toca el bot o el webhook, mejor fuera de pico para poder vigilarlo.
4. **Emergencia** (la base ya está caída): reiniciar de inmediato en Supabase →
   ⚙️ Project Settings → General → **Restart project**. No borra datos; 1–3 min fuera de línea.
5. Antes de lanzar un trabajo pesado, revisar en Supabase (página del proyecto) que **CPU y RAM**
   estén tranquilos. Con RAM por encima de ~75 % en Nano, no lanzar nada.

## Cómo volver a medirlo

```sql
-- Mensajes por hora (Colombia), últimos 14 días
select extract(hour from created_at at time zone 'America/Bogota')::int as hora,
       round(count(*)/14.0) as mensajes_por_dia
from messages where created_at > now() - interval '14 days'
group by 1 order by 1;
```

Correrla **en horario de valle**, no en pico.

Relacionado: [[supabase]] · [[despliegue]] · [[reglas-duras]]
