'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import VistaPreviaEmbudo from './VistaPreviaEmbudo';
import EmbudoStatsModal from './EmbudoStatsModal';
import CarritosAbandonados from './CarritosAbandonados';
import ModalConfirm from './ModalConfirm';
import EmbudosPapelera from './EmbudosPapelera';
import PlantillasEmbudoPanel from './PlantillasEmbudoPanel';
import VentasPorCampana from './VentasPorCampana';
import EditorPareja, { selectoresPareja, selectoresPolos } from './EditorPareja';
import SeccionDiseno from './SeccionDiseno';
import ArmarPackSelector from '../publico/ArmarPackSelector';
import { esVideo, acentoDe, imgOptim, type Insignia } from '@/lib/funnels';
import type { LayoutEmbudo, Bloque } from '@/lib/bloques';
import { bloquesARenderizar, nuevoIdBloque, CATALOGO_BLOQUES } from '@/lib/bloques';
import EditorBloqueLateral from './EditorBloqueLateral';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { marcarSinGuardar, confirmarSalida, haySinGuardar } from '@/lib/panel/cambios';
import { comprimirImagen } from '@/lib/imagen-comprimir';

/**
 * Sube un archivo y devuelve su enlace público.
 * - Fotos livianas → pasan por el servidor (rápido).
 * - Videos o archivos grandes → van DIRECTO a Supabase con un enlace firmado,
 *   así no chocan con el tope de ~4.5 MB de las funciones de Vercel.
 */
async function subirArchivo(file: File, slug: string): Promise<string | null> {
  // Comprime la foto en el navegador ANTES de subir (videos/gif quedan intactos).
  file = await comprimirImagen(file);

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

  // R2: subir por PUT directo a la URL prefirmada.
  if (info.mode === 'r2') {
    const put = await fetch(info.uploadUrl, {
      method: 'PUT', body: file, headers: { 'Content-Type': file.type },
    });
    if (!put.ok) throw new Error('No se pudo subir el archivo (R2).');
    return info.publicUrl as string;
  }

  // Supabase (respaldo): subida firmada.
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
  estilo?: string; // 'polos' → VARIABLES POLOS (a prueba de renombrado)
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
  layout: LayoutEmbudo | null;
  insignia: Insignia | null;
  confirmacion_modo?: string | null; // 'bot' | 'agente' | 'humano'
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
  layout: null, insignia: null,
});

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function EmbudosPanel({ abrirSlug, onAbierto }: { abrirSlug?: string | null; onAbierto?: () => void } = {}) {
  const [embudos, setEmbudos] = useState<Embudo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'lista' | 'editar'>('lista');
  const [statsDe, setStatsDe] = useState<{ slug: string; producto?: string } | null>(null);
  const [carritosOpen, setCarritosOpen] = useState(false);
  const [papeleraOpen, setPapeleraOpen] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [verPlantillas, setVerPlantillas] = useState(false);
  const [verCampanas, setVerCampanas] = useState(false);
  const [actual, setActual] = useState<Embudo>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [verPreview, setVerPreview] = useState(false); // en móvil: alterna edición / vista previa
  const [bloqueSelId, setBloqueSelId] = useState<string | null>(null); // bloque seleccionado en el teléfono
  const [verContenido, setVerContenido] = useState(false); // mostrar el formulario completo (oculto por defecto)
  const [checkoutModo, setCheckoutModo] = useState(false);  // pestaña Checkout: solo "Productos del checkout"
  const [pixelDe, setPixelDe] = useState<Embudo | null>(null); // embudo cuyo modal de píxel está abierto
  const [modoGuardando, setModoGuardando] = useState<string | null>(null); // slug cuyo modo se está guardando

  // Guarda ajustes rápidos (píxeles / modo de confirmación) de un embudo desde la
  // lista, sin abrir el editor. Actualiza también la copia local para reflejarlo ya.
  async function guardarAjustes(slug: string, cambios: Partial<Embudo>): Promise<boolean> {
    try {
      const res = await fetch('/api/funnels/ajustes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...cambios }),
      });
      const d = await res.json();
      if (!res.ok) { setAviso(d.error || 'No se pudo guardar.'); return false; }
      setEmbudos(prev => prev.map(e => (e.slug === slug ? { ...e, ...cambios } : e)));
      return true;
    } catch {
      setAviso('Error de conexión al guardar.');
      return false;
    }
  }

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
  const [packsOpen, setPacksOpen]   = useState<Record<number, boolean>>({});
  const [impBusca, setImpBusca]     = useState('');

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
  const enlaceDe = (slug: string) => `https://pedido.klixmant.shop/${slug}`;

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

  // Abrir DIRECTO un embudo para editar (viene desde Pedidos: "editar embudo").
  useEffect(() => {
    if (!abrirSlug || embudos.length === 0) return;
    const e = embudos.find(x => x.slug === abrirSlug);
    if (e) {
      historial.current = []; setPasosDeshacer(0);
      setActual({ ...vacio(), ...e } as Embudo);
      setVista('editar'); setAviso(null); marcarSinGuardar(false);
    }
    onAbierto?.(); // se consume una sola vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirSlug, embudos]);

  // ── Deshacer (Ctrl+Z) ──────────────────────────────────────────────────────
  // Cada cambio guarda una copia del estado anterior. Deshacer restaura la última.
  const historial = useRef<Embudo[]>([]);
  const [pasosDeshacer, setPasosDeshacer] = useState(0);

  const set = (campo: keyof Embudo, valor: any) => setActual(a => {
    historial.current.push(a);
    if (historial.current.length > 60) historial.current.shift();
    setPasosDeshacer(historial.current.length);
    marcarSinGuardar(true); // hay cambios sin guardar
    return { ...a, [campo]: valor };
  });

  function deshacer() {
    setActual(a => {
      const prev = historial.current.pop();
      setPasosDeshacer(historial.current.length);
      return prev ?? a;
    });
  }

  // Al desmontar la sección Embudos, limpia el aviso de "cambios sin guardar".
  useEffect(() => () => marcarSinGuardar(false), []);

  // Reordenar productos: mueve la variante `from` a la posición `to`.
  // Guarda en el historial para que también se pueda deshacer con Ctrl+Z.
  const moverVariante = (from: number, to: number) => setActual(a => {
    const n = a.variantes.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return a;
    historial.current.push(a);
    if (historial.current.length > 60) historial.current.shift();
    setPasosDeshacer(historial.current.length);
    marcarSinGuardar(true);
    const vs = [...a.variantes];
    const [m] = vs.splice(from, 1);
    vs.splice(to, 0, m);
    return { ...a, variantes: vs };
  });

  // Ctrl+Z para deshacer mientras se edita
  useEffect(() => {
    if (vista !== 'editar') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); deshacer(); }
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

  // ── Edición visual de bloques (clic en el teléfono → editor lateral) ────────
  const bloquesActuales = (): Bloque[] => bloquesARenderizar(actual.layout);
  const bloqueSel: Bloque | null = bloqueSelId
    ? bloquesActuales().find(b => b.id === bloqueSelId) ?? null
    : null;
  const actualizarBloque = (nb: Bloque) =>
    set('layout', { bloques: bloquesActuales().map(b => (b.id === nb.id ? nb : b)) });
  const duplicarBloque = () => {
    const bs = bloquesActuales();
    const i = bs.findIndex(b => b.id === bloqueSelId);
    if (i < 0) return;
    const copia: Bloque = { ...bs[i], id: nuevoIdBloque() };
    set('layout', { bloques: [...bs.slice(0, i + 1), copia, ...bs.slice(i + 1)] });
    setBloqueSelId(copia.id);
  };
  const borrarBloque = () => {
    set('layout', { bloques: bloquesActuales().filter(b => b.id !== bloqueSelId) });
    setBloqueSelId(null);
  };
  // Agregar un bloque nuevo desde la paleta (columna izquierda).
  const agregarBloque = (tipo: string) => {
    const nuevo: Bloque = { id: nuevoIdBloque(), tipo, visible: true };
    set('layout', { bloques: [...bloquesActuales(), nuevo] });
    setBloqueSelId(nuevo.id);
  };

  // `salir` = true → guarda y vuelve a la lista (botón principal).
  // `salir` = false → guarda pero SE QUEDA en el editor (botón "Guardar cambios" del bloque).
  async function guardar(salir = true) {
    if (!actual.slug.trim() || !actual.producto.trim()) {
      alert('La dirección y el nombre del producto son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actual),
      });
      const data = await res.json();
      if (!res.ok) { setAviso(`❌ ${data.error}`); return; }
      marcarSinGuardar(false); // ya quedó guardado
      if (salir) {
        setAviso(data.aviso ? `⚠️ ${data.aviso}` : `✅ Guardado. Ábrelo en /p/${data.slug}`);
        await cargar();
        setVista('lista');
      } else {
        // Guardado sin salir: aviso breve y seguimos editando.
        setAviso('✅ Cambios guardados.');
      }
    } finally { setGuardando(false); }
  }

  // Enviar a la papelera (borrado suave). No borra: se puede restaurar.
  async function enviarPapelera(slugs: string[]) {
    if (slugs.length === 0) return;
    const r = await fetch('/api/funnels', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', ids: slugs }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setAviso(d.error || 'No se pudo enviar a la papelera.');
      return;
    }
    setSeleccion(new Set());
    await cargar();
  }

  // El botón individual de la tarjeta también manda a la papelera (recuperable).
  async function borrar(slug: string) {
    await enviarPapelera([slug]);
  }

  const alternarSel = (slug: string) => setSeleccion(s => {
    const n = new Set(s);
    n.has(slug) ? n.delete(slug) : n.add(slug);
    return n;
  });
  const seleccionarTodos = () =>
    setSeleccion(s => (s.size === embudos.length ? new Set() : new Set(embudos.map(e => e.slug))));

  /** Convierte un nombre en una dirección (slug) válida y ÚNICA. */
  function slugDesdeNombre(nombre: string): string {
    const base = nombre
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') // solo letras/números y guiones
      || 'embudo';
    const usados = new Set(embudos.map(e => e.slug));
    if (!usados.has(base)) return base;
    let n = 2;
    while (usados.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  /** Copia un embudo idéntico, preguntando ANTES cómo se llamará el nuevo. */
  async function duplicar(e: Embudo) {
    const sugerido = (e.producto || e.nombre || '').trim();
    const nombre = window.prompt('¿Cómo quieres nombrar el nuevo embudo?', sugerido ? `${sugerido} 2` : '');
    if (nombre === null) return;            // canceló
    const limpio = nombre.trim();
    if (!limpio) { setAviso('❌ Escribe un nombre para el nuevo embudo.'); return; }

    const nuevoSlug = slugDesdeNombre(limpio);
    const copia: Embudo = {
      ...vacio(),
      ...e,
      slug: nuevoSlug,
      nombre: limpio,       // nombre interno = lo que escribiste
      producto: limpio,     // y también el nombre del producto (lo que ves en la lista)
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
      setAviso(`✅ "${limpio}" duplicado en pedido.klixmant.shop/${data.slug ?? nuevoSlug}`);
      await cargar();
    } finally { setGuardando(false); }
  }

  /** Crea un embudo nuevo a partir de una plantilla y abre el editor. */
  function crearEmbudoDesdePlantilla(p: any) {
    historial.current = []; setPasosDeshacer(0);
    const base = vacio();
    const nuevo = (p?.tipo === 'completa' && p?.datos)
      ? { ...base, ...p.datos, slug: '', activo: true, layout: p.datos.layout ?? p.layout ?? null }
      : { ...base, layout: p?.layout ?? null };
    setActual(nuevo as Embudo);
    setVerPlantillas(false);
    setVista('editar');
    marcarSinGuardar(false);
    setAviso('✅ Embudo nuevo con la plantilla aplicada. Ponle dirección, fotos y precio, y guarda.');
  }

  // Colores del catálogo aplanados (para importar en el producto Pareja).
  const coloresCatalogo = (() => {
    // TODOS los colores de TODOS los catálogos, con su familia (F1, motos…) para
    // distinguirlos. Solo se quitan duplicados EXACTOS (misma familia + mismo color).
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

  const input = 'w-full px-3 py-2 rounded-lg border border-[#E8E8E8] text-sm focus:outline-none focus:border-[#00A89D]';
  const label = 'block text-xs font-semibold text-[#0D0D0D] mb-1';

  // ── Plantillas de embudo (diseños reutilizables) ───────────────────────────
  if (verPlantillas) return <PlantillasEmbudoPanel onClose={() => setVerPlantillas(false)} onUsar={crearEmbudoDesdePlantilla} />;

  // ── Ventas por campaña (prendas + $ por campaña, con fechas) ────────────────
  if (verCampanas) return <VentasPorCampana onClose={() => setVerCampanas(false)} />;

  // ── Carritos abandonados (pantalla completa, no modal) ─────────────────────
  if (carritosOpen) return <CarritosAbandonados onClose={() => setCarritosOpen(false)} />;

  // ── Lista ─────────────────────────────────────────────────────────────────
  if (vista === 'lista') {
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
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setVerCampanas(true)}
                title="Prendas y dinero vendido por cada campaña"
                className="px-4 py-2.5 rounded-xl border border-[#8B5CF6]/40 text-[#6D28D9] text-sm font-semibold hover:bg-[#8B5CF6]/10"
              >📊 Campañas</button>
              <button
                onClick={() => setVerPlantillas(true)}
                title="Diseños reutilizables para tus páginas"
                className="px-4 py-2.5 rounded-xl border border-[#00A89D]/40 text-[#00847A] text-sm font-semibold hover:bg-[#00A89D]/10"
              >🧩 Plantillas</button>
              <button
                onClick={() => setCarritosOpen(true)}
                title="Clientes que empezaron a comprar y no terminaron"
                className="px-4 py-2.5 rounded-xl border border-[#F59E0B]/50 text-[#B45309] text-sm font-semibold hover:bg-[#F59E0B]/10"
              >🛒 Carritos abandonados</button>
              <button
                onClick={() => setPapeleraOpen(true)}
                title="Embudos eliminados (se pueden restaurar)"
                className="px-4 py-2.5 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] text-sm font-semibold hover:bg-[#F5F5F5]"
              >🗑️ Papelera</button>
              <button
                onClick={() => setConfirmarEliminar(true)}
                disabled={seleccion.size === 0}
                title="Enviar a la papelera los embudos seleccionados"
                className="px-4 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#B91C1C] disabled:opacity-40 disabled:cursor-not-allowed"
              >🗑 Eliminar{seleccion.size ? ` (${seleccion.size})` : ''}</button>
              <button
                onClick={() => { historial.current = []; setPasosDeshacer(0); setActual(vacio()); setVista('editar'); setAviso(null); marcarSinGuardar(false); }}
                className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A]"
              >+ Nuevo embudo</button>
            </div>
          </header>

          {aviso && <div className="mb-4 text-xs p-3 rounded-xl bg-white border border-[#E8E8E8]">{aviso}</div>}

          {!cargando && embudos.length > 0 && (
            <div className="flex items-center gap-3 mb-3 text-xs">
              <button onClick={seleccionarTodos} className="font-medium text-[#00847A] hover:underline">
                {seleccion.size === embudos.length ? 'Quitar selección' : 'Seleccionar todos'}
              </button>
              {seleccion.size > 0 && (
                <span className="text-[#6B6B6B]"><b className="text-[#0D0D0D]">{seleccion.size}</b> seleccionado(s)</span>
              )}
            </div>
          )}

          {cargando ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center">Cargando…</p>
          ) : embudos.length === 0 ? (
            <p className="text-sm text-[#6B6B6B] py-10 text-center">Aún no tienes embudos. Crea el primero.</p>
          ) : (
            <div className="space-y-3">
              {embudos.map(e => (
                <div key={e.slug} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-3 ${
                  seleccion.has(e.slug) ? 'border-[#00A89D] ring-1 ring-[#00A89D]/30' : 'border-[#E8E8E8]'
                }`}>
                  <input
                    type="checkbox"
                    checked={seleccion.has(e.slug)}
                    onChange={() => alternarSel(e.slug)}
                    title="Seleccionar"
                    className="w-4 h-4 accent-[#00A89D] shrink-0"
                  />
                  {e.imagenes?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgOptim(e.imagenes[0], 120)} alt="" className="w-14 h-14 rounded-lg object-contain bg-[#F5F5F5] shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#F5F5F5] flex items-center justify-center text-xl shrink-0">🛍️</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{e.producto}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.activo ? 'text-[#15803D] bg-[#15803D]/10' : 'text-[#DC2626] bg-[#DC2626]/10'
                      }`}>{e.activo ? 'Activo' : 'Apagado'}</span>
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] truncate">
                      pedido.klixmant.shop/{e.slug} · {pesos(e.precio)}
                    </p>
                    {/* Confirmación: decide si el bot responde al cliente o lo hace un humano */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-bold text-[#6B6B6B] shrink-0">💬 Confirmación:</span>
                      <select
                        value={e.confirmacion_modo || 'bot'}
                        disabled={modoGuardando === e.slug}
                        onChange={async (ev) => {
                          const modo = ev.target.value;
                          setModoGuardando(e.slug);
                          await guardarAjustes(e.slug, { confirmacion_modo: modo });
                          setModoGuardando(null);
                        }}
                        className="text-[11px] rounded-md border border-[#E0E0E0] px-1.5 py-1 bg-white max-w-[240px] disabled:opacity-50"
                      >
                        <option value="bot">Por defecto (bot confirma)</option>
                        <option value="agente">Confirmación con agente (bot cierra la venta)</option>
                        <option value="humano">Solo enviar y apagar bot (confirma un humano)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setPixelDe(e)}
                      title="Pegar el píxel y token de Meta / TikTok sin abrir el editor"
                      className="px-3 py-1.5 rounded-lg border border-[#7C3AED]/40 text-[#7C3AED] text-xs hover:bg-[#7C3AED]/10 font-semibold"
                    >📊 Píxel y token</button>
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
                      onClick={() => setStatsDe({ slug: e.slug, producto: e.producto })}
                      title="Ver dónde llegan y dónde se cae la venta"
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]"
                    >📊 Estadísticas</button>
                    <button
                      onClick={() => { historial.current = []; setPasosDeshacer(0); setActual({ ...vacio(), ...e }); setVista('editar'); setAviso(null); marcarSinGuardar(false); }}
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]"
                    >Editar</button>
                    <button
                      onClick={() => duplicar(e)}
                      disabled={guardando}
                      title="Crear una copia idéntica con otra dirección"
                      className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5] disabled:opacity-50"
                    >⧉ Duplicar</button>
                    <button
                      onClick={() => borrar(e.slug)}
                      className="w-8 h-8 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]"
                    >🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {statsDe && <EmbudoStatsModal slug={statsDe.slug} producto={statsDe.producto} onClose={() => setStatsDe(null)} />}

        {pixelDe && (
          <PixelModal
            embudo={pixelDe}
            onClose={() => setPixelDe(null)}
            onGuardar={async (campos) => {
              const ok = await guardarAjustes(pixelDe.slug, campos);
              if (ok) setPixelDe(null);
              return ok;
            }}
          />
        )}

        {papeleraOpen && (
          <EmbudosPapelera onClose={() => setPapeleraOpen(false)} onCambio={cargar} />
        )}

        <ModalConfirm
          abierto={confirmarEliminar}
          titulo="Enviar a la papelera"
          mensaje={`¿Enviar ${seleccion.size} elemento(s) a la papelera? Podrás restaurarlos después.`}
          textoConfirmar="Enviar a papelera"
          peligro
          onConfirmar={() => { setConfirmarEliminar(false); enviarPapelera([...seleccion]); }}
          onCancelar={() => setConfirmarEliminar(false)}
        />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={() => { if (confirmarSalida()) setVista('lista'); }} className="text-xs text-[#00A89D] font-semibold hover:underline">
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
            >↶ Deshacer{pasosDeshacer > 0 ? ` (${pasosDeshacer})` : ''}</button>
            {/* En pantallas chicas: mostrar/ocultar la vista previa */}
            <button
              onClick={() => setVerPreview(v => !v)}
              className="lg:hidden text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E8E8E8] hover:bg-white"
            >{verPreview ? '✏️ Editar' : '👁️ Ver previa'}</button>
          </div>
        </div>

        {/* Encabezado fijo: dirección de la página, nombre y prender/apagar */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-3 mb-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className={label}>Dirección de la página</label>
            <input value={actual.slug} onChange={e => set('slug', e.target.value)} placeholder="nacional-2026" className={input} />
            <p className="text-[10px] text-[#6B6B6B] mt-0.5">/p/{actual.slug || '…'}</p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={label}>Nombre del producto</label>
            <input value={actual.producto} onChange={e => set('producto', e.target.value)} placeholder="NACIONAL 2026" className={input} />
          </div>
          <button
            onClick={() => set('activo', !actual.activo)}
            title="Prender o apagar el embudo"
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold shrink-0 ${actual.activo ? 'bg-[#15803D]/10 text-[#15803D]' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}
          >
            <span className={`w-8 h-4 rounded-full relative transition-colors ${actual.activo ? 'bg-[#15803D]' : 'bg-[#C9C9C9]'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${actual.activo ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            {actual.activo ? 'Embudo PRENDIDO' : 'Embudo APAGADO'}
          </button>
        </div>

        <div className="lg:flex lg:gap-6 lg:items-start">
          {/* Columna de PALETA de bloques (agregar) */}
          <div className={`lg:w-[150px] lg:shrink-0 mb-4 lg:mb-0 ${verPreview ? 'hidden lg:block' : ''}`}>
            <div className="lg:sticky lg:top-6 bg-white rounded-2xl border border-[#E8E8E8] p-2">
              <p className="text-[11px] font-bold text-[#6B6B6B] px-1 mb-1.5">➕ Agregar bloque</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
                {CATALOGO_BLOQUES.map(d => (
                  <button
                    key={d.clave}
                    onClick={() => agregarBloque(d.clave)}
                    title={d.desc}
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-[#E8E8E8] hover:bg-[#00A89D]/10 hover:border-[#00A89D]/40 text-[11px] text-left"
                  >
                    <span className="text-sm shrink-0">{d.emoji}</span>
                    <span className="leading-tight truncate">{d.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Columna de edición */}
          <div className={`flex-1 min-w-0 ${verPreview ? 'hidden lg:block' : ''}`}>

        {/* Editor del bloque seleccionado en el teléfono (edición visual premium) */}
        {bloqueSel && (
          <div className="mb-4">
            <EditorBloqueLateral
              bloque={bloqueSel}
              onChange={actualizarBloque}
              onDuplicar={duplicarBloque}
              onBorrar={borrarBloque}
              onCerrar={() => setBloqueSelId(null)}
              onGuardar={() => guardar(false)}
              onSubirArchivo={(file) => subirArchivo(file, actual.slug || 'general')}
              setCampo={set}
              imagenes={actual.imagenes}
              precio={actual.precio}
              precioAntes={actual.precio_antes}
              variantes={(actual.variantes ?? []).map(v => ({ id: v.id, nombre: v.nombre }))}
              frases={actual.frases}
              onFrases={(listaF) => {
                const limpias = listaF.slice(0, 5);
                set('frases', limpias.filter(f => f.trim()));
                set('titulo', limpias.find(f => f.trim()) ?? '');
                setActual(a => ({ ...a, frases: limpias } as Embudo));
              }}
            />
          </div>
        )}

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
          {/* Aviso en modo Checkout */}
          {checkoutModo && (
            <div className="rounded-2xl border border-[#00A89D]/40 bg-[#00A89D]/10 p-3 text-center text-[13px] font-semibold text-[#00847A]">
              🛒 Editando el CHECKOUT · aquí armas los productos, colores, tallas y precio que el cliente elige.
            </div>
          )}

          {/* Constructor vacío: se llena al tocar un bloque en el teléfono */}
          {!bloqueSel && !checkoutModo && (
            <div className="rounded-2xl border border-dashed border-[#DADADA] p-6 text-center text-sm text-[#9A9A9A]">
              👉 Toca un bloque en el teléfono para editarlo, o usa la paleta de la izquierda para agregar bloques.
            </div>
          )}

          {/* Mostrar/ocultar el formulario completo. Por defecto se edita todo
              tocando los bloques en el teléfono; esto es para ajustes finos. */}
          {!checkoutModo && (
            <button onClick={() => setVerContenido(v => !v)}
              className="w-full py-2.5 rounded-xl border border-[#E8E8E8] text-sm font-semibold text-[#6B6B6B] hover:bg-[#F5F5F5]">
              {verContenido ? '▲ Ocultar contenido y ajustes' : '⚙️ Contenido y ajustes (fotos, precio, textos, productos…)'}
            </button>
          )}

          {(verContenido || checkoutModo) && (<>
          {/* Fotos (oculto en modo Checkout) */}
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
              <div className="flex items-center gap-3 flex-wrap justify-end">
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
                      { etiqueta: 'TALLA', opciones: actual.tallas.map(valor => ({ valor })) },
                    ],
                  }])}
                  title="Producto con desplegable de color y talla (como el ejemplo)"
                  className="text-xs text-[#7C3AED] font-semibold hover:underline"
                >⚡ + Producto variable (color + talla)</button>
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

              const esPack = /pack|pareja/i.test(v.nombre || '') || selectores.some(s => /buzo|prenda|elige|dama|caballero/i.test(s.grupo || ''));
              const esPareja = (v.selectores ?? []).some(s => /dama|caballero|mujer|hombre/i.test(s.grupo || ''));
              const esPolos  = v.estilo === 'polos' || (v.selectores ?? []).some(s => /polo\s*\d/i.test(s.grupo || ''));

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
                      {esPack ? '📦 PACK' : '🛍️ PRODUCTO'}{v.nombre ? ` · ${v.nombre}` : ''}
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
                        onClick={() => {
                          const copia: Variante = {
                            ...v,
                            id: `v${Date.now()}`,
                            nombre: v.nombre ? `${v.nombre} (copia)` : '',
                            selectores: (v.selectores ?? []).map(s => ({ ...s, opciones: [...s.opciones] })),
                          };
                          const vs = [...actual.variantes];
                          vs.splice(i + 1, 0, copia);
                          set('variantes', vs);
                        }}
                        title="Duplicar este producto"
                        className="text-[11px] text-[#00847A] hover:underline ml-1"
                      >⧉ Duplicar</button>
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

                  {/* ── Editor simple: Colores (con foto) + Tallas (una vez) ── */}
                  {(() => {
                    // Un pack REAL agrupa por prenda ("ELIGE BUZO 1"). Un color como grupo
                    // (NEGRO, ROJO) NO es pack: es una unidad con varios colores.
                    const esPackVar = /pack|pareja/i.test(v.nombre || '')
                      || selectores.some(s => /buzo|prenda|elige|dama|caballero|mujer|hombre/i.test(s.grupo || ''));
                    if (esPackVar) return null; // los packs y parejas usan el editor de abajo

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
                              <p className="text-[11px] font-bold text-[#5B21B6] mb-1">📥 Trae un catálogo (se agregan sus colores con foto)</p>
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
                                          // Trae también las tallas: si el producto no tiene, usa las del embudo
                                          // (o unas por defecto). Quedan editables abajo.
                                          const tallasFinal = (tallas && tallas.length > 0)
                                            ? tallas
                                            : (actual.tallas && actual.tallas.length > 0
                                                ? actual.tallas
                                                : ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
                                          escribir([...base, ...nuevos], tallasFinal);
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

                  {/* Elecciones del cliente (solo PACKS con varias prendas; los POLOS usan su propio editor) */}
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

                    <button type="button" onClick={() => setPacksOpen(o => ({ ...o, [i]: !o[i] }))}
                      className="px-3 py-1.5 rounded-lg border border-[#7C3AED]/40 text-[11px] text-[#6D28D9] bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 font-semibold">
                      {packsOpen[i] ? '▾ Ocultar opciones de pack' : '📦 Opciones de pack (pareja, polos, arma tu pack…) ▸'}
                    </button>

                    {packsOpen[i] && (<>
                    {/* Arma las elecciones del pack usando los colores ya creados */}
                    {[2, 3].map(cantidad => (
                      <button
                        key={cantidad}
                        onClick={() => {
                          // 1º: los colores propios de ESTE producto (los de "Colores (cada uno con su foto)").
                          const colorSelActual = selectores.find(s => /color/i.test(s.etiqueta));
                          const coloresPropios = (colorSelActual?.opciones ?? [])
                            .map(o => (typeof o === 'string' ? { valor: o } : o))
                            .filter(o => o && String(o.valor).trim());
                          // 2º: si no tiene colores propios, usa los OTROS productos del checkout.
                          const coloresDeOtros = actual.variantes
                            .filter((_, j) => j !== i)
                            .filter(o => o.imagen && !/pack/i.test(o.nombre))
                            .map(o => ({ valor: o.nombre, imagen: o.imagen }));
                          const colores = coloresPropios.length > 0 ? coloresPropios : coloresDeOtros;

                          if (colores.length === 0) {
                            alert('Primero crea los colores con su foto (arriba, en "Colores"). Luego este botón los usa para armar el pack.');
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

                    {/* Producto PAREJA: dos lados fijos (Dama + Caballero), cada uno con sus
                        colores y tallas propias. */}
                    <button
                      onClick={() => {
                        if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones actuales por la estructura de PAREJA (Dama + Caballero). ¿Seguir?')) return;
                        cambiar({ nombre: v.nombre || 'PAREJA', selectores: selectoresPareja(), armarPack: undefined });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#EC4899]/50 text-[11px] text-[#9D174D] bg-[#EC4899]/5 hover:bg-[#EC4899]/10 font-semibold"
                    >👫 Pareja (Dama + Caballero)</button>

                    <button
                      onClick={() => {
                        if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones actuales por VARIABLES POLOS: un pack x2 donde el cliente elige color y talla de cada polo. ¿Seguir?')) return;
                        cambiar({ nombre: v.nombre || 'PACK X2 POLOS', selectores: selectoresPolos(2), armarPack: undefined, estilo: 'polos' });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x2)</button>

                    <button
                      onClick={() => {
                        if ((v.selectores?.length ?? 0) > 0 && !confirm('Esto reemplaza las opciones actuales por VARIABLES POLOS x3: tres polos con color y talla. ¿Seguir?')) return;
                        cambiar({ nombre: v.nombre || 'PACK X3 POLOS', selectores: selectoresPolos(3), armarPack: undefined, estilo: 'polos' });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#0EA5E9]/50 text-[11px] text-[#075985] bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10 font-semibold"
                    >🎽 Variables Polos (pack x3)</button>

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
                    </>)}

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

                  {(esPareja || esPolos) && (
                    <EditorPareja
                      selectores={selectores}
                      coloresCatalogo={coloresCatalogo}
                      onChange={(s) => cambiar({ selectores: s })}
                      titulo={esPolos ? '🎽 VARIABLES POLOS · cada polo con su color y talla' : undefined}
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

          {/* Píxeles */}
          <section className="bg-white rounded-2xl border border-[#E8E8E8] p-4 space-y-4">
            <h2 className="text-sm font-bold">Píxeles</h2>

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
          </section>

          {/* Diseño de la página por bloques + plantillas */}
          <SeccionDiseno actual={actual} set={set} setActual={setActual} setAviso={setAviso} />
          </>)}

          {aviso && <div className="text-xs p-3 rounded-xl bg-white border border-[#E8E8E8]">{aviso}</div>}

          <div className="flex gap-2 pb-8">
            <button onClick={() => { if (confirmarSalida()) setVista('lista'); }} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]">
              Cancelar
            </button>
            <button onClick={() => guardar(true)} disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
          </div>{/* fin columna de edición */}

          {/* Columna de vista previa (pegada al hacer scroll en escritorio) */}
          <div className={`lg:w-[370px] lg:shrink-0 lg:sticky lg:top-6 ${verPreview ? '' : 'hidden lg:block'}`}>
            <VistaPreviaEmbudo
              d={actual} layout={actual.layout}
              onLayout={(l) => set('layout', l)}
              selectedId={bloqueSelId}
              onImagenes={(lista) => set('imagenes', lista)}
              onSubirArchivo={(file) => subirArchivo(file, actual.slug || 'general')}
              onModoChange={(m) => {
                // Al tocar "Checkout" en el teléfono, muestra SOLO "Productos del
                // checkout" en el centro; al volver a Inicio, vuelve a lo normal.
                if (m === 'checkout') { setBloqueSelId(null); setVerContenido(true); setCheckoutModo(true); }
                else { setCheckoutModo(false); }
              }}
              onSelect={(id) => {
                if (id === bloqueSelId) { setBloqueSelId(null); return; }
                // Aviso para no perder trabajo al cambiar de bloque con cambios pendientes.
                if (bloqueSelId && haySinGuardar()) {
                  const ok = window.confirm('No has guardado los cambios de este bloque.\n\nAceptar = Guardar ahora · Cancelar = seguir sin guardar');
                  if (ok) guardar(false);
                }
                setBloqueSelId(id);
              }}
            />
          </div>
        </div>{/* fin lg:flex */}
      </div>
    </div>
  );
}

/**
 * Ventana para copiar/pegar el píxel y el token de Meta y TikTok de un embudo,
 * sin abrir el editor completo. Guarda solo esos campos.
 */
function PixelModal({
  embudo, onClose, onGuardar,
}: {
  embudo: Embudo;
  onClose: () => void;
  onGuardar: (campos: Partial<Embudo>) => Promise<boolean>;
}) {
  const [pMeta, setPMeta] = useState(embudo.pixel_meta ?? '');
  const [tMeta, setTMeta] = useState(embudo.pixel_meta_token ?? '');
  const [pTk, setPTk] = useState(embudo.pixel_tiktok ?? '');
  const [tTk, setTTk] = useState(embudo.pixel_tiktok_token ?? '');
  const [guardando, setGuardando] = useState(false);

  const campo = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-sm';

  async function guardar() {
    setGuardando(true);
    await onGuardar({
      pixel_meta: pMeta.trim() || null,
      pixel_meta_token: tMeta.trim() || null,
      pixel_tiktok: pTk.trim() || null,
      pixel_tiktok_token: tTk.trim() || null,
    });
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-extrabold text-[#0D0D0D] flex items-center gap-2">📊 Píxel y token</h3>
          <p className="text-[12px] text-[#6B6B6B] uppercase font-bold">{embudo.producto}</p>
        </div>

        <section className="rounded-xl border border-[#E8E8E8] p-3 space-y-2">
          <p className="text-[13px] font-bold text-[#1877F2]">📘 Meta (Facebook e Instagram)</p>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1">Identificador del píxel</label>
            <input value={pMeta} onChange={e => setPMeta(e.target.value)} className={campo} placeholder="1100793867918663" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1">Token de la API de conversiones</label>
            <input value={tMeta} onChange={e => setTMeta(e.target.value)} className={campo} placeholder="EAAQ..." />
            <p className="text-[10px] text-[#9A9A9A] mt-1">Con este token las ventas se le informan a Meta desde el servidor (llegan aunque el cliente bloquee cookies).</p>
          </div>
        </section>

        <section className="rounded-xl border border-[#E8E8E8] p-3 space-y-2">
          <p className="text-[13px] font-bold text-[#0D0D0D]">🎵 TikTok</p>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1">Identificador del píxel</label>
            <input value={pTk} onChange={e => setPTk(e.target.value)} className={campo} placeholder="C6BD9A5MP..." />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#0D0D0D] mb-1">Token de eventos (opcional)</label>
            <input value={tTk} onChange={e => setTTk(e.target.value)} className={campo} placeholder="(opcional)" />
          </div>
        </section>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5]">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
