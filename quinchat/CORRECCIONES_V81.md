# CORRECCIONES V81 — Pixel TikTok/Meta (content_id + email/teléfono)
**Proyecto:** QuinChat (aplicar en **quin-comercial**)
**Fecha:** 2026-08-20
**Archivos modificados:**
- `components/publico/Pixeles.tsx`
- `app/p/[slug]/page.tsx`
- `app/p/[slug]/pedido/page.tsx`
- `components/publico/FormularioPedido.tsx`
- `components/publico/CheckoutPro.tsx` (solo si existe en este proyecto)

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| `Pixeles.tsx` | Los eventos de TikTok/Meta ahora envían `content_id` + `contents`, y en compra se llama `ttq.identify` con email/teléfono | TikTok marcaba "Content ID is missing" y "Email and phone are missing" (estado crítico) |
| `p/[slug]/page.tsx` | La landing dispara `ViewContent` con `content_id` = slug del embudo | Que el evento de vista de producto llegue completo |
| `p/[slug]/pedido/page.tsx` | El `InitiateCheckout` incluye `content_id` = slug | Mismo motivo |
| `FormularioPedido.tsx` | El `CompletePayment`/`Purchase` incluye `content_id` + `contents` + `ttq.identify` (tel/correo) | Compra con datos completos para coincidencia avanzada |
| `CheckoutPro.tsx` | Igual que arriba (si el archivo existe) | Mismo motivo |

---

## Instrucciones para Claude Code

Pega este mensaje en el chat del proyecto **quin-comercial**:

> Aplica este arreglo sin dañar nada más del proyecto. El pixel de TikTok/Meta debe enviar `content_id` en todos los eventos y `email/teléfono` en la compra (hoy TikTok marca crítico "Content ID missing" y "Email and phone missing"). Usa los bloques BUSCAR/REEMPLAZAR de abajo. Si algún BUSCAR no coincide exacto (por diferencias del proyecto), aplica el mismo criterio manualmente. Al final corre `npx tsc --noEmit` y confirma que compila.

---

## 1) `components/publico/Pixeles.tsx` — archivo completo corregido

Reemplaza el archivo entero por esto:

```tsx
'use client';

import Script from 'next/script';
import { useEffect } from 'react';

/**
 * Píxeles de Meta y TikTok.
 *
 * Se cargan después de que la página se muestra, para no retrasar lo que el
 * cliente ve: en tráfico de anuncios cada décima de segundo cuenta.
 */
export default function Pixeles({
  meta, tiktok, evento = 'PageView', datos,
}: {
  meta?: string | null;
  tiktok?: string | null;
  evento?: 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'Purchase';
  datos?: { valor?: number; producto?: string; id?: string; contentId?: string; email?: string; phone?: string };
}) {
  useEffect(() => {
    if (evento === 'PageView') return; // ese ya lo dispara el código de abajo
    const w = window as any;

    // content_id: TikTok/Meta lo EXIGEN. Usamos un id estable del producto.
    const contentId = String(datos?.contentId || datos?.producto || 'producto').slice(0, 100);
    const contents = [{
      content_id: contentId, content_name: datos?.producto,
      content_type: 'product', quantity: 1, price: datos?.valor,
    }];

    try {
      if (w.fbq) {
        w.fbq('track', evento, {
          content_name: datos?.producto,
          content_ids: [contentId], content_type: 'product', contents,
          value: datos?.valor, currency: 'COP',
        }, datos?.id ? { eventID: datos.id } : undefined);
      }
      if (w.ttq) {
        // Coincidencia avanzada: email/teléfono (TikTok los hashea solo).
        if (datos?.email || datos?.phone) {
          w.ttq.identify({
            email: datos?.email || undefined,
            phone_number: datos?.phone || undefined,
          });
        }
        w.ttq.track(
          evento === 'InitiateCheckout' ? 'InitiateCheckout'
          : evento === 'Purchase' ? 'CompletePayment' : 'ViewContent',
          {
            content_id: contentId, content_type: 'product', contents,
            content_name: datos?.producto, value: datos?.valor, currency: 'COP',
          },
          datos?.id ? { event_id: datos.id } : undefined
        );
      }
    } catch { /* nunca romper la página por un píxel */ }
  }, [evento, datos]);

  return (
    <>
      {meta && (
        <Script id="px-meta" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${meta}');fbq('track','PageView');
        `}</Script>
      )}

      {tiktok && (
        <Script id="px-tiktok" strategy="afterInteractive">{`
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
          ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
          ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
          ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";
          o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];
          a.parentNode.insertBefore(o,a)};
          ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');
        `}</Script>
      )}
    </>
  );
}
```

---

## 2) `app/p/[slug]/page.tsx` — landing dispara ViewContent con content_id

**BUSCAR:**
```tsx
      <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} />
```
**REEMPLAZAR POR:**
```tsx
      <Pixeles meta={f.pixel_meta} tiktok={f.pixel_tiktok} evento="ViewContent"
        datos={{ contentId: f.slug, producto: f.producto, valor: f.precio }} />
```

---

## 3) `app/p/[slug]/pedido/page.tsx` — InitiateCheckout con content_id

**BUSCAR:**
```tsx
        datos={{ valor: f.precio, producto: f.producto }}
```
**REEMPLAZAR POR:**
```tsx
        datos={{ valor: f.precio, producto: f.producto, contentId: f.slug }}
```

---

## 4) `components/publico/FormularioPedido.tsx` — compra con content_id + tel/correo

**BUSCAR:**
```tsx
    const w = window as any;
    try {
      w.fbq?.('track', 'Purchase', { value: variante.precio, currency: 'COP', content_name: variante.nombre }, { eventID: referencia });
      w.ttq?.track('CompletePayment', { value: variante.precio, currency: 'COP', content_name: variante.nombre }, { event_id: referencia });
    } catch { /* ignorar */ }
```
**REEMPLAZAR POR:**
```tsx
    const w = window as any;
    const telPx = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
    const emailPx = (datos as any).correo || undefined;
    const contents = [{ content_id: funnel.slug, content_name: nombreProducto, content_type: 'product', quantity: 1, price: variante.precio }];
    try {
      w.fbq?.('track', 'Purchase', { content_name: nombreProducto, content_ids: [funnel.slug], content_type: 'product', contents, value: variante.precio, currency: 'COP' }, { eventID: referencia });
      if (w.ttq) {
        w.ttq.identify({ phone_number: telPx ? `+57${telPx}` : undefined, email: emailPx });
        w.ttq.track('CompletePayment', { content_id: funnel.slug, content_type: 'product', contents, content_name: nombreProducto, value: variante.precio, currency: 'COP' }, { event_id: referencia });
      }
    } catch { /* ignorar */ }
```
> Nota: si en este proyecto la variable del nombre del producto no se llama `nombreProducto`, usa la que exista (o `variante.nombre`).

---

## 5) `components/publico/CheckoutPro.tsx` — SOLO si el archivo existe

**BUSCAR:**
```tsx
    const w = window as any;
    try {
      w.fbq?.('track', 'Purchase', { value: total, currency: 'COP', content_name: nombreProducto }, { eventID: referencia });
      w.ttq?.track('CompletePayment', { value: total, currency: 'COP', content_name: nombreProducto }, { event_id: referencia });
    } catch { /* ignorar */ }
```
**REEMPLAZAR POR:**
```tsx
    const w = window as any;
    const telPx = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
    const emailPx = (datos as any).correo || undefined;
    const contents = [{ content_id: funnel.slug, content_name: nombreProducto, content_type: 'product', quantity: cantidad, price: total }];
    try {
      w.fbq?.('track', 'Purchase', { content_name: nombreProducto, content_ids: [funnel.slug], content_type: 'product', contents, value: total, currency: 'COP' }, { eventID: referencia });
      if (w.ttq) {
        w.ttq.identify({ phone_number: telPx ? `+57${telPx}` : undefined, email: emailPx });
        w.ttq.track('CompletePayment', { content_id: funnel.slug, content_type: 'product', contents, content_name: nombreProducto, value: total, currency: 'COP' }, { event_id: referencia });
      }
    } catch { /* ignorar */ }
```

---

## Verificación

Después de aplicar, comprobar:
- [ ] `npx tsc --noEmit` compila sin errores.
- [ ] Desplegar con `vercel --prod`.
- [ ] En TikTok Events Manager → Test Events: abrir un embudo, hacer un pedido de prueba, y confirmar que el evento **CompletePayment** llega con `content_id` y con teléfono.
