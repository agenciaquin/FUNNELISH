# Pendientes — se retoma en el otro PC

> **Responsable obligatoria: `creativoquin-cpu` (creativoquin@gmail.com).** Solo esta usuaria
> termina esta tarea. Cualquier otra persona o agente: no continúa, no une a `master`, no publica.
> Antes de seguir, comprobar `git config user.name`; si no es `creativoquin-cpu`, parar y avisar.

Rama `seguridad-c1-c2`. **Nada publicado.** Un envío a `master` publica `pedido.klixmant.shop`.

## Hecho (27-10-2026), sin publicar

1. **C1 y C2** (`quinchat/middleware.ts`, CONTRATO-API-CATALOGOS.md §10).
   - C1: `/api/pedidos` se compara exacto; `/lista`, `/detalle` y `/accion` piden sesión (`haySesion()`).
   - C2: en el dominio de la tienda, `/api/*` ya no pasa libre: solo las 6 rutas de `exactas`.
2. **Freno de escrituras en local** (`quinchat/lib/freno-local.ts`, franja `components/AvisoLocal.tsx`).
   En localhost se lee la base real pero no se guarda nada. Válvula: `NEXT_PUBLIC_ESCRITURA_LOCAL=abierta`.
3. **Packs de Embudos por id** en vez de por nombre (los nombres se repiten), en las dos apps.

Probado en local desde la terminal: las 3 rutas de pedidos sin sesión → `/login`; un POST → 423 «Local protegido».

## Falta probar (en el navegador)

- Entrar, mirar Pedidos y Embudos, intentar guardar: debe salir «Local protegido» y **deshacer** lo pintado.
- Selector de packs con dos categorías del mismo nombre.
- **C2 no se puede probar en local** (solo aplica en el dominio de la tienda). Tras publicar: comprar en la
  tienda y mirar los registros de ejecución de Vercel por 401 en rutas que falten en `exactas`.

## Integración de la API de catálogos — a medias

Hecho: `quinchat/app/api/klixmant/catalogos/route.ts` — vista previa, solo lee. Con `QUINCHAT_API_KEY`
llama a `/api/v1/catalogos` del reporte; sin llave, **solo en local**, devuelve una muestra de 5 catálogos.

Hecho el 28-10: botón «Klixmant» con vista previa y `lib/klixmant-identificar.ts` (probado con los
239 nombres reales). Fotos revisadas (CONTRATO §11): 58 son el cartel «COLOR NO DISPONIBLE»; se
excluyen en el **reporte**, rama `catalogos-sin-cartel` (commit aecdc97, sin publicar: su `main` publica).

Antes era el siguiente paso: el botón «Klixmant» en `components/panel/CatalogosPanel.tsx` (cabecera, junto a
«Nuevo Catálogo») que abra la vista previa: catálogos por categoría, casillas para activar categorías
(no se guardan) y una caja «lo que escribe el cliente → lo que ofrecería el bot».

Después (contrato §5), en orden:
1. SQL `quinchat/sql/catalogos-klixmant.sql`: guardián → lo pega la dueña en el Supabase del bot.
2. Copia diaria + botón «Actualizar catálogos» (rechazar lista vacía o con menos de la mitad).
3. «Vincular a un catálogo de Klixmant» a mano, nunca por nombre.
4. El bot ofrece propios activos + Klixmant de las **categorías activadas**; sin ninguna activa, sigue como hoy.
5. El pedido guarda `id_catalogo` e `id_variante`.

## Bloqueos que no son de código

- **`QUINCHAT_API_KEY`**: está en un proyecto de Vercel fuera del equipo agencia-quin. La dueña la pega
  en `quinchat/.env.local` (y luego en Vercel, Sensitive). Nunca con `NEXT_PUBLIC_`.
- **Arley**: confirmar que un `id_catalogo` nunca se reutiliza (antes de vincular por número).
- **§8.4**: ¿el pedido llega a Effi con «Observación concepto»? Lo confirma quien sube los pedidos.

## Al montar el local en el otro PC

- `npm ci --prefer-offline` en `quinchat/` (sin `node_modules` el editor sale en rojo: no es el código).
- `.env.local` no viaja (está en `.gitignore`). Copiar `.env.local.example` y llenar a mano.
  Las variables de Production en Vercel son `[SENSITIVE]`: las de Supabase se leen en **Development**.
- Dejar `QUINCHAT_LOCAL=1` y **no** abrir la escritura. Comprobar la franja «LOCAL · PROTEGIDO».
- Este PC tiene 7 GB: arrancar con `NODE_OPTIONS=--max-old-space-size=1536` y abrir una pantalla a la vez.
