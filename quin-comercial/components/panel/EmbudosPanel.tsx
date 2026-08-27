'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import VistaPreviaEmbudo from './VistaPreviaEmbudo';
import ArmarPackSelector from '../publico/ArmarPackSelector';
import EditorPareja, { selectoresPolos } from './EditorPareja';
import EditorBloques from './EditorBloques';
import ConfirmacionModal from './ConfirmacionModal';
import PapeleraEmbudos from './PapeleraEmbudos';
import { type BloqueLayout } from '@/lib/funnel-layout';
import { esVideo, acentoDe } from '@/lib/funnels';
import { createBrowserSupabaseClient } from '@/lib/supabase';

/**
 * Sube un archivo y devuelve su enlace público.
 * - Fotos livianas → pasan por el servidor (rápido).
 * - Videos o archivos grandes → van DIRECTO a Supabase con un enlace firmado,
 *   así no chocan con el tope de ~4.5 MB de las funciones de Vercel.
 */
async function subirArchivo(file: File, slug: string): Promise<string | null> {
  const grande = file.size > 4 * 1024 * 1024;
  const esVid  = file.type.startsWith('video/');

  if (!grande && !esVid) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slug', slug);
    const res = await fetch('/api/funnels/imagen', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
    return data.url as string;
  }

  // Subida directa navegador → Supabase
  const ext = (file.name.split('.').pop() || (esVid ? 'mp4' : 'jpg')).toLowerCase();
  const r1  = await fetch('/api/funnels/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, ext }),
  });
  const info = await r1.json();
  if (!r1.ok) throw new Error(info.error || 'No se pudo preparar la subida.');

  const sb = createBrowserSupabaseClient();
  const { error } = await sb.storage
    .from('chat-media').uploadToSignedUrl(info.path, info.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return info.publicUrl as string;
}

interface Opcion { valor: string; imagen?: string }
interface Selector { etiqueta: string; grupo?: string; opciones: (string | Opcion)[] }

const aOpciones = (ops: (string | Opcion)[]): Opcion[] =>
  (ops ?? []).map(o => (typeof o === 'string' ? { valor: o } : o)).filter(o => o?.valor);

interface Variante {
  id: string; nombre: string; precio: number; precioAntes?: number;
  imagen?: string; tallas?: string[]; selectores?: Selector[];
  // "Arma tu pack" (cascada): escudería → color → talla por buzo.
  armarPack?: { unidades: number; categorias: { nombre: string; colores: Opcion[] }[]; tallas: string[]; labelCategoria?: string; labelPrenda?: string };
  estilo?: string;
  // Stock propio del embudo (opcional). null/undefined = ilimitado, se vende todo.
  stock?: number | null;
  politicaStock?: 'bloquear' | 'seguir';
}

interface Embudo {
  slug: string; activo: boolean; nombre: string; titulo: string; producto: string;
  precio: number; precio_antes: number | null;
  imagenes: string[]; imagen_banner: string | null; imagen_clientes: string | null; imagen_detalle: string | null;
  caracteristicas: string[]; frases: string[]; tallas: string[]; variantes: Variante[];
  horas_contador: number; personas_comprando: number;
  whatsapp: string;
  pixel_meta: string | null; pixel_meta_token: string | null;
  pixel_tiktok: string | null; pixel_tiktok_token: string | null;
  audio_url: string | null;
  video_url: string | null;
  color: string | null;
  miniatura_url: string | null;
  anuncios: string | null;
  // Editor por bloques ("Crear embudo de cero") + cuál versión se publica.
  layout: BloqueLayout[] | null;
  // Segunda versión de la PÁGINA (borrador): se arma aparte, en blanco, sin tocar
  // la versión actual ni la página publicada. null = todavía no se ha creado.
  layout_borrador?: BloqueLayout[] | null;
  modo_publicado: 'cero' | 'plantilla' | null;
  // Confirmación del pedido: 'solo' (bot envía y se apaga) o 'agente' (bot confirma). undefined = agente.
  modo_confirmacion?: 'solo' | 'agente' | null;
  // Oculta el SEGUNDO botón "COMPRAR" (el de abajo) en la página de venta.
  ocultar_boton2?: boolean;
  // Producto del catálogo al que está vinculado (para obedecer su stock en vivo).
  catalogoId?: string | null;
}

const vacio = (): Embudo => ({
  slug: '', activo: true, nombre: '', titulo: '🔥ÚLTIMAS UNIDADES🔥COMPRA YA!🔥', producto: '',
  precio: 139900, precio_antes: 195000,
  imagenes: [], imagen_banner: null, imagen_clientes: null, imagen_detalle: null,
  caracteristicas: [], frases: [], tallas: ['S HOMBRE', 'M HOMBRE', 'L HOMBRE', 'XL HOMBRE', 'XXL HOMBRE', 'XXXL HOMBRE', 'S DAMA', 'M DAMA', 'L DAMA', 'XL DAMA'],
  variantes: [], horas_contador: 10, personas_comprando: 27,
  whatsapp: '', pixel_meta: null, pixel_meta_token: null,
  pixel_tiktok: null, pixel_tiktok_token: null,
  audio_url: null, video_url: null, color: null, miniatura_url: null, anuncios: null,
  layout: null, layout_borrador: null, modo_publicado: null, modo_confirmacion: null, ocultar_boton2: false,
});

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

// ── Portar embudos entre apps ────────────────────────────────────────────────
// Un "código de embudo" lleva TODA la estructura adentro (texto, fotos, precios,
// productos, diseño), sin datos de la cuenta (WhatsApp, píxeles, IDs de anuncio,
// dirección). Así se copia en una app y se pega en otra sin depender de servidores.
const PREFIJO_EMBUDO = 'QUINEMB1:';
// Campos que SÍ viajan (contenido y diseño). Se omiten: slug, whatsapp, píxeles,
// anuncios, id, tenant y contadores (son propios de cada tienda).
const CAMPOS_PORTABLES = [
  'activo', 'nombre', 'titulo', 'producto', 'precio', 'precio_antes',
  'imagenes', 'imagen_banner', 'imagen_clientes', 'imagen_detalle',
  'caracteristicas', 'frases', 'tallas', 'variantes',
  'horas_contador', 'personas_comprando',
  'audio_url', 'video_url', 'color', 'miniatura_url',
  'layout', 'modo_publicado', 'modo_confirmacion', 'ocultar_boton2',
] as const;

/** Base64 seguro con acentos/emojis (UTF-8). */
function aBase64(txt: string): string {
  return btoa(unescape(encodeURIComponent(txt)));
}
function deBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

/** Convierte un embudo en su código portátil (texto para copiar). */
function codificarEmbudo(e: any): string {
  const limpio: Record<string, any> = {};
  for (const k of CAMPOS_PORTABLES) if (e[k] !== undefined) limpio[k] = e[k];
  const sobre = { v: 1, tipo: 'embudo', producto: e.producto ?? '', datos: limpio };
  return PREFIJO_EMBUDO + aBase64(JSON.stringify(sobre));
}

/** Lee un código pegado y devuelve los datos del embudo (o null si no sirve). */
function decodificarEmbudo(txt: string): { producto: string; datos: Record<string, any> } | null {
  try {
    let s = String(txt ?? '').trim();
    if (!s) return null;
    if (s.startsWith(PREFIJO_EMBUDO)) s = s.slice(PREFIJO_EMBUDO.length);
    // Permite pegar con espacios o saltos de línea de más.
    s = s.replace(/\s+/g, '');
    const json = deBase64(s);
    const sobre = JSON.parse(json);
    const datos = sobre?.datos && typeof sobre.datos === 'object' ? sobre.datos : null;
    if (!datos) return null;
    // Solo se conservan los campos permitidos (seguridad: no cuela columnas raras).
    const filtrado: Record<string, any> = {};
    for (const k of CAMPOS_PORTABLES) if (datos[k] !== undefined) filtrado[k] = datos[k];
    return { producto: String(sobre?.producto ?? filtrado.producto ?? 'Embudo'), datos: filtrado };
  } catch { return null; }
}

export default function EmbudosPanel() {
  const [embudos, setEmbudos] = useState<Embudo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'lista' | 'editar'>('lista');
  const [actual, setActual] = useState<Embudo>(vacio());
  // Dos formas de armar el embudo: 'plantilla' = formulario recomendado (clásico);
  // 'cero' = editor por bloques (arrastrar, con checkout).
  const [tabEditor, setTabEditor] = useState<'plantilla' | 'cero'>('cero');
  // Cuál versión de la PÁGINA se está editando: 'actual' (la publicada) o 'nueva'
  // (borrador en blanco que se arma aparte, sin dañar la actual).
  const [versionEditando, setVersionEditando] = useState<'actual' | 'nueva'>('actual');
  // Modo "Editar checkout": abre el formulario mostrando solo lo del checkout (oculta Fotos).
  const [checkoutModo, setCheckoutModo] = useState(false);
  const abrirCheckout = () => { setCheckoutModo(true); setTabEditor('plantilla'); };
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [verPreview, setVerPreview] = useState(false); // en móvil: alterna edición / vista previa

  const refGaleria  = useRef<HTMLInputElement>(null);
  const refBanner   = useRef<HTMLInputElement>(null);
  const refClientes = useRef<HTMLInputElement>(null);
  const refDetalle  = useRef<HTMLInputElement>(null);
  const refVariante = useRef<HTMLInputElement>(null);
  const varianteDestino = useRef<number>(-1);
  // Índice de la tarjeta que se está arrastrando (para reordenar productos)
  const arrastreOrigen = useRef<number>(-1);
  const [arrastreSobre, setArrastreSobre] = useState<number>(-1);
  const refOpcion = useRef<HTMLInputElement>(null);
  const opcionDestino = useRef<{ v: number; s: number; o: number }>({ v: -1, s: -1, o: -1 });
  const refAudio = useRef<HTMLInputElement>(null);
  const refVideo = useRef<HTMLInputElement>(null);
  const refMini  = useRef<HTMLInputElement>(null);

  async function subirAudio(file: File) {
    setSubiendo('audio');
    try {
      const url = await subirArchivo(file, actual.slug || 'nuevo');
      if (url) set('audio_url', url);
    } catch (e: any) {
      alert(e?.message || 'No se pudo subir el audio.');
    } finally { setSubiendo(null); }
  }

  async function subirVideo(file: File) {
    setSubiendo('video');
    try {
      const url = await subirArchivo(file, actual.slug || 'nuevo');
      if (url) set('video_url', url);
    } catch (e: any) {
      alert(e?.message || 'No se pudo subir el video.');
    } finally { setSubiendo(null); }
  }

  // Enlace copiado, para confirmar visualmente
  const [copiado, setCopiado] = useState<string | null>(null);
  // Sección de píxeles plegable (cerrada por defecto para no abrumar al cliente)
  const [pixelesAbierto, setPixelesAbierto] = useState(false);
  // Escuderías (familias del catálogo) para el pack con "elegir escudería"
  const [escuderias, setEscuderias] = useState<string[]>([]);
  const [catalogosFull, setCatalogosFull] = useState<any[]>([]);
  const [packConEscuderia, setPackConEscuderia] = useState(false);
  // Selector de escuderías para "arma tu pack" (elegir solo las que se quieran)
  const [packPicker, setPackPicker] = useState<{ vi: number; cantidad: number } | null>(null);
  const [packSel, setPackSel]       = useState<Set<string>>(new Set());
  const [packBusca, setPackBusca]   = useState('');
  // Importador de catálogos en el producto "unidad" (traer colores + fotos ya creados)
  const [impPicker, setImpPicker]   = useState<number | null>(null);
  const [impBusca, setImpBusca]     = useState('');
  // Dominio con el que se arman los enlaces: el propio del cliente si conectó
  // uno (Mi dominio); si no, el genérico de la plataforma.
  const [baseDominio, setBaseDominio] = useState('pedido.klixmant.shop');

  useEffect(() => {
    fetch('/api/tenant/dominio')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.dominio) setBaseDominio(String(d.dominio)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/catalogos', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const arr = (Array.isArray(d) ? d : d?.catalogos ?? []);
        setCatalogosFull(arr);
        const lista = arr.map((c: any) => String(c.familia ?? '').trim()).filter(Boolean);
        setEscuderias([...new Set(lista)] as string[]);
      })
      .catch(() => {});
  }, []);

  /** Dirección pública del embudo, lista para pegar en un anuncio. */
  const enlaceDe = (slug: string) => `https://${baseDominio}/${slug}`;

  async function copiarEnlace(slug: string) {
    const enlace = enlaceDe(slug);
    try {
      await navigator.clipboard.writeText(enlace);
    } catch {
      // Algunos navegadores no dejan copiar sin permiso: se muestra para copiar a mano
      window.prompt('Copia el enlace:', enlace);
      return;
    }
    setCopiado(slug);
    setTimeout(() => setCopiado(actual => (actual === slug ? null : actual)), 2000);
  }

  // Edición masiva por tipo de producto
  const [masivoTipo, setMasivoTipo]     = useState<number | null>(null);
  const [masivoPrecio, setMasivoPrecio] = useState('');
  const [masivoAntes, setMasivoAntes]   = useState('');
  const [masivoTallas, setMasivoTallas] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch('/api/funnels', { cache: 'no-store' });
      const data = await res.json();
      setEmbudos(data.embudos ?? []);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Contador de ventas por embudo (con filtro de fecha) ─────────────────────
  const [ventas, setVentas]                 = useState<Record<string, { total: number; confirmadas: number }>>({});
  const [ventasListas, setVentasListas]     = useState(true);   // false = falta correr la migración
  const [cargandoVentas, setCargandoVentas] = useState(true);
  const [rango, setRango]                   = useState<'hoy' | '7' | '30' | 'todo' | 'custom'>('30');
  const [desdeCustom, setDesdeCustom]       = useState('');
  const [hastaCustom, setHastaCustom]       = useState('');

  // Convierte el rango elegido en fechas ISO (desde/hasta) para la consulta.
  const rangoISO = useCallback((): { desde?: string; hasta?: string } => {
    const iniDia = (d: Date) => { d.setHours(0, 0, 0, 0); return d.toISOString(); };
    const finDia = (d: Date) => { d.setHours(23, 59, 59, 999); return d.toISOString(); };
    if (rango === 'hoy')  return { desde: iniDia(new Date()) };
    if (rango === '7')    return { desde: iniDia(new Date(Date.now() - 6 * 86_400_000)) };
    if (rango === '30')   return { desde: iniDia(new Date(Date.now() - 29 * 86_400_000)) };
    if (rango === 'todo') return {};
    const r: { desde?: string; hasta?: string } = {};
    if (desdeCustom) r.desde = iniDia(new Date(desdeCustom + 'T00:00:00'));
    if (hastaCustom) r.hasta = finDia(new Date(hastaCustom + 'T00:00:00'));
    return r;
  }, [rango, desdeCustom, hastaCustom]);

  const cargarVentas = useCallback(async () => {
    setCargandoVentas(true);
    try {
      const { desde, hasta } = rangoISO();
      const qs = new URLSearchParams();
      if (desde) qs.set('desde', desde);
      if (hasta) qs.set('hasta', hasta);
      const res  = await fetch(`/api/embudos/ventas?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setVentas(data.porEmbudo ?? {});
      setVentasListas(data.columnaLista !== false);
    } catch { setVentas({}); }
    finally { setCargandoVentas(false); }
  }, [rangoISO]);

  useEffect(() => {
    if (rango === 'custom' && !desdeCustom && !hastaCustom) return; // espera a que elija fechas
    cargarVentas();
  }, [cargarVentas, rango, desdeCustom, hastaCustom]);

  // ── Deshacer / Rehacer (Ctrl+Z / Ctrl+Y) ────────────────────────────────────
  // Cada cambio guarda una copia del estado anterior (atrasar). Al deshacer, ese
  // estado se pasa a la pila de "rehacer" (adelantar) para poder volver.
  const historial = useRef<Embudo[]>([]);
  const futuro = useRef<Embudo[]>([]);
  const [pasosDeshacer, setPasosDeshacer] = useState(0);
  const [pasosRehacer, setPasosRehacer] = useState(0);

  const set = (campo: keyof Embudo, valor: any) => setActual(a => {
    historial.current.push(a);
    if (historial.current.length > 60) historial.current.shift();
    // Un cambio nuevo invalida el "adelantar": ya no hay futuro que repetir.
    futuro.current = [];
    setPasosRehacer(0);
    setPasosDeshacer(historial.current.length);
    return { ...a, [campo]: valor };
  });

  function deshacer() {
    setActual(a => {
      const prev = historial.current.pop();
      if (prev === undefined) return a;
      futuro.current.push(a);
      if (futuro.current.length > 60) futuro.current.shift();
      setPasosRehacer(futuro.current.length);
      setPasosDeshacer(historial.current.length);
      return prev;
    });
  }

  function rehacer() {
    setActual(a => {
      const next = futuro.current.pop();
      if (next === undefined) return a;
      historial.current.push(a);
      if (historial.current.length > 60) historial.current.shift();
      setPasosDeshacer(historial.current.length);
      setPasosRehacer(futuro.current.length);
      return next;
    });
  }

  // Reordenar productos: mueve la variante `from` a la posición `to`.
  // Guarda en el historial para que también se pueda deshacer con Ctrl+Z.
  const moverVariante = (from: number, to: number) => setActual(a => {
    const n = a.variantes.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return a;
    historial.current.push(a);
    if (historial.current.length > 60) historial.current.shift();
    // Un cambio nuevo invalida el "adelantar" (igual que en set()).
    futuro.current = [];
    setPasosRehacer(0);
    setPasosDeshacer(historial.current.length);
    const vs = [...a.variantes];
    const [m] = vs.splice(from, 1);
    vs.splice(to, 0, m);
    return { ...a, variantes: vs };
  });

  // Ctrl+Z para deshacer (atrasar) y Ctrl+Y / Ctrl+Shift+Z para rehacer (adelantar)
  useEffect(() => {
    if (vista !== 'editar') return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && e.shiftKey) { e.preventDefault(); rehacer(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); deshacer(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); rehacer(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vista]);

  // Abre el selector de archivos forzando foto o video en un casillero dado.
  function pedir(ref: React.RefObject<HTMLInputElement | null>, tipo: 'foto' | 'video') {
    if (!ref.current) return;
    ref.current.accept = tipo === 'video' ? 'video/*' : 'image/*';
    ref.current.click();
  }

  async function subir(file: File, destino: 'galeria' | 'banner' | 'clientes' | 'detalle' | 'variante' | 'opcion' | 'miniatura') {
    setSubiendo(destino);
    try {
      const url = await subirArchivo(file, actual.slug || 'nuevo');
      if (!url) return;

      if (destino === 'galeria')       set('imagenes', [...actual.imagenes, url]);
      else if (destino === 'banner')   set('imagen_banner', url);
      else if (destino === 'clientes') set('imagen_clientes', url);
      else if (destino === 'detalle')  set('imagen_detalle', url);
      else if (destino === 'miniatura') set('miniatura_url', url);
      else if (destino === 'variante' && varianteDestino.current >= 0) {
        const vs = [...actual.variantes];
        vs[varianteDestino.current] = { ...vs[varianteDestino.current], imagen: url };
        set('variantes', vs);
      }
      else if (destino === 'opcion') {
        const { v, s, o } = opcionDestino.current;
        if (v < 0) return;
        const vs = [...actual.variantes];
        const sels = [...(vs[v].selectores ?? [])];
        // Raw (sin filtrar) para no perder colores aún sin nombre al subir la foto
        const ops = (sels[s]?.opciones ?? []).map((x: any) => (typeof x === 'string' ? { valor: x } : { ...x }));
        if (!ops[o]) return;
        ops[o] = { ...ops[o], imagen: url };
        sels[s] = { ...sels[s], opciones: ops };
        vs[v] = { ...vs[v], selectores: sels };
        set('variantes', vs);
      }
    } catch (e: any) {
      alert(e?.message || 'No se pudo subir el archivo.');
    } finally { setSubiendo(null); }
  }

  /**
   * Cuántas prendas lleva un producto: se deduce de cuántos grupos de elección
   * tiene ("ELIGE BUZO 1", "ELIGE BUZO 2"…). Si no tiene grupos, mira el nombre.
   */
  function unidadesDe(v: Variante): number {
    const grupos = new Set(
      (v.selectores ?? []).map(s => s.grupo?.trim()).filter(Boolean) as string[]
    );
    if (grupos.size > 0) return grupos.size;
    const m = String(v.nombre ?? '').toUpperCase().match(/PACK\s*X?\s*(\d)/);
    if (m) return Number(m[1]);
    if (/\b(DOS|2)\s+COLORES\b/.test(String(v.nombre ?? '').toUpperCase())) return 2;
    if (/\b(TRES|3)\s+COLORES\b/.test(String(v.nombre ?? '').toUpperCase())) return 3;
    return 1;
  }

  /** Aplica precio y tallas a todos los productos del tipo elegido. */
  function aplicarMasivo() {
    if (masivoTipo === null) return;
    const precio = masivoPrecio.trim() ? Number(masivoPrecio) : null;
    const antes  = masivoAntes.trim()  ? Number(masivoAntes)  : null;
    const tallas = masivoTallas.split('\n').map(t => t.trim()).filter(Boolean);

    if (precio === null && antes === null && tallas.length === 0) {
      alert('Escribe al menos un precio o unas tallas para aplicar.');
      return;
    }

    let cambiados = 0;
    const vs = actual.variantes.map(v => {
      if (unidadesDe(v) !== masivoTipo) return v;
      cambiados++;

      const nuevo: Variante = { ...v };
      if (precio !== null) nuevo.precio = precio;
      if (antes  !== null) nuevo.precioAntes = antes;

      // Solo se reemplazan las elecciones de talla; los colores no se tocan
      if (tallas.length > 0 && v.selectores) {
        nuevo.selectores = v.selectores.map(s =>
          /talla/i.test(s.etiqueta) ? { ...s, opciones: tallas.map(valor => ({ valor })) } : s
        );
      }
      return nuevo;
    });

    set('variantes', vs);
    setMasivoPrecio(''); setMasivoAntes(''); setMasivoTallas('');
    setAviso(`✅ Se actualizaron ${cambiados} producto${cambiados === 1 ? '' : 's'}.`);
  }

  /**
   * Arma las elecciones del embudo a partir de los colores ya creados.
   * Una unidad → cada color pide su talla.
   * Pack de 2 o 3 → se crea el producto del pack con color y talla por prenda.
   */
  function armarEmbudo(unidades: number) {
    const colores = actual.variantes
      .filter(v => v.imagen && !/pack/i.test(v.nombre))
      .map(v => ({ valor: v.nombre, imagen: v.imagen }));

    if (colores.length === 0) {
      alert('Primero crea los colores con su foto.\n\nCada color es un producto: le pones nombre, precio y foto. Luego vuelve a tocar este botón.');
      return;
    }

    // Cada color pide su talla
    const conTallas = actual.variantes.map(v =>
      /pack/i.test(v.nombre)
        ? v
        : { ...v, selectores: [{ etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) }] }
    );

    if (unidades === 1) {
      set('variantes', conTallas.filter(v => !/pack/i.test(v.nombre)));
      setAviso('✅ Embudo de una unidad: cada color pide su talla.');
      return;
    }

    // Elecciones del pack: color y talla por cada prenda
    const selectores: Selector[] = [];
    for (let n = 1; n <= unidades; n++) {
      const grupo = `ELIGE BUZO ${n}`;
      selectores.push({ grupo, etiqueta: 'COLOR', opciones: colores });
      selectores.push({ grupo, etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) });
    }

    const nombrePack = `PACK X${unidades} ${actual.producto}`.trim();
    const yaExiste   = conTallas.findIndex(v => /pack/i.test(v.nombre));

    const pack: Variante = yaExiste >= 0
      ? { ...conTallas[yaExiste], nombre: conTallas[yaExiste].nombre || nombrePack, selectores }
      : {
          id: `pack${Date.now()}`,
          nombre: nombrePack,
          precio: Math.round(actual.precio * unidades * 0.82), // sugerencia, la ajustas tú
          precioAntes: actual.precio_antes ? actual.precio_antes * unidades : undefined,
          selectores,
        };

    const vs = [...conTallas];
    if (yaExiste >= 0) vs[yaExiste] = pack; else vs.push(pack);

    set('variantes', vs);
    setAviso(`✅ Pack de ${unidades} armado: cada prenda pide su color y su talla. Revisa el precio del pack.`);
  }

  // slugOriginal: la dirección del embudo que se está EDITANDO (para actualizarlo
  // aunque le cambien la dirección). null = embudo nuevo / duplicado → se crea.
  const [slugOriginal, setSlugOriginal] = useState<string | null>(null);
  const [modalGuardar, setModalGuardar] = useState(false);
  // Ventana rápida "Píxel y token" desde la lista (sin abrir el editor completo).
  const [modalPixels, setModalPixels] = useState<null | { slug: string; nombre: string; pixel_meta: string; pixel_meta_token: string; pixel_tiktok: string; pixel_tiktok_token: string }>(null);
  const [guardandoPixels, setGuardandoPixels] = useState(false);

  async function guardarPixels() {
    if (!modalPixels) return;
    setGuardandoPixels(true);
    try {
      const res = await fetch('/api/funnels', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'pixels', ...modalPixels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAviso(`❌ ${data.error ?? 'No se pudo guardar el píxel'}`); return; }
      setModalPixels(null);
      setAviso('✅ Píxel y token guardados.');
      await cargar();
    } finally { setGuardandoPixels(false); }
  }

  async function guardar() {
    if (!actual.slug.trim() || !actual.producto.trim()) {
      alert('La dirección y el nombre del producto son obligatorios.');
      return;
    }
    // Embudo NUEVO (o recién duplicado) → se crea directo, sin preguntar.
    if (!slugOriginal) { await hacerGuardado('crear'); return; }
    // Embudo EXISTENTE → preguntar: ¿modificar este o crear uno nuevo?
    setModalGuardar(true);
  }

  async function hacerGuardado(modo: 'modificar' | 'crear') {
    setModalGuardar(false);
    setGuardando(true);
    try {
      const payload: any = { ...actual };
      // El editor por bloques (teléfono) es el que se publica: al guardar,
      // esta versión queda como la pública. Aditivo y reversible desde la BD.
      payload.modo_publicado = 'cero';
      if (modo === 'modificar' && slugOriginal) {
        // Actualiza el MISMO embudo (aunque haya cambiado la dirección).
        payload.slug_original = slugOriginal;
      } else {
        // Crear uno nuevo: si dejó la misma dirección del original, se le da una libre.
        if (slugOriginal && actual.slug.trim().toLowerCase() === slugOriginal.toLowerCase()) {
          payload.slug = slugLibre(actual.slug);
        }
        delete payload.slug_original;
      }
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }
      setAviso(data.aviso
        ? `⚠️ ${data.aviso}`
        : `✅ ${modo === 'modificar' ? 'Embudo modificado' : 'Embudo creado'}. Ábrelo en /p/${data.slug}`);
      await cargar();
      setVista('lista');
    } finally { setGuardando(false); }
  }

  // ── Selección masiva + papelera ─────────────────────────────────────────────
  const [seleccion, setSeleccion]         = useState<Set<string>>(new Set());
  const [papeleraAbierta, setPapeleraAbierta] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);

  // ── Portar embudos entre apps (Copiar embudo / Pegar embudo) ────────────────
  const [exportCodigo, setExportCodigo]   = useState<string | null>(null); // código en el modal
  const [exportNombre, setExportNombre]   = useState('');
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [importAbierto, setImportAbierto] = useState(false);
  const [importTexto, setImportTexto]     = useState('');
  const [importando, setImportando]       = useState(false);

  const toggleSel = (slug: string) => setSeleccion(prev => {
    const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n;
  });

  // Un solo embudo → a la papelera (soft delete: se puede restaurar).
  async function borrar(slug: string) {
    if (!confirm(`¿Enviar el embudo "${slug}" a la papelera?\n\nPodrás restaurarlo o borrarlo definitivamente desde la papelera.`)) return;
    await fetch('/api/funnels', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', slugs: [slug] }),
    });
    setSeleccion(prev => { const n = new Set(prev); n.delete(slug); return n; });
    await cargar();
  }

  // Varios embudos seleccionados → a la papelera.
  async function enviarSeleccionAPapelera() {
    const slugs = [...seleccion];
    if (!slugs.length) return;
    await fetch('/api/funnels', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', slugs }),
    });
    setSeleccion(new Set());
    setModalEliminar(false);
    await cargar();
  }

  /** Inventa una dirección libre a partir de otra, sin repetir ninguna. */
  function slugLibre(base: string): string {
    const usados = new Set(embudos.map(e => e.slug));
    const raiz = base.replace(/-copia(-\d+)?$/, ''); // no encadenar "copia-copia"
    let intento = `${raiz}-copia`;
    let n = 2;
    while (usados.has(intento)) { intento = `${raiz}-copia-${n}`; n++; }
    return intento;
  }

  /** Copia un embudo idéntico y solo le cambia la dirección (para no repetir link). */
  async function duplicar(e: Embudo) {
    const nuevoSlug = slugLibre(e.slug);
    const copia: Embudo = {
      ...vacio(),
      ...e,
      slug: nuevoSlug,
      nombre: e.nombre ? `${e.nombre} (copia)` : e.nombre,
    };
    setGuardando(true);
    try {
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copia),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }
      setAviso(`✅ Embudo duplicado en ${baseDominio}/${data.slug ?? nuevoSlug}`);
      await cargar();
    } finally { setGuardando(false); }
  }

  // ── Copiar embudo (exportar): genera el código y abre el modal para copiarlo ──
  async function copiarEmbudo(e: Embudo) {
    const codigo = codificarEmbudo(e);
    setExportNombre(e.producto || e.nombre || 'Embudo');
    setExportCodigo(codigo);
    setCopiadoCodigo(false);
    // Intenta copiar solo; si el navegador no deja, el modal lo muestra igual.
    try { await navigator.clipboard.writeText(codigo); setCopiadoCodigo(true); } catch { /* el modal lo muestra */ }
  }

  async function copiarCodigoDelModal() {
    if (!exportCodigo) return;
    try { await navigator.clipboard.writeText(exportCodigo); setCopiadoCodigo(true); setTimeout(() => setCopiadoCodigo(false), 2000); }
    catch { /* el usuario copia a mano desde el cuadro */ }
  }

  /** Dirección libre a partir de un texto (para el embudo pegado). */
  function slugLibreDe(base: string): string {
    const usados = new Set(embudos.map(e => e.slug));
    const raiz = String(base || 'embudo').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'embudo';
    if (!usados.has(raiz)) return raiz;
    let n = 2;
    while (usados.has(`${raiz}-${n}`)) n++;
    return `${raiz}-${n}`;
  }

  // ── Pegar embudo (importar): lee el código y crea el embudo en ESTA app ──────
  const importPreview = decodificarEmbudo(importTexto);
  async function pegarEmbudo() {
    const leido = decodificarEmbudo(importTexto);
    if (!leido) { setAviso('❌ El código no es válido. Copia de nuevo el embudo desde la otra app.'); return; }
    setImportando(true);
    try {
      const nuevoSlug = slugLibreDe(leido.datos.producto || leido.producto);
      const payload: any = { ...vacio(), ...leido.datos, slug: nuevoSlug };
      // El WhatsApp y los píxeles NO viajan: son de cada tienda (quedan vacíos).
      const res = await fetch('/api/funnels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }
      setImportAbierto(false);
      setImportTexto('');
      setAviso(`✅ Embudo pegado en ${baseDominio}/${data.slug ?? nuevoSlug}. Revisa el WhatsApp y los píxeles (no viajan por seguridad).`);
      await cargar();
    } catch { setAviso('❌ No se pudo pegar el embudo.'); }
    finally { setImportando(false); }
  }

  /** Cambia el modo de confirmación de un embudo desde la lista y lo guarda. */
  async function guardarModo(e: Embudo, valor: string) {
    const modo = (valor === 'solo' || valor === 'agente') ? valor : null;
    setEmbudos(prev => prev.map(x => x.slug === e.slug ? { ...x, modo_confirmacion: modo } : x));
    try {
      const res = await fetch('/api/funnels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...e, modo_confirmacion: modo }),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); await cargar(); return; }
      setAviso(modo === 'solo'
        ? '✅ Este embudo: el bot envía la confirmación y se APAGA (la confirma una persona).'
        : modo === 'agente'
          ? '✅ Este embudo: el bot confirma la venta con el cliente (agente).'
          : '✅ Confirmación por defecto (el bot confirma la venta).');
    } catch { setAviso('❌ No se pudo guardar el modo de confirmación.'); await cargar(); }
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]';
  const label = 'block text-xs font-semibold text-[#0D0D0D] mb-1';

  // ── Lista ─────────────────────────────────────────────────────────────────
  if (vista === 'lista') {
    // Total de ventas del rango y el embudo GANADOR (el de más ventas).
    const totalRango  = Object.values(ventas).reduce((s, v) => s + v.total, 0);
    const rankeados   = Object.entries(ventas).sort((a, b) => b[1].total - a[1].total);
    const ganadorSlug = rankeados[0]?.[0] ?? '';
    const rangoLabel  = { hoy: 'hoy', '7': 'últimos 7 días', '30': 'últimos 30 días', todo: 'todo el tiempo', custom: 'rango elegido' }[rango];

    const btnRango = (v: typeof rango, l: string) =>
      `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        rango === v ? 'bg-[#00A89D] text-white border-[#00A89D]' : 'bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#F5F5F5]'
      }`;

    return (
      <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
          <header className="flex items-start justify-between gap-3 mb-5 pl-10 md:pl-0 flex-wrap">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">Embudos</h1>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Tus páginas de venta. El pedido entra directo al chat, sin intermediarios.
              </p>
            </div>
            <button
              onClick={() => { historial.current = []; futuro.current = []; setPasosDeshacer(0); setPasosRehacer(0); setActual(vacio()); setSlugOriginal(null); setTabEditor('cero'); setVersionEditando('actual'); setCheckoutModo(false); setVista('editar'); setAviso(null); }}
              className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
            >+ Nuevo embudo</button>
          </header>

          {/* ── Barra de selección masiva + papelera ── */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => seleccion.size && setModalEliminar(true)}
              disabled={!seleccion.size}
              className="px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
            >🗑 Eliminar{seleccion.size > 0 ? ` (${seleccion.size})` : ''}</button>
            <button
              onClick={() => setPapeleraAbierta(true)}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold border border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
            >🗑️ Papelera</button>
            <button
              onClick={() => { setImportTexto(''); setImportAbierto(true); }}
              title="Pegar un embudo copiado desde otra de tus apps"
              className="px-3.5 py-2 rounded-xl text-sm font-semibold border border-[#00A89D] text-[#00847A] hover:bg-[#00A89D]/10 transition-colors"
            >📥 Pegar embudo</button>
            {seleccion.size > 0 && (
              <button onClick={() => setSeleccion(new Set())} className="text-xs text-[#00A89D] font-semibold hover:underline">Quitar selección</button>
            )}
            {embudos.length > 0 && (
              <label className="ml-auto flex items-center gap-2 text-xs text-[#6B6B6B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccion.size === embudos.length && embudos.length > 0}
                  onChange={() => setSeleccion(seleccion.size === embudos.length ? new Set() : new Set(embudos.map(e => e.slug)))}
                  className="w-4 h-4 accent-[#00A89D]"
                />
                Seleccionar todos
              </label>
            )}
          </div>

          {aviso && <div className="mb-4 text-xs p-3 rounded-xl bg-white border border-[#E8E8E8]">{aviso}</div>}

          {/* ── Filtro de fecha + resumen de ventas por embudo ── */}
          <div className="mb-4 bg-white rounded-2xl border border-[#E8E8E8] p-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#0D0D0D]">📅 Ventas del período:</span>
              <button onClick={() => setRango('hoy')}  className={btnRango('hoy', 'Hoy')}>Hoy</button>
              <button onClick={() => setRango('7')}    className={btnRango('7', '7 días')}>7 días</button>
              <button onClick={() => setRango('30')}   className={btnRango('30', '30 días')}>30 días</button>
              <button onClick={() => setRango('todo')} className={btnRango('todo', 'Todo')}>Todo</button>
              <button onClick={() => setRango('custom')} className={btnRango('custom', 'Personalizado')}>Personalizado</button>
              {rango === 'custom' && (
                <span className="flex items-center gap-1.5">
                  <input type="date" value={desdeCustom} onChange={e => setDesdeCustom(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-[#E8E8E8] focus:outline-none focus:border-[#00A89D]" />
                  <span className="text-xs text-[#6B6B6B]">→</span>
                  <input type="date" value={hastaCustom} onChange={e => setHastaCustom(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-[#E8E8E8] focus:outline-none focus:border-[#00A89D]" />
                </span>
              )}
              <button onClick={cargarVentas} title="Actualizar contador"
                className="ml-auto w-8 h-8 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10">⟳</button>
            </div>

            <div className="mt-2.5 flex items-center gap-3 flex-wrap text-xs">
              <span className="text-[#6B6B6B]">
                {cargandoVentas ? 'Contando…' : <>Total <b className="text-[#0D0D0D]">{totalRango}</b> venta{totalRango === 1 ? '' : 's'} ({rangoLabel})</>}
              </span>
              {!cargandoVentas && ganadorSlug && ventas[ganadorSlug]?.total > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold">
                  🏆 Más ganador: {embudos.find(e => e.slug === ganadorSlug)?.producto ?? ganadorSlug} · {ventas[ganadorSlug].total}
                </span>
              )}
            </div>

            {!ventasListas && (
              <p className="mt-2 text-[11px] text-[#9A5B00] bg-[#FFF7ED] border border-[#F5E4CC] rounded-lg px-2.5 py-1.5 leading-snug">
                El contador empieza a sumar cuando corras la migración <b>sql/clientes-funnel-slug.sql</b> en Supabase y despliegues. Los pedidos nuevos ya quedan marcados con su embudo.
              </p>
            )}
          </div>

          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p>
          ) : embudos.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center">Aún no tienes embudos. Crea el primero.</p>
          ) : (
            <div className="space-y-3">
              {embudos.map(e => {
                const v = ventas[e.slug];
                const esGanador = e.slug === ganadorSlug && (v?.total ?? 0) > 0;
                return (
                <div key={e.slug} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-3 ${seleccion.has(e.slug) ? 'border-[#00A89D] ring-1 ring-[#00A89D]/30' : esGanador ? 'border-[#F59E0B]/60 ring-1 ring-[#F59E0B]/30' : 'border-[#E8E8E8]'}`}>
                  <input
                    type="checkbox"
                    checked={seleccion.has(e.slug)}
                    onChange={() => toggleSel(e.slug)}
                    className="w-4 h-4 accent-[#00A89D] shrink-0"
                    title="Seleccionar para eliminar"
                  />
                  {e.imagenes?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imagenes[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#F5F5F5] flex items-center justify-center text-xl shrink-0">🛍️</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{e.producto}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.activo ? 'text-[#15803D] bg-[#15803D]/10' : 'text-[#DC2626] bg-[#DC2626]/10'
                      }`}>{e.activo ? 'Activo' : 'Apagado'}</span>
                      {/* Contador de ventas del período elegido */}
                      <span
                        title={v ? `${v.confirmadas} confirmada${v.confirmadas === 1 ? '' : 's'} de ${v.total}` : 'Sin ventas en este período'}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          (v?.total ?? 0) > 0 ? 'text-[#075985] bg-[#0EA5E9]/10' : 'text-[#9A9A9A] bg-[#F5F5F5]'
                        }`}
                      >
                        🛒 {v?.total ?? 0} venta{(v?.total ?? 0) === 1 ? '' : 's'}
                        {v && v.confirmadas > 0 ? ` · ✅ ${v.confirmadas}` : ''}
                      </span>
                      {esGanador && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[#92400E] bg-[#FEF3C7]">🏆 El más ganador</span>}
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] truncate">
                      {baseDominio}/{e.slug} · {pesos(e.precio)}
                    </p>
                    {/* Confirmación con agente/bot — se aplica SOLO a este embudo */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-[#0D0D0D]">🤝 Confirmación:</span>
                      <select
                        value={e.modo_confirmacion ?? ''}
                        onChange={ev => guardarModo(e, ev.target.value)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-[#0EA5E9]/40 bg-[#0EA5E9]/5 text-[#075985] font-semibold focus:outline-none"
                        title="Cómo confirma el bot los pedidos de este embudo"
                      >
                        <option value="">Por defecto (bot confirma)</option>
                        <option value="agente">Confirmación con agente (bot cierra la venta)</option>
                        <option value="solo">Solo enviar y apagar bot (confirma un humano)</option>
                      </select>
                      {e.modo_confirmacion === 'solo' && (
                        <span className="text-[10px] text-[#C2410C] font-semibold">· el bot se apaga tras enviar</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copiarEnlace(e.slug)}
                      title="Copiar el enlace para compartirlo"
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        copiado === e.slug
                          ? 'border-[#15803D] text-[#15803D] bg-[#15803D]/10 font-semibold'
                          : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'
                      }`}
                    >{copiado === e.slug ? '✓ Copiado' : '🔗 Copiar'}</button>
                    <a
                      href={`/p/${e.slug}`} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]"
                    >Ver</a>
                    <button
                      onClick={() => { historial.current = []; futuro.current = []; setPasosDeshacer(0); setPasosRehacer(0); setActual({ ...vacio(), ...e, catalogoId: (e as any).catalogo_id ?? null }); setSlugOriginal(e.slug); setTabEditor('cero'); setVersionEditando('actual'); setCheckoutModo(false); setVista('editar'); setAviso(null); }}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]"
                    >Editar</button>
                    <button
                      onClick={() => duplicar(e)}
                      disabled={guardando}
                      title="Crear una copia idéntica con otra dirección"
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5] disabled:opacity-50"
                    >⧉ Duplicar</button>
                    <button
                      onClick={() => copiarEmbudo(e)}
                      title="Copiar este embudo para pegarlo en otra de tus apps"
                      className="px-3 py-1.5 rounded-lg border border-[#00A89D]/40 text-[#00847A] text-xs hover:bg-[#00A89D]/10"
                    >📋 Copiar embudo</button>
                    <button
                      onClick={() => setModalPixels({ slug: e.slug, nombre: e.producto || e.nombre || e.slug, pixel_meta: e.pixel_meta ?? '', pixel_meta_token: (e as any).pixel_meta_token ?? '', pixel_tiktok: e.pixel_tiktok ?? '', pixel_tiktok_token: (e as any).pixel_tiktok_token ?? '' })}
                      title="Pegar el píxel de Meta y TikTok con sus tokens"
                      className="px-3 py-1.5 rounded-lg border border-[#6D28D9]/40 text-[#6D28D9] text-xs hover:bg-[#6D28D9]/10"
                    >📊 Píxel y token</button>
                    <button
                      onClick={() => borrar(e.slug)}
                      className="w-8 h-8 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]"
                    >🗑</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ventana "Píxel y token" (acceso rápido desde la lista) */}
        {modalPixels && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={() => setModalPixels(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E8E8E8] overflow-hidden max-h-[90vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
              <div className="px-5 py-4 border-b border-[#F0F0F0]">
                <h3 className="text-[15px] font-bold text-[#0D0D0D]">📊 Píxel y token</h3>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5 truncate">{modalPixels.nombre}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl border border-[#E8E8E8] p-3 space-y-2">
                  <div className="text-[13px] font-bold text-[#1877F2]">📘 Meta (Facebook e Instagram)</div>
                  <div>
                    <label className={label}>Identificador del píxel</label>
                    <input value={modalPixels.pixel_meta} onChange={e => setModalPixels({ ...modalPixels, pixel_meta: e.target.value })} placeholder="1005280598535259" className={input} />
                  </div>
                  <div>
                    <label className={label}>Token de la API de conversiones</label>
                    <input value={modalPixels.pixel_meta_token} onChange={e => setModalPixels({ ...modalPixels, pixel_meta_token: e.target.value })} placeholder="EAAG…" className={input} />
                    <p className="text-[10px] text-[#6B6B6B] mt-1">Con este token las ventas se le informan a Meta desde el servidor (llegan aunque el cliente bloquee cookies).</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#E8E8E8] p-3 space-y-2">
                  <div className="text-[13px] font-bold text-[#0D0D0D]">🎵 TikTok</div>
                  <div>
                    <label className={label}>Identificador del píxel</label>
                    <input value={modalPixels.pixel_tiktok} onChange={e => setModalPixels({ ...modalPixels, pixel_tiktok: e.target.value })} placeholder="C6BD9A5MP02182KUTCC0" className={input} />
                  </div>
                  <div>
                    <label className={label}>Token de eventos (opcional)</label>
                    <input value={modalPixels.pixel_tiktok_token} onChange={e => setModalPixels({ ...modalPixels, pixel_tiktok_token: e.target.value })} placeholder="(opcional)" className={input} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 p-4 pt-0">
                <button onClick={() => setModalPixels(null)} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancelar</button>
                <button onClick={guardarPixels} disabled={guardandoPixels} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A] disabled:opacity-50">{guardandoPixels ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de envío a papelera (selección masiva) */}
        <ConfirmacionModal
          abierto={modalEliminar}
          peligro
          titulo={`¿Enviar ${seleccion.size} embudo${seleccion.size === 1 ? '' : 's'} a la papelera?`}
          mensaje="Sus páginas dejarán de funcionar. Podrás restaurarlos o borrarlos definitivamente desde la papelera."
          textoAceptar="Sí, enviar a papelera"
          onAceptar={enviarSeleccionAPapelera}
          onCancelar={() => setModalEliminar(false)}
        />

        {/* Papelera (overlay) */}
        {papeleraAbierta && (
          <PapeleraEmbudos onCerrar={() => setPapeleraAbierta(false)} onCambio={cargar} />
        )}

        {/* ── Modal: Copiar embudo (mostrar el código para llevarlo a otra app) ── */}
        {exportCodigo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setExportCodigo(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#E8E8E8] overflow-hidden" onClick={ev => ev.stopPropagation()}>
              <div className="p-5">
                <h3 className="text-[15px] font-bold text-[#0D0D0D] mb-1">📋 Copiar embudo</h3>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                  Este es el código de <b>{exportNombre}</b>. Cópialo y, en tu otra app de QuinChat, entra a
                  Embudos → <b>📥 Pegar embudo</b> y pégalo. Se copia toda la estructura (textos, fotos, precios,
                  productos y diseño). No incluye tu WhatsApp ni tus píxeles (esos son de cada tienda).
                </p>
                <textarea
                  readOnly
                  value={exportCodigo}
                  onFocus={ev => ev.currentTarget.select()}
                  rows={5}
                  className="mt-3 w-full rounded-xl border border-[#E8E8E8] px-3 py-2 text-[11px] font-mono text-[#0D0D0D] bg-[#FAFAFA] focus:outline-none focus:border-[#00A89D] resize-none break-all"
                />
              </div>
              <div className="flex gap-2 p-4 pt-0">
                <button onClick={() => setExportCodigo(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-[#3A3A3A] text-sm font-semibold hover:bg-[#F5F5F5]">
                  Cerrar
                </button>
                <button onClick={copiarCodigoDelModal}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${copiadoCodigo ? 'bg-[#15803D]' : 'bg-[#00A89D] hover:bg-[#00847A]'}`}>
                  {copiadoCodigo ? '✓ Copiado' : 'Copiar código'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Pegar embudo (traer uno copiado en otra app) ── */}
        {importAbierto && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => !importando && setImportAbierto(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#E8E8E8] overflow-hidden" onClick={ev => ev.stopPropagation()}>
              <div className="p-5">
                <h3 className="text-[15px] font-bold text-[#0D0D0D] mb-1">📥 Pegar embudo</h3>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                  Pega aquí el código que copiaste en tu otra app (empieza por <code className="text-[11px]">QUINEMB1:</code>).
                  Se creará un embudo nuevo con toda su estructura; luego solo revisas el WhatsApp y los píxeles.
                </p>
                <textarea
                  value={importTexto}
                  onChange={ev => setImportTexto(ev.target.value)}
                  rows={5}
                  placeholder="QUINEMB1:…"
                  className="mt-3 w-full rounded-xl border border-[#E8E8E8] px-3 py-2 text-[11px] font-mono text-[#0D0D0D] focus:outline-none focus:border-[#00A89D] resize-none break-all"
                />
                {importTexto.trim() && (
                  importPreview ? (
                    <div className="mt-2 rounded-lg bg-[#00A89D]/5 border border-[#00A89D]/30 px-3 py-2 text-[12px] text-[#0D0D0D]">
                      ✅ Listo para pegar: <b>{importPreview.producto}</b>
                      {importPreview.datos.precio ? ` · ${pesos(Number(importPreview.datos.precio))}` : ''}
                      {Array.isArray(importPreview.datos.variantes) && importPreview.datos.variantes.length ? ` · ${importPreview.datos.variantes.length} producto(s)` : ''}
                      {Array.isArray(importPreview.datos.imagenes) && importPreview.datos.imagenes.length ? ` · ${importPreview.datos.imagenes.length} foto(s)` : ''}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-600">
                      ❌ Ese código no se reconoce. Copia de nuevo el embudo completo desde la otra app.
                    </div>
                  )
                )}
              </div>
              <div className="flex gap-2 p-4 pt-0">
                <button onClick={() => setImportAbierto(false)} disabled={importando}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-[#3A3A3A] text-sm font-semibold hover:bg-[#F5F5F5] disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={pegarEmbudo} disabled={importando || !importPreview}
                  className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A] disabled:opacity-40 disabled:cursor-not-allowed">
                  {importando ? 'Pegando…' : 'Crear este embudo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      {/* Ventana flotante: ¿modificar este embudo o crear uno nuevo? */}
      {modalGuardar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setModalGuardar(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-[#E8E8E8] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-[15px] font-bold text-[#0D0D0D] mb-1.5">Guardar embudo</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                Estás guardando <b>{actual.producto || 'este embudo'}</b>. ¿Qué deseas hacer?
              </p>
            </div>
            <div className="flex flex-col gap-2 p-4 pt-0">
              <button onClick={() => hacerGuardado('modificar')} disabled={guardando}
                className="w-full py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A] disabled:opacity-50">
                ✏️ Modificar este embudo{slugOriginal ? ` («${slugOriginal}»)` : ''}
              </button>
              <button onClick={() => hacerGuardado('crear')} disabled={guardando}
                className="w-full py-2.5 rounded-xl border border-[#00A89D] text-[#00847A] text-sm font-bold hover:bg-[#00A89D]/10 disabled:opacity-50">
                ➕ Crear un nuevo embudo
              </button>
              <button onClick={() => setModalGuardar(false)}
                className="w-full py-2 rounded-xl text-[#6B6B6B] text-sm hover:bg-[#F5F5F5]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-[1700px] mx-auto px-3 md:px-6 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={() => setVista('lista')} className="text-xs text-[#00A89D] font-semibold hover:underline">
            ← Volver a la lista
          </button>
          <div className="flex items-center gap-2">
            {/* Deshacer el último cambio (o Ctrl+Z) */}
            <button
              onClick={deshacer}
              disabled={pasosDeshacer === 0}
              title="Deshacer el último cambio (Ctrl+Z)"
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                pasosDeshacer === 0
                  ? 'border-[#E8E8E8] text-[#C9C9C9] cursor-not-allowed'
                  : 'border-[#00A89D]/40 text-[#00847A] hover:bg-[#00A89D]/10'
              }`}
            >↺ Deshacer{pasosDeshacer > 0 ? ` (${pasosDeshacer})` : ''}</button>
            {/* En pantallas chicas: mostrar/ocultar la vista previa */}
            <button
              onClick={() => setVerPreview(v => !v)}
              className="lg:hidden text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E8E8E8] hover:bg-white"
            >{verPreview ? '✏️ Editar' : '👁️ Ver previa'}</button>
          </div>
        </div>

        {/* ── Versión de la PÁGINA: ACTUAL (publicada) vs NUEVA (borrador en blanco) ──
            Deja construir una versión nueva aparte SIN dañar la actual. */}
        <div className="mb-4">
          <div className="inline-flex rounded-xl border border-[#E8E8E8] bg-white p-1 shadow-sm">
            <button type="button"
              onClick={() => setVersionEditando('actual')}
              title="La versión que está publicada ahora mismo"
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${versionEditando === 'actual' ? 'bg-[#00A89D] text-white shadow' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
              📄 VERSIÓN ACTUAL
            </button>
            <button type="button"
              onClick={() => { setVersionEditando('nueva'); setTabEditor('cero'); setCheckoutModo(false); }}
              title="Arma una versión nueva en blanco, sin tocar la actual"
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors ${versionEditando === 'nueva' ? 'bg-[#00A89D] text-white shadow' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
              ✨ VERSIÓN NUEVA
            </button>
          </div>
          {versionEditando === 'nueva' && (
            <p className="text-[11px] text-[#8A5000] bg-[#FFF6EA] border border-[#F6D4A6] rounded-lg px-3 py-2 mt-2 max-w-xl">
              ✍️ Estás armando una <b>versión nueva en blanco</b>. No toca la versión actual ni la página publicada; se guarda aparte al tocar <b>Guardar</b>. Cuando quieras que esta sea la que se muestra, me dices y la publicamos.
            </p>
          )}
        </div>

        {/* ── CABECERA del editor: solo lo esencial ──
            Dirección + Nombre + switch Prendido/Apagado. Todo lo demás del
            embudo se edita tocando cada bloque en el teléfono (abajo). */}
        <div className="relative mb-5">
          {/* Chip flotante verde agua: resumen en vivo de ventas del embudo */}
          {(() => {
            const v = ventas[actual.slug];
            const conf = v?.confirmadas ?? 0;
            const monto = conf * (actual.precio || 0);
            return (
              <div className="absolute -top-3 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-[#00A89D] text-white text-[11px] font-bold px-3 py-1 shadow-md ring-2 ring-white"
                   title="Ventas confirmadas de este embudo en el período elegido">
                {pesos(monto)} · {conf} {conf === 1 ? 'prenda' : 'prendas'}
              </div>
            );
          })()}

          <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 pt-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Dirección de la página */}
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B] mb-1">Dirección de la página</label>
                <input value={actual.slug} onChange={e => set('slug', e.target.value)} placeholder="f1-escuderia-tk" className={input} />
                <p className="text-[10px] text-[#9A9A9A] mt-1">/p/{actual.slug || '…'}</p>
              </div>
              {/* Nombre del producto */}
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B] mb-1">Nombre del producto</label>
                <input value={actual.producto} onChange={e => set('producto', e.target.value)} placeholder="F1 ESCUDERIA FACEBOOK" className={input} />
              </div>
              {/* Switch Prendido / Apagado (controla `activo`) */}
              <div className="shrink-0">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B] mb-1">Embudo</label>
                <button type="button" onClick={() => set('activo', !actual.activo)}
                  title={actual.activo ? 'El embudo está prendido (visible para vender)' : 'El embudo está apagado'}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${
                    actual.activo
                      ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A]'
                      : 'border-[#E8E8E8] bg-[#F5F5F5] text-[#9A9A9A]'
                  }`}>
                  <span className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${actual.activo ? 'bg-[#00A89D]' : 'bg-[#CFCFCF]'}`}>
                    <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${actual.activo ? 'left-[21px]' : 'left-[3px]'}`} />
                  </span>
                  {actual.activo ? 'PRENDIDO' : 'APAGADO'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cambia entre ARMAR LA PÁGINA (bloques) y CONTENIDO Y AJUSTES.
            En modo checkout se oculta (el regreso se hace con el botón del banner). */}
        {!checkoutModo && versionEditando === 'actual' && (
          <button type="button" onClick={() => setTabEditor(tabEditor === 'cero' ? 'plantilla' : 'cero')}
            className="w-full mb-4 rounded-2xl border-2 border-[#00A89D]/30 bg-[#E9F7F5] px-4 py-3 text-left hover:bg-[#DDF3F0] transition-colors">
            {tabEditor === 'cero'
              ? <span className="flex items-center gap-2 text-[13px] font-bold text-[#00847A]">⚙️ Contenido y ajustes <span className="font-normal text-[#6B6B6B] text-[12px]">— productos del checkout, colores, tallas, packs x2/x3, precio, textos, píxeles…</span></span>
              : <span className="flex items-center gap-2 text-[13px] font-bold text-[#00847A]">← Volver a armar la página (bloques)</span>}
          </button>
        )}

        <div className="lg:flex lg:gap-6 lg:items-start">
          {/* Columna de edición */}
          <div className={`flex-1 min-w-0 ${verPreview ? 'hidden lg:block' : ''}`}>

        {/* Entradas de archivo ocultas */}
        <input ref={refGaleria}  type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'galeria'); e.target.value = ''; }} />
        <input ref={refBanner}   type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'banner'); e.target.value = ''; }} />
        <input ref={refClientes} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'clientes'); e.target.value = ''; }} />
        <input ref={refDetalle}  type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'detalle'); e.target.value = ''; }} />
        <input ref={refVariante} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'variante'); e.target.value = ''; }} />
        <input ref={refOpcion}   type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'opcion'); e.target.value = ''; }} />
        <input ref={refAudio}    type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirAudio(f); e.target.value = ''; }} />
        <input ref={refVideo}    type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirVideo(f); e.target.value = ''; }} />
        <input ref={refMini}     type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f, 'miniatura'); e.target.value = ''; }} />

        <div className="space-y-5">
          {tabEditor === 'cero' && (
            <EditorBloques
              key={versionEditando}
              d={actual}
              onCampo={(campo, valor) => set(campo as keyof Embudo, valor)}
              subir={async (f) => { try { return await subirArchivo(f, actual.slug || 'embudo'); } catch { return null; } }}
              layout={versionEditando === 'nueva' ? (actual.layout_borrador ?? []) : actual.layout}
              onLayout={(bs) => set(versionEditando === 'nueva' ? 'layout_borrador' : 'layout', bs)}
              permitirVacio={versionEditando === 'nueva'}
              onAbrirContenido={() => { setCheckoutModo(false); setTabEditor('plantilla'); }}
              onAbrirCheckout={abrirCheckout}
              onGuardar={guardar}
              guardando={guardando}
              onDeshacer={deshacer}
              onRehacer={rehacer}
              puedeDeshacer={pasosDeshacer > 0}
              puedeRehacer={pasosRehacer > 0}
            />
          )}
          {tabEditor === 'plantilla' && (<>
          {/* Pestañas PÁGINA DE INICIO / CHECKOUT: alternan de un clic (mismas del modo bloques) */}
          {checkoutModo && (
            <div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setCheckoutModo(false); setTabEditor('cero'); }}
                  className="flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border-2 bg-white text-[#00847A] border-[#00A89D]/40 hover:bg-[#00A89D]/5 transition-all">🛍️ Página de inicio</button>
                <button type="button"
                  className="flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border-2 bg-[#00A89D] text-white border-[#00A89D] shadow-md cursor-default">🛒 Checkout</button>
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-1.5">🛒 Aquí armas los productos, colores, tallas y precio que el cliente elige. Toca <b>Página de inicio</b> para volver a armar la página.</p>
            </div>
          )}
          {/* Básico (se oculta en modo checkout: ahí solo van los Productos del checkout) */}
          {!checkoutModo && (
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <h2 className="text-sm font-bold">Lo básico</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className={label}>Dirección de la página</label>
                <input value={actual.slug} onChange={e => set('slug', e.target.value)} placeholder="nacional-2026" className={input} />
                <p className="text-[10px] text-[#6B6B6B] mt-1">Queda como /p/{actual.slug || '…'}</p>
              </div>
              <div>
                <label className={label}>Nombre del producto</label>
                <input value={actual.producto} onChange={e => set('producto', e.target.value)} placeholder="NACIONAL 2026" className={input} />
              </div>
              <div>
                <label className={label}>Precio de hoy</label>
                <input type="number" value={actual.precio} onChange={e => set('precio', Number(e.target.value))} className={input} />
              </div>
              <div>
                <label className={label}>Precio tachado</label>
                <input type="number" value={actual.precio_antes ?? ''} onChange={e => set('precio_antes', e.target.value ? Number(e.target.value) : null)} className={input} />
              </div>
            </div>
            <div>
              <label className={label}>Titular (frases que van rotando)</label>
              <p className="text-[10px] text-[#6B6B6B] mb-2">
                Se alternan cada 5 segundos en la franja amarilla de arriba. Puedes poner hasta 5.
              </p>

              {(() => {
                const frases = actual.frases.length > 0 ? actual.frases : [actual.titulo || ''];
                const guardar = (nuevas: string[]) => {
                  const limpias = nuevas.slice(0, 5);
                  set('frases', limpias.filter(f => f.trim()));
                  set('titulo', limpias.find(f => f.trim()) ?? '');
                  // Se guarda la lista completa para no perder los campos vacíos
                  setActual(a => ({ ...a, frases: limpias } as Embudo));
                };

                return (
                  <div className="space-y-2">
                    {frases.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#00A89D]/10 text-[#00847A] text-[11px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <input
                          value={f}
                          onChange={e => {
                            const c = [...frases];
                            c[i] = e.target.value;
                            guardar(c);
                          }}
                          placeholder={
                            i === 0 ? '🔥ÚLTIMAS UNIDADES🔥COMPRA YA!🔥'
                            : i === 1 ? '🚚 ENVÍO GRATIS A TODA COLOMBIA'
                            : '💰 PAGAS CUANDO RECIBES'
                          }
                          className={`${input} flex-1`}
                        />
                        {frases.length > 1 && (
                          <button
                            onClick={() => guardar(frases.filter((_, j) => j !== i))}
                            className="w-7 h-7 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] shrink-0 text-xs"
                          >✕</button>
                        )}
                      </div>
                    ))}

                    {frases.length < 5 && (
                      <button
                        onClick={() => guardar([...frases, ''])}
                        className="text-[11px] text-[#00A89D] font-semibold hover:underline"
                      >+ Agregar frase</button>
                    )}
                  </div>
                );
              })()}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={actual.activo} onChange={e => set('activo', e.target.checked)} />
              Página activa (si la apagas, deja de abrir)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!actual.ocultar_boton2} onChange={e => set('ocultar_boton2' as any, e.target.checked as any)} />
              Ocultar el segundo botón &quot;COMPRAR&quot; (el de abajo de la página)
            </label>
          </section>
          )}

          {/* Fotos (se oculta en modo checkout) */}
          {!checkoutModo && (
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <h2 className="text-sm font-bold">Fotos</h2>

            {/* Portada: foto (galería) o video con sonido */}
            <div className="rounded-xl border border-[#E8E8E8] p-3 bg-[#FAFAFA]">
              <label className={label}>Portada de la página</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => set('video_url', null)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${!actual.video_url ? 'bg-[#00A89D] text-white border-[#00A89D]' : 'bg-white border-[#E8E8E8]'}`}
                >🖼️ Fotos (galería)</button>
                <button
                  onClick={() => { if (actual.video_url) return; refVideo.current?.click(); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${actual.video_url ? 'bg-[#00A89D] text-white border-[#00A89D]' : 'bg-white border-[#E8E8E8]'}`}
                >🎬 Video con sonido</button>
              </div>

              {actual.video_url ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={actual.video_url} controls className="flex-1 min-w-0 max-h-32 rounded-lg border border-[#E8E8E8] bg-black" />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => refVideo.current?.click()} disabled={subiendo === 'video'}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white hover:bg-[#F5F5F5] disabled:opacity-50">
                      {subiendo === 'video' ? 'Subiendo…' : 'Cambiar'}</button>
                    <button onClick={() => set('video_url', null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>
                  </div>
                </div>
              ) : subiendo === 'video' ? (
                <p className="text-xs text-[#6B6B6B]">Subiendo video…</p>
              ) : (
                <p className="text-[10px] text-[#6B6B6B]">
                  Con <b>Video</b>, la portada será ese video (mp4, máx. 50 MB) y se reemplaza la galería.
                  El sonido se activa cuando el cliente toca la pantalla.
                </p>
              )}
            </div>

            <div className={actual.video_url ? 'opacity-50' : ''}>
              <label className={label}>
                Galería principal (el carrusel)
                {actual.video_url && <span className="text-[10px] text-[#9A9A9A] font-normal ml-1">— oculta mientras uses video</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {actual.imagenes.map((src, i) => (
                  <div key={i} className="relative">
                    {esVideo(src) ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={src} muted className="w-20 h-20 object-cover rounded-lg border border-[#E8E8E8] bg-black" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-[#E8E8E8]" />
                    )}
                    {esVideo(src) && <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1 rounded">▶ video</span>}
                    <button
                      onClick={() => set('imagenes', actual.imagenes.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#DC2626] text-white text-[10px]"
                    >✕</button>
                  </div>
                ))}
                {/* Casillero partido: mitad foto, mitad video */}
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-[#C9C9C9] overflow-hidden flex flex-col">
                  <button
                    onClick={() => pedir(refGaleria, 'foto')}
                    disabled={subiendo === 'galeria'}
                    className="flex-1 text-[10px] text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] border-b border-[#E8E8E8] disabled:opacity-50"
                  >{subiendo === 'galeria' ? '…' : '📷 Foto'}</button>
                  <button
                    onClick={() => pedir(refGaleria, 'video')}
                    disabled={subiendo === 'galeria'}
                    className="flex-1 text-[10px] text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] disabled:opacity-50"
                  >🎬 Video</button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {([
                ['imagen_clientes', 'Banner de clientes', refClientes, 'clientes'],
                ['imagen_detalle',  'Foto de detalle',    refDetalle,  'detalle'],
                ['imagen_banner',   'Banner del pedido',  refBanner,   'banner'],
              ] as const).map(([campo, texto, ref, destino]) => (
                <div key={campo}>
                  <label className={label}>{texto}</label>
                  {actual[campo] ? (
                    <div className="relative">
                      {esVideo(actual[campo] as string) ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={actual[campo] as string} muted className="w-full h-20 object-cover rounded-lg border border-[#E8E8E8] bg-black" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={actual[campo] as string} alt="" className="w-full h-20 object-cover rounded-lg border border-[#E8E8E8]" />
                      )}
                      {esVideo(actual[campo] as string) && <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1 rounded">▶ video</span>}
                      <button onClick={() => set(campo, null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#DC2626] text-white text-[10px]">✕</button>
                    </div>
                  ) : (
                    <div className="w-full h-20 rounded-lg border-2 border-dashed border-[#C9C9C9] overflow-hidden flex">
                      <button
                        onClick={() => pedir(ref, 'foto')}
                        disabled={subiendo === destino}
                        className="flex-1 text-xs text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] border-r border-[#E8E8E8] disabled:opacity-50"
                      >{subiendo === destino ? '…' : '📷 Foto'}</button>
                      <button
                        onClick={() => pedir(ref, 'video')}
                        disabled={subiendo === destino}
                        className="flex-1 text-xs text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] disabled:opacity-50"
                      >🎬 Video</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Miniatura flotante (opcional) */}
            <div className="rounded-xl border border-[#E8E8E8] p-3 bg-[#FAFAFA]">
              <label className={label}>
                Miniatura flotante <span className="text-[11px] font-normal text-[#9A9A9A]">(opcional)</span>
              </label>
              <p className="text-[10px] text-[#6B6B6B] mb-2">
                Aparece pequeña sobre la página y al tocarla se agranda. Puede ser foto o video.
                Si no subes nada, no se muestra.
              </p>

              {actual.miniatura_url ? (
                <div className="flex items-center gap-2">
                  {esVideo(actual.miniatura_url) ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={actual.miniatura_url} muted className="w-24 h-24 object-cover rounded-lg border border-[#E8E8E8] bg-black" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actual.miniatura_url} alt="" className="w-24 h-24 object-cover rounded-lg border border-[#E8E8E8]" />
                  )}
                  <div className="flex flex-col gap-1">
                    <button onClick={() => pedir(refMini, 'foto')} disabled={subiendo === 'miniatura'}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white hover:bg-[#F5F5F5] disabled:opacity-50">
                      {subiendo === 'miniatura' ? 'Subiendo…' : '📷 Cambiar foto'}</button>
                    <button onClick={() => pedir(refMini, 'video')} disabled={subiendo === 'miniatura'}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs bg-white hover:bg-[#F5F5F5] disabled:opacity-50">
                      🎬 Cambiar video</button>
                    <button onClick={() => set('miniatura_url', null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-16 rounded-lg border-2 border-dashed border-[#C9C9C9] overflow-hidden flex">
                  <button onClick={() => pedir(refMini, 'foto')} disabled={subiendo === 'miniatura'}
                    className="flex-1 text-xs text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] border-r border-[#E8E8E8] disabled:opacity-50">
                    {subiendo === 'miniatura' ? '…' : '📷 Foto'}</button>
                  <button onClick={() => pedir(refMini, 'video')} disabled={subiendo === 'miniatura'}
                    className="flex-1 text-xs text-[#6B6B6B] hover:bg-[#00A89D]/10 hover:text-[#00A89D] disabled:opacity-50">
                    🎬 Video</button>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Variantes */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Productos del checkout</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => set('variantes', [...actual.variantes, {
                    id: `v${Date.now()}`, nombre: '', precio: actual.precio,
                    precioAntes: actual.precio_antes ?? undefined,
                    selectores: [{ etiqueta: 'TALLA', opciones: actual.tallas }],
                  }])}
                  className="text-xs text-[#00A89D] font-semibold hover:underline"
                >+ Agregar producto</button>
                <button
                  onClick={() => set('variantes', [...actual.variantes, {
                    id: `v${Date.now()}`, nombre: '', precio: actual.precio,
                    precioAntes: actual.precio_antes ?? undefined,
                    selectores: [
                      { etiqueta: 'COLOR', opciones: [{ valor: '', imagen: '' }] },
                      { etiqueta: 'TALLA', opciones: (actual.tallas ?? []).map(t => ({ valor: t })) },
                    ],
                  }])}
                  className="text-xs text-[#6D28D9] font-semibold hover:underline"
                >⚡ + Producto con variables (color + talla)</button>
              </div>
            </div>
            <p className="text-[10px] text-[#6B6B6B] leading-snug">
              Cada uno es una opción que el cliente puede escoger. Si no agregas ninguno,
              se muestra un solo producto con el precio de arriba.
            </p>

            {/* Editar varios productos a la vez */}
            <div className="bg-[#00A89D]/8 border border-[#00A89D]/25 rounded-xl p-3">
              <p className="text-[11px] font-bold text-[#00847A] mb-1">✏️ Editar masivo</p>
              <p className="text-[10px] text-[#6B6B6B] mb-2 leading-snug">
                Cambia el precio y las tallas de todos los productos del mismo tipo de una sola vez.
              </p>

              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { n: 1, txt: '👕 Unidad' },
                  { n: 2, txt: '👕👕 Pack x2' },
                  { n: 3, txt: '👕👕👕 Pack x3' },
                ].map(({ n, txt }) => {
                  const cuantos = actual.variantes.filter(v => unidadesDe(v) === n).length;
                  const activo = masivoTipo === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setMasivoTipo(activo ? null : n)}
                      className={`px-3 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${
                        activo
                          ? 'bg-[#00A89D] text-white border-[#00A89D]'
                          : 'bg-white border-[#00A89D]/40 text-[#00847A] hover:bg-[#00A89D]/10'
                      }`}
                    >{txt} <span className="opacity-70">({cuantos})</span></button>
                  );
                })}
              </div>

              {masivoTipo !== null && (() => {
                const afectados = actual.variantes.filter(v => unidadesDe(v) === masivoTipo);
                return (
                  <div className="bg-white rounded-lg border border-[#E8E8E8] p-3 space-y-2">
                    {afectados.length === 0 ? (
                      <p className="text-[11px] text-[#6B6B6B]">
                        No hay productos de este tipo todavía.
                      </p>
                    ) : (
                      <>
                        <p className="text-[10px] text-[#6B6B6B]">
                          Se aplicará a: {afectados.map(v => v.nombre || 'sin nombre').join(' · ')}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Precio</label>
                            <input
                              type="number" value={masivoPrecio}
                              onChange={e => setMasivoPrecio(e.target.value)}
                              placeholder="Dejar vacío = no cambiar"
                              className={input}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Precio tachado</label>
                            <input
                              type="number" value={masivoAntes}
                              onChange={e => setMasivoAntes(e.target.value)}
                              placeholder="Dejar vacío = no cambiar"
                              className={input}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#6B6B6B] mb-0.5">
                            Tallas (una por línea · vacío = no cambiar)
                          </label>
                          <textarea
                            rows={3} value={masivoTallas}
                            onChange={e => setMasivoTallas(e.target.value)}
                            placeholder={actual.tallas.slice(0, 3).join('\n')}
                            className={`${input} resize-y`}
                          />
                        </div>

                        <button
                          onClick={aplicarMasivo}
                          className="w-full py-2 rounded-lg bg-[#00A89D] text-white text-xs font-semibold hover:bg-[#00847A]"
                        >Aplicar a los {afectados.length} productos</button>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-5">
            {actual.variantes.map((v, i) => {
              const cambiar = (cambios: Partial<Variante>) => {
                const vs = [...actual.variantes];
                vs[i] = { ...v, ...cambios };
                set('variantes', vs);
              };
              const selectores = v.selectores ?? [{ etiqueta: 'TALLA', opciones: v.tallas ?? actual.tallas }];

              const esPack = /pack/i.test(v.nombre || '') || selectores.some(s => /buzo|prenda|elige/i.test(s.grupo || ''));
              const esPolos = v.estilo === 'polos' || (v.selectores ?? []).some(s => /polo\s*\d/i.test(s.grupo || ''));

              // Colores del catálogo (con familia) para importar en VARIABLES POLOS.
              const coloresCatalogo = (() => {
                const vistos = new Set<string>();
                const out: { valor: string; imagen?: string; familia?: string }[] = [];
                for (const c of catalogosFull) {
                  const familia = String((c as any).familia ?? '').trim();
                  for (const x of ((c as any).catalogo_colores ?? [])) {
                    const valor = String(x.color ?? '').trim();
                    if (!valor) continue;
                    const k = `${familia.toLowerCase()}::${valor.toLowerCase()}`;
                    if (vistos.has(k)) continue;
                    vistos.add(k);
                    out.push({ valor, imagen: x.url_imagen || undefined, familia });
                  }
                }
                return out;
              })();

              const total = actual.variantes.length;
              return (
                <div
                  key={v.id}
                  className={`rounded-2xl border-2 shadow-sm bg-white overflow-hidden transition-all ${
                    arrastreSobre === i ? 'border-[#00A89D] ring-2 ring-[#00A89D]/40' : 'border-[#00A89D]/25'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); if (arrastreSobre !== i) setArrastreSobre(i); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (arrastreOrigen.current >= 0) moverVariante(arrastreOrigen.current, i);
                    arrastreOrigen.current = -1; setArrastreSobre(-1);
                  }}
                >
                  {/* Encabezado numerado del producto — separa uno de otro y se arrastra */}
                  <div
                    className="flex items-center justify-between px-3 py-2 bg-[#00A89D]/10 border-b border-[#00A89D]/20"
                    draggable
                    onDragStart={() => { arrastreOrigen.current = i; }}
                    onDragEnd={() => { arrastreOrigen.current = -1; setArrastreSobre(-1); }}
                  >
                    <span className="text-[12px] font-bold text-[#00847A] flex items-center gap-1.5">
                      <span className="cursor-grab active:cursor-grabbing text-[#00A89D] text-[15px] leading-none select-none" title="Arrastra para reordenar">⠿</span>
                      <span className="w-5 h-5 rounded-full bg-[#00A89D] text-white text-[11px] flex items-center justify-center">{i + 1}</span>
                      {esPack ? '📦 PACK' : '🛍️ PRODUCTO CON VARIABLES'}{v.nombre ? ` · ${v.nombre}` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moverVariante(i, i - 1)}
                        disabled={i === 0}
                        title="Subir"
                        className="w-6 h-6 rounded-md text-[13px] text-[#00847A] hover:bg-[#00A89D]/15 disabled:opacity-30 disabled:cursor-not-allowed"
                      >↑</button>
                      <button
                        onClick={() => moverVariante(i, i + 1)}
                        disabled={i === total - 1}
                        title="Bajar"
                        className="w-6 h-6 rounded-md text-[13px] text-[#00847A] hover:bg-[#00A89D]/15 disabled:opacity-30 disabled:cursor-not-allowed"
                      >↓</button>
                      <button
                        onClick={() => set('variantes', actual.variantes.filter((_, j) => j !== i))}
                        className="text-[11px] text-[#DC2626] hover:underline ml-1"
                      >🗑 Quitar</button>
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                  {/* Cabecera del producto */}
                  <div className="flex items-center gap-2">
                    {v.imagen ? (
                      <button
                        onClick={() => { varianteDestino.current = i; refVariante.current?.click(); }}
                        title="Cambiar foto"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.imagen} alt="" className="w-14 h-14 rounded object-cover" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { varianteDestino.current = i; refVariante.current?.click(); }}
                        className="w-14 h-14 rounded border-2 border-dashed border-[#C9C9C9] text-[10px] text-[#6B6B6B] shrink-0 hover:border-[#00A89D]"
                      >+ Foto</button>
                    )}
                    <input
                      value={v.nombre}
                      onChange={e => cambiar({ nombre: e.target.value })}
                      placeholder="NACIONAL VERDE 2026"
                      className={`${input} flex-1`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Precio</label>
                      <input type="number" value={v.precio} onChange={e => cambiar({ precio: Number(e.target.value) })} className={input} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Precio tachado</label>
                      <input type="number" value={v.precioAntes ?? ''} onChange={e => cambiar({ precioAntes: e.target.value ? Number(e.target.value) : undefined })} className={input} />
                    </div>
                  </div>

                  {/* ── Stock propio del embudo (opcional). Vacío = ilimitado. ── */}
                  <div className="rounded-xl border border-[#E8E8E8] bg-[#FAF9F6] p-2.5 mt-2">
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="block text-[10px] text-[#6B6B6B] mb-0.5">🧮 Stock (unidades)</label>
                        <input type="number" min={0} inputMode="numeric" value={v.stock ?? ''} placeholder="∞ ilimitado"
                          onChange={e => cambiar({ stock: e.target.value.trim() === '' ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          className={`${input} w-[130px]`} />
                      </div>
                      <div className="flex-1 min-w-[170px]">
                        <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Al llegar a 0</label>
                        <select value={v.politicaStock ?? 'bloquear'} onChange={e => cambiar({ politicaStock: e.target.value as 'bloquear' | 'seguir' })}
                          className={input} style={{ color: (v.politicaStock ?? 'bloquear') === 'bloquear' ? '#C1121F' : '#0D8A3E', fontWeight: 600 }}>
                          <option value="bloquear">🚫 No dejar comprar</option>
                          <option value="seguir">✅ Seguir vendiendo</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#9A9A9A] mt-1">Déjalo vacío para vender sin límite. Si pones unidades, cada venta descuenta 1; al llegar a 0 se aplica la regla de arriba en la página.</p>
                  </div>

                  {/* ── Editor simple: Colores (con foto) + Tallas (una vez) ── */}
                  {(() => {
                    // Un pack REAL agrupa por prenda ("ELIGE BUZO 1"). Un color como grupo
                    // (NEGRO, ROJO) NO es pack: es una unidad con varios colores.
                    const esPackVar = /pack/i.test(v.nombre || '')
                      || selectores.some(s => /buzo|prenda|elige/i.test(s.grupo || ''));
                    if (esPackVar) return null; // los packs usan el editor de abajo

                    const colorSel = selectores.find(s => /color/i.test(s.etiqueta));
                    const tallaSel = selectores.find(s => /talla/i.test(s.etiqueta) || !s.etiqueta?.trim());
                    let colores = (colorSel?.opciones ?? []).map((o: any) => (typeof o === 'string' ? { valor: o } : { ...o }));
                    // Si los colores quedaron como "grupos" (dato viejo), se recuperan de ahí
                    if (colores.length === 0) {
                      const gruposColor = [...new Set(selectores.map(s => s.grupo?.trim()).filter(Boolean) as string[])];
                      if (gruposColor.length) colores = gruposColor.map(valor => ({ valor, imagen: '' }));
                    }
                    const tallas  = (tallaSel?.opciones ?? actual.tallas).map((o: any) => (typeof o === 'string' ? o : o.valor));

                    // Reescribe SIEMPRE como [COLOR, TALLA] (color en índice 0, para las fotos)
                    const escribir = (cs: any[], ts: string[]) => cambiar({ selectores: [
                      { etiqueta: 'COLOR', opciones: cs },
                      { etiqueta: 'TALLA', opciones: ts.map(valor => ({ valor })) },
                    ] });

                    return (
                      <div className="border-t border-[#EEE] pt-2.5 space-y-3">
                        {/* Colores */}
                        <div>
                          <p className="text-[11px] font-bold text-[#0D0D0D] mb-1.5">🎨 Colores (cada uno con su foto)</p>
                          <div className="space-y-1.5">
                            {colores.map((c: any, ci: number) => (
                              <div key={ci} className="flex items-center gap-2">
                                {c.imagen ? (
                                  <button onClick={() => { opcionDestino.current = { v: i, s: 0, o: ci }; refOpcion.current?.click(); }} className="shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={c.imagen} alt="" className="w-10 h-10 rounded object-cover" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { escribir(colores, tallas); opcionDestino.current = { v: i, s: 0, o: ci }; refOpcion.current?.click(); }}
                                    className="w-10 h-10 rounded border border-dashed border-[#C9C9C9] text-[9px] text-[#6B6B6B] shrink-0 hover:border-[#00A89D]"
                                  >+ Foto</button>
                                )}
                                <input
                                  value={c.valor}
                                  onChange={e => { const cs = [...colores]; cs[ci] = { ...c, valor: e.target.value }; escribir(cs, tallas); }}
                                  placeholder="Ej: NEGRO"
                                  className={`${input} flex-1`}
                                />
                                <button onClick={() => escribir(colores.filter((_: any, j: number) => j !== ci), tallas)}
                                  className="w-8 h-8 rounded text-[#DC2626] hover:bg-[#FEE2E2] shrink-0">✕</button>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <button onClick={() => escribir([...colores, { valor: '', imagen: '' }], tallas)}
                              className="text-[11px] text-[#00A89D] font-semibold hover:underline">+ Agregar color</button>
                            <button onClick={() => { setImpBusca(''); setImpPicker(i); }}
                              className="text-[11px] text-[#6D28D9] font-semibold hover:underline">📥 Traer de Catálogos</button>
                          </div>

                          {/* Importador: trae un catálogo ya creado con sus colores y fotos */}
                          {impPicker === i && (
                            <div className="mt-2 rounded-lg border-2 border-[#7C3AED] bg-white p-2.5">
                              <p className="text-[11px] font-bold text-[#5B21B6] mb-1">📥 Trae un catálogo (colores con foto + tallas + nombre)</p>
                              <input
                                value={impBusca}
                                onChange={e => setImpBusca(e.target.value)}
                                placeholder="🔍 Buscar catálogo…"
                                className="w-full px-2 py-1.5 rounded border border-[#E0E0E0] text-[12px] mb-2"
                              />
                              <div className="max-h-44 overflow-y-auto border border-[#EEE] rounded divide-y divide-[#F4F4F4]">
                                {catalogosFull
                                  .filter((c: any) => String(c.familia ?? '').toLowerCase().includes(impBusca.toLowerCase()))
                                  .map((c: any) => {
                                    const nombre = String(c.familia ?? '').trim();
                                    const cols = (c.catalogo_colores ?? [])
                                      .filter((x: any) => x.url_imagen)
                                      .map((x: any) => ({ valor: String(x.color ?? '').trim(), imagen: x.url_imagen as string }))
                                      .filter((o: any) => o.valor);
                                    return (
                                      <button
                                        key={nombre}
                                        onClick={() => {
                                          if (cols.length === 0) { alert('Ese catálogo no tiene colores con foto.'); return; }
                                          // Agrega los colores nuevos (sin duplicar) y, si el producto no tiene nombre, usa el del catálogo
                                          const existentes = new Set(colores.map((x: any) => String(x.valor).toUpperCase()));
                                          const nuevos = cols.filter((x: any) => !existentes.has(x.valor.toUpperCase()));
                                          const base = colores.filter((x: any) => x.valor);
                                          // TALLAS del catálogo: la primera columna que NO es de color (sin hex).
                                          const columnas = Array.isArray(c.columnas) ? c.columnas : [];
                                          const noColor = columnas.find((col: any) => col && Array.isArray(col.vals) && col.vals.length && !col.vals.some((vv: any) => vv?.hex));
                                          let tallasCat: string[] = noColor ? noColor.vals.map((vv: any) => String(vv?.nm ?? '').trim()).filter(Boolean) : [];
                                          // Respaldo: unir las tallas guardadas en cada color (variante), quitando los nombres de color.
                                          if (!tallasCat.length) {
                                            const coloresUp = new Set(cols.map((x: any) => x.valor.toUpperCase()));
                                            const setT = new Set<string>();
                                            (c.catalogo_colores ?? []).forEach((r: any) => {
                                              const variante = (r?.variante && typeof r.variante === 'object') ? r.variante : {};
                                              Object.values(variante).forEach((arr: any) => (Array.isArray(arr) ? arr : []).forEach((o: any) => { const s = String(o).trim(); if (s && !coloresUp.has(s.toUpperCase())) setT.add(s); }));
                                            });
                                            tallasCat = [...setT];
                                          }
                                          // Une con las tallas que ya tenía (sin duplicar); si no había, usa las del catálogo.
                                          const tallasBase = tallas.filter(Boolean);
                                          const tallasUp = new Set(tallasBase.map(t => t.toUpperCase()));
                                          const tallasFinal = [...tallasBase];
                                          tallasCat.forEach(t => { const up = t.toUpperCase(); if (!tallasUp.has(up)) { tallasUp.add(up); tallasFinal.push(t); } });
                                          escribir([...base, ...nuevos], tallasFinal.length ? tallasFinal : tallas);
                                          if (!v.nombre?.trim()) cambiar({ nombre });
                                          setImpPicker(null);
                                        }}
                                        className="w-full flex items-center justify-between px-2 py-1.5 text-[12px] text-left hover:bg-[#FAFAFA]"
                                      >
                                        <span className="font-semibold">{nombre}</span>
                                        <span className={`text-[10px] ${cols.length === 0 ? 'text-[#C2410C]' : 'text-[#9A9A9A]'}`}>{cols.length} colores</span>
                                      </button>
                                    );
                                  })}
                              </div>
                              <button onClick={() => setImpPicker(null)} className="mt-2 px-3 py-1 rounded-lg border border-[#E8E8E8] text-[11px]">Cerrar</button>
                            </div>
                          )}
                        </div>

                        {/* Tallas (una vez para todos los colores) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-bold text-[#0D0D0D]">📏 Tallas <span className="font-normal text-[#9A9A9A]">(una sola vez, valen para todos los colores)</span></p>
                            <button onClick={() => escribir(colores, actual.tallas)} className="text-[10px] text-[#00A89D] hover:underline">↺ Usar las del embudo</button>
                          </div>
                          <textarea
                            rows={3}
                            value={tallas.join('\n')}
                            onChange={e => escribir(colores, e.target.value.split('\n').map(x => x.trim()).filter(Boolean))}
                            placeholder="Una talla por línea"
                            className={`${input} resize-y`}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Elecciones del cliente (solo para PACKS con varias prendas) */}
                  {!esPolos && (/pack/i.test(v.nombre || '') || selectores.some(s => /buzo|prenda|elige/i.test(s.grupo || ''))) &&
                  <div className="border-t border-[#EEE] pt-2.5">
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <span className="text-[11px] font-semibold text-[#0D0D0D]">
                        Qué debe elegir el cliente ({selectores.length}/6)
                      </span>
                      {selectores.length < 6 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cambiar({ selectores: [...selectores, { etiqueta: 'COLOR', opciones: [{ valor: '', imagen: '' }, { valor: '', imagen: '' }] }] })}
                            className="text-[11px] text-[#00A89D] font-semibold hover:underline"
                          >🎨 + Color</button>
                          <button
                            onClick={() => cambiar({ selectores: [...selectores, { etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) }] })}
                            className="text-[11px] text-[#00A89D] font-semibold hover:underline"
                          >+ Talla</button>
                        </div>
                      )}
                    </div>

                    {/* Si quedó como varios "pasos" por color, se aplana a color + talla */}
                    {selectores.some(s => s.grupo?.trim()) && (
                      <button
                        onClick={() => {
                          const colores = [...new Set(selectores.map(s => s.grupo?.trim()).filter(Boolean) as string[])];
                          cambiar({ selectores: [
                            // Cada color con su espacio de foto (para subirla luego)
                            { etiqueta: 'COLOR', opciones: (colores.length ? colores : ['']).map(valor => ({ valor, imagen: '' })) },
                            { etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) },
                          ] });
                        }}
                        className="w-full mb-2 py-1.5 rounded-lg bg-[#00A89D]/10 text-[#00847A] text-[11px] font-semibold hover:bg-[#00A89D]/20"
                      >🔄 Convertir a Color + Talla (todo junto, se elige uno)</button>
                    )}

                    <div className="space-y-3">
                      {selectores.map((s, si) => {
                        // Se conservan las opciones vacías mientras se editan (aOpciones
                        // las quitaría y no dejaría escribir el color nuevo).
                        const ops = (s.opciones ?? []).map(o => (typeof o === 'string' ? { valor: o } : (o ?? { valor: '' })));
                        // El selector de COLOR SIEMPRE va con foto por opción (como el pack x2).
                        const conFotos = /color/i.test(s.etiqueta) || ops.some(o => o.imagen !== undefined);
                        const actualizarSel = (cambios: Partial<Selector>) => {
                          const ss = [...selectores];
                          ss[si] = { ...s, ...cambios };
                          cambiar({ selectores: ss });
                        };

                        return (
                          <div key={si} className="border border-[#E8E8E8] rounded-lg p-2.5 bg-white space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={s.grupo ?? ''}
                                onChange={e => actualizarSel({ grupo: e.target.value })}
                                placeholder="ELIGE BUZO 1 (opcional)"
                                className="flex-1 px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] focus:outline-none focus:border-[#00A89D]"
                              />
                              <input
                                value={s.etiqueta}
                                onChange={e => actualizarSel({ etiqueta: e.target.value })}
                                placeholder="COLOR / TALLA"
                                className="w-28 px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] font-semibold shrink-0 focus:outline-none focus:border-[#00A89D]"
                              />
                              {selectores.length > 1 && (
                                <button
                                  onClick={() => cambiar({ selectores: selectores.filter((_, j) => j !== si) })}
                                  className="w-7 h-7 rounded text-[11px] text-[#DC2626] hover:bg-[#FEE2E2] shrink-0"
                                >✕</button>
                              )}
                            </div>

                            {conFotos ? (
                              // Con fotos: una fila por opción
                              <div className="space-y-1.5">
                                {ops.map((op, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    {op.imagen ? (
                                      <button
                                        onClick={() => { opcionDestino.current = { v: i, s: si, o: oi }; refOpcion.current?.click(); }}
                                        className="shrink-0"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={op.imagen} alt="" className="w-9 h-9 rounded object-cover" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => { opcionDestino.current = { v: i, s: si, o: oi }; refOpcion.current?.click(); }}
                                        className="w-9 h-9 rounded border border-dashed border-[#C9C9C9] text-[9px] text-[#6B6B6B] shrink-0"
                                      >Foto</button>
                                    )}
                                    <input
                                      value={op.valor}
                                      onChange={e => {
                                        const nuevas = [...ops];
                                        nuevas[oi] = { ...op, valor: e.target.value };
                                        actualizarSel({ opciones: nuevas });
                                      }}
                                      className="flex-1 px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] focus:outline-none focus:border-[#00A89D]"
                                    />
                                    <button
                                      onClick={() => actualizarSel({ opciones: ops.filter((_, j) => j !== oi) })}
                                      className="w-7 h-7 rounded text-[10px] text-[#DC2626] hover:bg-[#FEE2E2] shrink-0"
                                    >✕</button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => actualizarSel({ opciones: [...ops, { valor: '' }] })}
                                  className="text-[11px] text-[#00A89D] font-semibold hover:underline"
                                >+ Opción</button>
                              </div>
                            ) : (
                              <textarea
                                rows={2}
                                value={ops.map(o => o.valor).join('\n')}
                                onChange={e => actualizarSel({
                                  opciones: e.target.value.split('\n').map(x => x.trim()).filter(Boolean).map(valor => ({ valor })),
                                })}
                                placeholder="Una opción por línea"
                                className="w-full px-2 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] resize-y focus:outline-none focus:border-[#00A89D]"
                              />
                            )}

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => actualizarSel({ opciones: actual.tallas.map(valor => ({ valor })) })}
                                className="text-[10px] text-[#00A89D] hover:underline"
                              >↺ Usar las tallas del embudo</button>
                              {/* La foto SOLO va en el color, nunca en la talla */}
                              {/talla/i.test(s.etiqueta) ? null : (
                                <button
                                  onClick={() => actualizarSel({
                                    opciones: conFotos
                                      ? ops.map(o => ({ valor: o.valor }))
                                      : ops.map(o => ({ ...o, imagen: o.imagen ?? '' })),
                                  })}
                                  className="text-[10px] text-[#6B6B6B] hover:underline"
                                >{conFotos ? 'Quitar fotos' : '🖼️ Foto por color'}</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  }

                  {/* Acciones */}
                  <div className="flex items-center gap-2 border-t border-[#EEE] pt-2.5 flex-wrap">
                    {/* Opcional: el pack deja elegir la escudería por prenda (mezclar modelos) */}
                    <label className="flex items-center gap-1.5 text-[11px] text-[#0D0D0D] cursor-pointer mr-1">
                      <input type="checkbox" checked={packConEscuderia}
                        onChange={e => setPackConEscuderia(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#00A89D]" />
                      🏁 Elegir escudería en el pack
                    </label>

                    {/* Arma las elecciones del pack usando los colores ya creados */}
                    {[2, 3].map(cantidad => (
                      <button
                        key={cantidad}
                        onClick={() => {
                          // Los demás productos del checkout son los colores disponibles
                          const colores = actual.variantes
                            .filter((_, j) => j !== i)
                            .filter(o => o.imagen && !/pack/i.test(o.nombre))
                            .map(o => ({ valor: o.nombre, imagen: o.imagen }));

                          if (colores.length === 0) {
                            alert('Primero crea los colores con su foto. Luego este botón los usa para armar el pack.');
                            return;
                          }
                          if (packConEscuderia && escuderias.length === 0) {
                            alert('No hay escuderías cargadas en Catálogos para elegir. Créalas primero.');
                            return;
                          }

                          const nuevos: Selector[] = [];
                          for (let n = 1; n <= cantidad; n++) {
                            const grupo = `ELIGE BUZO ${n}`;
                            if (packConEscuderia) {
                              nuevos.push({ grupo, etiqueta: 'ESCUDERÍA', opciones: escuderias.map(valor => ({ valor })) });
                            }
                            nuevos.push({ grupo, etiqueta: 'COLOR', opciones: colores });
                            nuevos.push({ grupo, etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) });
                          }
                          cambiar({ selectores: nuevos });
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#00A89D]/40 text-[11px] text-[#00847A] hover:bg-[#00A89D]/10"
                      >⚡ Armar pack de {cantidad}</button>
                    ))}

                    {/* "Arma tu pack/unidad": abre un SELECTOR con buscador para elegir SOLO
                        las escuderías que se quieran (no todas). x1 = una sola prenda. */}
                    {[1, 2, 3].map(cantidad => (
                      <button
                        key={`cascada-${cantidad}`}
                        onClick={() => {
                          if (catalogosFull.length === 0) {
                            alert('No hay escuderías en Catálogos.\n\nEn Catálogos crea las escuderías con sus colores y foto. Luego vuelve aquí.');
                            return;
                          }
                          setPackSel(new Set((v.armarPack?.categorias ?? []).map((c: any) => String(c.nombre))));
                          setPackBusca('');
                          setPackPicker({ vi: i, cantidad });
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#7C3AED]/40 text-[11px] text-[#6D28D9] bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 font-semibold"
                      >🧩 {cantidad === 1 ? 'Arma tu unidad (elige escudería)' : `Arma tu pack x${cantidad}`}</button>
                    ))}

                    {/* VARIABLES POLOS: pack de polos donde cada polo elige color + talla */}
                    <button
                      onClick={() => { if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones por VARIABLES POLOS (2 polos con color y talla). ¿Seguir?')) return; cambiar({ nombre: v.nombre || 'PACK X2 POLOS', selectores: selectoresPolos(2), armarPack: undefined, estilo: 'polos' }); }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x2)</button>
                    <button
                      onClick={() => { if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones por VARIABLES POLOS x3. ¿Seguir?')) return; cambiar({ nombre: v.nombre || 'PACK X3 POLOS', selectores: selectoresPolos(3), armarPack: undefined, estilo: 'polos' }); }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x3)</button>
                    {esPolos && (
                      <button
                        onClick={() => cambiar({ estilo: undefined, selectores: [] })}
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] text-[#C2410C] hover:bg-[#FFF7ED]"
                      >✕ Quitar Variables Polos</button>
                    )}

                    {v.armarPack && (
                      <button
                        onClick={() => cambiar({ armarPack: undefined })}
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] text-[#C2410C] hover:bg-[#FFF7ED]"
                      >✕ Quitar arma tu pack</button>
                    )}

                    <button
                      onClick={() => {
                        const copia: Variante = {
                          ...v,
                          id: `v${Date.now()}`,
                          nombre: `${v.nombre} (copia)`,
                          selectores: selectores.map(s => ({ ...s, opciones: [...s.opciones] })),
                        };
                        const vs = [...actual.variantes];
                        vs.splice(i + 1, 0, copia);
                        set('variantes', vs);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px] hover:bg-[#F5F5F5]"
                    >📋 Duplicar</button>
                    <button
                      onClick={() => set('variantes', actual.variantes.filter((_, j) => j !== i))}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-[#DC2626] hover:bg-[#FEE2E2] ml-auto"
                    >🗑 Quitar</button>
                  </div>

                  {/* Selector de escuderías del pack (buscador + checkboxes) */}
                  {packPicker?.vi === i && (
                    <div className="mt-2 rounded-lg border-2 border-[#7C3AED] bg-white p-3">
                      <p className="text-[12px] font-bold text-[#5B21B6] mb-1">🧩 Elige las escuderías {packPicker.cantidad === 1 ? 'para la unidad' : `para el pack x${packPicker.cantidad}`}</p>
                      <input
                        value={packBusca}
                        onChange={e => setPackBusca(e.target.value)}
                        placeholder="🔍 Buscar escudería…"
                        className="w-full px-2 py-1.5 rounded border border-[#E0E0E0] text-[12px] mb-2"
                      />
                      <div className="max-h-52 overflow-y-auto border border-[#EEE] rounded divide-y divide-[#F4F4F4]">
                        {catalogosFull
                          .filter((c: any) => String(c.familia ?? '').toLowerCase().includes(packBusca.toLowerCase()))
                          .map((c: any) => {
                            const nombre = String(c.familia ?? '').trim();
                            const nCol = (c.catalogo_colores ?? []).filter((x: any) => x.url_imagen).length;
                            const checked = packSel.has(nombre);
                            return (
                              <label key={nombre} className="flex items-center gap-2 px-2 py-1.5 text-[12px] cursor-pointer hover:bg-[#FAFAFA]">
                                <input
                                  type="checkbox" checked={checked} className="accent-[#7C3AED]"
                                  onChange={() => setPackSel(prev => { const s = new Set(prev); s.has(nombre) ? s.delete(nombre) : s.add(nombre); return s; })}
                                />
                                <span className="flex-1">{nombre}</span>
                                <span className={`text-[10px] ${nCol === 0 ? 'text-[#C2410C]' : 'text-[#9A9A9A]'}`}>{nCol} colores</span>
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            const categorias = catalogosFull
                              .filter((c: any) => packSel.has(String(c.familia ?? '').trim()))
                              .map((c: any) => ({
                                nombre: String(c.familia ?? '').trim(),
                                colores: (c.catalogo_colores ?? [])
                                  .filter((x: any) => x.url_imagen)
                                  .map((x: any) => ({ valor: String(x.color ?? '').trim(), imagen: x.url_imagen as string }))
                                  .filter((o: any) => o.valor),
                              }))
                              .filter((c: any) => c.colores.length > 0);
                            if (!categorias.length) { alert('Elige al menos una escudería que tenga colores con foto.'); return; }
                            cambiar({ armarPack: { unidades: packPicker.cantidad, categorias, tallas: actual.tallas }, selectores: [] });
                            setPackPicker(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-semibold hover:bg-[#6D28D9]"
                        >✅ Agregar al pack ({packSel.size})</button>
                        <button onClick={() => setPackPicker(null)} className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[11px]">Cancelar</button>
                      </div>
                    </div>
                  )}

                  {/* "Arma tu pack" activo: aviso + VISTA PREVIA en vivo del constructor */}
                  {v.armarPack && (
                    <div className="mt-2 rounded-lg border-2 border-[#7C3AED]/40 bg-[#7C3AED]/5 p-2.5">
                      <p className="text-[11px] text-[#5B21B6]">
                        🧩 <b>Arma tu pack ACTIVO</b> · pack de {v.armarPack.unidades} · {v.armarPack.categorias?.length ?? 0} categorías, {v.armarPack.categorias?.reduce((s: number, c: any) => s + (c.colores?.length ?? 0), 0) ?? 0} colores. <b>Guarda</b> para dejarlo aplicado.
                      </p>

                      {/* Etiquetas editables: no siempre es "escudería"/"buzo" */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Nombre del selector</label>
                          <input
                            value={v.armarPack.labelCategoria ?? ''}
                            onChange={e => cambiar({ armarPack: { ...v.armarPack!, labelCategoria: e.target.value } })}
                            placeholder="escudería / marca / equipo / pareja"
                            className="w-full px-2 py-1.5 rounded border border-[#E0E0E0] text-[12px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B6B6B] mb-0.5">Nombre de la prenda</label>
                          <input
                            value={v.armarPack.labelPrenda ?? ''}
                            onChange={e => cambiar({ armarPack: { ...v.armarPack!, labelPrenda: e.target.value } })}
                            placeholder="buzo / camiseta / prenda"
                            className="w-full px-2 py-1.5 rounded border border-[#E0E0E0] text-[12px]"
                          />
                        </div>
                      </div>
                      {(v.armarPack.categorias?.length ?? 0) === 0 ? (
                        <p className="text-[11px] text-[#C2410C] font-bold mt-1">⚠️ No capturó escuderías: crea las escuderías con colores y foto en Catálogos y vuelve a tocar el botón.</p>
                      ) : (
                        <div className="mt-2">
                          <p className="text-[10px] font-bold text-[#9A9A9A] uppercase mb-1">👁️ Vista previa (así lo ve el cliente):</p>
                          <div className="bg-white rounded-lg border border-[#EEE] py-2 pointer-events-none">
                            <ArmarPackSelector
                              config={v.armarPack as any}
                              acento={acentoDe((actual as any).color)}
                              onChange={() => { /* solo vista previa */ }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VARIABLES POLOS: editor de cada polo (color + talla) */}
                  {esPolos && (
                    <EditorPareja
                      selectores={selectores as any}
                      coloresCatalogo={coloresCatalogo}
                      onChange={(s) => cambiar({ selectores: s as any })}
                      titulo={'🎽 VARIABLES POLOS · cada polo con su color y talla'}
                    />
                  )}
                  </div>
                </div>
              );
            })}
            </div>
          </section>

          {/* Textos y ajustes */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <h2 className="text-sm font-bold">Textos y ajustes</h2>
            <div>
              <label className={label}>Características (una por línea)</label>
              <textarea
                rows={3}
                value={actual.caracteristicas.join('\n')}
                onChange={e => set('caracteristicas', e.target.value.split('\n').filter(Boolean))}
                className={`${input} resize-y`}
              />
            </div>
            <div>
              <label className={label}>Tallas disponibles (una por línea)</label>
              <textarea
                rows={4}
                value={actual.tallas.join('\n')}
                onChange={e => set('tallas', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                className={`${input} resize-y`}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={label}>Horas del contador</label>
                <input type="number" value={actual.horas_contador} onChange={e => set('horas_contador', Number(e.target.value))} className={input} />
              </div>
              <div>
                <label className={label}>Personas comprando</label>
                <input type="number" value={actual.personas_comprando} onChange={e => set('personas_comprando', Number(e.target.value))} className={input} />
              </div>
              <div>
                <label className={label}>WhatsApp del bot</label>
                <div className="px-3 py-2 rounded-lg bg-[#F4F4F4] border border-[#E8E8E8] text-sm text-[#6B6B6B]">
                  🔒 Automático
                </div>
                <p className="text-[10px] text-[#6B6B6B] mt-1">
                  La página de gracias siempre lleva al número que atiende el bot. Se toma solo,
                  para que nunca se le escriba mal y una venta termine en otro número.
                </p>
              </div>
            </div>

            {/* IDs de anuncios que llevan a este producto (lista) */}
            {(() => {
              const ids = String(actual.anuncios ?? '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
              const guardar = (lista: string[]) => set('anuncios', lista.join(', '));
              return (
                <div>
                  <label className={label}>🎯 IDs de anuncios de este producto <span className="text-[10px] font-normal text-[#9A9A9A]">(para el bot de ventas)</span></label>

                  <div className="space-y-2">
                    {ids.map((id, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={id}
                          onChange={e => { const c = [...ids]; c[i] = e.target.value; guardar(c); }}
                          placeholder="Ej: 120210000001"
                          className={`${input} flex-1`}
                        />
                        <button
                          onClick={() => guardar(ids.filter((_, j) => j !== i))}
                          className="w-9 h-9 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] shrink-0"
                          title="Eliminar este ID"
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => guardar([...ids, ''])}
                    className="mt-2 text-xs text-[#00A89D] font-semibold hover:underline"
                  >+ Agregar ID de anuncio</button>

                  <p className="text-[10px] text-[#6B6B6B] mt-2">
                    Agrega un ID por cada campaña que apunte a <b>{actual.producto || 'este producto'}</b>.
                    Cuando alguien llegue por ese anuncio, el bot sabrá con certeza qué quiere.
                  </p>
                </div>
              );
            })()}
          </section>

          {/* Color de acento (por embudo) */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold">🎨 Color de la página <span className="text-[11px] font-normal text-[#9A9A9A]">(botón, precio y títulos)</span></h2>
              <p className="text-[11px] text-[#6B6B6B] mt-1">Solo cambia <b>este</b> embudo. Los demás siguen en verde.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                ['Verde',  ''],
                ['Morado', '#7C3AED'],
                ['Rosado', '#EC4899'],
                ['Azul',   '#2563EB'],
                ['Rojo',   '#DC2626'],
                ['Naranja','#EA580C'],
                ['Negro',  '#111111'],
              ] as const).map(([nombre, valor]) => {
                const activo = (actual.color ?? '') === valor;
                return (
                  <button
                    key={nombre}
                    onClick={() => set('color', valor || null)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${activo ? 'border-[#00A89D] bg-[#00A89D]/10 font-semibold' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}
                  >
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: valor || '#3DC12A' }} />
                    {nombre}
                    {activo && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
              {/* Color libre */}
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-xs cursor-pointer hover:bg-[#F5F5F5]">
                <input
                  type="color"
                  value={actual.color ?? '#3DC12A'}
                  onChange={e => set('color', e.target.value)}
                  className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
                />
                Otro
              </label>
            </div>
          </section>

          {/* Música de fondo (opcional, por embudo) */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold">🎵 Música de fondo <span className="text-[11px] font-normal text-[#9A9A9A]">(opcional)</span></h2>
              <p className="text-[11px] text-[#6B6B6B] mt-1">
                Suena solo en <b>este</b> embudo. Empieza en cuanto el cliente toca la pantalla
                (los navegadores no dejan que arranque sola de una). Si no subes nada, la página no suena.
              </p>
            </div>

            {actual.audio_url ? (
              <div className="flex items-center gap-3 p-2 rounded-xl border border-[#E8E8E8] bg-[#FAFAFA]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={actual.audio_url} controls className="flex-1 min-w-0 h-9" />
                <button
                  onClick={() => refAudio.current?.click()}
                  disabled={subiendo === 'audio'}
                  className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-white disabled:opacity-50"
                >{subiendo === 'audio' ? 'Subiendo…' : 'Cambiar'}</button>
                <button
                  onClick={() => set('audio_url', null)}
                  className="w-8 h-8 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]"
                  title="Quitar la música"
                >🗑</button>
              </div>
            ) : (
              <button
                onClick={() => refAudio.current?.click()}
                disabled={subiendo === 'audio'}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#D8D8D8] text-sm text-[#6B6B6B] hover:border-[#00A89D] hover:text-[#00A89D] disabled:opacity-50"
              >{subiendo === 'audio' ? 'Subiendo…' : '🎵 Subir canción (mp3, máx. 15 MB)'}</button>
            )}
          </section>

          {/* Píxeles (desplegable) */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
            <button
              type="button"
              onClick={() => setPixelesAbierto(v => !v)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#FAFAFA]"
            >
              <span className="w-8 h-8 rounded-lg bg-[#00A89D]/10 flex items-center justify-center text-base shrink-0">🎯</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold">Píxeles de seguimiento <span className="text-[11px] font-normal text-[#9A9A9A]">(opcional)</span></h2>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                  {[actual.pixel_meta && 'Meta ✓', actual.pixel_tiktok && 'TikTok ✓'].filter(Boolean).join('  ·  ') || 'Conecta Meta y TikTok para medir tus anuncios en este embudo.'}
                </p>
              </div>
              <span className={`text-[#9A9A9A] text-lg transition-transform shrink-0 ${pixelesAbierto ? 'rotate-180' : ''}`}>⌄</span>
            </button>

            {pixelesAbierto && (
              <div className="px-4 pb-4 space-y-4 border-t border-[#F0F0F0] pt-4">

            {/* Meta */}
            <div className="border border-[#E8E8E8] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-[#0866FF]/10 flex items-center justify-center text-sm">📘</span>
                <span className="text-xs font-bold text-[#0866FF]">Meta (Facebook e Instagram)</span>
              </div>
              <div>
                <label className={label}>Identificador del píxel</label>
                <input
                  value={actual.pixel_meta ?? ''}
                  onChange={e => set('pixel_meta', e.target.value || null)}
                  placeholder="1005280598535259"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Token de la API de conversiones</label>
                <input
                  type="password"
                  value={actual.pixel_meta_token ?? ''}
                  onChange={e => set('pixel_meta_token', e.target.value || null)}
                  placeholder="EAAN..."
                  className={input}
                />
                <p className="text-[10px] text-[#6B6B6B] mt-1 leading-snug">
                  Con este token las ventas se le informan a Meta <strong>desde el servidor</strong>,
                  no solo desde el navegador. Llegan aunque el cliente bloquee cookies.
                </p>
              </div>
            </div>

            {/* TikTok */}
            <div className="border border-[#E8E8E8] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-black/5 flex items-center justify-center text-sm">🎵</span>
                <span className="text-xs font-bold">TikTok</span>
              </div>
              <div>
                <label className={label}>Identificador del píxel</label>
                <input
                  value={actual.pixel_tiktok ?? ''}
                  onChange={e => set('pixel_tiktok', e.target.value || null)}
                  placeholder="C6BD9A5MP02182KUTCC0"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Token de eventos (opcional)</label>
                <input
                  type="password"
                  value={actual.pixel_tiktok_token ?? ''}
                  onChange={e => set('pixel_tiktok_token', e.target.value || null)}
                  className={input}
                />
              </div>
            </div>
              </div>
            )}
          </section>

          </>)}

          {aviso && <div className="text-xs p-3 rounded-xl bg-white border border-[#E8E8E8]">{aviso}</div>}

          <div className="flex gap-2 pb-8">
            <button onClick={() => setVista('lista')} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
          </div>{/* fin columna de edición */}

          {/* Columna de vista previa (pegada al hacer scroll en escritorio).
              En "Crear de cero" no va: el editor de bloques trae su propia previa. */}
          {tabEditor === 'plantilla' && (
          <div className={`lg:w-[340px] lg:shrink-0 lg:sticky lg:top-6 ${verPreview ? '' : 'hidden lg:block'}`}>
            <VistaPreviaEmbudo d={actual} />
          </div>
          )}
        </div>{/* fin lg:flex */}
      </div>
    </div>
  );
}
