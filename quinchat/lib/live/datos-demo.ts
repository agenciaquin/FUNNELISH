// Datos de PRUEBA de QUIN LIVE SHOPPING (maqueta). Nada de esto viene de la base de datos.
// Fotos: SVG de ejemplo en /public/live-demo. Precios en COP, solo ilustrativos.

import type { ColorProducto, LiveConfig, ProductoLive, Talla } from './tipos';
import { MODO_REPRODUCCION, PRIVACIDAD_URL, VIDEO_URL, WHATSAPP_VENTAS } from './config';

const TALLAS: Talla[] = ['S', 'M', 'L', 'XL'];
const foto = (modelo: string, color: string) => `/live-demo/buzo-${modelo}-${color}.svg`;
const color = (modelo: string, id: string, nombre: string, hex: string): ColorProducto =>
  ({ id, nombre, hex, foto: foto(modelo, id) });

export const PRODUCTOS_DEMO: ProductoLive[] = [
  {
    id: 'buzo-urban',
    nombre: 'Buzo Premium Urban',
    descripcion: 'Buzo oversize con capota, felpa suave por dentro.',
    precio: 129900,
    precioAntes: 159900,
    promo: { etiqueta: 'Pack x2', unidades: 2, precioPack: 229900 },
    tallas: TALLAS,
    colores: [color('urban', 'negro', 'Negro', '#161616'), color('urban', 'gris', 'Gris', '#8a8f98'), color('urban', 'beige', 'Beige', '#cdbb9b')],
  },
  {
    id: 'buzo-classic',
    nombre: 'Buzo Premium Classic',
    descripcion: 'Corte clásico, bordado frontal y puños reforzados.',
    precio: 139900,
    precioAntes: 169900,
    promo: { etiqueta: 'Pack x2', unidades: 2, precioPack: 249900 },
    tallas: TALLAS,
    colores: [color('classic', 'azul', 'Azul noche', '#1f2a44'), color('classic', 'vino', 'Vino', '#6b1f2e'), color('classic', 'verde', 'Verde bosque', '#2f4a3a')],
  },
  {
    id: 'buzo-street',
    nombre: 'Buzo Premium Street',
    descripcion: 'Estilo streetwear, caída holgada y bolsillo canguro.',
    precio: 149900,
    tallas: TALLAS,
    colores: [color('street', 'hueso', 'Hueso', '#e9e6dc'), color('street', 'cafe', 'Café', '#5a3d2b'), color('street', 'grafito', 'Grafito', '#3b3f46')],
  },
];

export const LIVES_DEMO: LiveConfig[] = [
  {
    slug: 'demo',
    titulo: 'Buzos premium KLIXMANT',
    etiquetaGrabada: 'Presentación grabada',
    tienda: { nombre: 'KLIXMANT', logo: '/logo-agencia-quin.png' },
    videoUrl: VIDEO_URL,
    timelineUrl: '/live-demo/timeline.json',
    whatsapp: WHATSAPP_VENTAS,
    privacidadUrl: PRIVACIDAD_URL,
    modo: MODO_REPRODUCCION,
    productos: PRODUCTOS_DEMO,
  },
];

export function buscarLive(slug: string): LiveConfig | undefined {
  return LIVES_DEMO.find(l => l.slug === slug);
}
