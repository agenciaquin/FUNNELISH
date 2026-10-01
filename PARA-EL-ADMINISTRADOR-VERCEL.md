# Para el administrador de Vercel · qué hacer antes de publicar la versión unificada

**De:** creativoquin-cpu · **Fecha:** 30-09-2026
**Contexto:** se ha unido en una sola versión (rama `integracion`) lo que corre hoy en `pedido.klixmant.shop`
(v174), el compresor de imágenes de `master` y los arreglos de seguridad. Está revisada por el auditor. Para
publicarla sin cortar nada hacen falta estos pasos, que solo puede dar quien tiene acceso al equipo
**AGENCIA QUIN** en Vercel, a Meta y a cron-job.org.

> **No compartas los valores de las claves en chats ni documentos.** Basta con decir "hecho" en cada punto.
> **Importante:** una variable nueva o cambiada **no se aplica hasta la siguiente publicación**, y para quitarla
> también hay que volver a publicar (o volver al despliegue anterior desde el panel).

---

## 1 · Vercel (panel → proyecto → Settings)

| # | Proyecto | Qué hacer |
| --- | --- | --- |
| 1.1 | `quinchat-agencia-quin` y `quinchat-comercial` | **Ignored Build Step** (Settings → Git): que cada proyecto solo publique cuando cambie su carpeta (`quinchat/` o `quin-comercial/`), comparando contra el último despliegue y no contra el commit anterior |
| 1.2 | `quinchat-comercial` | **Crear `CRON_SECRET`** (una cadena larga al azar). **Hoy no existe**: sin ella, tras publicar no corre ningún cron de esa app |
| 1.3 | `quinchat-agencia-quin` | Comprobar que `CRON_SECRET` **existe** (no cambiarla) |
| 1.4 | `quinchat-agencia-quin` | Crear `WHATSAPP_APP_SECRET` = la **clave secreta de la app de Meta** de la agencia (Meta → la app → Configuración → Básica) |
| 1.5 | `quinchat-comercial` | `WHATSAPP_APP_SECRET`: **antes, comprobar en Meta qué app tiene como webhook `www.klixmant.shop/api/whatsapp/webhook`** y usar la clave de **esa** app. **Si no se sabe con seguridad, no crearla**: sin ella funciona como hoy; con la clave equivocada se rechazan todos los mensajes |
| 1.6 | los dos | Comprobar que existe `R2_PUBLIC_URL` si se usa R2 para fotos |
| 1.7 | los dos | **No crear todavía** `FUNNELISH_WEBHOOK_TOKEN`: va coordinado con el paso 3 |
| 1.8 | `quinchat` (`quinchat-sepia.vercel.app`) | Proyecto creado por error que se construye en cada envío: **desconectar Git** ahora y borrarlo en 7 días |
| 1.9 | equipo | Opcional: retención de despliegues (p. ej., 1 mes). No borrar despliegues a mano: son la marcha atrás |

## 2 · cron-job.org

- **Todas** las tareas de las dos apps tienen que mandar la clave: cabecera `Authorization: Bearer <CRON_SECRET>`
  o `?secret=<CRON_SECRET>` al final de la URL.
- En **quin-comercial**, ninguna la manda todavía: añadirla a **todas**, con la clave nueva del punto 1.2.
- En **quinchat**, revisar sobre todo `ventas-seguimiento` y `carrito-recuperacion`, que antes no la pedían.

## 3 · Funnelish (el mismo día, en este orden)

1. Elegir una cadena larga al azar para cada proyecto.
2. **quinchat:** en Funnelish, añadir `?token=<la cadena>` a la URL del webhook (conservar `&modo=agente` si lo
   lleva). Se puede hacer antes de crear la variable.
3. **quin-comercial:** cada cliente tiene su propia URL con token. Las generamos nosotros y se las pasamos.
   **Primero** las cambia cada cliente y **después** se crea la variable. Si no, se cortan sus ventas.
4. Entonces crear `FUNNELISH_WEBHOOK_TOKEN` en cada proyecto y volver a publicar.

## 4 · El día de publicar

- Avisar de la hora: hay que tener alguien mirando los **registros de ejecución** de los dos proyectos durante
  la primera hora, con la marcha atrás a mano desde el panel si hace falta.
- Lo demás (base de datos, rotación de tokens de promociones, pruebas con un WhatsApp a cada línea) lo hacemos
  nosotros. Está detallado en `INTEGRACION.md` §6 de la rama.

---

**Gracias.** Cuando termines los puntos 1 y 2, responde con "hecho 1 y 2" y avanzamos con 3 y 4.
