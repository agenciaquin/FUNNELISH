# Hallazgo · La API completa es alcanzable sin sesión desde el dominio público

**Fecha:** 29 de agosto de 2026
**Proyecto:** `quinchat` · `pedido.klixmant.shop`
**Estado:** **detectado y verificado. Sin corregir — pendiente de aprobación.**
**Severidad:** alta

---

## Resumen para decidir

Las **82 rutas de la API** de `quinchat` responden **sin pedir sesión** en
`pedido.klixmant.shop`, el dominio público que reciben unos 509 visitantes
distintos al día.

Entre ellas hay rutas que envían WhatsApp desde el número del negocio, que leen
y modifican credenciales, que borran datos de clientes y que disparan procesos
masivos con una simple visita.

Todas se ejecutan con la clave `service_role`, que **ignora RLS y permisos de
tabla**. Es decir: esta vía rodea por completo el modelo de seguridad de la base
de datos. El cierre de tablas previsto en la fase 1 no habría tapado ninguna.

No es un fallo introducido por el trabajo de compresión de imágenes. Es anterior
y se detectó al probar una de las rutas de subida.

---

## La causa

`quinchat/middleware.ts` distingue dos sitios sobre el mismo proyecto:

- **el panel** — todo protegido salvo una lista corta de rutas públicas
- **la tienda** — es la rama con el problema:

```js
if (esTienda) {
  const interno = pathname.startsWith('/p/')
    || pathname.startsWith('/api/')   // ← deja pasar la API ENTERA
    || pathname.startsWith('/_next')
    || pathname === '/tienda'
    || pathname.includes('.');

  if (!interno) { /* reescribe /slug -> /p/slug */ }
  return NextResponse.next();          // ← sin comprobar sesión
}
```

Ese `pathname.startsWith('/api/')` está pensado para que la tienda pueda llamar
a las rutas del checkout. Pero abre las 82.

---

## Evidencia

Medido con `media-api/auditar-rutas-api.ts`, que recorre `app/api/` y sondea
cada ruta en los dos dominios.

```
Alcanzables SIN sesion en la tienda : 82 de 82
Protegidas                          : 0
```

Ejemplo directo, la misma petición en los dos dominios:

| Dominio | Respuesta |
| --- | --- |
| `pedido.klixmant.shop/api/funnels/imagen` | **500** con el error propio de la ruta |
| `quinchat-agencia-quin.vercel.app/api/funnels/imagen` | **307** → `/login` |

Ese 500 dice que el handler llegó a ejecutarse: protestó por el `Content-Type`.
En el panel ni se alcanza.

### Cómo se midió sin causar daño

Sondear con `GET` habría sido peligroso: `/api/cron/remarketing` **habría
enviado mensajes de remarketing reales**. Por eso cada ruta se sondeó con un
verbo HTTP que ese archivo **no exporta**.

El middleware corre antes que el handler, así que la respuesta distingue los dos
casos sin que el handler se ejecute:

- redirección al login → protegida
- `405` u otra cosa → el middleware la dejó pasar

**No se leyó ningún cuerpo de respuesta de las rutas sensibles, no se extrajo
ningún dato y no se ejecutó ningún handler.**

---

## Qué queda expuesto, por tipo de daño

### Ejecutar procesos masivos con una visita

```
/api/cron/remarketing          [GET]
/api/cron/seguimiento-ia       [GET]
/api/cron/ventas-seguimiento   [GET]
```

### Enviar WhatsApp desde el número del negocio

```
/api/whatsapp/send · send-media · send-media-url   [POST]
/api/plantillas-wa/enviar                          [POST]
```

### Leer y modificar credenciales

```
/api/ajustes   [GET, PUT]
```

El `PUT` permite cambiarlas, no solo leerlas.

### Datos de clientes, con borrado

```
/api/contactos           [GET, POST]
/api/contactos/[id]      [PUT, DELETE]
/api/conversations/[id]  [DELETE]
/api/ventas/lista · /api/pedidos/lista · /api/pedidos/detalle
```

### Escritura en el bucket

```
/api/funnels/upload-url · /api/funnels/imagen · /api/catalogos/upload-imagen
```

En total, **41 de las 82** manejan datos sensibles o efectos secundarios.

---

## ¿Se ha aprovechado?

**No hay indicios, y tampoco puedo descartarlo.** La ventana de registros de
Supabase es de 24 horas, y en ese periodo el único tráfico anómalo fueron 38
respuestas `429` originadas por el propio servidor de la aplicación.

Comprobarlo a fondo requeriría registros de Vercel, que no se revisaron.

> Nota de plazo: el endpoint de registros por API de Supabase **deja de
> funcionar el 23 de septiembre de 2026**. Si se quiere una revisión histórica
> con herramientas, conviene hacerla antes.

---

## La corrección propuesta

Cambiar, en la rama de la tienda, el `startsWith('/api/')` por la lista de rutas
que la tienda realmente usa. Verificado leyendo `components/publico/`, son tres:

```
/api/funnels/carrito
/api/funnels/evento
/api/pedidos
```

Más la lista de públicas que ya existe (webhooks de Meta y Funnelish, crons), que
debe seguir pasando para no romper las integraciones.

**Tamaño del cambio:** unas ocho líneas en un archivo. No toca ninguna otra parte.

**Cómo verificarlo:** relanzando `auditar-rutas-api.ts`. Hoy da 82 abiertas;
después debería dar 5 o 6.

**Riesgo de la corrección:** si alguna integración externa llama a una ruta que
no esté en la lista, dejaría de funcionar. Se mitiga revisando los registros de
Vercel un par de días tras aplicarlo, igual que se planificó para la fase 1.

---

## Recomendación

Corregirlo antes que el resto del trabajo pendiente. El problema del egress era
dinero; esto son datos de clientes y el número de WhatsApp del negocio.

Dicho esto, **lleva así desde que existe el dominio de la tienda**. No es una
regresión de hoy y no exige una intervención de madrugada. Pero sí conviene que
vaya por delante de las fases 1 a 4.

---

## Quién detectó esto y con qué alcance

Detectado el 29-08-2026 durante el trabajo de optimización de imágenes, al
probar `POST /api/funnels/imagen`. Fuera del alcance encargado, que era consumo
de Supabase y compresión de media.

**No se aplicó ninguna corrección.** El trabajo se detuvo al confirmar el
hallazgo, a la espera de aprobación de la dirección del proyecto.
