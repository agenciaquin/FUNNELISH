# Memoria de Sesión — QuinChat Bot WhatsApp
**Última actualización:** 2026-07-18

## Proyecto
Bot de WhatsApp para KLIXMANT (Josué y Mallerlis). Stack: Next.js + Supabase + Meta WhatsApp Cloud API. Deploy en Vercel. Carpeta: `quinchat/`.

---

## Estado actual: 3 BUGS PENDIENTES DE CORREGIR

### BUG 1 — `isCompleteAddress` no acepta "Carrera 21 152 30" (sin `#` ni `-`)

**Archivo:** `quinchat/lib/address.ts`  
**Línea 13:**
```typescript
if (/\b(calle|carrera|diagonal|transversal|avenida|cl\b|cra\b|cr\b|kr\b|diag\b|av\b|cll\b)\s*\d+\s*[#\-]\s*\d/.test(a)) return true;
```
El regex exige `#` o `-`. "Carrera 21 152 30" (solo espacios) no pasa → el bot sigue pidiendo dirección.

**Fix:** Añadir DESPUÉS de la línea 13:
```typescript
// Acepta formato sin # ni -: "Carrera 21 152 30" (3 números separados por espacio)
if (/\b(calle|carrera|diagonal|transversal|avenida|cl\b|cra\b|cr\b|kr\b|diag\b|av\b|cll\b)\s*\d+\s+\d+\s+\d+/.test(a)) return true;
```
El fix en `isCompleteAddress` es suficiente; `getAddressQuestion` ya hace `if (isCompleteAddress(addr)) return null` al inicio, así que no genera pregunta errónea.

---

### BUG 2 — Rama `pendingPedido`: "quiero otro" no dispara promo; no pide talla

**Archivo:** `quinchat/app/api/whatsapp/webhook/route.ts`

**A) `mentionsDos` (línea ~707) no incluye "quiero otro":**
```typescript
const mentionsDos = ['quiero dos', 'comprar dos', '2 prendas', '2 buzos', 'dos prendas',
  'dos buzos', 'los dos', 'las dos', 'quiero 2', 'pack x2', 'combo 2',
  'quiero comprar dos'].some(w => textLower.includes(w));
```
Agregar: `'quiero otro', 'quiero otra', 'quiero añadir', 'añadir uno', 'añadir una', 'agregar uno', 'agregar una', 'uno más', 'una más', 'uno mas', 'una mas'`

**B) Cuando `mentionsDos=true` pero `allColorsInText=[]` → cae al `isMultiPrenda` block pero no hace match (`matchedItems.length=0`) → no maneja el mensaje.**

Dentro del bloque `isMultiPrenda` (después del check `matchedItems.length >= 2 || ...`), antes de `// Colores no coinciden...`, agregar:
```typescript
// "quiero otro" sin color → preguntar qué color + mostrar promo
if ((mentionsDos || mentionsTres) && allColorsInText.length === 0) {
  const colorListPend = famColoresMulti.map((c: any) => c.color).filter(Boolean).join(', ');
  const promoCount = mentionsTres ? 3 : 2;
  const promoValorRef = PROMO_PRICES[promoCount];
  const askColorMsg =
    `¡Perfecto! 😊 Para la promo de ${promoCount} prendas: *${promoValorRef}*\n\n` +
    `¿Qué color quieres agregar y en qué talla?\n` +
    `Disponibles: ${colorListPend || 'consulta con un asesor'}`;
  const wamid = await sendTextMessage(from, askColorMsg);
  await saveAndSend(supabase, from, askColorMsg, 'text', wamid);
  continue;
}
```

**C) Contexto: cuando el bot preguntó "qué color quieres agregar" (en pending) y el cliente responde → debe AGREGAR, no CAMBIAR.**

Añadir después de obtener `lastBotMsg` (línea ~794):
```typescript
const lastBotAskedAddColorPending =
  lastBotMsg?.content?.toLowerCase().includes('quieres agregar') ||
  lastBotMsg?.content?.toLowerCase().includes('color quieres agregar');
```

Y antes del bloque `colorChangeIntent` (línea ~806), añadir handler:
```typescript
if (lastBotAskedAddColorPending && mentionedColor) {
  const famColPend = await getFamColores(pendingPedido.producto);
  const matchPend = famColPend.find((c: any) =>
    (c.color ?? '').toLowerCase().includes(mentionedColor) ||
    (c.nombre_producto as string).toUpperCase().includes(mentionedColor.toUpperCase())
  );
  if (matchPend) {
    const currentCount = (pendingPedido.producto ?? '').split('+').length;
    const newCount = Math.min(currentCount + 1, 3);
    const combinedProd = `${pendingPedido.producto.trim()} + ${matchPend.nombre_producto}`;
    const promoValor = PROMO_PRICES[newCount] ?? '$325.000';
    await supabase.from('clientes_funnelish').update({ producto: combinedProd, valor: promoValor }).eq('id', pendingPedido.id);
    if (matchPend.url_imagen && matchPend.url_imagen !== FALLBACK_IMAGE) {
      const imgWamid = await sendImageByUrl(from, matchPend.url_imagen, matchPend.nombre_producto);
      await saveAndSend(supabase, from, matchPend.url_imagen, 'image', imgWamid);
    }
    const confirmMsg =
      `✅ ¡Promo activada! Tu pedido:\n*${combinedProd}*\n\n` +
      `💰 Valor: *${promoValor}*\n\nEscribe *CONFIRMO* para que lo despachemos en 24h. 🚚`;
    const wamid = await sendTextMessage(from, confirmMsg);
    await saveAndSend(supabase, from, confirmMsg, 'text', wamid);
    continue;
  }
}
```

---

### BUG 3 — `getFamColores` / `getColoresFamilia` devuelve productos de otra familia

**Raíz del problema:** Ambas funciones usan OR sobre TODAS las palabras del producto (incluyendo el color). Para "ROJO REDBULL" extrae ["ROJO", "REDBULL"] y busca productos que contengan CUALQUIERA → incluye "NEGRO NEW YORK" (que contiene "NEGRO", que no es una palabra del producto... espera, no). 

**Corrección real:** El problema es que ["ROJO", "REDBULL"] se usan como OR. Productos con "ROJO" que son de otra familia (p.ej. si existiera "ROJO NEW YORK") quedarían incluidos. Y al buscar el match para "negro", podría encontrar "NEGRO NEW YORK" si aparece antes en el arreglo.

**Fix:** Filtrar las palabras de color de `prodWords`, quedarse solo con las palabras de MARCA (no-color). Así "ROJO REDBULL" → busca solo "REDBULL" → no incluye productos de NEW YORK.

```typescript
// COLOR_NAMES en uppercase para filtrar
const COLOR_NAMES_UPPER = new Set(COLOR_NAMES.map((c: string) => c.toUpperCase()));

// En getFamColores (pending, línea ~693):
const getFamColores = async (productoRef: string) => {
  const { data: allC } = await supabase
    .from('catalogo_colores').select('color, nombre_producto, url_imagen')
    .not('url_imagen', 'is', null);
  const refWords = productoRef.toUpperCase().split(/\s+/);
  // Solo palabras de marca (no colores, 3+ chars)
  const brandWords = refWords.filter((w: string) => w.length >= 3 && !COLOR_NAMES_UPPER.has(w));
  const searchWords = brandWords.length > 0 ? brandWords : refWords.filter((w: string) => w.length >= 4);
  return (allC ?? []).filter((c: any) =>
    searchWords.some((w: string) => (c.nombre_producto as string).toUpperCase().includes(w))
  );
};

// En getColoresFamilia (confirmed, línea ~352):
const getColoresFamilia = async (productoRef: string) => {
  const { data: allC } = await supabase
    .from('catalogo_colores').select('color, nombre_producto, url_imagen')
    .not('url_imagen', 'is', null);
  const refWords = productoRef.toUpperCase().split(/\s+/);
  const brandWords = refWords.filter((w: string) => w.length >= 3 && !COLOR_NAMES_UPPER.has(w));
  const searchWords = brandWords.length > 0 ? brandWords : refWords.filter((w: string) => w.length >= 4);
  const all = (allC ?? []).filter((c: any) =>
    searchWords.some((w: string) => (c.nombre_producto as string).toUpperCase().includes(w))
  );
  return [...new Map(all.map((c: any) => [c.nombre_producto, c])).values()];
};
```

Nota: `COLOR_NAMES_UPPER` debe definirse UNA VEZ al inicio del archivo o antes de las funciones, no dentro de ellas.

---

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `quinchat/app/api/whatsapp/webhook/route.ts` | Webhook principal WhatsApp — bugs 2 y 3 |
| `quinchat/app/api/funnelish/webhook/route.ts` | Webhook Funnelish — recibe pedidos |
| `quinchat/lib/address.ts` | Validación de direcciones — bug 1 |
| `quinchat/lib/lupap.ts` | Geocodificación (pendiente de activar, 0 créditos) |
| `quinchat/.env.local` | Variables de entorno (Lupap key ya guardada) |

## Después de corregir
Ejecutar desde `quinchat/`:
```bash
npx tsc --noEmit   # o: node_modules/.bin/tsc --noEmit
vercel --prod
```

## COLOR_NAMES (completo)
```typescript
const COLOR_NAMES = ['azul oscuro', 'rojo', 'negro', 'azul', 'blanco marfil', 'marfil', 'blanco', 'amarillo', 'beige', 'verde', 'gris', 'cocoa', 'azul navy', 'verde oscuro'];
```
(Está en línea 65 de `webhook/route.ts`)
