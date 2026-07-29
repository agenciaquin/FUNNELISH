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
  datos?: { valor?: number; producto?: string; id?: string };
}) {
  useEffect(() => {
    if (evento === 'PageView') return; // ese ya lo dispara el código de abajo
    const w = window as any;

    try {
      if (w.fbq) {
        w.fbq('track', evento, {
          content_name: datos?.producto,
          value: datos?.valor,
          currency: 'COP',
        }, datos?.id ? { eventID: datos.id } : undefined);
      }
      if (w.ttq) {
        w.ttq.track(
          evento === 'InitiateCheckout' ? 'InitiateCheckout'
          : evento === 'Purchase' ? 'CompletePayment' : 'ViewContent',
          { content_name: datos?.producto, value: datos?.valor, currency: 'COP' },
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
