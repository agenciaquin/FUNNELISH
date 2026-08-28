'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { acentoDe, esVideo } from '@/lib/funnels';
import { construirLayoutDesdeFunnel, layoutEmbudoQueConvierte, type BloqueLayout } from '@/lib/funnel-layout';
import MiniBarraTexto from './MiniBarraTexto';
import SelectorColor from './SelectorColor';
import {
  CK_PALETA_CATS, CK_META, CAMPO_INFO, CAMPOS_PEDIDO, TIPOS_EXTRA,
  AVISO_CAMPO, AVISO_TIPO, bloquesDesdeConfig, nuevoBloqueCk, normalizarBloquesCk,
  camposDelCheckout, problemasDelCheckout, resumenDelPedido,
  camposDelBloque, campoFijo, campoPropio,
  type BloqueCk as BloqueCk2, type CampoPedido, type CampoForm,
} from '@/lib/checkout-bloques';
import { estiloTexto, estiloEspacio, botonVariante, VARIANTES_BOTON, ANIMACIONES, FONTS_LISTA, claseAnim } from '@/lib/bloque-estilo';

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
const nid = (t: string) => `${t}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Lista PLANA de bloques (igual que la referencia): nombres completos y en orden.
// Es la que se muestra en la paleta y en el menú "+".
const BLOQUES: { tipo: string; label: string; icono: string }[] = [
  { tipo: 'banner_clientes', label: 'Banner de clientes', icono: '🖼️' },
  { tipo: 'titular',         label: 'Titular', icono: '🔠' },
  { tipo: 'galeria',         label: 'Portada (galería/video)', icono: '🛍️' },
  { tipo: 'boton_comprar',   label: 'Botón COMPRAR', icono: '🟢' },
  { tipo: 'precio',          label: 'Precio', icono: '💲' },
  { tipo: 'contador_pagina', label: 'Contador de oferta', icono: '⏱️' },
  { tipo: 'ultimas_unidades',label: 'Últimas unidades + detalle', icono: '⚠️' },
  { tipo: 'caracteristicas', label: 'Características', icono: '📋' },
  { tipo: 'estrellas',       label: 'Estrellas de reseña', icono: '⭐' },
  { tipo: 'testimonios',     label: 'Clientes felices', icono: '😍' },
  { tipo: 'gatillos',        label: 'Gatillos mentales', icono: '🧠' },
  { tipo: 'stock',           label: 'Stock / escasez', icono: '📉' },
  { tipo: 'mas_vendido',     label: 'Botón MÁS VENDIDO', icono: '🔥' },
  { tipo: 'ventas',          label: 'Ventas en vivo', icono: '📣' },
  { tipo: 'checkout',        label: 'Checkout (formulario)', icono: '🛒' },
  { tipo: 'checkout_pro',    label: 'Checkout PRO', icono: '⚡' },
  { tipo: 'texto',           label: 'Texto libre', icono: '📝' },
  { tipo: 'foto',            label: 'Imagen / Video extra', icono: '🖼️' },
  { tipo: 'espaciador',      label: 'Espacio en blanco', icono: '↕️' },
];

// Bloques ÚNICOS (no se pueden repetir en la página). El resto es repetible.
// Solo el checkout es único (tiene su propia pestaña). Todo lo demás se puede
// agregar las veces que quieras: nada queda "bloqueado" en la paleta.
const UNICOS = new Set(['checkout', 'checkout_pro']);

function nuevoBloque(tipo: string): BloqueLayout {
  const b: BloqueLayout = { id: nid(tipo), tipo };
  if (tipo === 'texto') b.cuerpo = 'Escribe aquí tu texto…';
  if (tipo === 'boton') { b.texto = 'COMPRAR AHORA'; b.accion = 'comprar'; }
  if (tipo === 'collage') b.urls = [];
  if (tipo === 'contador') b.horas = 10;
  if (tipo === 'espaciador') b.altura = 24;
  if (tipo === 'beneficios') { b.titulo = 'POR QUÉ COMPRARLO'; b.items = ['Material de alta calidad', 'Envío rápido y seguro', 'Garantía de satisfacción']; }
  if (tipo === 'garantia') { b.titulo = 'COMPRA SIN RIESGO'; b.cuerpo = 'Si no te gusta, te devolvemos tu dinero. Sin preguntas.'; }
  if (tipo === 'confianza') b.items = ['🚚 Envío gratis', '💵 Pago contra entrega', '🔒 Compra 100% segura'];
  if (tipo === 'testimonios') b.items = [{ nombre: 'María G.', texto: '¡Excelente calidad, llegó rapidísimo!', estrellas: 5, gatillo: true, boton: true, botonTexto: '🛒 LO QUIERO AHORA' }, { nombre: 'Carlos R.', texto: 'Tal cual la foto, muy recomendado 👌', estrellas: 5, boton: true, botonTexto: '🛒 LO QUIERO AHORA' }];
  if (tipo === 'faq') b.items = [{ pregunta: '¿Cómo pago?', respuesta: 'Pagas en efectivo cuando recibes el pedido.' }, { pregunta: '¿Cuánto demora?', respuesta: 'De 3 a 6 días hábiles.' }];
  if (tipo === 'mas_vendido') b.props = { texto: 'EL MÁS VENDIDO', emoji: '🔥', color: '#C1121F', colorTexto: '#FFFFFF', size: 'md', modelo: '' };
  if (tipo === 'ventas') b.props = { titulo: 'NUEVA VENTA REALIZADA', items: ['COLOMBIA NEGRO: Felipe P. ✅', 'COLOMBIA AMARILLO: Juan G.', 'COLOMBIA MARFIL: Carlos J.'], emoji: '🔥', color: '#0E8F82', colorTexto: '#FFFFFF', posicion: 'top-right', delayInicial: 10, intervalo: 10, duracion: 5, tamLetra: 12, anim: 'rebota', ancho: 100 };
  if (tipo === 'stock') b.props = { titulo: 'EL STOCK SE ESTÁ AGOTANDO', tituloColor: '#0D0D0D', tituloSize: 16, tituloFont: '', mensaje: 'Quedan pocas unidades en algunos colores y tallas.', alerta: '⚠️ ¡No te quedes sin el tuyo!', alertaColor: '#B45309', animada: true, barraInicial: 31, barraFinal: 8, cadaSeg: 10, paso: 1, color: '#F59E0B', anim: '', ancho: 100 };
  if (tipo === 'gatillos') b.props = {
    titulo: 'OFERTA LIMITADA', tituloColor: '#C1121F', tituloSize: 20, tituloFont: '',
    mensaje: 'SE ESTÁ AGOTANDO LA TALLA - L y TALLA - M', mensajeColor: '#0D0D0D', mensajeSize: 13,
    barra: 31, barraColor: '#C1121F',
    instruccion: '', instruccionColor: '#6B6B6B', instruccionSize: 13,
    etiquetaNormal: 'PRECIO NORMAL', etiquetaOferta: 'OFERTA LIMITADA',
    precioColor: '#C1121F', tamOferta: 12, tamPrecio: 28,
    botonTexto: 'CLIC AQUI PARA COMPRAR', botonColor: '#1E9E5A', botonLetra: 0, botonAncho: 100, botonForma: 'redondeado',
    sellos: [], anim: '', ancho: 100,
  };
  // ── Bloques nuevos (paleta "Estructura", estilo Funnelish) ──
  if (tipo === 'encabezado') b.props = { texto: 'Escribe tu titular aquí', size: 24, color: '', align: 'center', font: '', bold: true };
  if (tipo === 'enlace') { b.texto = 'Ver más información'; b.props = { url: '', color: '#00A89D', align: 'center', size: 15 }; }
  if (tipo === 'social') b.props = { items: [{ red: 'whatsapp', url: '' }, { red: 'instagram', url: '' }, { red: 'facebook', url: '' }], size: 30, align: 'center' };
  if (tipo === 'html') b.props = { html: '<p style="text-align:center">Tu HTML aquí</p>' };
  if (tipo === 'carrusel') b.props = { urls: [], masVendido: false, mvTexto: '🔥 MÁS VENDIDO', mvColor: '#C1121F', mvColorTexto: '#FFFFFF', anim: '', h: 0, autoplay: true, segundos: 3, dots: true, miniaturas: true, ajuste: 'cover', redondeado: 14 };
  if (tipo === 'foto') b.props = { anim: '', h: 0, ancho: 100, ajuste: 'contain', redondeado: 0, link: '', masVendido: false, mvTexto: '🔥 MÁS VENDIDO', mvColor: '#C1121F', mvColorTexto: '#FFFFFF' };
  // checkout_pro usa el mismo motor del checkout (mismos props de config).
  return b;
}

// Item de la paleta del constructor (una tarjeta que se arrastra al lienzo).
// `tipo` apunta a un bloque real; `pronto` = se muestra pero deshabilitado.
type EstItem = { label: string; ic: string; tipo?: string; nuevo?: boolean; obsoleto?: boolean; pronto?: boolean };
// ── Paleta del "Constructor de Embudos" (3 columnas): agrupa los BLOQUES REALES
// del negocio en categorías (como el mockup). Cada item apunta a un `tipo` que ya
// existe en nuevoBloque/vistaBloque/editorBloque, así nada se rompe. `pronto` =
// se muestra deshabilitado (aún sin bloque).
const PALETA_CATS: { cat: string; items: EstItem[] }[] = [
  { cat: 'Disposición', items: [
    { label: 'Sección', ic: '🗂️', tipo: 'separador' },
    { label: 'Espaciador', ic: '↕️', tipo: 'espaciador' },
  ] },
  { cat: 'Texto', items: [
    { label: 'Titular', ic: '🔠', tipo: 'encabezado' },
    { label: 'Párrafo', ic: '📝', tipo: 'texto' },
    { label: 'Texto libre', ic: '🗒️', tipo: 'texto' },
    { label: 'Características', ic: '📋', tipo: 'caracteristicas' },
    { label: 'Preguntas frecuentes', ic: '❓', tipo: 'faq' },
  ] },
  { cat: 'Multimedia', items: [
    { label: 'Imagen / Video', ic: '🏞️', tipo: 'foto' },
    { label: 'Vídeo', ic: '▶️', tipo: 'video' },
    { label: 'Carrusel de imágenes', ic: '🎠', tipo: 'carrusel', nuevo: true },
    { label: 'Collage', ic: '🖼️', tipo: 'collage' },
    { label: 'Banner de clientes', ic: '🎪', tipo: 'banner_clientes' },
    { label: 'Portada (galería)', ic: '🛍️', tipo: 'galeria' },
  ] },
  { cat: 'Gatillos y disparadores', items: [
    { label: 'Contador de oferta', ic: '⏱️', tipo: 'contador_pagina' },
    { label: 'Minutero', ic: '⏲️', tipo: 'contador' },
    { label: 'Gatillos mentales', ic: '🧠', tipo: 'gatillos' },
    { label: 'Últimas unidades', ic: '⚠️', tipo: 'ultimas_unidades' },
    { label: 'Stock / escasez', ic: '📉', tipo: 'stock' },
    { label: 'Ventas en vivo', ic: '📣', tipo: 'ventas' },
  ] },
  { cat: 'Botones (CTA)', items: [
    { label: 'Botón', ic: '🔘', tipo: 'boton' },
    { label: 'Botón COMPRAR', ic: '🟢', tipo: 'boton_comprar' },
    { label: 'Enlace', ic: '🔗', tipo: 'enlace' },
    { label: 'Botón MÁS VENDIDO', ic: '🔥', tipo: 'mas_vendido' },
  ] },
  { cat: 'Información y producto', items: [
    { label: 'Precio', ic: '💲', tipo: 'precio' },
    { label: 'Estrellas de reseña', ic: '⭐', tipo: 'estrellas' },
    { label: 'Clientes felices', ic: '😍', tipo: 'testimonios' },
    { label: 'Social', ic: '🌐', tipo: 'social' },
    { label: 'HTML personalizado', ic: '🧩', tipo: 'html' },
  ] },
  { cat: 'Formulario', items: [
    { label: 'Checkout (formulario)', ic: '🛒', tipo: 'checkout' },
    { label: 'Checkout PRO', ic: '⚡', tipo: 'checkout_pro' },
  ] },
];

// Bloques que se pueden redimensionar arrastrando las esquinas (alto/ancho).
const RESIZABLE = new Set(['carrusel', 'foto']);
const REDES: { key: string; label: string; ic: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', ic: '🟢' },
  { key: 'instagram', label: 'Instagram', ic: '📸' },
  { key: 'facebook', label: 'Facebook', ic: '👍' },
  { key: 'tiktok', label: 'TikTok', ic: '🎵' },
  { key: 'youtube', label: 'YouTube', ic: '▶️' },
  { key: 'web', label: 'Sitio web', ic: '🌐' },
];

export default function EditorBloques({
  d, onCampo, subir, layout, onLayout, onAbrirContenido, onAbrirCheckout, permitirVacio,
  onGuardar, guardando, onDeshacer, onRehacer, puedeDeshacer, puedeRehacer,
}: {
  d: any;
  onCampo: (campo: string, valor: any) => void;
  subir: (f: File) => Promise<string | null>;
  layout: BloqueLayout[] | null | undefined;
  onLayout: (bs: BloqueLayout[]) => void;
  onAbrirContenido?: () => void;
  onAbrirCheckout?: () => void;
  // Si es true, un layout vacío se queda VACÍO (hoja en blanco). Se usa para la
  // "versión nueva": el usuario arma desde cero sin que se cargue una plantilla.
  permitirVacio?: boolean;
  // Barra sobre el teléfono: atrasar/adelantar + guardar (opcionales).
  onGuardar?: () => void;
  guardando?: boolean;
  onDeshacer?: () => void;
  onRehacer?: () => void;
  puedeDeshacer?: boolean;
  puedeRehacer?: boolean;
}) {
  // Embudo NUEVO (sin producto aún) → arranca con la plantilla que convierte
  // (misma estructura del embudo de referencia). Embudo EXISTENTE → se arma desde
  // sus campos para no perder lo que ya tenía.
  const layoutInicial = () => (!d?.producto || !String(d.producto).trim())
    ? layoutEmbudoQueConvierte()
    : construirLayoutDesdeFunnel(d);
  // Con permitirVacio, un layout vacío se respeta (hoja en blanco); si no, se
  // arma la plantilla por defecto como siempre.
  const bs: BloqueLayout[] = (layout && layout.length) ? layout : (permitirVacio ? [] : layoutInicial());
  const acento = acentoDe(d.color);
  const inp = 'w-full text-sm border border-[#E8E8E8] rounded px-2 py-1';

  // ⚠️ IMPORTANTE: si el layout está vacío, se genera uno por defecto UNA sola vez y
  // se persiste. Sin esto, cada render regeneraba los bloques con IDs nuevos y no se
  // podía seleccionar/editar ninguno (el clic "se perdía").
  // En "versión nueva" (permitirVacio) NO se auto-genera: se queda en blanco.
  useEffect(() => {
    if (permitirVacio) return;
    if (!(layout && layout.length)) onLayout(layoutInicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sel, setSel] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [pendingTipo, setPendingTipo] = useState<string | null>(null);
  const [dragTipo, setDragTipo] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // Pestaña del teléfono: la página (inicio) o el checkout.
  const [vistaTel, setVistaTel] = useState<'inicio' | 'checkout'>('inicio');
  // Paleta activa: 'boton' (lista de bloques dinámicos) o 'estructura' (grid Funnelish).
  // Reordenar fotos del carrusel arrastrando (índice que se está moviendo).
  const [dragFoto, setDragFoto] = useState<number | null>(null);
  // Redimensionar un bloque arrastrando sus esquinas (alto/ancho).
  const [rz, setRz] = useState<null | { id: string; corner: string; startX: number; startY: number; startH: number; startW: number; contW: number; props: any }>(null);
  // Constructor de Embudos (3 columnas): dispositivo del lienzo y pestaña del
  // panel derecho de propiedades.
  const [dispositivo, setDispositivo] = useState<'movil' | 'escritorio'>('movil');
  const [panelTab, setPanelTab] = useState<'contenido' | 'diseno' | 'avanzado'>('contenido');
  const [buscarPal, setBuscarPal] = useState('');
  // ── Checkout por bloques: se arma igual que la página ──
  const [selCk, setSelCk] = useState<string | null>(null);
  const [dragCk, setDragCk] = useState<{ tipo: string } | null>(null);
  const [dragCkId, setDragCkId] = useState<string | null>(null);
  const [overCk, setOverCk] = useState<number | null>(null);
  const [buscarCk, setBuscarCk] = useState('');
  // Editar el nombre de un dato del formulario (con aceptar / cancelar).
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [campoAbierto, setCampoAbierto] = useState<string | null>(null);
  const [addAbierto, setAddAbierto] = useState(false);

  const set = (nv: BloqueLayout[]) => onLayout(nv);
  const upd = (id: string, patch: any) => set(bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const borrar = (id: string) => { set(bs.filter(b => b.id !== id)); if (sel === id) setSel(null); };
  const duplicar = (id: string) => { const i = bs.findIndex(b => b.id === id); if (i < 0) return; const c = { ...bs[i], id: nid(bs[i].tipo) }; const a = [...bs]; a.splice(i + 1, 0, c); set(a); };
  const mover = (id: string, dir: -1 | 1) => { const i = bs.findIndex(b => b.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= bs.length) return; const a = [...bs]; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const insertar = (idx: number, tipo: string) => { const nb = nuevoBloque(tipo); const a = [...bs]; a.splice(idx, 0, nb); set(a); setPendingTipo(null); setMenuIdx(null); if (tipo === 'checkout' || tipo === 'checkout_pro') { setVistaTel('checkout'); setSel(nb.id); } };
  const hayCheckout = bs.some(b => b.tipo === 'checkout' || b.tipo === 'checkout_pro');
  // ¿Este tipo ya no se puede volver a agregar? checkout y checkout_pro cuentan
  // como UN mismo grupo (solo puede haber un checkout en la página).
  const bloqueadoUnico = (t?: string) => !t ? false
    : (t === 'checkout' || t === 'checkout_pro') ? hayCheckout
    : (UNICOS.has(t) && bs.some(b => b.tipo === t));
  const checkoutBloque = bs.find(b => b.tipo === 'checkout' || b.tipo === 'checkout_pro') || null;
  // Agrega el checkout completo (catálogo + formulario + comprar ahora) al final.
  const agregarCheckout = () => { const nb = nuevoBloque('checkout'); if (!hayCheckout) set([...bs, nb]); setVistaTel('checkout'); setSel(hayCheckout ? (checkoutBloque?.id ?? null) : nb.id); };
  // ── BLOQUES DEL CHECKOUT ───────────────────────────────────────────────────
  // Viven en la configuración del propio embudo (checkout_config.bloques), que
  // es el mismo sitio donde ya vivían los campos renombrados y los propios.
  // Si no hay bloques, el checkout se comporta exactamente como hoy.
  const ckCfg: any = d.checkout_config ?? {};
  const ckBloques: BloqueCk2[] | null = normalizarBloquesCk(ckCfg.bloques);
  // Si todavía no están guardados, se derivan de la configuración del embudo
  // (queda EXACTAMENTE igual a como se ve hoy) y se guardan al primer cambio.
  // useMemo: sin esto los ids se regenerarían en cada render y no se podría
  // seleccionar ni arrastrar ningún bloque.
  const ckFirma = JSON.stringify([ckCfg.camposFijos ?? null, ckCfg.camposExtra ?? null, ckCfg.bloqueProducto ?? null, ckCfg.variablesDesplegable ?? null]);
  const ckDerivados = useMemo(() => bloquesDesdeConfig(ckCfg), [ckFirma]); // eslint-disable-line react-hooks/exhaustive-deps
  const ckLista: BloqueCk2[] = ckBloques ?? ckDerivados;
  const setCk = (nv: BloqueCk2[] | null) => {
    const c = { ...ckCfg };
    if (nv && nv.length) c.bloques = nv; else delete c.bloques;
    onCampo('checkout_config', c);
  };
  const updCk = (id: string, props: any) => setCk(ckLista.map(x => (x.id === id ? { ...x, props: { ...(x.props ?? {}), ...props } } : x)));
  const ocultarCk = (id: string, oculto: boolean) => setCk(ckLista.map(x => (x.id === id ? { ...x, visible: oculto ? false : undefined } : x)));
  const borrarCk = (id: string) => { setCk(ckLista.filter(x => x.id !== id)); if (selCk === id) setSelCk(null); };
  const moverCk = (id: string, dir: -1 | 1) => {
    const i = ckLista.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= ckLista.length) return;
    const a2 = [...ckLista]; [a2[i], a2[j]] = [a2[j], a2[i]]; setCk(a2);
  };
  const duplicarCk = (id: string) => {
    const i = ckLista.findIndex(x => x.id === id); if (i < 0) return;
    const c = nuevoBloqueCk(ckLista[i].tipo);
    c.props = { ...(ckLista[i].props ?? {}) };
    // Un campo propio duplicado necesita su propio id: si no, el pedido guardaría
    // los dos en el mismo sitio y uno pisaría al otro.
    if (c.tipo === 'campo_extra') c.props.id = `extra-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const a2 = [...ckLista]; a2.splice(i + 1, 0, c); setCk(a2); setSelCk(c.id);
  };
  const insertarCk = (idx: number, tipo: string) => {
    const nb = nuevoBloqueCk(tipo);
    const a2 = [...ckLista]; a2.splice(idx, 0, nb); setCk(a2); setSelCk(nb.id);
    setDragCk(null); setOverCk(null);
  };
  const soltarCkEn = (idx: number) => {
    if (dragCk) { insertarCk(idx, dragCk.tipo); return; }
    if (dragCkId) {
      const from = ckLista.findIndex(x => x.id === dragCkId);
      if (from >= 0) { const a2 = [...ckLista]; const [m] = a2.splice(from, 1); a2.splice(from < idx ? idx - 1 : idx, 0, m); setCk(a2); }
      setDragCkId(null); setOverCk(null);
    }
  };
  const ckProblemas = problemasDelCheckout(ckLista);
  /** Qué se pierde al borrar este bloque. Se puede borrar todo, pero avisado. */
  const avisoCk = (b: BloqueCk2): string | null => AVISO_TIPO[b.tipo] ?? null;
  /** Qué se pierde al quitar UN dato del formulario. */
  const avisoCampo = (c: CampoForm): string | null =>
    c.campo ? (AVISO_CAMPO[c.campo] ?? null)
            : `Si lo quitas, "${String(c.label ?? 'ese dato').trim() || 'ese dato'}" deja de llegar en los pedidos nuevos.`;
  // ── Campos del módulo FORMULARIO ──
  const setCampos = (idBloque: string, campos: CampoForm[]) => updCk(idBloque, { campos });
  const updCampo = (idBloque: string, key: string, patch: Partial<CampoForm>) =>
    setCampos(idBloque, camposDelBloque(ckLista.find(x => x.id === idBloque)).map(c => (c.key === key ? { ...c, ...patch } : c)));
  const quitarCampo = (idBloque: string, key: string) =>
    setCampos(idBloque, camposDelBloque(ckLista.find(x => x.id === idBloque)).filter(c => c.key !== key));
  const moverCampo = (idBloque: string, key: string, dir: -1 | 1) => {
    const cs = camposDelBloque(ckLista.find(x => x.id === idBloque));
    const i = cs.findIndex(c => c.key === key), j = i + dir;
    if (i < 0 || j < 0 || j >= cs.length) return;
    const a2 = [...cs]; [a2[i], a2[j]] = [a2[j], a2[i]]; setCampos(idBloque, a2);
  };
  const agregarCampo = (idBloque: string, c: CampoForm) =>
    setCampos(idBloque, [...camposDelBloque(ckLista.find(x => x.id === idBloque)), c]);

  const enCk = vistaTel === 'checkout' && !!checkoutBloque;

  const soltarEn = (idx: number) => {
    if (dragTipo) { insertar(idx, dragTipo); setDragTipo(null); setOverIdx(null); return; }
    if (dragId) {
      const from = bs.findIndex(b => b.id === dragId);
      if (from >= 0) { const a = [...bs]; const [m] = a.splice(from, 1); a.splice(from < idx ? idx - 1 : idx, 0, m); set(a); }
      setDragId(null); setOverIdx(null);
    }
  };
  const subirCampo = async (campo: string, f: File) => { setSubiendo(campo); try { const url = await subir(f); if (url) onCampo(campo, url); } finally { setSubiendo(null); } };
  const subirEnBloque = async (id: string, f: File) => { setSubiendo(id); try { const url = await subir(f); if (url) upd(id, { url }); } finally { setSubiendo(null); } };
  const subirCollage = async (id: string, f: File) => { setSubiendo(id); try { const url = await subir(f); if (url) { const b = bs.find(x => x.id === id); upd(id, { urls: [...((b?.urls) ?? []), url] }); } } finally { setSubiendo(null); } };
  // Carrusel: sube VARIAS fotos y las agrega a props.urls del bloque.
  const subirCarrusel = async (id: string, files: FileList) => {
    setSubiendo(id);
    try {
      const nuevas: string[] = [];
      for (const f of Array.from(files)) { const url = await subir(f); if (url) nuevas.push(url); }
      if (nuevas.length) { const b = bs.find(x => x.id === id); const P = b?.props ?? {}; upd(id, { props: { ...P, urls: [...((P.urls as string[]) ?? []), ...nuevas] } }); }
    } finally { setSubiendo(null); }
  };

  // Empieza a redimensionar arrastrando una esquina del bloque en el teléfono.
  const iniciarResize = (e: React.PointerEvent, b: BloqueLayout, corner: string) => {
    e.preventDefault(); e.stopPropagation();
    const wrap = (e.currentTarget as HTMLElement).parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const P: any = b.props ?? {};
    const anchoActual = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
    setRz({
      id: b.id, corner,
      startX: e.clientX, startY: e.clientY,
      startH: Number(P.h) > 0 ? Number(P.h) : Math.round(rect.height),
      startW: anchoActual,
      contW: rect.width || 300,
      props: P,
    });
  };

  // Mientras se arrastra una esquina: ajusta alto (px) y ancho (%) del bloque.
  useEffect(() => {
    if (!rz) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - rz.startX, dy = e.clientY - rz.startY;
      const signY = (rz.corner === 'bl' || rz.corner === 'br') ? 1 : -1;
      const signX = (rz.corner === 'tr' || rz.corner === 'br') ? 1 : -1;
      const h = Math.max(80, Math.min(640, Math.round(rz.startH + signY * dy)));
      const w = Math.max(40, Math.min(100, Math.round(rz.startW + signX * (dx / rz.contW * 100))));
      upd(rz.id, { props: { ...rz.props, h, ancho: w } });
    };
    const onUp = () => setRz(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.body.style.userSelect = 'none';
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); document.body.style.userSelect = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rz]);

  // Punto de inserción "+" entre bloques (drag-drop + tap + menú emergente).
  // `grande` = versión GRANDE y centrada para la hoja en blanco (primer bloque).
  const Mas = ({ idx, grande }: { idx: number; grande?: boolean }) => {
    const activo = !!pendingTipo || !!dragTipo || !!dragId;
    const resaltado = overIdx === idx && (!!dragTipo || !!dragId);
    return (
      <div
        onDragOver={e => { if (dragTipo || dragId) { e.preventDefault(); setOverIdx(idx); } }}
        onDragLeave={() => setOverIdx(o => (o === idx ? null : o))}
        onDrop={() => soltarEn(idx)}
        className={`relative flex justify-center transition-all ${grande ? 'py-4' : activo ? 'py-2' : 'py-0.5 group'} ${resaltado ? 'bg-[#00A89D]/10' : ''}`}
      >
        <button type="button"
          onClick={() => { if (pendingTipo) insertar(idx, pendingTipo); else setMenuIdx(menuIdx === idx ? null : idx); }}
          className={grande
            ? `w-16 h-16 rounded-full text-white text-3xl leading-none flex items-center justify-center shadow-lg z-10 transition-transform ${activo ? 'bg-[#00847A] scale-110' : 'bg-[#00A89D] hover:scale-105'}`
            : `w-6 h-6 rounded-full text-white text-base leading-none flex items-center justify-center shadow z-10 ${activo ? 'bg-[#00847A] scale-110' : 'bg-[#00A89D] opacity-40 group-hover:opacity-100'}`}
          title={activo ? 'Insertar aquí' : 'Agregar elemento aquí'}
        >+</button>
        {menuIdx === idx && (
          <div className={`absolute ${grande ? 'top-20' : 'top-7'} z-30 bg-white border border-[#E8E8E8] rounded-xl shadow-lg p-2 w-72 max-h-80 overflow-y-auto`}>
            <p className="text-[9px] uppercase tracking-wide text-[#9A9A9A] px-1 mb-1">Agregar bloque aquí</p>
            <div className="grid grid-cols-2 gap-1">
              {BLOQUES.map(o => {
                const yaEsta = bloqueadoUnico(o.tipo);
                return (
                  <button key={o.tipo} type="button" disabled={yaEsta} onClick={() => insertar(idx, o.tipo)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-left border ${yaEsta ? 'opacity-40 border-[#EEE] cursor-default' : 'border-[#EEE] hover:bg-[#F5F5F5]'}`}>
                    <span className="text-sm shrink-0">{o.icono}</span><span className="truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selBloque = bs.find(b => b.id === sel) || null;
  // Icono + nombre legible de un tipo de bloque (para la cabecera del panel y la
  // lista "Estructura del embudo"). Busca en la lista plana, luego en la paleta
  // por categorías, luego en un mapa de respaldo.
  const metaTipo = (t: string): { ic: string; label: string } => {
    const b = BLOQUES.find(x => x.tipo === t);
    if (b) return { ic: b.icono, label: b.label };
    for (const c of PALETA_CATS) { const it = c.items.find(x => x.tipo === t); if (it) return { ic: it.ic, label: it.label }; }
    const extra: Record<string, [string, string]> = {
      texto: ['📝', 'Texto'], encabezado: ['🔠', 'Titular'], boton: ['🔘', 'Botón'], video: ['▶️', 'Video'],
      collage: ['🖼️', 'Collage'], faq: ['❓', 'Preguntas'], enlace: ['🔗', 'Enlace'], social: ['🌐', 'Social'],
      html: ['🧩', 'HTML'], carrusel: ['🎠', 'Carrusel'], separador: ['➖', 'Sección'], espaciador: ['↕️', 'Espacio'],
      contador: ['⏲️', 'Minutero'], beneficios: ['✅', 'Beneficios'], garantia: ['🏅', 'Garantía'],
      confianza: ['🛡️', 'Confianza'], detalle: ['📸', 'Detalle'], checkout_pro: ['⚡', 'Checkout PRO'],
    };
    const e = extra[t]; return e ? { ic: e[0], label: e[1] } : { ic: '🧱', label: t };
  };
  const nombreTipo = (t: string) => { const m = metaTipo(t); return `${m.ic} ${m.label}`; };

  // Marco del lienzo según el dispositivo elegido (móvil = teléfono; escritorio = ancho).
  const marcoOut = dispositivo === 'movil'
    ? 'w-full max-w-[380px] rounded-[2rem] border-[6px] border-[#1A1A1A] bg-[#1A1A1A] shadow-xl overflow-hidden'
    : 'w-full max-w-[880px] rounded-2xl border border-[#D8D8D8] bg-[#EDEDED] p-2 shadow-xl overflow-hidden';
  const marcoIn = dispositivo === 'movil'
    ? 'bg-white min-h-[200px] max-h-[min(80vh,720px)] overflow-y-auto'
    : 'bg-white rounded-xl min-h-[200px] max-h-[min(80vh,720px)] overflow-y-auto';

  // ── CHECKOUT POR BLOQUES: paleta, lienzo, propiedades y estructura ─────────
  const selCkBloque = ckLista.find(b => b.id === selCk) || null;
  const ckUnicoUsado = (t: string) => {
    const it = CK_PALETA_CATS.flatMap(c => c.items).find(x => x.tipo === t);
    return !!it?.unico && ckLista.some(b => b.tipo === t);
  };

  // Punto de inserción entre bloques del checkout (igual que el de la página).
  const MasCk = ({ idx }: { idx: number }) => {
    const activo = !!dragCk || !!dragCkId;
    const resaltado = overCk === idx && activo;
    return (
      <div onDragOver={e => { if (activo) { e.preventDefault(); setOverCk(idx); } }}
        onDragLeave={() => setOverCk(o => (o === idx ? null : o))}
        onDrop={() => soltarCkEn(idx)}
        className={`relative flex justify-center transition-all ${activo ? 'py-2' : 'py-0.5 group'} ${resaltado ? 'bg-[#00A89D]/10' : ''}`}>
        <span className={`w-6 h-6 rounded-full text-white text-base leading-none flex items-center justify-center shadow z-10 ${activo ? 'bg-[#00847A] scale-110' : 'bg-[#00A89D] opacity-0 group-hover:opacity-60'}`}>+</span>
      </div>
    );
  };

  const paletaCk = () => {
    const q = buscarCk.trim().toLowerCase();
    const cats = CK_PALETA_CATS
      .map(c => ({ ...c, items: c.items.filter(it => !q || it.label.toLowerCase().includes(q)) }))
      .filter(c => c.items.length);
    return (
      <div className="lg:w-56 lg:shrink-0 lg:sticky lg:top-2 lg:max-h-[86vh] overflow-y-auto bg-white border border-[#E8E8E8] rounded-2xl p-3">
        <div className="text-[13px] font-extrabold text-[#0D0D0D] mb-0.5">Bloques del checkout</div>
        <p className="text-[10px] text-[#9A9A9A] mb-2">Arrastra al lienzo, o toca para agregarlo al final. Los datos del cliente van dentro del bloque <b>Formulario</b>: tócalo en el lienzo para agregar, renombrar o quitar cada uno.</p>
        <div className="relative mb-2">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9A9A9A] text-[12px]">🔍</span>
          <input value={buscarCk} onChange={e => setBuscarCk(e.target.value)} placeholder="Buscar bloque…"
            className="w-full pl-7 pr-2 py-2 rounded-lg border border-[#E8E8E8] text-[12px] focus:border-[#00A89D] outline-none" />
        </div>
        {!cats.length && <p className="text-[11px] text-[#9A9A9A] px-1 py-3 text-center">Sin resultados.</p>}
        {cats.map(c => (
          <div key={c.cat} className="mb-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#9A9A9A] px-0.5 mb-1">{c.cat}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {c.items.map(it => {
                const ya = ckUnicoUsado(it.tipo);
                return (
                  <button key={it.tipo + it.label} type="button"
                    draggable={!ya} disabled={ya}
                    onDragStart={() => { if (!ya) { setDragCk({ tipo: it.tipo }); setSelCk(null); } }}
                    onDragEnd={() => { setDragCk(null); setOverCk(null); }}
                    onClick={() => { if (!ya) insertarCk(ckLista.length, it.tipo); }}
                    title={ya ? 'Ya está en el checkout' : `Arrastra al lienzo, o toca para agregarlo al final: ${it.label}`}
                    className={`relative flex flex-col items-center justify-center gap-1 px-1.5 py-2.5 rounded-xl border text-center transition-colors ${
                      ya ? 'border-[#EEE] opacity-45 cursor-default'
                         : 'cursor-grab active:cursor-grabbing border-[#E8E8E8] hover:border-[#00A89D]/50 hover:bg-[#00A89D]/5'}`}>
                    <span className="text-lg leading-none">{it.ic}</span>
                    <span className="text-[10px] font-semibold text-[#4A4A4A] leading-tight">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button type="button"
          onClick={() => { if (confirm('Deja el checkout como viene por defecto: todos los datos, en el orden de siempre. Se pierde el orden que armaste. ¿Seguro?')) setCk(bloquesDesdeConfig(ckCfg)); }}
          className="w-full mt-1 px-2 py-2 rounded-lg text-[10.5px] font-semibold border border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]">↺ Restablecer el checkout</button>
      </div>
    );
  };

  /** Vista de un bloque del checkout dentro del lienzo. */
  const vistaCk = (b: BloqueCk2) => {
    const P: any = b.props ?? {};
    const vs: any[] = d.variantes ?? [];
    const v0: any = vs[0] || null;
    const R = resumenDelPedido(
      { nombre: v0?.nombre || d.producto, precio: (typeof v0?.precio === 'number' ? v0.precio : d.precio), precioAntes: v0?.precioAntes ?? d.precio_antes },
      { textoEnvio: P.textoEnvio },
    );
    const img0: string | null = v0?.imagen || d.imagenes?.[0] || null;
    const alin = P.align === 'center' ? 'text-center' : P.align === 'right' ? 'text-right' : 'text-left';
    const chip = 'text-[10px] border border-[#DDD] rounded-md px-2 py-1 bg-white flex items-center gap-1';
    const lbl = 'text-[9px] font-extrabold tracking-wide text-[#0D0D0D]';
    const norm = (ops: any[]) => (ops ?? []).map((o: any) => (typeof o === 'string' ? { valor: o } : o)).filter((o: any) => o?.valor);
    const caja = (ph: string) => <div className="h-7 rounded-lg bg-white border border-[#E8E8E8] flex items-center px-2 text-[10px] text-[#B5B5B5] mt-1">{ph}</div>;
    switch (b.tipo) {
      case 'titulo':
        return <div className={`font-extrabold px-3 pt-4 pb-1 ${alin}`} style={{ fontSize: Math.min(22, Number(P.size) || 18), color: P.color || undefined }}>{P.texto || 'Título'}</div>;
      case 'texto':
        return <div className={`px-3 py-1 ${alin} ${P.italica ? 'italic' : ''}`} style={{ fontSize: Number(P.size) || 12, color: P.color || '#6B6B6B' }}>{P.texto || 'Texto'}</div>;
      case 'espaciador':
        return <div style={{ height: Math.max(4, Number(P.alto) || 16) }} className="bg-[repeating-linear-gradient(45deg,#F7F7F7,#F7F7F7_6px,#fff_6px,#fff_12px)]" />;
      case 'producto':
        return (
          <div className="mx-3 my-2 flex items-center gap-2 rounded-xl border border-[#E8E8E8] p-2">
            {P.mostrarFoto !== false && (img0
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={img0} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-lg bg-[#F2F1EE] grid place-items-center text-lg shrink-0">📦</div>)}
            <div className="min-w-0">
              <div className="text-[11px] font-bold truncate">{R.nombre || 'Tu producto'}</div>
              <div className="text-[10px] text-[#6B6B6B]">
                {R.precioAntes != null && <><span>{P.etiquetaNormal || 'PRECIO NORMAL'} </span><s className="text-[#C1121F]">{pesos(R.precioAntes)}</s>{' · '}</>}
                <span className="font-extrabold" style={{ color: acento.texto }}>{R.precio == null ? '—' : pesos(R.precio)}</span>
              </div>
            </div>
          </div>
        );
      case 'variantes': {
        const selectores: any[] = Array.isArray(v0?.selectores) ? v0.selectores : [];
        const tieneTalla = selectores.some(x => /talla/i.test(x?.etiqueta || ''));
        const tallas0: string[] = (!tieneTalla && Array.isArray(v0?.tallas) && v0.tallas.length) ? v0.tallas : (!tieneTalla && Array.isArray(d.tallas) ? d.tallas : []);
        const nada = selectores.length === 0 && tallas0.length === 0;
        return (
          <div className="px-3 py-2 space-y-2">
            {!!P.titulo && <div className="text-center font-extrabold text-[12px]">{P.titulo}</div>}
            {selectores.map((x: any, si: number) => {
              const ops = norm(x.opciones).slice(0, 8);
              if (!ops.length) return null;
              return (
                <div key={si}>
                  <div className={lbl}>{(x.etiqueta || 'OPCIÓN').toUpperCase()}</div>
                  {P.desplegable
                    ? caja(`— Elige ${(x.etiqueta || 'opción').toLowerCase()} —`)
                    : <div className="flex gap-1 flex-wrap mt-1">{ops.map((o: any, k: number) => <span key={k} className={chip}>{o.valor}</span>)}</div>}
                </div>
              );
            })}
            {tallas0.length > 0 && (
              <div><div className={lbl}>TALLA</div>
                {P.desplegable ? caja('— Elige talla —')
                  : <div className="flex gap-1 flex-wrap mt-1">{tallas0.slice(0, 8).map((t, k) => <span key={k} className={chip}>{t}</span>)}</div>}
              </div>
            )}
            {nada && <div className="text-[10px] text-[#B45309] bg-[#FEF6E7] rounded-lg px-2 py-1.5">Este producto todavía no tiene colores ni tallas. Se ponen en “Editar productos del checkout”.</div>}
          </div>
        );
      }
      case 'formulario': {
        const cs = camposDelBloque(b).filter(c => c.visible !== false);
        if (!cs.length) return <div className="px-3 py-3 text-[10px] text-[#C1121F]">El formulario quedó sin datos: el pedido llegaría vacío. Tócalo para agregar.</div>;
        return (
          <div className="px-3 py-1.5 space-y-2">
            {cs.map(c => {
              const nom = String(c.label ?? '').trim();
              const ph = c.campo === 'departamento' ? '— Elige tu departamento —'
                : c.campo === 'municipio' ? '— Elige tu ciudad —'
                : (!c.campo && c.tipo === 'selector') ? '— Elige una opción —'
                : (c.placeholder || (c.campo ? (CAMPO_INFO[c.campo]?.placeholder ?? '') : ''));
              return (
                <div key={c.key}>
                  <div className={lbl}>
                    {nom || <span className="text-[#C1121F]">SIN NOMBRE — no se le muestra al cliente</span>}
                    {c.obligatorio && <span className="text-[#C1121F]"> *</span>}
                  </div>
                  {(!c.campo && c.tipo === 'checkbox')
                    ? <div className="text-[10px] text-[#6B6B6B] mt-1">☐ {nom}</div>
                    : caja(ph)}
                </div>
              );
            })}
          </div>
        );
      }
      case 'resumen':
        return (
          <div className="mx-3 my-2 border border-[#E0E0E0] rounded-lg overflow-hidden text-[10px]">
            <div className="flex justify-between px-3 py-1.5 bg-[#FAFAFA] font-bold"><span>{P.etiquetaProducto || 'PRODUCTO'}</span><span>{P.etiquetaPrecio || 'PRECIO'}</span></div>
            <div className="flex justify-between px-3 py-1.5 border-t border-[#EEE]"><span className="truncate">{R.nombre || 'Tu producto'}</span><span className="font-bold">{R.precio == null ? '—' : pesos(R.precio)}</span></div>
            {R.envio && <div className="flex justify-between px-3 py-1.5 border-t border-[#EEE]"><span>{P.etiquetaEnvio || 'Envío'}</span><span className="font-bold">{R.envio}</span></div>}
            <div className="flex justify-between px-3 py-1.5 border-t border-[#EEE] font-bold"><span>{P.etiquetaTotal || 'Total'}</span><span>{R.total == null ? '—' : pesos(R.total)}</span></div>
          </div>
        );
      case 'sellos':
        return (
          <div className="flex flex-wrap justify-center gap-1.5 px-3 py-2">
            {(Array.isArray(P.items) ? P.items : []).map((x: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#F2F1EE] rounded-full px-2 py-1"><span>{x.emoji || '✅'}</span>{x.texto}</span>
            ))}
          </div>
        );
      case 'pago':
        return (
          <div className="mx-3 my-2 border border-[#E0E0E0] rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: P.color || '#F97316' }} />
            <span className="font-bold text-[#6B6B6B] text-[11px]">{P.texto || 'CONTRA ENTREGA'}</span>
          </div>
        );
      case 'boton':
        return (
          <div className="px-3 py-2">
            <div className={`text-white text-center font-extrabold text-[12px] py-2.5 ${P.forma === 'cuadrado' ? 'rounded-none' : P.forma === 'redondeado' ? 'rounded-xl' : 'rounded-full'}`} style={{ background: P.color || acento.boton }}>{P.texto || 'COMPLETAR MI PEDIDO'}</div>
          </div>
        );
      default:
        return <div className="px-3 py-2 text-[10px] text-[#9A9A9A]">Bloque desconocido: {b.tipo}</div>;
    }
  };

  /** El lienzo en la pestaña CHECKOUT. */
  const lienzoCk = () => {
    if (!checkoutBloque) return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-2">🛒</div>
        <p className="text-[13px] text-[#6B6B6B] mb-3">Esta página todavía no tiene checkout.<br />Actívalo para recibir los pedidos.</p>
        <button onClick={agregarCheckout} className="rounded-xl py-2.5 px-5 bg-[#00A89D] text-white text-sm font-bold hover:bg-[#007A72]">🛒 Activar checkout</button>
      </div>
    );
    return (
      <div className="py-1">
        <MasCk idx={0} />
        {ckLista.map((b, i) => {
          const oculto = b.visible === false;
          return (
            <Fragment key={b.id}>
              <div className={`group/ck relative ${selCk === b.id ? 'ring-2 ring-[#00A89D] ring-inset' : ''} ${dragCkId === b.id ? 'opacity-40' : ''}`}>
                <div className={`absolute -top-3 right-2 z-20 items-center gap-0.5 bg-white border border-[#00A89D]/40 rounded-lg px-1 py-0.5 shadow ${selCk === b.id ? 'flex' : 'hidden group-hover/ck:flex'}`}>
                  <span draggable onDragStart={() => setDragCkId(b.id)} onDragEnd={() => { setDragCkId(null); setOverCk(null); }}
                    className="text-xs px-1 cursor-grab active:cursor-grabbing text-[#9A9A9A]" title="Arrastra para mover">⠿</span>
                  <button onClick={e => { e.stopPropagation(); moverCk(b.id, -1); }} disabled={i === 0} className="text-xs px-0.5 disabled:opacity-25" title="Subir">↑</button>
                  <button onClick={e => { e.stopPropagation(); moverCk(b.id, 1); }} disabled={i === ckLista.length - 1} className="text-xs px-0.5 disabled:opacity-25" title="Bajar">↓</button>
                  <button onClick={e => { e.stopPropagation(); duplicarCk(b.id); }} className="text-xs px-0.5" title="Duplicar">⧉</button>
                  <button onClick={e => { e.stopPropagation(); ocultarCk(b.id, !oculto); }} className="text-xs px-0.5" title={oculto ? 'Mostrar' : 'Ocultar'}>{oculto ? '🙈' : '👁'}</button>
                  <button onClick={e => { e.stopPropagation(); const av = avisoCk(b); if (!av || confirm(`${av}\n\n¿Lo borro igual?`)) borrarCk(b.id); }} className="text-xs px-0.5 text-[#DC2626]" title="Borrar">🗑</button>
                </div>
                <div onClick={() => setSelCk(b.id)} className={`cursor-pointer ${oculto ? 'opacity-40 grayscale' : ''}`}>
                  {oculto && <div className="absolute top-1 left-1 z-10 text-[9px] bg-[#0D0D0D]/70 text-white rounded px-1.5 py-0.5">oculto</div>}
                  {vistaCk(b)}
                </div>
              </div>
              <MasCk idx={i + 1} />
            </Fragment>
          );
        })}
        {ckLista.length === 0 && (
          <div className="p-6 text-center text-[12px] text-[#9A9A9A]">El checkout quedó vacío.<br />Arrastra bloques desde la izquierda: así como está, el cliente no puede comprar.</div>
        )}
      </div>
    );
  };

  /** Propiedades del bloque de checkout elegido (pestaña Contenido). */
  const propsCkContenido = () => {
    const b = selCkBloque!;
    const P: any = b.props ?? {};
    const up = (patch: any) => updCk(b.id, patch);
    const campoTxt = (label: string, key: string, ph?: string) => (
      <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">{label}</span>
        <input className={inp} value={P[key] ?? ''} placeholder={ph} onChange={e => up({ [key]: e.target.value })} /></label>
    );
    const check = (label: string, on: boolean, onClick: () => void) => (
      <button type="button" onClick={onClick} className="flex items-center gap-2 text-[12px] font-semibold text-left">
        <span className={`w-4 h-4 rounded border grid place-items-center text-[10px] text-white shrink-0 ${on ? 'bg-[#00A89D] border-[#00A89D]' : 'bg-white border-[#D5D1C8]'}`}>{on ? '✓' : ''}</span>
        <span>{label}</span>
      </button>
    );
    return (
      <>
        {b.tipo === 'formulario' && (() => {
          const cs = camposDelBloque(b);
          const libres = CAMPOS_PEDIDO.filter(x => !cs.some(c => c.campo === x));
          return (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A]">Datos que pide el formulario</p>
              <div className="space-y-1">
                {cs.length === 0 && <p className="text-[11px] text-[#C1121F]">Sin datos, el pedido llega vacío. Agrega al menos nombre, whatsapp y dirección.</p>}
                {cs.map((c, i) => {
                  const nom = String(c.label ?? '').trim();
                  const oculto = c.visible === false;
                  const abierto = campoAbierto === c.key;
                  const editando = editKey === c.key;
                  return (
                    <div key={c.key} className={`rounded-xl border ${abierto ? 'border-[#00A89D]' : 'border-[#E8E8E8]'} ${oculto ? 'opacity-55' : ''}`}>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <button type="button" title={oculto ? 'Mostrar en el checkout' : 'Quitar del checkout (sin borrarlo)'}
                          onClick={() => updCampo(b.id, c.key, { visible: oculto ? true : false })}
                          className="text-[13px] shrink-0">{oculto ? '🙈' : '👁'}</button>
                        {editando ? (
                          <>
                            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { updCampo(b.id, c.key, { label: editVal }); setEditKey(null); } if (e.key === 'Escape') setEditKey(null); }}
                              className="flex-1 min-w-0 text-[12px] border border-[#00A89D] rounded px-2 py-1" />
                            <button type="button" title="Aceptar" onClick={() => { updCampo(b.id, c.key, { label: editVal }); setEditKey(null); }}
                              className="px-1.5 py-1 rounded-lg bg-[#00A89D] text-white text-[11px] font-bold shrink-0">✓</button>
                            <button type="button" title="Cancelar" onClick={() => setEditKey(null)}
                              className="px-1.5 py-1 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-[11px] font-bold shrink-0">✕</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => setCampoAbierto(abierto ? null : c.key)}
                              className="flex-1 min-w-0 text-left text-[12px] font-semibold truncate">
                              {nom || <span className="text-[#C1121F]">sin nombre</span>}
                              {c.obligatorio && <span className="text-[#C1121F]"> *</span>}
                              {!c.campo && <span className="text-[9px] text-[#00847A] ml-1">propio</span>}
                            </button>
                            <button type="button" title="Cambiar el nombre" onClick={() => { setEditKey(c.key); setEditVal(nom); }}
                              className="px-1 text-[12px] text-[#6B6B6B] hover:text-[#00847A] shrink-0">✏️</button>
                            <button type="button" title="Subir" disabled={i === 0} onClick={() => moverCampo(b.id, c.key, -1)}
                              className="px-0.5 text-[11px] disabled:opacity-25 shrink-0">↑</button>
                            <button type="button" title="Bajar" disabled={i === cs.length - 1} onClick={() => moverCampo(b.id, c.key, 1)}
                              className="px-0.5 text-[11px] disabled:opacity-25 shrink-0">↓</button>
                            <button type="button" title="Quitar del formulario"
                              onClick={() => { const av = avisoCampo(c); if (!av || confirm(`${av}\n\n¿Lo quito igual?`)) quitarCampo(b.id, c.key); }}
                              className="px-1 text-[12px] text-[#DC2626] shrink-0">🗑</button>
                          </>
                        )}
                      </div>
                      {abierto && !editando && (
                        <div className="px-2 pb-2 pt-1 space-y-2 border-t border-[#F0F0F0]">
                          <button type="button" onClick={() => updCampo(b.id, c.key, { obligatorio: !c.obligatorio })}
                            className="flex items-center gap-2 text-[11.5px] font-semibold">
                            <span className={`w-4 h-4 rounded border grid place-items-center text-[10px] text-white shrink-0 ${c.obligatorio ? 'bg-[#00A89D] border-[#00A89D]' : 'bg-white border-[#D5D1C8]'}`}>{c.obligatorio ? '✓' : ''}</span>
                            Obligatorio (no deja comprar sin llenarlo)
                          </button>
                          {!c.campo && (
                            <label className="block"><span className="block text-[9.5px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Tipo</span>
                              <select className={inp} value={c.tipo ?? 'texto'} onChange={e => updCampo(b.id, c.key, { tipo: e.target.value as any })}>
                                {TIPOS_EXTRA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                              </select></label>
                          )}
                          {!c.campo && c.tipo === 'selector' && (
                            <label className="block"><span className="block text-[9.5px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Opciones (una por línea)</span>
                              <textarea className={`${inp} min-h-[60px]`} value={(c.opciones ?? []).join('\n')}
                                onChange={e => updCampo(b.id, c.key, { opciones: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} /></label>
                          )}
                          {c.campo !== 'departamento' && c.campo !== 'municipio' && (c.campo || (c.tipo !== 'checkbox' && c.tipo !== 'selector')) && (
                            <label className="block"><span className="block text-[9.5px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Texto de ayuda dentro del campo</span>
                              <input className={inp} value={c.placeholder ?? ''} onChange={e => updCampo(b.id, c.key, { placeholder: e.target.value })} /></label>
                          )}
                          <p className="text-[10px] text-[#9A9A9A] leading-snug">
                            {c.campo ? 'Cambiar el nombre cambia lo que ve el cliente, no el dato que llega en el pedido.' : 'Este dato llega en el pedido junto a los demás.'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-1 space-y-1.5">
                <button type="button" onClick={() => setAddAbierto(!addAbierto)}
                  className="w-full py-2 rounded-xl border border-[#00A89D] text-[#00847A] text-[12px] font-bold hover:bg-[#00A89D]/5">+ Agregar un dato</button>
                {addAbierto && (
                  <div className="rounded-xl border border-[#E8E8E8] p-2 space-y-1">
                    <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#9A9A9A]">Datos del pedido</p>
                    {libres.length === 0 && <p className="text-[10.5px] text-[#9A9A9A]">Ya están todos puestos.</p>}
                    {libres.map(x => (
                      <button key={x} type="button"
                        onClick={() => { agregarCampo(b.id, campoFijo(x)); setAddAbierto(false); }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] hover:bg-[#F5F5F5]">✏️ {CAMPO_INFO[x].label}</button>
                    ))}
                    <div className="h-px bg-[#F0F0F0] my-1" />
                    <button type="button"
                      onClick={() => { const n = campoPropio(); agregarCampo(b.id, n); setCampoAbierto(n.key); setEditKey(n.key); setEditVal(n.label); setAddAbierto(false); }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] font-semibold text-[#00847A] hover:bg-[#00A89D]/5">➕ Campo nuevo (lo inventas tú)</button>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {(b.tipo === 'titulo' || b.tipo === 'texto') && (<>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Texto</span>
            <textarea className={`${inp} min-h-[70px]`} value={P.texto ?? ''} onChange={e => up({ texto: e.target.value })} /></label>
          <div className="flex gap-2">
            <label className="flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Tamaño</span>
              <input type="number" min={9} max={40} className={inp} value={Number(P.size) || (b.tipo === 'titulo' ? 18 : 12)} onChange={e => up({ size: Number(e.target.value) })} /></label>
            <label className="flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Alineación</span>
              <select className={inp} value={P.align ?? 'left'} onChange={e => up({ align: e.target.value })}>
                <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
              </select></label>
          </div>
          <div><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Color</span>
            <SelectorColor value={P.color ?? ''} onChange={(v: string) => up({ color: v })} permitirVacio /></div>
          {b.tipo === 'texto' && check('Cursiva', !!P.italica, () => up({ italica: !P.italica }))}
        </>)}

        {b.tipo === 'espaciador' && (
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Alto (px)</span>
            <input type="number" min={4} max={120} className={inp} value={Number(P.alto) || 16} onChange={e => up({ alto: Number(e.target.value) })} /></label>
        )}

        {b.tipo === 'variantes' && (<>
          {campoTxt('Título encima de los colores', 'titulo')}
          {check('Mostrar color y talla como desplegable (▼)', P.desplegable === true, () => up({ desplegable: !P.desplegable }))}
          <p className="text-[10.5px] text-[#6B6B6B] leading-snug">Los colores, tallas y precios salen del producto.</p>
          <button onClick={() => onAbrirContenido?.()} className="w-full rounded-xl py-2 border border-[#E8E8E8] text-[12px] font-semibold hover:bg-[#F5F5F5]">✏️ Editar productos del checkout</button>
        </>)}

        {b.tipo === 'producto' && (<>
          {check('Mostrar la foto', P.mostrarFoto !== false, () => up({ mostrarFoto: P.mostrarFoto === false }))}
          {campoTxt('Etiqueta del precio de antes', 'etiquetaNormal')}
          {campoTxt('Etiqueta del precio de hoy', 'etiquetaOferta')}
        </>)}

        {b.tipo === 'resumen' && (<>
          {campoTxt('Título de la columna del producto', 'etiquetaProducto')}
          {campoTxt('Título de la columna del precio', 'etiquetaPrecio')}
          {campoTxt('Cómo se llama el total', 'etiquetaTotal')}
          {campoTxt('Cómo se llama la línea del envío', 'etiquetaEnvio')}
          {campoTxt('Qué dice el envío (vacío = no se muestra)', 'textoEnvio', 'GRATIS')}
          <p className="text-[10.5px] text-[#6B6B6B] leading-snug">El total lo calcula el sistema con el precio del producto: no se escribe a mano. La línea del envío es solo un texto y no suma ni resta.</p>
        </>)}

        {b.tipo === 'pago' && (<>
          {campoTxt('Texto', 'texto')}
          <div><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Color del punto</span>
            <SelectorColor value={P.color ?? '#F97316'} onChange={(v: string) => up({ color: v })} /></div>
        </>)}

        {b.tipo === 'boton' && (<>
          {campoTxt('Qué dice el botón', 'texto')}
          <div><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Color</span>
            <SelectorColor value={P.color ?? ''} onChange={(v: string) => up({ color: v })} permitirVacio /></div>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-1">Forma</span>
            <select className={inp} value={P.forma ?? 'pill'} onChange={e => up({ forma: e.target.value })}>
              <option value="pill">Redondo</option><option value="redondeado">Esquinas suaves</option><option value="cuadrado">Cuadrado</option>
            </select></label>
          {check('Que siga al cliente al bajar', P.flotante !== false, () => up({ flotante: P.flotante === false }))}
        </>)}

        {b.tipo === 'sellos' && (<>
          {(Array.isArray(P.items) ? P.items : []).map((x: any, i: number) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input className={`${inp} w-14 text-center`} value={x.emoji ?? ''} onChange={e => { const it = [...P.items]; it[i] = { ...it[i], emoji: e.target.value }; up({ items: it }); }} />
              <input className={inp} value={x.texto ?? ''} onChange={e => { const it = [...P.items]; it[i] = { ...it[i], texto: e.target.value }; up({ items: it }); }} />
              <button onClick={() => up({ items: P.items.filter((_: any, k: number) => k !== i) })} className="text-[#C1121F] px-1">✕</button>
            </div>
          ))}
          <button onClick={() => up({ items: [...(P.items ?? []), { emoji: '✅', texto: 'Nuevo sello' }] })} className="w-full rounded-xl py-2 border border-[#E8E8E8] text-[12px] font-semibold hover:bg-[#F5F5F5]">+ Agregar sello</button>
        </>)}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── ENCABEZADO: Constructor de Embudos ── */}
      <div className="flex items-center gap-2.5 flex-wrap bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00A89D] to-[#0D8A3E] grid place-items-center text-white text-lg shadow shrink-0">🎨</span>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-[#0D0D0D] leading-tight">Constructor de Embudos</div>
            <div className="text-[11px] text-[#9A9A9A] leading-tight truncate">Arrastra y suelta los bloques para construir tu embudo</div>
          </div>
        </div>
        {(onDeshacer || onRehacer) && (
          <div className="inline-flex rounded-xl border border-[#E8E8E8] overflow-hidden">
            <button type="button" onClick={onDeshacer} disabled={!puedeDeshacer} title="Atrasar (Ctrl+Z)"
              className={`px-3 py-2 text-lg leading-none ${puedeDeshacer ? 'text-[#00847A] hover:bg-[#00A89D]/10' : 'text-[#CFCFCF] cursor-not-allowed'}`}>↶</button>
            <span className="w-px bg-[#E8E8E8]" />
            <button type="button" onClick={onRehacer} disabled={!puedeRehacer} title="Adelantar (Ctrl+Y)"
              className={`px-3 py-2 text-lg leading-none ${puedeRehacer ? 'text-[#00847A] hover:bg-[#00A89D]/10' : 'text-[#CFCFCF] cursor-not-allowed'}`}>↷</button>
          </div>
        )}
        <div className="inline-flex rounded-xl border border-[#E8E8E8] overflow-hidden">
          <button type="button" onClick={() => setDispositivo('movil')} title="Vista móvil"
            className={`px-3 py-2 text-base ${dispositivo === 'movil' ? 'bg-[#00A89D] text-white' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>📱</button>
          <button type="button" onClick={() => setDispositivo('escritorio')} title="Vista escritorio"
            className={`px-3 py-2 text-base ${dispositivo === 'escritorio' ? 'bg-[#00A89D] text-white' : 'text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>🖥️</button>
        </div>
        {d.slug ? (
          <a href={`/p/${d.slug}`} target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-xl border border-[#E8E8E8] text-[13px] font-semibold hover:bg-[#F5F5F5]">Vista previa</a>
        ) : null}
        {onGuardar && (
          <button type="button" onClick={onGuardar} disabled={guardando}
            className="px-5 py-2 rounded-xl bg-[#00A89D] text-white text-[13px] font-bold hover:bg-[#00847A] disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        )}
        <button type="button" onClick={() => setSel(null)} title="Cerrar edición del bloque"
          className="w-9 h-9 rounded-xl border border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5] grid place-items-center">✕</button>
      </div>

      {/* ── 3 COLUMNAS: Paleta · Lienzo · Propiedades ── */}
      <div className="lg:flex lg:gap-3 lg:items-start space-y-3 lg:space-y-0">

        {/* ── Columna 1: PALETA (la del checkout cuando esa pestaña está abierta) ── */}
        {enCk ? paletaCk() : (
        <div className="lg:w-56 lg:shrink-0 lg:sticky lg:top-2 lg:max-h-[86vh] overflow-y-auto bg-white border border-[#E8E8E8] rounded-2xl p-3">
          <div className="text-[13px] font-extrabold text-[#0D0D0D] mb-0.5">Bloques</div>
          <p className="text-[10px] text-[#9A9A9A] mb-2">Arrastra al lienzo, o toca para agregarlo al final. Los datos del cliente van dentro del bloque <b>Formulario</b>: tócalo en el lienzo para agregar, renombrar o quitar cada uno.</p>
          <div className="relative mb-2">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9A9A9A] text-[12px]">🔍</span>
            <input value={buscarPal} onChange={e => setBuscarPal(e.target.value)} placeholder="Buscar bloque…"
              className="w-full pl-7 pr-2 py-2 rounded-lg border border-[#E8E8E8] text-[12px] focus:border-[#00A89D] outline-none" />
          </div>
          {(() => {
            const q = buscarPal.trim().toLowerCase();
            const cats = PALETA_CATS
              .map(c => ({ ...c, items: c.items.filter(it => !q || it.label.toLowerCase().includes(q)) }))
              .filter(c => c.items.length);
            if (!cats.length) return <p className="text-[11px] text-[#9A9A9A] px-1 py-3 text-center">Sin resultados.</p>;
            return cats.map(c => (
              <div key={c.cat} className="mb-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#9A9A9A] px-0.5 mb-1">{c.cat}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {c.items.map(it => {
                    const yaEsta = bloqueadoUnico(it.tipo);
                    const inactivo = it.pronto || yaEsta;
                    const activoSel = it.tipo && pendingTipo === it.tipo;
                    return (
                      <button key={it.label} type="button"
                        draggable={!inactivo}
                        onDragStart={() => { if (!inactivo && it.tipo) { setDragTipo(it.tipo); setSel(null); } }}
                        onDragEnd={() => { setDragTipo(null); setOverIdx(null); }}
                        onClick={() => { if (!inactivo && it.tipo) setPendingTipo(pendingTipo === it.tipo ? null : it.tipo); }}
                        disabled={inactivo}
                        title={it.pronto ? 'Próximamente' : yaEsta ? 'Ya está en la página' : `Arrastra o toca para agregar: ${it.label}`}
                        className={`relative flex flex-col items-center justify-center gap-1 px-1.5 py-2.5 rounded-xl border text-center transition-colors ${
                          inactivo
                            ? 'border-[#EEE] opacity-45 cursor-default'
                            : 'cursor-grab active:cursor-grabbing ' + (activoSel ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E8E8E8] hover:border-[#00A89D]/50 hover:bg-[#00A89D]/5')
                        }`}>
                        {it.nuevo && <span className="absolute top-1 right-1 text-[7px] font-extrabold text-white bg-[#4C6EF5] rounded px-1 py-[1px]">NUEVO</span>}
                        {it.pronto && <span className="absolute top-1 right-1 text-[7px] font-extrabold text-white bg-[#E6A817] rounded px-1 py-[1px]">PRONTO</span>}
                        <span className="text-lg leading-none">{it.ic}</span>
                        <span className="text-[10px] font-semibold text-[#4A4A4A] leading-tight">{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
          {pendingTipo && (
            <div className="mt-1 text-[10px] text-[#00847A] bg-[#00A89D]/10 rounded-lg p-2">
              Toca un <b>+</b> en el lienzo donde va.
              <button onClick={() => setPendingTipo(null)} className="block mt-1 text-[#DC2626] font-semibold">Cancelar</button>
            </div>
          )}
        </div>

        )}

        {/* ── Columna 2: LIENZO (organiza y previsualiza) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 items-center">
          {/* Pestañas: PÁGINA DE INICIO / CHECKOUT */}
          <div className="flex gap-2 w-full max-w-[420px]">
            <button type="button"
              onClick={() => { setVistaTel('inicio'); if (selBloque && (selBloque.tipo === 'checkout' || selBloque.tipo === 'checkout_pro')) setSel(null); }}
              className={`flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all border-2 ${vistaTel === 'inicio' ? 'bg-[#00A89D] text-white border-[#00A89D] shadow-md' : 'bg-white text-[#00847A] border-[#00A89D]/40 hover:bg-[#00A89D]/5'}`}>🛍️ Página de inicio</button>
            <button type="button"
              onClick={() => { setVistaTel('checkout'); setSel(null); }}
              className={`flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all border-2 ${vistaTel === 'checkout' ? 'bg-[#00A89D] text-white border-[#00A89D] shadow-md' : 'bg-white text-[#00847A] border-[#00A89D]/40 hover:bg-[#00A89D]/5'}`}>🛒 Checkout{hayCheckout ? ' ✓' : ''}</button>
          </div>
          <p className="text-[10px] text-[#6B6B6B] text-center -mt-0.5">{vistaTel === 'inicio' ? '👆 Arrastra un bloque de la izquierda al lienzo, o usa ⠿ ▲▼ para ordenar.' : '👆 Toca un bloque del checkout para editarlo, arrástralo de la izquierda o usa ⠿ ▲▼ para ordenarlo.'}</p>

          <div className={marcoOut}>
          <div className={marcoIn}>
            {vistaTel === 'inicio' ? (<>
            {bs.length === 0 ? (
              <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-10 text-center">
                <p className="text-[14px] font-extrabold text-[#3A3A3A] tracking-wide mb-4">AGREGA TU PRIMER BLOQUE AL EMBUDO</p>
                <Mas idx={0} grande />
                <p className="text-[11px] text-[#9A9A9A] mt-4 max-w-[220px]">Toca el <b className="text-[#00A89D]">+</b>, o arrastra un bloque desde la izquierda, para empezar a construir.</p>
              </div>
            ) : (<>
            <Mas idx={0} />
            {bs.map((b, i) => {
              // El checkout tiene su propia pestaña: no se muestra en "Inicio".
              if (b.tipo === 'checkout' || b.tipo === 'checkout_pro') return null;
              const oculto = b.visible === false;
              return (
              <Fragment key={b.id}>
                <div className={`group/bl relative ${sel === b.id ? 'ring-2 ring-[#00A89D] ring-inset' : ''} ${dragId === b.id ? 'opacity-40' : ''}`}>
                  {/* Barra flotante del bloque (al pasar el mouse o seleccionar) */}
                  <div className={`absolute -top-3 right-2 z-20 items-center gap-0.5 bg-white border border-[#00A89D]/40 rounded-lg px-1 py-0.5 shadow ${sel === b.id ? 'flex' : 'hidden group-hover/bl:flex'}`}>
                    <span draggable onDragStart={() => { setDragId(b.id); }} onDragEnd={() => { setDragId(null); setOverIdx(null); }}
                      className="text-xs px-1 cursor-grab active:cursor-grabbing text-[#9A9A9A]" title="Arrastra para mover">⠿</span>
                    <button onClick={e => { e.stopPropagation(); mover(b.id, -1); }} disabled={i === 0} className="text-xs px-0.5 disabled:opacity-25" title="Subir">↑</button>
                    <button onClick={e => { e.stopPropagation(); mover(b.id, 1); }} disabled={i === bs.length - 1} className="text-xs px-0.5 disabled:opacity-25" title="Bajar">↓</button>
                    <button onClick={e => { e.stopPropagation(); duplicar(b.id); }} className="text-xs px-0.5" title="Duplicar">⧉</button>
                    <button onClick={e => { e.stopPropagation(); upd(b.id, { visible: oculto ? true : false }); }} className="text-xs px-0.5" title={oculto ? 'Mostrar' : 'Ocultar'}>{oculto ? '🙈' : '👁'}</button>
                    <button onClick={e => { e.stopPropagation(); borrar(b.id); }} className="text-xs px-0.5 text-[#DC2626]" title="Borrar">🗑</button>
                  </div>
                  <div onClick={() => setSel(b.id)} className={`cursor-pointer ${oculto ? 'opacity-40 grayscale' : ''}`} style={estiloEspacio(b.props)}>
                    {oculto && <div className="absolute top-1 left-1 z-10 text-[9px] bg-[#0D0D0D]/70 text-white rounded px-1.5 py-0.5">oculto</div>}
                    {vistaBloque(b)}
                  </div>
                  {/* Puntos de escala en las esquinas (arrastrar para ajustar tamaño) */}
                  {sel === b.id && RESIZABLE.has(b.tipo) && (['tl', 'tr', 'bl', 'br'] as const).map(c => (
                    <span key={c} onPointerDown={e => iniciarResize(e, b, c)}
                      title="Arrastra para ajustar el tamaño"
                      className={`absolute z-30 w-4 h-4 rounded-full bg-white border-2 border-[#00A89D] shadow touch-none ${c === 'tl' ? 'top-1 left-1 cursor-nwse-resize' : c === 'tr' ? 'top-1 right-1 cursor-nesw-resize' : c === 'bl' ? 'bottom-1 left-1 cursor-nesw-resize' : 'bottom-1 right-1 cursor-nwse-resize'}`} />
                  ))}
                </div>
                <Mas idx={i + 1} />
              </Fragment>
              );
            })}
            </>)}
            </>) : (
              // Pestaña Checkout: se arma bloque por bloque, igual que la página.
              lienzoCk()
            )}
          </div>
          </div>
        </div>

        {/* ── Columna 3: PROPIEDADES del bloque + Estructura + Tips ── */}
        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-2 lg:max-h-[86vh] overflow-y-auto space-y-3">
          {/* Tabs Contenido / Diseño / Avanzado */}
          <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden">
            <div className="flex border-b border-[#E8E8E8]">
              {(['contenido', 'diseno', 'avanzado'] as const).map(t => (
                <button key={t} type="button" onClick={() => setPanelTab(t)}
                  className={`flex-1 py-2.5 text-[12px] font-semibold ${panelTab === t ? 'text-[#00A89D] border-b-2 border-[#00A89D]' : 'text-[#9A9A9A] hover:text-[#6B6B6B]'}`}>
                  {t === 'diseno' ? 'Diseño' : t === 'avanzado' ? 'Avanzado' : 'Contenido'}
                </button>
              ))}
            </div>
            <div className="p-3">
              {enCk ? (
                !selCkBloque ? (
                  <div className="text-center py-8 text-[#9A9A9A]">
                    <div className="text-3xl mb-1">👆</div>
                    <div className="text-[13px] font-semibold text-[#6B6B6B]">Selecciona un bloque</div>
                    <div className="text-[11px] mt-0.5">Toca un bloque del checkout para editar su contenido.</div>
                    {ckProblemas.length > 0 && (
                      <div className="mt-3 text-left rounded-xl border border-[#F3C3CB] bg-[#FDEEF0] p-2.5 space-y-1">
                        <p className="text-[11px] font-extrabold text-[#C1121F]">⚠️ Ojo con esto</p>
                        {ckProblemas.map((t, i) => <p key={i} className="text-[11px] text-[#C1121F] leading-snug">· {t}</p>)}
                      </div>
                    )}
                  </div>
                ) : (<>
                  <div className="flex items-center gap-2 mb-3">
                    <b className="text-[13px] flex-1 truncate">{CK_META(selCkBloque).ic} {CK_META(selCkBloque).label}</b>
                  </div>
                  {panelTab === 'contenido' && <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-0.5">{propsCkContenido()}</div>}
                  {panelTab === 'diseno' && (
                    <div className="space-y-2 text-[12px] text-[#6B6B6B]">
                      <p>El checkout se ve igual en toda la página: los colores y la letra salen del color del embudo, para que no queden dos estilos distintos.</p>
                      <p className="text-[11px]">Lo que sí se ajusta por bloque (texto, tamaño, alineación, color del botón) está en <b>Contenido</b>.</p>
                    </div>
                  )}
                  {panelTab === 'avanzado' && (
                    <div className="space-y-2 text-[12px]">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={selCkBloque.visible !== false} onChange={e => ocultarCk(selCkBloque.id, !e.target.checked)} /> Mostrar este bloque en el checkout</label>
                      {avisoCk(selCkBloque) && <p className="text-[11px] text-[#C1121F] bg-[#FDEEF0] border border-[#F3C3CB] rounded-lg px-2.5 py-2 leading-snug">⚠️ {avisoCk(selCkBloque)}</p>}
                      <p className="text-[10px] text-[#9A9A9A]">Tipo de bloque: <b>{selCkBloque.tipo}</b></p>
                    </div>
                  )}
                </>)
              ) : !selBloque ? (
                <div className="text-center py-8 text-[#9A9A9A]">
                  <div className="text-3xl mb-1">👆</div>
                  <div className="text-[13px] font-semibold text-[#6B6B6B]">Selecciona un bloque</div>
                  <div className="text-[11px] mt-0.5">Toca un bloque en el lienzo para editar su contenido y configuración.</div>
                </div>
              ) : (<>
                <div className="flex items-center gap-2 mb-3">
                  <b className="text-[13px] flex-1 truncate">{nombreTipo(selBloque.tipo)}</b>
                </div>
                {panelTab === 'contenido' && <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-0.5">{editorBloque(selBloque)}</div>}
                {panelTab === 'diseno' && <div className="space-y-3">{controlEspacio(selBloque)}</div>}
                {panelTab === 'avanzado' && (
                  <div className="space-y-2 text-[12px]">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={selBloque.visible !== false} onChange={e => upd(selBloque.id, { visible: e.target.checked })} /> Mostrar este bloque en la página</label>
                    <p className="text-[10px] text-[#9A9A9A]">Tipo de bloque: <b>{selBloque.tipo}</b></p>
                  </div>
                )}
              </>)}
            </div>
          </div>

          {/* Acciones rápidas del bloque de checkout */}
          {enCk && selCkBloque && (
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-2">Acciones rápidas</p>
              <div className="space-y-1.5">
                <button type="button" onClick={() => duplicarCk(selCkBloque.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">⧉ Duplicar bloque</button>
                <button type="button" onClick={() => { const av = avisoCk(selCkBloque); if (!av || confirm(`${av}\n\n¿Lo borro igual?`)) borrarCk(selCkBloque.id); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#F3C3CB] text-[#C1121F] text-[13px] hover:bg-[#FDEEF0]">🗑 Eliminar bloque</button>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => moverCk(selCkBloque.id, -1)} className="flex-1 px-2 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">↑ Arriba</button>
                  <button type="button" onClick={() => moverCk(selCkBloque.id, 1)} className="flex-1 px-2 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">↓ Abajo</button>
                </div>
              </div>
            </div>
          )}

          {/* Acciones rápidas */}
          {!enCk && selBloque && (
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-2">Acciones rápidas</p>
              <div className="space-y-1.5">
                <button type="button" onClick={() => duplicar(selBloque.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">⧉ Duplicar bloque</button>
                <button type="button" onClick={() => borrar(selBloque.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#F3C3CB] text-[#C1121F] text-[13px] hover:bg-[#FDEEF0]">🗑 Eliminar bloque</button>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => mover(selBloque.id, -1)} className="flex-1 px-2 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">↑ Arriba</button>
                  <button type="button" onClick={() => mover(selBloque.id, 1)} className="flex-1 px-2 py-2 rounded-lg border border-[#E8E8E8] text-[13px] hover:bg-[#F5F5F5]">↓ Abajo</button>
                </div>
              </div>
            </div>
          )}

          {/* Estructura del checkout */}
          {enCk && (
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-2">Estructura del checkout</p>
              {ckLista.length === 0 ? (
                <p className="text-[11px] text-[#9A9A9A]">El checkout quedó vacío. Arrastra un bloque desde la izquierda.</p>
              ) : (
                <div className="space-y-1">
                  {ckLista.map(b => {
                    const m = CK_META(b);
                    return (
                      <div key={b.id} className={`flex items-center gap-1 rounded-lg ${selCk === b.id ? 'bg-[#00A89D]/10' : 'hover:bg-[#F5F5F5]'} ${b.visible === false ? 'opacity-50' : ''}`}>
                        <button type="button" onClick={() => setSelCk(b.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 text-[12px] text-left flex-1 min-w-0 ${selCk === b.id ? 'text-[#00847A] font-semibold' : ''}`}>
                          <span className="text-sm shrink-0">{m.ic}</span>
                          <span className="truncate flex-1">{m.label}</span>
                        </button>
                        <button type="button" title={b.visible === false ? 'Mostrar' : 'Ocultar'} onClick={() => ocultarCk(b.id, b.visible !== false)}
                          className="px-1 text-[12px] text-[#9A9A9A] hover:text-[#0D0D0D]">{b.visible === false ? '🙈' : '👁'}</button>
                        <button type="button" title="Borrar" onClick={() => { const av = avisoCk(b); if (!av || confirm(`${av}\n\n¿Lo borro igual?`)) borrarCk(b.id); }}
                          className="px-1.5 text-[12px] text-[#DC2626]">🗑</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {ckProblemas.length > 0 && (
                <div className="mt-2 rounded-xl border border-[#F3C3CB] bg-[#FDEEF0] p-2.5 space-y-1">
                  <p className="text-[11px] font-extrabold text-[#C1121F]">⚠️ Ojo con esto</p>
                  {ckProblemas.map((t, i) => <p key={i} className="text-[11px] text-[#C1121F] leading-snug">· {t}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Estructura del embudo */}
          {!enCk && (
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A9A9A] mb-2">Estructura del embudo</p>
            {bs.length === 0 ? (
              <p className="text-[11px] text-[#9A9A9A]">Aún no hay bloques. Arrastra uno desde la izquierda.</p>
            ) : (
              <div className="space-y-1">
                {bs.map(b => {
                  const m = metaTipo(b.tipo);
                  const esChk = b.tipo === 'checkout' || b.tipo === 'checkout_pro';
                  return (
                    <button key={b.id} type="button"
                      onClick={() => { setSel(b.id); setVistaTel(esChk ? 'checkout' : 'inicio'); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-left ${sel === b.id ? 'bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'hover:bg-[#F5F5F5]'} ${b.visible === false ? 'opacity-50' : ''}`}>
                      <span className="text-sm shrink-0">{m.ic}</span>
                      <span className="truncate flex-1">{m.label}</span>
                      {b.visible === false && <span className="text-[9px] text-[#9A9A9A]">oculto</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          )}

          {/* Tips */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-3">
            <p className="text-[12px] font-bold text-[#92700E] mb-0.5">💡 Tips</p>
            <p className="text-[11px] text-[#92700E]/90 leading-snug">{enCk
              ? 'Arrastra los bloques del checkout desde la izquierda. Cada dato del cliente es un bloque: se mueve, se renombra y se puede quitar. Lo que rompa el pedido te avisa antes.'
              : 'Arrastra los bloques desde el panel izquierdo al lienzo. Usa los botones + para agregar nuevas secciones. Toca un bloque para editarlo aquí a la derecha.'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Vista previa de cada bloque ─────────────────────────────────────────────
  function vistaBloque(b: BloqueLayout) {
    // Estructurales: leen los campos compartidos del embudo (d).
    if (b.tipo === 'banner_clientes') return d.imagen_clientes
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={d.imagen_clientes} alt="" className="w-full object-cover" />
      : <Vacio icono="🖼️" label="Banner de clientes — toca para subir" />;
    if (b.tipo === 'titular') return <div className="bg-[#FFF3CD] text-center py-2 px-3 font-extrabold text-[#0D0D0D] text-sm">{d.titulo || d.frases?.[0] || '🔥 ÚLTIMAS UNIDADES 🔥'}</div>;
    if (b.tipo === 'galeria') {
      const P = b.props ?? {}; const modo = P.modo === 'individual' ? 'individual' : 'carrusel';
      const src = (modo === 'individual' && P.url) ? P.url : d.imagenes?.[0];
      const esVid = esVideo(src);
      const ancho = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
      const h = Number(P.h) || 0;
      const cont = (inner: any) => <div style={{ maxWidth: `${ancho}%`, margin: ancho < 100 ? '0 auto' : undefined }}>{inner}</div>;
      if (!src) return cont(<div className="w-full aspect-square bg-[#F2F1EE] flex items-center justify-center text-4xl">📷</div>);
      const estilo = h > 0 ? { height: h } : undefined;
      return cont(esVid
        ? <video src={src} className="w-full object-cover bg-black" style={estilo} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={src} alt="" className={`w-full object-cover ${h > 0 ? '' : 'aspect-square'}`} style={estilo} />);
    }
    if (b.tipo === 'boton_comprar') return <div className="px-3 py-3"><div style={{ background: acento.boton }} className="rounded-full text-white text-center font-extrabold py-3 text-lg leading-tight">COMPRAR<br /><span className="text-sm">CONTRA ENTREGA →</span></div></div>;
    if (b.tipo === 'precio') { const P = b.props ?? {}; return (
      <div className="text-center py-2">
        {d.precio_antes ? <p className="text-base font-bold italic line-through" style={{ color: P.colorAntes || '#C1121F' }}>{P.labelAntes ?? 'Antes'} {pesos(d.precio_antes)}</p> : null}
        <p className="text-2xl font-extrabold">{P.labelHoy ?? 'HOY 🔥'} <span style={{ color: P.colorHoy || acento.texto }}>{pesos(d.precio)}</span></p>
      </div>
    ); }
    if (b.tipo === 'contador_pagina') return (
      <div className="flex justify-center gap-4 py-3 text-center">{[['09', 'HORAS'], ['59', 'MIN'], ['50', 'SEG']].map(([n, l]) => <div key={l}><div className="text-2xl font-extrabold text-[#C1121F]">{n}</div><div className="text-[9px] text-[#9A9A9A]">{l}</div></div>)}</div>
    );
    if (b.tipo === 'ultimas_unidades') { const P = b.props ?? {}; return <p className="text-center font-extrabold text-lg py-2" style={{ color: P.color || '#C1121F' }}>{P.texto || '⚠️ ÚLTIMAS UNIDADES'}</p>; }
    if (b.tipo === 'detalle') return d.imagen_detalle
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={d.imagen_detalle} alt="" className="w-full object-cover" />
      : <Vacio icono="📸" label="Foto de detalle — toca para subir" />;
    if (b.tipo === 'caracteristicas') return (
      <div className="px-4 py-2">
        <div className="font-extrabold text-xs mb-1" style={{ color: acento.texto }}>CARACTERÍSTICAS:</div>
        {(d.caracteristicas ?? []).length ? <ul className="space-y-0.5">{(d.caracteristicas as string[]).map((c, k) => <li key={k} className="text-[12px] font-semibold">✅ {c}</li>)}</ul> : <div className="text-[11px] text-[#9A9A9A]">Toca para escribir.</div>}
      </div>
    );
    if (b.tipo === 'estrellas') { const P = b.props ?? {}; const size = Number(P.size) > 0 ? Number(P.size) : 22; return <p className="text-center py-2" style={{ fontSize: size, color: P.color || undefined, letterSpacing: P.color ? 3 : undefined }}>{P.color ? '★★★★★' : '⭐⭐⭐⭐⭐'}</p>; }
    // Contenido:
    if (b.tipo === 'foto') {
      if (!b.url) return <Vacio icono="📷" label="Imagen — toca para subir" />;
      const P = b.props ?? {};
      const h = Number(P.h) || 0;
      const anchoC = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
      const ajuste = P.ajuste === 'cover' ? 'cover' : 'contain';
      return (
        <div className="p-1">
          <div className="relative mx-auto overflow-hidden" style={{ width: `${anchoC}%`, borderRadius: Number(P.redondeado) || 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.url} alt="" className="w-full block" style={{ height: h > 0 ? h : undefined, objectFit: h > 0 ? (ajuste as any) : undefined }} />
            {P.masVendido && <div className="absolute top-2 left-2 text-[10px] font-extrabold rounded-full px-2 py-0.5 shadow" style={{ background: P.mvColor || '#C1121F', color: P.mvColorTexto || '#fff' }}>{P.mvTexto || '🔥 MÁS VENDIDO'}</div>}
          </div>
        </div>
      );
    }
    if (b.tipo === 'video') return b.url ? <video src={b.url} className="w-full max-h-56 bg-black" /> : <Vacio icono="🎬" label="Video — toca para subir" />;
    if (b.tipo === 'collage') return (b.urls && b.urls.length)
      ? <div className="grid grid-cols-2 gap-1 p-1">{b.urls.map((u, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={u} alt="" className="w-full aspect-square object-cover rounded" />))}</div>
      : <Vacio icono="🖼️" label="Collage — toca para agregar" />;
    if (b.tipo === 'texto') { const P = b.props ?? {}; return <div className={`px-3 py-2 ${b.centrado ? 'text-center' : ''}`} style={P.bg ? { background: P.bg } : undefined}>{b.titulo && <div className="font-bold text-sm">{b.titulo}</div>}<div className={`text-sm whitespace-pre-line text-[#3A3A3A] ${P.bold ? 'font-extrabold' : ''}`} style={estiloTexto(b.props)}>{b.cuerpo || 'Texto…'}</div></div>; }
    if (b.tipo === 'encabezado') { const P = b.props ?? {}; return <div className="px-3 py-2" style={{ textAlign: P.align || 'center' }}><span className={P.bold !== false ? 'font-extrabold' : 'font-semibold'} style={estiloTexto(P, { size: Number(P.size) || 24 })}>{P.texto || 'Titular'}</span></div>; }
    if (b.tipo === 'enlace') { const P = b.props ?? {}; return <div className="px-3 py-2" style={{ textAlign: P.align || 'center' }}><span className="underline font-semibold" style={{ color: P.color || '#00A89D', fontSize: Number(P.size) || 15 }}>{b.texto || 'Ver más'}</span></div>; }
    if (b.tipo === 'social') { const P = b.props ?? {}; const items = (P.items as any[]) ?? []; return <div className="px-3 py-2 flex gap-3" style={{ justifyContent: P.align === 'izq' ? 'flex-start' : P.align === 'der' ? 'flex-end' : 'center' }}>{(items.length ? items : [{ red: 'whatsapp' }]).map((s, k) => <span key={k} style={{ fontSize: Number(P.size) || 30 }}>{REDES.find(r => r.key === s.red)?.ic || '🌐'}</span>)}</div>; }
    if (b.tipo === 'html') { const P = b.props ?? {}; return <div className="px-3 py-2 text-[13px] overflow-hidden" dangerouslySetInnerHTML={{ __html: String(P.html || '<span style="color:#9A9A9A">HTML…</span>') }} />; }
    if (b.tipo === 'carrusel') {
      const P = b.props ?? {};
      const urls: string[] = (P.urls as string[]) ?? [];
      const rad = Number(P.redondeado) || 0;
      const h = Number(P.h) || 0;
      const anchoC = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
      const ajuste = P.ajuste === 'contain' ? 'contain' : 'cover';
      return (
        <div className="p-2">
          <div className="relative bg-[#F2F2F2] overflow-hidden mx-auto" style={{ borderRadius: rad, height: h > 0 ? h : undefined, aspectRatio: h > 0 ? undefined : '1 / 1', width: `${anchoC}%`, maxWidth: 320 }}>
            {urls[0]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={urls[0]} alt="" className="w-full h-full" style={{ objectFit: ajuste }} />
              : <div className="w-full h-full grid place-items-center text-[#B7B4AD] text-3xl">🖼️</div>}
            {P.masVendido && <div className="absolute top-2 left-2 text-[10px] font-extrabold rounded-full px-2 py-0.5 shadow" style={{ background: P.mvColor || '#C1121F', color: P.mvColorTexto || '#fff' }}>{P.mvTexto || '🔥 MÁS VENDIDO'}</div>}
          </div>
          {P.miniaturas !== false && urls.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 overflow-x-auto">
              {urls.slice(0, 6).map((u, k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={u} alt="" className="w-10 h-10 rounded object-cover shrink-0 border border-[#E8E8E8]" />
              ))}
            </div>
          )}
          {urls.length === 0 && <p className="text-[10px] text-[#9A9A9A] text-center mt-1">Sube fotos en el panel de la izquierda.</p>}
        </div>
      );
    }
    if (b.tipo === 'espaciador') return <div style={{ height: (b.altura ?? 24) }} className="bg-[repeating-linear-gradient(45deg,#F5F5F5,#F5F5F5_6px,#EDEDED_6px,#EDEDED_12px)]" />;
    if (b.tipo === 'separador') return <div className="mx-4 my-2 border-t border-[#DADADA]" />;
    if (b.tipo === 'contador') return <div className="flex justify-center gap-4 py-3 text-center">{[['09', 'HORAS'], ['59', 'MIN'], ['50', 'SEG']].map(([n, l]) => <div key={l}><div className="text-2xl font-extrabold text-[#C1121F]">{n}</div><div className="text-[9px] text-[#9A9A9A]">{l}</div></div>)}</div>;
    if (b.tipo === 'beneficios') return <div className="px-4 py-2">{b.titulo && <div className="font-extrabold text-sm mb-1" style={{ color: acento.texto }}>{b.titulo}</div>}<ul className="space-y-0.5">{((b.items as string[]) ?? []).map((it, k) => <li key={k} className="text-[13px] font-semibold">✅ {it}</li>)}</ul></div>;
    if (b.tipo === 'garantia') return <div className="mx-3 my-2 rounded-xl border-2 border-[#0D8A3E]/30 bg-[#0D8A3E]/[0.06] p-3 text-center"><div className="text-2xl">🏅</div><div className="font-extrabold text-sm text-[#0D8A3E]">{b.titulo || 'COMPRA SIN RIESGO'}</div>{b.cuerpo && <div className="text-[12px] text-[#3A3A3A] mt-0.5">{b.cuerpo}</div>}</div>;
    if (b.tipo === 'confianza') return <div className="flex flex-wrap justify-center gap-2 px-3 py-2">{((b.items as string[]) ?? []).map((it, k) => <span key={k} className="text-[11px] font-semibold bg-[#F2F1EE] rounded-full px-2.5 py-1">{it}</span>)}</div>;
    if (b.tipo === 'testimonios') { const P = b.props ?? {}; const titulo = P.titulo ?? b.titulo ?? 'LO QUE DICEN NUESTROS CLIENTES'; return (
      <div className="px-3 py-2.5 space-y-3">
        {titulo && (
          <div className="text-center">
            <div className="font-extrabold text-sm leading-tight" style={estiloTexto({ font: P.tituloFont, color: P.tituloColor, size: P.tituloSize }, { color: acento.texto })}>{titulo}</div>
            <div className="mx-auto mt-1 h-[3px] w-12 rounded-full" style={{ background: acento.texto, opacity: 0.85 }} />
          </div>
        )}
        {((b.items as any[]) ?? []).map((t, k) => {
          const est = Math.max(1, Math.min(5, Number(t?.estrellas ?? 5) || 5));
          const ini = String(t?.nombre ?? '?').trim().charAt(0).toUpperCase() || '★';
          return (
            <div key={k} className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: t?.gatillo ? '0 6px 18px -8px rgba(193,18,31,0.28)' : '0 5px 16px -10px rgba(0,0,0,0.22)', border: `1px solid ${t?.gatillo ? 'rgba(193,18,31,0.35)' : 'rgba(0,0,0,0.06)'}`, borderLeft: `4px solid ${t?.gatillo ? '#C1121F' : acento.texto}` }}>
              <div className="flex gap-2 p-2.5">
                {t?.foto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.foto} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" style={{ boxShadow: '0 0 0 2px #fff, 0 3px 8px -2px rgba(0,0,0,0.25)' }} />
                  : <div className="w-14 h-14 rounded-lg shrink-0 grid place-items-center text-white text-lg font-extrabold" style={{ background: acento.texto }}>{ini}</div>}
                <div className="min-w-0 flex-1">
                  {t?.gatillo && <div className="inline-block text-[9px] font-extrabold text-white bg-[#C1121F] rounded-full px-1.5 py-0.5 mb-0.5">🆕 NUEVA RESEÑA</div>}
                  <div className="text-[12px] font-extrabold text-[#1A1A1A] leading-tight">{t?.nombre}</div>
                  <div className="text-[13px] leading-none mt-0.5" style={{ color: '#FFB300', letterSpacing: '1px' }}>{'★'.repeat(est)}<span style={{ color: '#E3E0D8' }}>{'★'.repeat(5 - est)}</span></div>
                  {t?.texto && <div className="text-[11.5px] text-[#42423E] italic mt-1 leading-snug">&ldquo;{t.texto}&rdquo;</div>}
                </div>
              </div>
              {t?.boton && <div className="px-2.5 pb-2.5 flex" style={{ justifyContent: t?.botonAlign === 'izq' ? 'flex-start' : t?.botonAlign === 'der' ? 'flex-end' : 'center' }}><div className="text-white text-center font-extrabold rounded-full py-1.5 text-[11px]" style={{ width: `${t?.botonAncho ?? 100}%`, background: t?.botonColor || acento.boton }}>{t?.botonTexto || '🛒 LO QUIERO'}</div></div>}
            </div>
          );
        })}
      </div>
    ); }
    if (b.tipo === 'faq') return <div className="px-3 py-2 space-y-1">{((b.items as any[]) ?? []).map((f, k) => <div key={k} className="rounded-lg border border-[#EEE] p-2"><div className="text-[12px] font-bold">❓ {f.pregunta}</div><div className="text-[11px] text-[#6B6B6B] mt-0.5">{f.respuesta}</div></div>)}</div>;
    if (b.tipo === 'boton') { const p = b.props ?? {}; const v = botonVariante(p.variante, p.bg || '#00A89D'); const colTxt = (v.style as any).color || '#FFFFFF'; return <div className="px-3 py-2"><div className={`py-2 text-sm ${v.className} ${p.compacto ? 'mx-auto w-fit px-8' : ''}`} style={v.style}><span style={estiloTexto(b.props, { color: colTxt })}>{b.texto || 'COMPRAR'}</span></div>{p.flotante && <div className="text-[9px] text-[#00847A] font-semibold text-center mt-1">📌 Se muestra fijo abajo en la página</div>}</div>; }
    if (b.tipo === 'mas_vendido') { const p = b.props ?? {}; return <div className="px-3 py-2"><div className={`rounded-full text-center font-extrabold py-2.5 text-sm shadow ${p.flotante ? 'w-fit mx-auto px-5' : ''}`} style={{ background: p.color || '#C1121F', color: p.colorTexto || '#fff' }}>{p.emoji ?? '🔥'} {p.texto || 'EL MÁS VENDIDO'}</div>{p.flotante && <div className="text-[9px] text-[#00847A] font-semibold text-center mt-1">📌 Flotante en la página ({p.posicion || 'bottom-right'})</div>}</div>; }
    if (b.tipo === 'stock') {
      const p = b.props ?? {};
      const pct = Math.max(0, Math.min(100, Number(p.barraInicial ?? p.porcentaje ?? 31)));
      const titulo = p.titulo ?? p.texto ?? 'EL STOCK SE ESTÁ AGOTANDO';
      const anchoB = Number(p.ancho) > 0 ? Number(p.ancho) : 100;
      return (
        <div className={claseAnim(p.anim)} style={{ maxWidth: anchoB < 100 ? `${anchoB}%` : undefined, margin: anchoB < 100 ? '0 auto' : undefined }}>
          <div className="px-4 py-2 text-center">
            {titulo && <div className="font-extrabold text-[13px]" style={estiloTexto({ font: p.tituloFont, color: p.tituloColor, size: p.tituloSize }, { color: '#0D0D0D', size: 13 })}>{titulo}</div>}
            <div className="h-2.5 rounded-full bg-[#EEE] overflow-hidden mt-1.5"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color || '#F59E0B' }} /></div>
            {p.mensaje && <p className="text-[11px] text-[#6B6B6B] mt-1.5">{p.mensaje}</p>}
            {p.alerta && <p className="text-[12px] font-extrabold mt-0.5" style={{ color: p.alertaColor || '#B45309' }}>{p.alerta}</p>}
          </div>
        </div>
      );
    }
    if (b.tipo === 'ventas') { const p = b.props ?? {}; return <div className="px-3 py-2"><div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: p.color || '#0D0D0D', color: p.colorTexto || '#fff' }}><span>{p.emoji ?? '🛒'}</span><div><div className="text-[9px] uppercase opacity-80 font-bold">{p.titulo || 'Venta reciente'}</div><div className="text-[11px] font-semibold">{(p.items?.[0]) || 'Alguien acaba de comprar 🎉'}</div></div></div><div className="text-[10px] text-[#9A9A9A] mt-1">Flotante en la página (esquina {p.posicion || 'bottom-right'}).</div></div>; }
    if (b.tipo === 'gatillos') {
      const P = b.props ?? {};
      const barra = P.barra == null ? 31 : Math.max(0, Math.min(100, Number(P.barra) || 0));
      const forma = botonVariante(P.botonForma || 'redondeado', P.botonColor || '#1E9E5A');
      const anchoB = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
      const sellos: string[] = Array.isArray(P.sellos) ? P.sellos.filter(Boolean) : [];
      const tamOf = Number(P.tamOferta) > 0 ? Number(P.tamOferta) : 12;
      const tamPr = Number(P.tamPrecio) > 0 ? Number(P.tamPrecio) : 28;
      return (
        <div className={claseAnim(P.anim)} style={{ maxWidth: anchoB < 100 ? `${anchoB}%` : undefined, margin: anchoB < 100 ? '0 auto' : undefined }}>
          <div className="mx-2 my-2 rounded-xl border-2 p-2.5" style={{ borderColor: '#EAE7E0' }}>
            <div className="grid grid-cols-2 gap-2 items-center">
              <div>
                <div className="font-extrabold leading-tight" style={estiloTexto({ font: P.tituloFont, color: P.tituloColor, size: P.tituloSize }, { color: '#C1121F', size: 16 })}>{P.titulo || 'OFERTA LIMITADA'}</div>
                {P.mensaje && <div className="mt-0.5 font-semibold text-[11px]" style={estiloTexto({ color: P.mensajeColor, size: P.mensajeSize }, { color: '#0D0D0D', size: 11 })}>{P.mensaje}</div>}
                <div className="mt-1.5 h-2 rounded-full bg-[#EEE] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${barra}%`, background: P.barraColor || '#C1121F' }} /></div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[#6B6B6B]" style={{ fontSize: Math.min(tamOf, 12) }}>{P.etiquetaNormal || 'PRECIO NORMAL'}</div>
                {d.precio_antes ? <div className="line-through font-extrabold text-[#C1121F]" style={{ fontSize: Math.min(tamOf, 12) + 2 }}>{pesos(d.precio_antes)}</div> : null}
                <div className="font-bold text-[#0D0D0D] mt-0.5" style={{ fontSize: Math.min(tamOf, 12) }}>{P.etiquetaOferta || 'OFERTA LIMITADA'}</div>
                <div className="font-extrabold leading-none" style={{ fontSize: Math.min(tamPr, 24), color: P.precioColor || '#C1121F' }}>{pesos(d.precio)}</div>
              </div>
            </div>
            {P.instruccion && <p className="text-center mt-2 text-[11px]" style={estiloTexto({ color: P.instruccionColor, size: P.instruccionSize }, { color: '#6B6B6B', size: 11 })}>{P.instruccion}</p>}
            <div className={`mt-2 ${forma.className}`} style={{ ...forma.style, width: `${Number(P.botonAncho) > 0 ? Number(P.botonAncho) : 100}%`, margin: '0 auto', paddingTop: 10, paddingBottom: 10 }}>
              <span className="flex items-center justify-center gap-1.5" style={{ fontSize: Number(P.botonLetra) > 0 ? Math.min(Number(P.botonLetra), 16) : 14 }}>{P.botonTexto || 'CLIC AQUI PARA COMPRAR'} <span>→</span></span>
            </div>
            {sellos.length > 0 && <div className="flex flex-wrap justify-center gap-1.5 mt-2">{sellos.map((s, k) => <span key={k} className="text-[10px] font-semibold bg-[#F2F1EE] rounded-full px-2 py-0.5">{s}</span>)}</div>}
          </div>
        </div>
      );
    }
    if (b.tipo === 'checkout' || b.tipo === 'checkout_pro') {
      const vs: any[] = d.variantes ?? [];
      const v0: any = vs[0] || null;
      const img0: string | null = v0?.imagen || d.imagenes?.[0] || null;
      const nombre0: string = v0?.nombre || d.producto || 'Tu producto';
      const precio0: number = (typeof v0?.precio === 'number' ? v0.precio : d.precio) || 0;
      const norm = (ops: any[]) => (ops ?? []).map((o: any) => (typeof o === 'string' ? { valor: o } : o)).filter((o: any) => o?.valor);
      const selectores: any[] = Array.isArray(v0?.selectores) ? v0.selectores : [];
      const tieneTallaSel = selectores.some(s => /talla/i.test(s?.etiqueta || ''));
      const tallas0: string[] = (!tieneTallaSel && Array.isArray(v0?.tallas) && v0.tallas.length) ? v0.tallas
        : (!tieneTallaSel && Array.isArray(d.tallas) ? d.tallas : []);
      const chip = 'text-[10px] border border-[#DDD] rounded-md px-2 py-1 bg-white flex items-center gap-1';
      const lbl = 'text-[9px] font-extrabold tracking-wide text-[#0D0D0D] mt-1';
      return (
        <div className="px-3 py-3 bg-white space-y-2.5">
          {b.tipo === 'checkout_pro' && <div className="text-[9px] font-extrabold text-[#00847A] text-center">⚡ CHECKOUT PRO</div>}
          <div className="text-center font-extrabold text-[13px]">Completa tus datos 👇</div>

          {/* Tarjeta del producto */}
          <div className="flex items-center gap-2 rounded-xl border border-[#E8E8E8] p-2">
            {img0
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={img0} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              : <div className="w-12 h-12 rounded-lg bg-[#F2F1EE] grid place-items-center text-lg shrink-0">📦</div>}
            <div className="min-w-0">
              <div className="text-[11px] font-bold truncate">{nombre0}</div>
              <div className="text-[12px] font-extrabold" style={{ color: acento.texto }}>{pesos(precio0)}</div>
            </div>
          </div>

          {/* Selectores del producto (color, talla…) */}
          {selectores.map((s: any, si: number) => {
            const ops = norm(s.opciones).slice(0, 8);
            if (!ops.length) return null;
            return (
              <div key={si}>
                <div className={lbl}>{(s.etiqueta || 'OPCIÓN').toUpperCase()}</div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {ops.map((o: any, k: number) => (
                    <span key={k} className={chip}>
                      {o.imagen
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={o.imagen} alt="" className="w-4 h-4 rounded object-cover" /> : null}
                      {o.valor}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {tallas0.length > 0 && (
            <div>
              <div className={lbl}>TALLA</div>
              <div className="flex gap-1 flex-wrap mt-1">{tallas0.slice(0, 8).map((t, k) => <span key={k} className={chip}>{t}</span>)}</div>
            </div>
          )}

          {/* Datos del cliente */}
          {[['NOMBRE', 'Ej: María'], ['WHATSAPP', '3001234567'], ['DIRECCIÓN', 'Calle 1 # 2-3']].map(([l, ph]) => (
            <div key={l}>
              <div className={lbl}>{l}</div>
              <div className="h-7 rounded-lg bg-white border border-[#E8E8E8] flex items-center px-2 text-[10px] text-[#B5B5B5] mt-1">{ph}</div>
            </div>
          ))}

          {/* Total + botón */}
          <div className="flex items-center justify-between rounded-lg bg-[#F4F7F6] px-2.5 py-2 mt-1">
            <span className="text-[11px] font-bold">TOTAL A PAGAR</span>
            <span className="text-[13px] font-extrabold" style={{ color: acento.texto }}>{pesos(precio0)}</span>
          </div>
          <div style={{ background: acento.boton }} className="rounded-full text-white text-center font-extrabold py-2.5 text-sm shadow">✅ COMPLETAR MI PEDIDO</div>
        </div>
      );
    }
    return <Vacio icono="❔" label={b.tipo} />;
  }

  // ── Editor de cada bloque ───────────────────────────────────────────────────
  function editorBloque(b: BloqueLayout) {
    // Estructurales → editan campos compartidos del embudo.
    if (b.tipo === 'banner_clientes' || b.tipo === 'detalle') {
      const campo = b.tipo === 'banner_clientes' ? 'imagen_clientes' : 'imagen_detalle';
      return (
        <div className="flex gap-2 flex-wrap">
          <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer">
            {subiendo === campo ? 'Subiendo…' : (d[campo] ? 'Cambiar' : 'Subir')}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCampo(campo, f); e.target.value = ''; }} />
          </label>
          {d[campo] && <button onClick={() => onCampo(campo, null)} className="text-[11px] px-3 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]">Quitar</button>}
        </div>
      );
    }
    if (b.tipo === 'titular') return <textarea value={d.titulo ?? ''} onChange={e => onCampo('titulo', e.target.value)} rows={2} className={inp} placeholder="Título…" />;
    if (b.tipo === 'galeria') {
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      const modo = P.modo === 'individual' ? 'individual' : 'carrusel';
      const imgs: string[] = d.imagenes ?? [];
      const setImgs = (nv: string[]) => onCampo('imagenes', nv);
      const subirVarias = async (files: FileList) => {
        setSubiendo('galeria');
        try {
          const nuevas: string[] = [];
          for (const f of Array.from(files)) { const url = await subir(f); if (url) nuevas.push(url); }
          if (nuevas.length) setImgs([...(d.imagenes ?? []), ...nuevas]);
        } finally { setSubiendo(null); }
      };
      const esVid = esVideo(P.url);
      const h = Number(P.h) || 0;
      const ancho = Number(P.ancho) > 0 ? Number(P.ancho) : 100;
      const lblS = 'block text-[10px] font-mono uppercase tracking-wider text-[#8A9793] mb-1';
      const seg = (on: boolean) => `rounded-lg py-1.5 text-[12px] font-semibold border ${on ? 'bg-[#00A89D] text-white border-[#00A89D]' : 'bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#F5F5F5]'}`;
      return (
        <div className="space-y-3">
          {/* ARCHIVO (foto/gif/video propio del bloque) */}
          <div>
            <label className={lblS}>Archivo</label>
            <label className="block border border-dashed border-[#00A89D] bg-[#E9F7F5] rounded-xl p-3 text-center text-[12px] font-semibold text-[#00847A] cursor-pointer hover:bg-[#DCF1EE]">
              {subiendo === 'galeria-uno' ? 'Subiendo…' : (P.url ? '📎 Cambiar archivo' : '📎 Subir o arrastrar archivo')}
              <span className="block text-[10px] font-normal text-[#8A9793]">Foto, GIF o video</span>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { setSubiendo('galeria-uno'); try { const url = await subir(f); if (url) setP({ url }); } finally { setSubiendo(null); } } (e.target as HTMLInputElement).value = ''; }} />
            </label>
            {P.url && <div className="mt-1.5 relative">{esVid
              ? <video src={P.url} className="w-full max-h-40 rounded-lg bg-black" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={P.url} alt="" className="w-full max-h-40 object-cover rounded-lg" />}
              <button onClick={() => setP({ url: '' })} className="absolute top-1 right-1 bg-[#DC2626] text-white rounded-full w-5 h-5 text-[11px] leading-none shadow">×</button></div>}
          </div>
          {/* CÓMO SE VE */}
          <div>
            <label className={lblS}>Cómo se ve</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setP({ modo: 'individual' })} className={seg(modo === 'individual')}>Foto/Video</button>
              <button onClick={() => setP({ modo: 'carrusel' })} className={seg(modo === 'carrusel')}>Carrusel</button>
            </div>
          </div>
          {/* FOTOS DEL CARRUSEL */}
          {modo === 'carrusel' && (
            <div>
              <label className={lblS}>Fotos del carrusel</label>
              <label className="block border border-dashed border-[#00A89D] bg-[#E9F7F5] rounded-xl p-2.5 text-center text-[12px] font-semibold text-[#00847A] cursor-pointer hover:bg-[#DCF1EE]">
                {subiendo === 'galeria' ? 'Subiendo…' : '➕ Subir varias fotos (elige varias a la vez)'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) subirVarias(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
              </label>
              {imgs.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {imgs.map((u, k) => (
                    <div key={k} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="w-full aspect-square object-cover rounded-lg border border-[#E8E8E8]" />
                      <button onClick={() => setImgs(imgs.filter((_, j) => j !== k))} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-[11px] leading-none shadow">×</button>
                      <div className="absolute bottom-0.5 inset-x-0.5 flex justify-between">
                        <button onClick={() => { if (k > 0) { const a = [...imgs]; [a[k - 1], a[k]] = [a[k], a[k - 1]]; setImgs(a); } }} disabled={k === 0} className="text-white bg-black/50 rounded px-1 text-[10px] leading-tight disabled:opacity-20">‹</button>
                        <button onClick={() => { if (k < imgs.length - 1) { const a = [...imgs]; [a[k + 1], a[k]] = [a[k], a[k + 1]]; setImgs(a); } }} disabled={k === imgs.length - 1} className="text-white bg-black/50 rounded px-1 text-[10px] leading-tight disabled:opacity-20">›</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[10px] text-[#9A9A9A] mt-1">Sube fotos para el carrusel. La 1ª es la principal; usa ‹ › y ×.</p>}
            </div>
          )}
          {/* ALTO */}
          <div>
            <label className={lblS}>Alto {h === 0 ? '· Automático' : `· ${h}px`}</label>
            <input type="range" min={0} max={600} step={10} value={h} onChange={e => setP({ h: Number(e.target.value) })} className="w-full accent-[#00A89D]" />
            <p className="text-[10px] text-[#9A9A9A]">0 = tamaño original.</p>
          </div>
          {/* ANIMACIÓN */}
          <div>
            <label className={lblS}>Animación</label>
            <select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>
              {ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          {/* ANCHO DEL BLOQUE */}
          <div>
            <label className={lblS}>Ancho del bloque · {ancho}%</label>
            <input type="range" min={50} max={100} step={5} value={ancho} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" />
            <p className="text-[10px] text-[#9A9A9A]">100% = ancho completo. Menos lo hace más angosto y centrado.</p>
          </div>
        </div>
      );
    }
    if (b.tipo === 'precio') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-[#6B6B6B]">Precios</label>
        <input type="number" value={d.precio ?? ''} onChange={e => onCampo('precio', Number(e.target.value))} placeholder="Precio hoy" className={inp} />
        <input type="number" value={d.precio_antes ?? ''} onChange={e => onCampo('precio_antes', e.target.value ? Number(e.target.value) : null)} placeholder="Precio tachado" className={inp} />
        <label className="text-[11px] font-semibold text-[#6B6B6B]">Etiquetas</label>
        <div className="flex gap-2">
          <input value={P.labelHoy ?? ''} onChange={e => setP({ labelHoy: e.target.value })} placeholder="HOY 🔥" className={inp} />
          <input value={P.labelAntes ?? ''} onChange={e => setP({ labelAntes: e.target.value })} placeholder="Antes" className={inp} />
        </div>
        <div className="flex gap-3 items-end">
          <div><label className="text-[10px] text-[#6B6B6B] block">Precio hoy</label><SelectorColor value={P.colorHoy ?? '#00A89D'} onChange={v => setP({ colorHoy: v })} /></div>
          <div><label className="text-[10px] text-[#6B6B6B] block">Tachado</label><SelectorColor value={P.colorAntes ?? '#C1121F'} onChange={v => setP({ colorAntes: v })} /></div>
        </div>
      </div>
    ); }
    if (b.tipo === 'contador_pagina') return <div><label className="text-[11px] font-semibold text-[#6B6B6B]">Horas del contador</label><input type="number" value={d.horas_contador ?? 10} onChange={e => onCampo('horas_contador', Number(e.target.value))} className={inp} /></div>;
    if (b.tipo === 'caracteristicas') return <textarea rows={4} className={inp} value={(d.caracteristicas ?? []).join('\n')} onChange={e => onCampo('caracteristicas', e.target.value.split('\n'))} placeholder={'Una por línea…'} />;
    if (b.tipo === 'boton_comprar') return <p className="text-[11px] text-[#6B6B6B]">Este bloque no tiene ajustes. Puedes moverlo, duplicarlo o borrarlo con su barra.</p>;
    if (b.tipo === 'ultimas_unidades') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-[#6B6B6B]">Texto</label>
        <input value={P.texto ?? ''} onChange={e => setP({ texto: e.target.value })} placeholder="⚠️ ÚLTIMAS UNIDADES" className={inp} />
        <div><label className="text-[10px] text-[#6B6B6B] block">Color</label><SelectorColor value={P.color ?? '#C1121F'} onChange={v => setP({ color: v })} /></div>
      </div>
    ); }
    if (b.tipo === 'estrellas') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); const size = Number(P.size) > 0 ? Number(P.size) : 26; return (
      <div className="space-y-2">
        <div><label className="text-[11px] font-semibold text-[#6B6B6B]">Tamaño · {size}px</label><input type="range" min={16} max={48} step={2} value={size} onChange={e => setP({ size: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
        <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
          <input type="checkbox" checked={!!P.color} onChange={e => setP({ color: e.target.checked ? '#F5A623' : '' })} /> Color propio
          {P.color && <SelectorColor value={P.color} onChange={v => setP({ color: v })} />}
        </label>
        <p className="text-[10px] text-[#9A9A9A]">Sin color propio se ven las estrellas amarillas ⭐. Con color, se pintan del tono que elijas.</p>
      </div>
    ); }

    // ── IMAGEN (foto): editor completo ──
    if (b.tipo === 'foto') {
      const P = b.props ?? {};
      const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      return (
        <div className="space-y-3">
          {/* Fuente: link o subir (Navegar) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B6B]">Imagen · link</label>
            <div className="flex gap-2 mt-1">
              <input value={b.url ?? ''} onChange={e => upd(b.id, { url: e.target.value })} placeholder="https://…" className={inp} />
              <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#00A89D]/40 bg-[#E9F7F5] text-[#00847A] font-semibold cursor-pointer shrink-0 whitespace-nowrap">{subiendo === b.id ? 'Subiendo…' : 'Navegar…'}<input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirEnBloque(b.id, f); e.target.value = ''; }} /></label>
            </div>
          </div>

          {/* AGREGAR IMAGEN: área grande (si aún no hay imagen) o vista de la actual */}
          {!b.url ? (
            <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#00A89D]/50 rounded-xl bg-[#E9F7F5] py-8 cursor-pointer hover:bg-[#DDF3F0]">
              <span className="text-3xl text-[#00847A] leading-none">＋</span>
              <span className="text-[11px] font-bold text-[#00847A]">AGREGAR IMAGEN</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirEnBloque(b.id, f); e.target.value = ''; }} />
            </label>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.url} alt="" className="w-full max-h-40 object-contain rounded-lg border border-[#E8E8E8] bg-[#FAFAF8]" />
          )}

          {/* Enlace al hacer clic (opcional) */}
          <input value={P.link ?? ''} onChange={e => setP({ link: e.target.value })} placeholder="Al tocar la imagen ir a… (opcional)" className={inp} />

          {/* Botón "Más vendido" (editable) */}
          <div className="rounded-lg border border-[#E8E8E8] p-2.5 space-y-2">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#3A3A3A]"><input type="checkbox" checked={!!P.masVendido} onChange={e => setP({ masVendido: e.target.checked })} /> 🔥 Botón “Más vendido”</label>
            {P.masVendido && (<>
              <input value={P.mvTexto ?? ''} onChange={e => setP({ mvTexto: e.target.value })} placeholder="🔥 MÁS VENDIDO" className={inp} />
              <div className="flex gap-2 items-end">
                <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={P.mvColor ?? '#C1121F'} onChange={v => setP({ mvColor: v })} /></div>
                <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={P.mvColorTexto ?? '#FFFFFF'} onChange={v => setP({ mvColorTexto: v })} /></div>
              </div>
            </>)}
          </div>

          {/* Animación */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B6B6B]">Animación</label>
            <select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
          </div>

          {/* Tamaño responsive + esquinas */}
          <p className="text-[10px] text-[#00847A] bg-[#E9F7F5] rounded px-2 py-1">✥ Tip: arrastra las <b>esquinas</b> de la imagen en el teléfono para ajustar su tamaño.</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-[#6B6B6B]">Alto · {Number(P.h) || 0 ? `${P.h}px` : 'original'}</label><input type="range" min={0} max={640} step={10} value={Number(P.h) || 0} onChange={e => setP({ h: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Ancho · {Number(P.ancho) > 0 ? Number(P.ancho) : 100}%</label><input type="range" min={30} max={100} value={Number(P.ancho) > 0 ? Number(P.ancho) : 100} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Esquinas · {Number(P.redondeado) || 0}px</label><input type="range" min={0} max={40} value={Number(P.redondeado) || 0} onChange={e => setP({ redondeado: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div className="flex items-end"><button onClick={() => setP({ h: 0, ancho: 100 })} className="text-[10px] text-[#00847A] font-semibold border border-[#E8E8E8] rounded-lg px-2 py-1 w-full hover:bg-[#F5F5F5]">↺ Tamaño original</button></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6B6B]">Ajuste</label>
            <select value={P.ajuste ?? 'contain'} onChange={e => setP({ ajuste: e.target.value })} className={inp}><option value="contain">Tamaño original (no recorta)</option><option value="cover">Rellenar (recorta)</option></select>
          </div>
        </div>
      );
    }

    // Contenido → editan la data del propio bloque.
    if (b.tipo === 'foto' || b.tipo === 'video') return (
      <div className="flex gap-2">
        <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer shrink-0">
          {subiendo === b.id ? 'Subiendo…' : (b.url ? 'Cambiar' : 'Subir ' + b.tipo)}
          <input type="file" accept={b.tipo === 'foto' ? 'image/*' : 'video/*'} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirEnBloque(b.id, f); e.target.value = ''; }} />
        </label>
        <input value={b.url ?? ''} onChange={e => upd(b.id, { url: e.target.value })} placeholder="o pega enlace" className={inp} />
      </div>
    );
    if (b.tipo === 'carrusel') {
      const P = b.props ?? {};
      const urls: string[] = (P.urls as string[]) ?? [];
      const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      const quitar = (k: number) => setP({ urls: urls.filter((_, j) => j !== k) });
      const reordenar = (from: number, to: number) => { if (from === to || from < 0 || to < 0 || from >= urls.length || to >= urls.length) return; const a = [...urls]; const [m] = a.splice(from, 1); a.splice(to, 0, m); setP({ urls: a }); };
      return (
        <div className="space-y-3">
          {/* ARCHIVO: agregar fotos al carrusel */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B6B]">Archivo</label>
            <label className="mt-1 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#00A89D]/50 rounded-xl bg-[#E9F7F5] py-6 cursor-pointer hover:bg-[#DDF3F0]">
              <span className="text-3xl text-[#00847A] leading-none">＋</span>
              <span className="text-[11px] font-bold text-[#00847A]">{subiendo === b.id ? 'Subiendo…' : 'AGREGAR FOTO AL CARRUSEL'}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) subirCarrusel(b.id, e.target.files); (e.target as HTMLInputElement).value = ''; }} />
            </label>
          </div>

          {/* Miniaturas: reordenar arrastrando + quitar */}
          {urls.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-[#6B6B6B]">Mover orden arrastrando</label>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {urls.map((u, k) => (
                  <div key={k} draggable
                    onDragStart={() => setDragFoto(k)}
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={() => { if (dragFoto !== null) reordenar(dragFoto, k); setDragFoto(null); }}
                    onDragEnd={() => setDragFoto(null)}
                    className={`relative cursor-grab active:cursor-grabbing ${dragFoto === k ? 'opacity-40' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="w-full aspect-square object-cover rounded-lg border border-[#E8E8E8]" />
                    <button onClick={() => quitar(k)} className="absolute -top-1 -right-1 bg-[#DC2626] text-white rounded-full w-4 h-4 text-[10px] leading-none">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón "Más vendido" (editable) */}
          <div className="rounded-lg border border-[#E8E8E8] p-2.5 space-y-2">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#3A3A3A]"><input type="checkbox" checked={!!P.masVendido} onChange={e => setP({ masVendido: e.target.checked })} /> 🔥 Botón “Más vendido”</label>
            {P.masVendido && (<>
              <input value={P.mvTexto ?? ''} onChange={e => setP({ mvTexto: e.target.value })} placeholder="🔥 MÁS VENDIDO" className={inp} />
              <div className="flex gap-2 items-end">
                <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={P.mvColor ?? '#C1121F'} onChange={v => setP({ mvColor: v })} /></div>
                <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={P.mvColorTexto ?? '#FFFFFF'} onChange={v => setP({ mvColorTexto: v })} /></div>
              </div>
            </>)}
          </div>

          {/* Animación */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B6B6B]">Animación</label>
            <select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
          </div>

          {/* Tamaño (alto/ancho) + esquinas — también se ajusta arrastrando las esquinas en el teléfono */}
          <p className="text-[10px] text-[#00847A] bg-[#E9F7F5] rounded px-2 py-1">✥ Tip: arrastra las <b>esquinas</b> del bloque en el teléfono para ajustar el tamaño.</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-[#6B6B6B]">Alto · {Number(P.h) || 0 ? `${P.h}px` : 'auto'}</label><input type="range" min={0} max={640} step={10} value={Number(P.h) || 0} onChange={e => setP({ h: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Ancho · {Number(P.ancho) > 0 ? Number(P.ancho) : 100}%</label><input type="range" min={40} max={100} value={Number(P.ancho) > 0 ? Number(P.ancho) : 100} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Esquinas · {Number(P.redondeado) || 0}px</label><input type="range" min={0} max={40} value={Number(P.redondeado) || 0} onChange={e => setP({ redondeado: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div className="flex items-end"><button onClick={() => setP({ h: 0, ancho: 100 })} className="text-[10px] text-[#00847A] font-semibold border border-[#E8E8E8] rounded-lg px-2 py-1 w-full hover:bg-[#F5F5F5]">↺ Tamaño automático</button></div>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-[11px] text-[#6B6B6B]">Ajuste de imagen</label>
            <select value={P.ajuste ?? 'cover'} onChange={e => setP({ ajuste: e.target.value })} className={inp}><option value="cover">Rellenar (cover)</option><option value="contain">Mostrar completa (contain)</option></select>
          </div>

          {/* Opciones de reproducción */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={P.autoplay !== false} onChange={e => setP({ autoplay: e.target.checked })} /> Pasar solo (automático)</label>
            {P.autoplay !== false && <div className="pl-6"><label className="text-[10px] text-[#6B6B6B]">Cada · {Number(P.segundos) || 3}s</label><input type="range" min={1} max={8} value={Number(P.segundos) || 3} onChange={e => setP({ segundos: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>}
            <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={P.dots !== false} onChange={e => setP({ dots: e.target.checked })} /> Mostrar puntos (•••)</label>
            <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={P.miniaturas !== false} onChange={e => setP({ miniaturas: e.target.checked })} /> Mostrar miniaturas debajo</label>
          </div>
        </div>
      );
    }
    if (b.tipo === 'collage') return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">{(b.urls ?? []).map((u, k) => (
          <div key={k} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-full aspect-square object-cover rounded" />
            <button onClick={() => upd(b.id, { urls: (b.urls ?? []).filter((_, j) => j !== k) })} className="absolute -top-1 -right-1 bg-[#DC2626] text-white rounded-full w-4 h-4 text-[10px] leading-none">×</button>
          </div>))}
        </div>
        <label className="text-[11px] px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white cursor-pointer inline-block">{subiendo === b.id ? 'Subiendo…' : '+ Agregar foto'}<input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirCollage(b.id, f); e.target.value = ''; }} /></label>
      </div>
    );
    if (b.tipo === 'texto') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <input value={b.titulo ?? ''} onChange={e => upd(b.id, { titulo: e.target.value })} placeholder="Título (opcional)" className={inp} />
        <textarea value={b.cuerpo ?? ''} onChange={e => upd(b.id, { cuerpo: e.target.value })} rows={3} placeholder="Texto…" className={inp} />
        <MiniBarraTexto font={P.font} color={P.color} size={P.size}
          onFont={v => setP({ font: v })} onColor={v => setP({ color: v })} onSize={v => setP({ size: v })}
          onEmoji={em => upd(b.id, { cuerpo: (b.cuerpo ?? '') + em })} sizeMin={12} sizeMax={40} />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!b.centrado} onChange={e => upd(b.id, { centrado: e.target.checked })} /> Centrar</label>
          <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!P.bold} onChange={e => setP({ bold: e.target.checked })} /> Negrita fuerte</label>
          <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]">
            <input type="checkbox" checked={!!P.bg} onChange={e => setP({ bg: e.target.checked ? '#FFF3CD' : '' })} /> Fondo
            {P.bg && <SelectorColor value={P.bg} onChange={v => setP({ bg: v })} />}
          </label>
        </div>
      </div>
    ); }
    if (b.tipo === 'encabezado') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <textarea value={P.texto ?? ''} onChange={e => setP({ texto: e.target.value })} rows={2} className={inp} placeholder="Escribe tu titular…" />
        <MiniBarraTexto font={P.font} color={P.color} size={P.size} onFont={v => setP({ font: v })} onColor={v => setP({ color: v })} onSize={v => setP({ size: v })} sizeMin={14} sizeMax={44} />
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Alineación</label><select value={P.align ?? 'center'} onChange={e => setP({ align: e.target.value })} className={inp}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div>
          <label className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] pb-1.5"><input type="checkbox" checked={P.bold !== false} onChange={e => setP({ bold: e.target.checked })} /> Negrita</label>
        </div>
      </div>
    ); }
    if (b.tipo === 'enlace') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <input value={b.texto ?? ''} onChange={e => upd(b.id, { texto: e.target.value })} className={inp} placeholder="Texto del enlace" />
        <input value={P.url ?? ''} onChange={e => setP({ url: e.target.value })} className={inp} placeholder="https://… (a dónde lleva; vacío = ir a comprar)" />
        <div className="flex gap-2 items-end">
          <div><label className="text-[10px] text-[#6B6B6B]">Color</label><SelectorColor value={P.color ?? '#00A89D'} onChange={v => setP({ color: v })} /></div>
          <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Alineación</label><select value={P.align ?? 'center'} onChange={e => setP({ align: e.target.value })} className={inp}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div>
        </div>
      </div>
    ); }
    if (b.tipo === 'social') { const P = b.props ?? {}; const items: any[] = (P.items as any[]) ?? []; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); const setItem = (k: number, patch: any) => setP({ items: items.map((x, j) => (j === k ? { ...x, ...patch } : x)) }); return (
      <div className="space-y-2">
        {items.map((s, k) => (
          <div key={k} className="flex gap-1.5 items-center">
            <select value={s.red} onChange={e => setItem(k, { red: e.target.value })} className="rounded border border-[#E8E8E8] text-[12px] px-1.5 py-1.5">{REDES.map(r => <option key={r.key} value={r.key}>{r.ic} {r.label}</option>)}</select>
            <input value={s.url ?? ''} onChange={e => setItem(k, { url: e.target.value })} placeholder="Enlace o número" className="flex-1 min-w-0 text-sm border border-[#E8E8E8] rounded px-2 py-1" />
            <button onClick={() => setP({ items: items.filter((_, j) => j !== k) })} className="text-[#DC2626] px-1 shrink-0">✕</button>
          </div>
        ))}
        <button onClick={() => setP({ items: [...items, { red: 'whatsapp', url: '' }] })} className="text-[11px] text-[#00A89D] font-semibold">+ Agregar red</button>
        <div className="flex gap-2 items-end pt-1">
          <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Tamaño · {Number(P.size) || 30}</label><input type="range" min={18} max={48} value={Number(P.size) || 30} onChange={e => setP({ size: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
          <div><label className="text-[10px] text-[#6B6B6B]">Alineación</label><select value={P.align ?? 'center'} onChange={e => setP({ align: e.target.value })} className={inp}><option value="izq">Izq.</option><option value="center">Centro</option><option value="der">Der.</option></select></div>
        </div>
      </div>
    ); }
    if (b.tipo === 'html') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-[#6B6B6B]">HTML personalizado</label>
        <textarea value={P.html ?? ''} onChange={e => setP({ html: e.target.value })} rows={6} className={`${inp} font-mono text-[11px]`} placeholder="<p>Tu HTML…</p>" />
        <p className="text-[10px] text-[#9A9A9A]">Se muestra tal cual en la página. Úsalo para pegar código propio (ej. un widget). Solo tú lo controlas.</p>
      </div>
    ); }
    if (b.tipo === 'espaciador') return <div><label className="text-[11px] font-semibold text-[#6B6B6B]">Altura (px)</label><input type="number" value={b.altura ?? 24} onChange={e => upd(b.id, { altura: Number(e.target.value) })} className={inp} /></div>;
    if (b.tipo === 'separador') return <p className="text-[11px] text-[#6B6B6B]">Línea divisoria. Sin ajustes.</p>;
    if (b.tipo === 'contador') return <div><label className="text-[11px] font-semibold text-[#6B6B6B]">Horas</label><input type="number" value={b.horas ?? 10} onChange={e => upd(b.id, { horas: Number(e.target.value) })} className={inp} /></div>;
    if (b.tipo === 'beneficios' || b.tipo === 'confianza') return (
      <div className="space-y-2">
        {b.tipo === 'beneficios' && <input value={b.titulo ?? ''} onChange={e => upd(b.id, { titulo: e.target.value })} placeholder="Título (opcional)" className={inp} />}
        <textarea rows={4} className={inp} value={((b.items as string[]) ?? []).join('\n')} onChange={e => upd(b.id, { items: e.target.value.split('\n') })} placeholder="Una por línea…" />
      </div>
    );
    if (b.tipo === 'garantia') return (
      <div className="space-y-2">
        <input value={b.titulo ?? ''} onChange={e => upd(b.id, { titulo: e.target.value })} placeholder="Título" className={inp} />
        <textarea value={b.cuerpo ?? ''} onChange={e => upd(b.id, { cuerpo: e.target.value })} rows={2} placeholder="Texto…" className={inp} />
      </div>
    );
    if (b.tipo === 'faq') {
      const items: any[] = (b.items as any[]) ?? [];
      const setI = (nv: any[]) => upd(b.id, { items: nv });
      return (
        <div className="space-y-2">
          {items.map((it, k) => (
            <div key={k} className="rounded-lg border border-[#E8E8E8] p-2 space-y-1">
              <input value={it.pregunta} onChange={e => setI(items.map((x, j) => j === k ? { ...x, pregunta: e.target.value } : x))} placeholder="Pregunta" className={inp} />
              <textarea value={it.respuesta} onChange={e => setI(items.map((x, j) => j === k ? { ...x, respuesta: e.target.value } : x))} rows={2} placeholder="Respuesta" className={inp} />
              <button onClick={() => setI(items.filter((_, j) => j !== k))} className="text-[11px] text-[#DC2626]">Eliminar</button>
            </div>
          ))}
          <button onClick={() => setI([...items, { pregunta: '', respuesta: '' }])} className="text-[11px] text-[#00A89D] font-semibold">+ Agregar pregunta</button>
        </div>
      );
    }
    if (b.tipo === 'testimonios') {
      const items: any[] = (b.items as any[]) ?? [];
      const setI = (nv: any[]) => upd(b.id, { items: nv });
      const setItem = (k: number, patch: any) => setI(items.map((x, j) => (j === k ? { ...x, ...patch } : x)));
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      const subirFoto = (k: number, f: File) => { setSubiendo(`${b.id}:${k}`); subir(f).then(url => { if (url) setItem(k, { foto: url }); }).finally(() => setSubiendo(null)); };
      return (
        <div className="space-y-3">
          {/* Título del bloque + mini-barra */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#6B6B6B]">Título del bloque</label>
            <input value={P.titulo ?? b.titulo ?? ''} onChange={e => setP({ titulo: e.target.value })} placeholder="LO QUE DICEN NUESTROS CLIENTES" className={inp} />
            <MiniBarraTexto font={P.tituloFont} color={P.tituloColor} size={P.tituloSize} onFont={v => setP({ tituloFont: v })} onColor={v => setP({ tituloColor: v })} onSize={v => setP({ tituloSize: v })} sizeMin={14} sizeMax={30} />
          </div>
          {/* Reseñas */}
          {items.map((it, k) => (
            <div key={k} className="rounded-lg border border-[#E8E8E8] p-2.5 space-y-1.5">
              <div className="flex gap-2 items-start">
                <label className="w-16 h-16 rounded-lg border border-dashed border-[#00A89D] bg-[#E9F7F5] grid place-items-center text-[10px] text-[#00847A] cursor-pointer overflow-hidden shrink-0">
                  {it.foto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.foto} alt="" className="w-full h-full object-cover" />
                    : (subiendo === `${b.id}:${k}` ? '…' : '+ Foto')}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(k, f); e.target.value = ''; }} />
                </label>
                <div className="flex-1 space-y-1">
                  <input value={it.nombre ?? ''} onChange={e => setItem(k, { nombre: e.target.value })} placeholder="Nombre" className={inp} />
                  <textarea value={it.texto ?? ''} onChange={e => setItem(k, { texto: e.target.value })} rows={2} placeholder="Comentario" className={inp} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-[#6B6B6B]">Estrellas</span>
                <select value={it.estrellas ?? 5} onChange={e => setItem(k, { estrellas: Number(e.target.value) })} className="px-2 py-1 rounded border border-[#E8E8E8] text-[11px]">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}</select>
                <label className="flex items-center gap-1 text-[11px] text-[#6B6B6B] ml-1"><input type="checkbox" checked={!!it.gatillo} onChange={e => setItem(k, { gatillo: e.target.checked })} /> 🆕 Gatillo</label>
                <label className="flex items-center gap-1 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!it.boton} onChange={e => setItem(k, { boton: e.target.checked })} /> 🛒 Botón</label>
              </div>
              {it.boton && (
                <div className="space-y-1.5 pl-2 border-l-2 border-[#E8E8E8]">
                  <input value={it.botonTexto ?? ''} onChange={e => setItem(k, { botonTexto: e.target.value })} placeholder="🛒 LO QUIERO" className={inp} />
                  <div className="flex gap-2 items-end">
                    <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={it.botonColor ?? '#C1121F'} onChange={v => setItem(k, { botonColor: v })} /></div>
                    <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={it.botonColorTexto ?? '#FFFFFF'} onChange={v => setItem(k, { botonColorTexto: v })} /></div>
                    <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Alineación</label><select value={it.botonAlign ?? 'centro'} onChange={e => setItem(k, { botonAlign: e.target.value })} className={inp}><option value="izq">Izquierda</option><option value="centro">Centro</option><option value="der">Derecha</option></select></div>
                  </div>
                  <div><label className="text-[10px] text-[#6B6B6B]">Ancho: {it.botonAncho ?? 100}%</label><input type="range" min={40} max={100} value={it.botonAncho ?? 100} onChange={e => setItem(k, { botonAncho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
                </div>
              )}
              <button onClick={() => setI(items.filter((_, j) => j !== k))} className="text-[11px] text-[#DC2626]">Eliminar reseña</button>
            </div>
          ))}
          <button onClick={() => setI([...items, { nombre: '', texto: '', estrellas: 5 }])} className="text-[11px] text-[#00A89D] font-semibold">+ Agregar reseña</button>

          {/* Aviso flotante "Nueva reseña" */}
          <div className="rounded-lg border border-[#F6D4A6] bg-[#FFF6EA] p-2.5 space-y-1.5">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#8A5000]"><input type="checkbox" checked={P.avisoActivo !== false} onChange={e => setP({ avisoActivo: e.target.checked })} /> 🔔 Aviso flotante &ldquo;Nueva reseña&rdquo;</label>
            <p className="text-[10px] text-[#8A5000]">Aparece solo si marcaste una reseña como 🆕 Gatillo.</p>
            <input value={P.avisoTexto ?? ''} onChange={e => setP({ avisoTexto: e.target.value })} placeholder="Nueva reseña" className={inp} />
            <div className="flex gap-2 items-end">
              <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={P.avisoColor ?? '#C1121F'} onChange={v => setP({ avisoColor: v })} /></div>
              <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={P.avisoColorTexto ?? '#FFFFFF'} onChange={v => setP({ avisoColorTexto: v })} /></div>
              <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Esquina</label><select value={P.avisoPosicion ?? 'bottom-left'} onChange={e => setP({ avisoPosicion: e.target.value })} className={inp}><option value="bottom-left">Abajo izq.</option><option value="bottom-right">Abajo der.</option><option value="top-left">Arriba izq.</option><option value="top-right">Arriba der.</option><option value="bottom-center">Abajo centro</option></select></div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Aparece a los (seg)</label><input type="number" value={P.avisoAparece ?? 8} onChange={e => setP({ avisoAparece: Number(e.target.value) })} className={inp} /></div>
              <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Dura (seg)</label><input type="number" value={P.avisoDura ?? 6} onChange={e => setP({ avisoDura: Number(e.target.value) })} className={inp} /></div>
            </div>
          </div>
        </div>
      );
    }
    if (b.tipo === 'boton') { const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } }); const escala = Number(P.escala) > 0 ? Number(P.escala) : 100; return (
      <div className="space-y-2.5">
        <input value={b.texto ?? ''} onChange={e => upd(b.id, { texto: e.target.value })} placeholder="Texto del botón" className={inp} />
        <MiniBarraTexto font={P.font} color={P.color} size={P.size}
          onFont={v => setP({ font: v })} onColor={v => setP({ color: v })} onSize={v => setP({ size: v })}
          onEmoji={em => upd(b.id, { texto: (b.texto ?? '') + em })} sizeMin={14} sizeMax={30} colorDefault="#FFFFFF" />

        {/* Forma del botón */}
        <div>
          <label className="text-[11px] font-semibold text-[#6B6B6B]">Forma del botón</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {VARIANTES_BOTON.map(v => {
              const activo = (P.variante || 'pill') === v.key;
              const prev = botonVariante(v.key, P.bg || '#00A89D');
              return (
                <button key={v.key} type="button" onClick={() => setP({ variante: v.key })}
                  className={`rounded-lg border p-1.5 text-center ${activo ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}>
                  <span className={`block text-white text-[9px] font-bold py-1 px-1 ${prev.className}`} style={prev.style}>Aa</span>
                  <span className="block text-[9px] text-[#6B6B6B] mt-0.5">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color y tamaño */}
        <div className="flex gap-3 items-end">
          <div><label className="text-[10px] text-[#6B6B6B] block">Color</label><SelectorColor value={P.bg ?? '#00A89D'} onChange={v => setP({ bg: v })} /></div>
          <div className="flex-1">
            <label className="text-[10px] text-[#6B6B6B] block">Tamaño del botón · {escala}%</label>
            <input type="range" min={70} max={160} step={5} value={escala} onChange={e => setP({ escala: Number(e.target.value) })} className="w-full accent-[#00A89D]" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!P.compacto} onChange={e => setP({ compacto: e.target.checked })} /> Botón angosto (no ocupa todo el ancho)</label>
        <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B]"><input type="checkbox" checked={!!P.flotante} onChange={e => setP({ flotante: e.target.checked })} /> 📌 Botón flotante (fijo abajo, siempre a la vista)</label>

        <select value={b.accion ?? 'comprar'} onChange={e => upd(b.id, { accion: e.target.value })} className={inp}><option value="comprar">Ir a comprar</option><option value="url">Abrir enlace</option></select>
        {b.accion === 'url' && <input value={b.url ?? ''} onChange={e => upd(b.id, { url: e.target.value })} placeholder="https://…" className={inp} />}

        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-[#6B6B6B]">Animación</label><select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></div>
          <div><label className="text-[10px] text-[#6B6B6B]">Ancho del bloque: {Number(P.ancho) > 0 ? Number(P.ancho) : 100}%</label><input type="range" min={40} max={100} value={Number(P.ancho) > 0 ? Number(P.ancho) : 100} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
        </div>
      </div>
    ); }
    if (b.tipo === 'gatillos') {
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      const sellos: string[] = (P.sellos as string[]) ?? [];
      const lbl = 'text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]';
      return (
        <div className="space-y-3">
          {/* TÍTULO */}
          <div className="space-y-1">
            <label className={lbl}>Título</label>
            <input value={P.titulo ?? ''} onChange={e => setP({ titulo: e.target.value })} placeholder="OFERTA LIMITADA" className={inp} />
            <div className="flex items-center gap-2">
              <input type="range" min={12} max={40} value={Number(P.tituloSize) || 20} onChange={e => setP({ tituloSize: Number(e.target.value) })} className="flex-1 accent-[#00A89D]" />
              <span className="text-[10px] text-[#6B6B6B] w-10 text-right">{Number(P.tituloSize) || 20}px</span>
              <SelectorColor value={P.tituloColor ?? '#C1121F'} onChange={v => setP({ tituloColor: v })} />
            </div>
          </div>
          {/* TIPOGRAFÍA */}
          <div className="space-y-1">
            <label className={lbl}>Tipografía</label>
            <select value={P.tituloFont ?? ''} onChange={e => setP({ tituloFont: e.target.value })} className={inp}>
              <option value="">Predeterminada</option>
              {FONTS_LISTA.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          {/* MENSAJE DE URGENCIA */}
          <div className="space-y-1">
            <label className={lbl}>Mensaje de urgencia</label>
            <input value={P.mensaje ?? ''} onChange={e => setP({ mensaje: e.target.value })} placeholder="SE ESTÁ AGOTANDO LA TALLA…" className={inp} />
            <div className="flex items-center gap-2">
              <input type="range" min={10} max={22} value={Number(P.mensajeSize) || 13} onChange={e => setP({ mensajeSize: Number(e.target.value) })} className="flex-1 accent-[#00A89D]" />
              <span className="text-[10px] text-[#6B6B6B] w-10 text-right">{Number(P.mensajeSize) || 13}px</span>
              <SelectorColor value={P.mensajeColor ?? '#0D0D0D'} onChange={v => setP({ mensajeColor: v })} />
            </div>
          </div>
          {/* BARRA */}
          <div className="space-y-1">
            <label className={lbl}>Barra: {Math.max(0, Math.min(100, Number(P.barra) || 0))}%</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={Math.max(0, Math.min(100, Number(P.barra) || 0))} onChange={e => setP({ barra: Number(e.target.value) })} className="flex-1 accent-[#00A89D]" />
              <SelectorColor value={P.barraColor ?? '#C1121F'} onChange={v => setP({ barraColor: v })} />
            </div>
          </div>
          {/* TEXTO DE INSTRUCCIÓN */}
          <div className="space-y-1">
            <label className={lbl}>Texto de instrucción (opcional)</label>
            <textarea rows={2} value={P.instruccion ?? ''} onChange={e => setP({ instruccion: e.target.value })} placeholder="Ej: Toca el botón para pedir contra entrega" className={inp} />
            <div className="flex items-center gap-2">
              <input type="range" min={10} max={22} value={Number(P.instruccionSize) || 13} onChange={e => setP({ instruccionSize: Number(e.target.value) })} className="flex-1 accent-[#00A89D]" />
              <span className="text-[10px] text-[#6B6B6B] w-10 text-right">{Number(P.instruccionSize) || 13}px</span>
              <SelectorColor value={P.instruccionColor ?? '#6B6B6B'} onChange={v => setP({ instruccionColor: v })} />
            </div>
          </div>
          {/* ETIQUETAS + COLOR PRECIO */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Etiqueta precio normal</label><input value={P.etiquetaNormal ?? ''} onChange={e => setP({ etiquetaNormal: e.target.value })} placeholder="PRECIO NORMAL" className={inp} /></div>
            <div><label className={lbl}>Etiqueta oferta</label><input value={P.etiquetaOferta ?? ''} onChange={e => setP({ etiquetaOferta: e.target.value })} placeholder="OFERTA LIMITADA" className={inp} /></div>
          </div>
          <div className="space-y-1">
            <label className={lbl}>Color del precio</label>
            <SelectorColor value={P.precioColor ?? '#C1121F'} onChange={v => setP({ precioColor: v })} />
            <p className="text-[10px] text-[#9A9A9A]">Los valores del precio salen del embudo (Precio hoy: {pesos(d.precio || 0)} · Antes: {d.precio_antes ? pesos(d.precio_antes) : '—'}).</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Tamaño “oferta”: {Number(P.tamOferta) || 12}px</label><input type="range" min={9} max={20} value={Number(P.tamOferta) || 12} onChange={e => setP({ tamOferta: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div><label className={lbl}>Tamaño precio: {Number(P.tamPrecio) || 28}px</label><input type="range" min={18} max={44} value={Number(P.tamPrecio) || 28} onChange={e => setP({ tamPrecio: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
          </div>
          {/* BOTÓN */}
          <div className="space-y-1 pt-1 border-t border-[#F0F0F0]">
            <label className={lbl}>Texto del botón</label>
            <input value={P.botonTexto ?? ''} onChange={e => setP({ botonTexto: e.target.value })} placeholder="CLIC AQUI PARA COMPRAR" className={inp} />
            <div className="flex items-center gap-2">
              <SelectorColor value={P.botonColor ?? '#1E9E5A'} onChange={v => setP({ botonColor: v })} />
              <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Letra: {Number(P.botonLetra) > 0 ? Number(P.botonLetra) : 'auto'}</label><input type="range" min={0} max={28} value={Number(P.botonLetra) || 0} onChange={e => setP({ botonLetra: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
              <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Ancho: {Number(P.botonAncho) > 0 ? Number(P.botonAncho) : 100}%</label><input type="range" min={40} max={100} value={Number(P.botonAncho) > 0 ? Number(P.botonAncho) : 100} onChange={e => setP({ botonAncho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            </div>
            <label className={lbl}>Forma</label>
            <div className="grid grid-cols-3 gap-1.5">
              {VARIANTES_BOTON.map(v => {
                const activo = (P.botonForma || 'redondeado') === v.key;
                const prev = botonVariante(v.key, P.botonColor || '#1E9E5A');
                return (
                  <button key={v.key} type="button" onClick={() => setP({ botonForma: v.key })} className={`rounded-lg border p-1.5 text-center ${activo ? 'border-[#00A89D] bg-[#00A89D]/10' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}>
                    <span className={`block text-white text-[9px] font-bold py-1 px-1 ${prev.className}`} style={prev.style}>Aa</span>
                    <span className="block text-[9px] text-[#6B6B6B] mt-0.5">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* SELLOS */}
          <div className="space-y-1">
            <label className={lbl}>Sellos</label>
            {sellos.map((s, k) => (
              <div key={k} className="flex gap-1.5 items-center">
                <input value={s} onChange={e => setP({ sellos: sellos.map((x, j) => j === k ? e.target.value : x) })} placeholder="🚚 Envío gratis" className="flex-1 text-sm border border-[#E8E8E8] rounded px-2 py-1" />
                <button onClick={() => setP({ sellos: sellos.filter((_, j) => j !== k) })} className="text-[#DC2626] px-1">✕</button>
              </div>
            ))}
            <button onClick={() => setP({ sellos: [...sellos, ''] })} className="text-[11px] text-[#00A89D] font-semibold">+ Agregar sello</button>
          </div>
          {/* ANIMACIÓN + ANCHO */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Animación</label><select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></div>
            <div><label className={lbl}>Ancho del bloque: {Number(P.ancho) > 0 ? Number(P.ancho) : 100}%</label><input type="range" min={50} max={100} value={Number(P.ancho) > 0 ? Number(P.ancho) : 100} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
          </div>
        </div>
      );
    }
    if (b.tipo === 'checkout' || b.tipo === 'checkout_pro') {
      return (
        <div className="space-y-3 text-[12px] text-[#6B6B6B]">
          <button onClick={() => onAbrirContenido?.()} className="w-full rounded-xl py-2.5 bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A]">✏️ Editar Productos del checkout (colores, tallas, precio, packs, traer del catálogo)</button>
          {/* Mismos campos que en "Productos del checkout" (una sola fuente: el embudo). */}
          <p className="text-[11px] text-[#6B6B6B] leading-snug">Los datos que pide el checkout se arman <b>bloque por bloque</b>: toca la pestaña <b>🛒 Checkout</b> de arriba para agregar, mover, renombrar o quitar cada uno.</p>
        </div>
      );
    }
    // ── Bloques nuevos: editan su propio `props` ──
    if (b.tipo === 'mas_vendido') {
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      return (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[#6B6B6B]">Texto del botón</label>
          <input value={P.texto ?? ''} onChange={e => setP({ texto: e.target.value })} placeholder="EL MÁS VENDIDO" className={inp} />
          <div className="flex gap-2">
            <div className="w-16"><label className="text-[10px] text-[#6B6B6B]">Emoji</label><input value={P.emoji ?? ''} onChange={e => setP({ emoji: e.target.value })} maxLength={2} className={inp} /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={P.color ?? '#C1121F'} onChange={v => setP({ color: v })} /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={P.colorTexto ?? '#FFFFFF'} onChange={v => setP({ colorTexto: v })} /></div>
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Tamaño</label><select value={P.size ?? 'md'} onChange={e => setP({ size: e.target.value })} className={inp}><option value="sm">Pequeño</option><option value="md">Mediano</option><option value="lg">Grande</option></select></div>
          </div>
          <label className="text-[11px] font-semibold text-[#6B6B6B]">Modelo que preselecciona en el checkout</label>
          <select value={P.modelo ?? ''} onChange={e => setP({ modelo: e.target.value })} className={inp}>
            <option value="">— El que ya esté elegido —</option>
            {(d.variantes ?? []).map((v: any, k: number) => <option key={k} value={v.nombre}>{v.nombre}</option>)}
          </select>
          <p className="text-[10px] text-[#9A9A9A]">Al tocarlo, baja al checkout y marca 🔥 ese modelo.</p>
          <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B] pt-1 border-t border-[#F0F0F0] mt-1"><input type="checkbox" checked={!!P.flotante} onChange={e => setP({ flotante: e.target.checked })} /> 📌 Insignia flotante (fija en una esquina)</label>
          {P.flotante && (
            <div><label className="text-[10px] text-[#6B6B6B]">Esquina</label>
              <select value={P.posicion ?? 'bottom-right'} onChange={e => setP({ posicion: e.target.value })} className={inp}>
                <option value="bottom-right">Abajo derecha</option>
                <option value="bottom-left">Abajo izquierda</option>
                <option value="bottom-center">Abajo centro</option>
                <option value="top-right">Arriba derecha</option>
                <option value="top-left">Arriba izquierda</option>
              </select>
            </div>
          )}
        </div>
      );
    }
    if (b.tipo === 'stock') {
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      const lbl = 'text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]';
      return (
        <div className="space-y-3">
          {/* Título */}
          <div className="space-y-1">
            <label className={lbl}>Título</label>
            <input value={P.titulo ?? P.texto ?? ''} onChange={e => setP({ titulo: e.target.value })} placeholder="EL STOCK SE ESTÁ AGOTANDO" className={inp} />
            <MiniBarraTexto font={P.tituloFont} color={P.tituloColor} size={P.tituloSize} onFont={v => setP({ tituloFont: v })} onColor={v => setP({ tituloColor: v })} onSize={v => setP({ tituloSize: v })} sizeMin={12} sizeMax={28} />
          </div>
          {/* Mensaje + alerta */}
          <div className="space-y-1">
            <label className={lbl}>Mensaje</label>
            <textarea rows={2} value={P.mensaje ?? ''} onChange={e => setP({ mensaje: e.target.value })} placeholder="Quedan pocas unidades en algunos colores y tallas." className={inp} />
          </div>
          <div className="space-y-1">
            <label className={lbl}>Alerta (con ⚠️)</label>
            <div className="flex gap-2 items-center">
              <input value={P.alerta ?? ''} onChange={e => setP({ alerta: e.target.value })} placeholder="⚠️ ¡No te quedes sin el tuyo!" className={inp} />
              <SelectorColor value={P.alertaColor ?? '#B45309'} onChange={v => setP({ alertaColor: v })} />
            </div>
          </div>
          {/* Barra */}
          <div className="rounded-lg border border-[#E8E8E8] p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] text-[#6B6B6B] flex-1"><input type="checkbox" checked={P.animada !== false} onChange={e => setP({ animada: e.target.checked })} /> 📉 Barra que baja sola (urgencia)</label>
              <div><label className="text-[10px] text-[#6B6B6B]">Color</label><SelectorColor value={P.color ?? '#F59E0B'} onChange={v => setP({ color: v })} /></div>
            </div>
            <div><label className="text-[10px] text-[#6B6B6B]">Barra inicial: {Number(P.barraInicial) || 31}%</label><input type="range" min={0} max={100} value={Number(P.barraInicial) || 31} onChange={e => setP({ barraInicial: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            {P.animada !== false && (<>
              <div><label className="text-[10px] text-[#6B6B6B]">Nunca baja de: {Number(P.barraFinal) || 8}%</label><input type="range" min={0} max={100} value={Number(P.barraFinal) || 8} onChange={e => setP({ barraFinal: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Baja cada: {Number(P.cadaSeg) || 10}s</label><input type="range" min={3} max={30} value={Number(P.cadaSeg) || 10} onChange={e => setP({ cadaSeg: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
                <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Cuánto baja: {Number(P.paso) || 1}%</label><input type="range" min={1} max={5} value={Number(P.paso) || 1} onChange={e => setP({ paso: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
              </div>
            </>)}
          </div>
          {/* Animación + ancho */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Animación</label><select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></div>
            <div><label className={lbl}>Ancho del bloque: {Number(P.ancho) > 0 ? Number(P.ancho) : 100}%</label><input type="range" min={50} max={100} value={Number(P.ancho) > 0 ? Number(P.ancho) : 100} onChange={e => setP({ ancho: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
          </div>
        </div>
      );
    }
    if (b.tipo === 'ventas') {
      const P = b.props ?? {}; const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
      return (
        <div className="space-y-2">
          <input value={P.titulo ?? ''} onChange={e => setP({ titulo: e.target.value })} placeholder="Título (ej: Venta reciente)" className={inp} />
          <label className="text-[11px] font-semibold text-[#6B6B6B]">Frases que rotan (una por línea)</label>
          <textarea rows={3} className={inp} value={(P.items ?? []).join('\n')} onChange={e => setP({ items: e.target.value.split('\n').filter(Boolean) })} placeholder={'Alguien acaba de comprar 🎉\nNuevo pedido confirmado ✅'} />
          <div className="flex gap-2">
            <div className="w-16"><label className="text-[10px] text-[#6B6B6B]">Emoji</label><input value={P.emoji ?? ''} onChange={e => setP({ emoji: e.target.value })} maxLength={2} className={inp} /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Fondo</label><SelectorColor value={P.color ?? '#0D0D0D'} onChange={v => setP({ color: v })} /></div>
            <div><label className="text-[10px] text-[#6B6B6B]">Texto</label><SelectorColor value={P.colorTexto ?? '#FFFFFF'} onChange={v => setP({ colorTexto: v })} /></div>
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Esquina</label><select value={P.posicion ?? 'bottom-right'} onChange={e => setP({ posicion: e.target.value })} className={inp}><option value="bottom-right">Abajo der.</option><option value="bottom-left">Abajo izq.</option><option value="top-right">Arriba der.</option><option value="top-left">Arriba izq.</option><option value="bottom-center">Abajo centro</option></select></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Aparece a los (seg)</label><input type="number" value={P.delayInicial ?? 10} onChange={e => setP({ delayInicial: Number(e.target.value) })} className={inp} /></div>
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Cada (seg)</label><input type="number" value={P.intervalo ?? 15} onChange={e => setP({ intervalo: Number(e.target.value) })} className={inp} /></div>
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Dura (seg)</label><input type="number" value={P.duracion ?? 3} onChange={e => setP({ duracion: Number(e.target.value) })} className={inp} /></div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Tamaño de letra: {Number(P.tamLetra) || 12}px</label><input type="range" min={10} max={18} value={Number(P.tamLetra) || 12} onChange={e => setP({ tamLetra: Number(e.target.value) })} className="w-full accent-[#00A89D]" /></div>
            <div className="flex-1"><label className="text-[10px] text-[#6B6B6B]">Animación</label><select value={P.anim ?? ''} onChange={e => setP({ anim: e.target.value })} className={inp}>{ANIMACIONES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></div>
          </div>
        </div>
      );
    }
    return <p className="text-[11px] text-[#6B6B6B]">Sin ajustes.</p>;
  }

  // ── Control común a TODO bloque: espacio arriba/abajo (acepta negativos) ──
  function controlEspacio(b: BloqueLayout) {
    const P = b.props ?? {};
    const setP = (patch: any) => upd(b.id, { props: { ...P, ...patch } });
    const mt = typeof P.mt === 'number' ? P.mt : 0;
    const mb = typeof P.mb === 'number' ? P.mb : 0;
    return (
      <div className="pt-2 border-t border-[#E8E8E8]">
        <div className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide mb-1.5">Espacio (negativo = juntar bloques)</div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-[#6B6B6B]">Arriba: {mt}px</label>
            <input type="range" min={-40} max={60} value={mt} onChange={e => setP({ mt: Number(e.target.value) })} className="w-full accent-[#00A89D]" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[#6B6B6B]">Abajo: {mb}px</label>
            <input type="range" min={-40} max={60} value={mb} onChange={e => setP({ mb: Number(e.target.value) })} className="w-full accent-[#00A89D]" />
          </div>
        </div>
      </div>
    );
  }
}

function Vacio({ icono, label }: { icono: string; label: string }) {
  return <div className="flex items-center justify-center gap-2 h-16 text-xs text-[#9A9A9A] bg-[#F5F5F5]">{icono} {label}</div>;
}
