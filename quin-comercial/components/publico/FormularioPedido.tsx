'use client';

import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { normalizarOpciones, acentoDe, varianteAgotada, opcionAgotada } from '@/lib/funnels';
import type { Funnel, VarianteFunnel } from '@/lib/funnels';
import ArmarPackSelector, { type PackSalida } from './ArmarPackSelector';
import {
  normalizarBloquesCk, camposDelCheckout, resumenDelPedido,
  type BloqueCk, type CampoCk,
} from '@/lib/checkout-bloques';

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export interface CheckoutConfig {
  titulo?: string; subtitulo?: string; tituloDatos?: string;
  textoBoton?: string; colorBoton?: string;
  sellos?: { emoji?: string; texto?: string }[]; mostrarSellos?: boolean;
}

interface Props {
  funnel: Funnel;
  utms: Record<string, string>;
  config?: CheckoutConfig;
}

export default function FormularioPedido({ funnel, utms, config }: Props) {
  const router = useRouter();
  const acento = acentoDe(funnel.color);

  // ── Checkout por BLOQUES (opcional) ───────────────────────────────────────
  // Si este embudo tiene bloques armados, mandan ellos: qué se muestra, en qué
  // orden y con qué texto. Si NO tiene, se dibuja el checkout de siempre, igual
  // que antes. Un embudo que ya está vendiendo no cambia solo.
  const bloques: BloqueCk[] | null = normalizarBloquesCk((config as any)?.bloques);

  // Qué datos se le piden al cliente lo decide `camposDelCheckout`: sin bloques,
  // los de siempre; con bloques, los que estén armados. De aquí salen los campos
  // que se dibujan, los que se validan y los que se avisan como faltantes.
  const CAMPOS: CampoCk[] = camposDelCheckout(bloques);

  const cTituloDatos   = '✅ DATOS PARA EL ENVÍO:';
  const cTextoBoton    = 'COMPLETAR MI PEDIDO';
  const cColorBoton    = acento.boton;

  const variantes: VarianteFunnel[] = funnel.variantes.length > 0
    ? funnel.variantes
    : [{ id: 'unica', nombre: funnel.producto, precio: funnel.precio, precioAntes: funnel.precio_antes ?? undefined }];

  // Arranca en la primera variante DISPONIBLE (no en una agotada).
  const [varianteId, setVarianteId] = useState((variantes.find(v => !varianteAgotada(v)) ?? variantes[0]).id);
  // Una elección por cada selector del producto (talla, color 1, color 2…)
  const [elecciones, setElecciones] = useState<string[]>([]);
  // Estado del constructor "arma tu pack" (cuando la variante lo usa)
  const [pack, setPack] = useState<PackSalida | null>(null);
  const [enviando, setEnviando]     = useState(false);
  const [errores, setErrores]       = useState<Record<string, string>>({});
  // Qué dato se está señalando ahora mismo con la animación
  const [señalando, setSeñalando]   = useState<string | null>(null);
  const [recienElegido, setRecienElegido] = useState<string | null>(null); // para el "pop" del botón
  // El botón se vuelve flotante solo cuando el de verdad se sale de la pantalla
  const botonRef = useRef<HTMLButtonElement>(null);
  const [botonFlotante, setBotonFlotante] = useState(false);

  useEffect(() => {
    const el = botonRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entrada]) => setBotonFlotante(!entrada.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Bloque "MÁS VENDIDO": al tocarlo, preselecciona esa variante (si coincide).
  useEffect(() => {
    function onMasVendido(e: Event) {
      const modelo = String((e as CustomEvent)?.detail?.modelo ?? '').trim().toLowerCase();
      if (!modelo) return;
      const match = variantes.find(v => String(v.nombre ?? '').trim().toLowerCase() === modelo)
        || variantes.find(v => String(v.nombre ?? '').toLowerCase().includes(modelo));
      if (match && !varianteAgotada(match)) { setVarianteId(match.id); setElecciones([]); }
    }
    window.addEventListener('quin:mas-vendido', onMasVendido);
    return () => window.removeEventListener('quin:mas-vendido', onMasVendido);
  }, [variantes]);

  /** Lleva al dato que falta y lo hace notar. */
  function señalar(campo: string) {
    setSeñalando(campo);
    const el = document.querySelector(`[data-campo="${campo}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // La animación dura unos segundos y se apaga sola
    window.setTimeout(() => setSeñalando(actual => (actual === campo ? null : actual)), 3200);
  }

  const [datos, setDatos] = useState({
    nombre: '', apellidos: '', whatsapp: '', correo: '',
    direccion: '', barrio: '', municipio: '', departamento: '',
  });

  const variante = useMemo(
    () => variantes.find(v => v.id === varianteId) ?? variantes[0],
    [varianteId, variantes]
  );

  // ── Carrito abandonado ──────────────────────────────────────────────────────
  // Apenas el cliente escribe nombre + un WhatsApp válido (aunque no termine de
  // comprar), guardamos el carrito para que el dueño pueda recuperarlo. Se hace
  // con retardo (deja de escribir) y se actualiza mientras llena el formulario.
  useEffect(() => {
    const tel = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
    if (!datos.nombre.trim() || !/^3\d{9}$/.test(tel)) return;
    const t = setTimeout(() => {
      const seleccionTxt = elecciones.filter(Boolean).join(' / ');
      // Foto del producto (la de la variante o la 1ª del embudo) + galería.
      const imagenes = [variante?.imagen, ...(Array.isArray(funnel.imagenes) ? funnel.imagenes : [])]
        .filter((u): u is string => typeof u === 'string' && !!u)
        .filter((u, i, a) => a.indexOf(u) === i)
        .slice(0, 8);
      fetch('/api/funnels/carrito', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({
          slug: funnel.slug,
          telefono: tel,
          nombre: `${datos.nombre} ${datos.apellidos}`.trim(),
          producto: variante?.nombre ?? funnel.producto,
          talla: seleccionTxt,
          valor: variante?.precio ?? funnel.precio,
          // Datos parciales que el cliente ya haya escrito (para verlos en el panel)
          apellidos: datos.apellidos,
          correo: datos.correo,
          direccion: datos.direccion,
          barrio: datos.barrio,
          municipio: datos.municipio,
          departamento: datos.departamento,
          // Blob completo para el desplegable "Ver todos los datos" del panel.
          datos: {
            nombre: datos.nombre,
            apellidos: datos.apellidos,
            whatsapp: datos.whatsapp,
            correo: datos.correo,
            direccion: datos.direccion,
            barrio: datos.barrio,
            municipio: datos.municipio,
            departamento: datos.departamento,
            producto: variante?.nombre ?? funnel.producto,
            seleccion: seleccionTxt,
            valor: variante?.precio ?? funnel.precio,
            imagenes,
          },
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [datos.nombre, datos.apellidos, datos.correo, datos.direccion, datos.barrio, datos.municipio, datos.departamento, datos.whatsapp, variante, elecciones, funnel.slug, funnel.producto, funnel.precio]);

  /** Las elecciones que pide este producto. Si no define ninguna, pide la talla. */
  const selectores = useMemo(() => {
    let sels = (variante.selectores && variante.selectores.length > 0)
      ? variante.selectores.slice(0, 6)
      : [{ etiqueta: 'TALLA', opciones: (variante.tallas && variante.tallas.length > 0 ? variante.tallas : funnel.tallas) }];

    // ── Auto-compactar una UNIDAD mal configurada como "varios pasos por color" ──
    // Ej: grupos NEGRO/ROJO/BEIGE, cada uno solo con talla. Se muestra como un
    // pack x2: una fila de COLOR (los nombres de los grupos) + una fila de TALLA.
    // Un pack real (ELIGE BUZO 1/2) NO se toca: sus grupos no son colores sueltos.
    const grposUnicos = [...new Set(sels.map(s => (s.grupo ?? '').trim()).filter(Boolean))];
    const pareceColor = (t: string) => t.split(/\s+/).length <= 3 && !/buzo|prenda|pack|elige/i.test(t);
    const todosSonColor = grposUnicos.length >= 2 && grposUnicos.every(pareceColor);
    const cadaGrupoSoloTalla = sels.every(s => /talla/i.test(s.etiqueta) || !s.etiqueta);

    if (todosSonColor && cadaGrupoSoloTalla) {
      const tallas = (() => {
        const primera = sels.find(s => /talla/i.test(s.etiqueta) || !s.etiqueta);
        return normalizarOpciones(primera?.opciones ?? funnel.tallas);
      })();
      sels = [
        { etiqueta: 'COLOR', opciones: grposUnicos.map(valor => ({ valor })) },
        { etiqueta: 'TALLA', opciones: tallas },
      ];
    }
    return sels;
  }, [variante, funnel.tallas]);

  // Si un selector tiene UNA sola opción (ej. un único color), se elige solo:
  // el cliente no tiene que tocarlo y nunca bloquea la compra.
  useEffect(() => {
    setElecciones(prev => {
      const next = [...prev];
      let cambio = false;
      selectores.forEach((s, i) => {
        const ops = normalizarOpciones(s.opciones);
        // Solo se auto-elige si esa única opción NO está agotada.
        if (ops.length === 1 && !next[i] && !opcionAgotada(ops[0])) { next[i] = ops[0].valor; cambio = true; }
      });
      return cambio ? next : prev;
    });
  }, [selectores]);

  // Lo que finalmente se guarda: "VERDE / NEGRO / M HOMBRE"
  const seleccion = elecciones.filter(Boolean).join(' / ');

  /**
   * Las elecciones se agrupan por su título ("ELIGE BUZO 1"). Cada grupo se
   * cierra al completarse, para que el cliente no tenga que bajar tanto.
   */
  const grupos = useMemo(() => {
    const salida: { titulo: string | null; indices: number[] }[] = [];
    selectores.forEach((s, i) => {
      const titulo = s.grupo?.trim() || null;
      const ultimo = salida[salida.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.indices.push(i);
      else salida.push({ titulo, indices: [i] });
    });
    return salida;
  }, [selectores]);

  // VARIABLES POLOS: pack de polos donde cada polo elige color + talla, con
  // desplegables y foto grande (en vez de los chips de siempre).
  const esPolos = variante.estilo === 'polos' || grupos.some(g => /polo\s*\d/i.test(g.titulo || ''));

  /** Lo que aún falta, en palabras, para mostrarlo en la barra flotante. */
  const faltantes = (() => {
    const f: string[] = [];
    if (selectores.some((s, i) => normalizarOpciones(s.opciones).length > 0 && !elecciones[i])) f.push('elegir talla y color');
    const nombres: Record<string, string> = {
      nombre: 'nombre', apellidos: 'apellidos', whatsapp: 'WhatsApp', correo: 'correo',
      direccion: 'dirección', barrio: 'barrio', municipio: 'municipio', departamento: 'departamento',
    };
    // Solo cuenta como "falta" un dato que se está pidiendo y es obligatorio.
    for (const c of CAMPOS) {
      if (!c.obligatorio) continue;
      if (!String((datos as any)[c.id] ?? '').trim()) f.push(nombres[c.id] ?? c.label.toLowerCase());
    }
    return f.slice(0, 3);
  })();

  const grupoCompleto = (g: { indices: number[] }) => g.indices.every(i => !!elecciones[i]);
  // Se abre el primero que falte por llenar
  const grupoAbierto = grupos.findIndex(g => !grupoCompleto(g));
  const [abiertoManual, setAbiertoManual] = useState<number | null>(null);

  // ── Guía paso a paso ──────────────────────────────────────────────────────
  // Cuando el cliente completa una prenda, la página lo lleva sola al siguiente
  // paso (la otra prenda o los datos de envío), para que no se pierda.
  const datosRef  = useRef<HTMLDivElement>(null);
  const gruposRef = useRef<(HTMLDivElement | null)[]>([]);
  const focoPrev  = useRef<number>(0);

  // "Arma tu pack": al terminar de armar el producto, lleva al cliente directo
  // al formulario de envío (scroll suave), para que no se pierda del siguiente paso.
  const packCompletoPrev = useRef(false);
  useEffect(() => {
    if (variante.armarPack && pack?.completo && !packCompletoPrev.current) {
      setTimeout(() => datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
    packCompletoPrev.current = !!pack?.completo;
  }, [pack?.completo, variante.armarPack]);

  useEffect(() => {
    const idx  = grupos.findIndex(g => !grupoCompleto(g)); // -1 = todas las prendas listas
    const foco = idx === -1 ? grupos.length : idx;
    if (foco > focoPrev.current) {
      // Avanzó de paso → llevarlo suavemente a lo que sigue
      const t = setTimeout(() => {
        if (idx === -1) datosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else gruposRef.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      focoPrev.current = foco;
      return () => clearTimeout(t);
    }
    focoPrev.current = foco;
  }, [elecciones]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (campo: string, valor: string) => {
    setDatos(d => ({ ...d, [campo]: valor }));
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: '' }));
  };

  function validar(): boolean {
    const e: Record<string, string> = {};
    // No se puede comprar una variante agotada (stock 0 con política "no vender").
    if (varianteAgotada(variante)) {
      setErrores({ talla: 'Esa opción está agotada. Elige otra disponible.' });
      señalar('talla');
      return false;
    }
    // Solo se exige lo que el checkout de verdad está pidiendo. Un campo que no
    // se muestra no puede bloquear la compra.
    const FALTA: Record<string, string> = {
      nombre: 'Escribe tu nombre', apellidos: 'Escribe tus apellidos',
      correo: 'Escribe tu correo', direccion: 'Escribe tu dirección',
      barrio: 'Escribe tu barrio', municipio: 'Escribe tu municipio',
      departamento: 'Escribe tu departamento',
    };
    for (const c of CAMPOS) {
      if (c.id === 'whatsapp') {
        // Celular colombiano: 10 dígitos que empiezan por 3. Evita pedidos sin WhatsApp.
        const tel = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
        if (c.obligatorio || datos.whatsapp.trim()) {
          if (!/^3\d{9}$/.test(tel)) e.whatsapp = 'Debe ser un celular de 10 dígitos que empiece por 3';
        }
        continue;
      }
      if (c.obligatorio && !String(datos[c.id] ?? '').trim()) e[c.id] = FALTA[c.id] ?? 'Completa este dato';
    }

    // Elecciones del producto obligatorias. Con "arma tu pack" se valida que los
    // dos buzos estén completos; si no, las elecciones normales.
    if (variante.armarPack) {
      if (!pack?.completo) e.talla = 'Completa la escudería, color y talla de cada buzo';
    } else {
      selectores.forEach((s, i) => {
        const ops = normalizarOpciones(s.opciones);
        // Si el selector NO tiene opciones de verdad (ej. no se agregaron colores),
        // no se exige: no debe bloquear la compra por un dato que el dueño no configuró.
        if (ops.length > 0 && !elecciones[i]) e.talla = `Elige ${s.etiqueta.toLowerCase()}`;
        // Si eligió una opción que quedó agotada, no se puede comprar.
        const elegidaOp = ops.find(o => o.valor === elecciones[i]);
        if (elegidaOp && opcionAgotada(elegidaOp)) e.talla = `Esa opción de ${s.etiqueta.toLowerCase()} está agotada. Elige otra.`;
      });
    }

    setErrores(e);
    if (Object.keys(e).length > 0) {
      // La talla y el color se piden primero: están arriba de todo
      const orden = ['talla', ...CAMPOS.map(c => c.id as string)];
      const primero = orden.find(k => e[k]) ?? Object.keys(e)[0];
      señalar(primero);
      // Desde aquí el botón lo sigue: llena el dato y cierra sin bajar de nuevo
      return false;
    }
    return true;
  }

  async function enviar() {
    if (enviando || !validar()) return;
    setEnviando(true);

    const referencia = `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // "Arma tu pack": el producto, resumen y fotos salen del constructor.
    const usaPack = !!variante.armarPack && !!pack;
    const nombreProducto = usaPack ? pack!.producto : variante.nombre;
    const seleccionFinal = usaPack ? pack!.seleccion : seleccion;

    // Foto del producto elegido: la del color, si no la de la variante, si no la del embudo.
    const fotoColor = selectores
      .map((s, i) => normalizarOpciones(s.opciones).find(o => o.valor === elecciones[i])?.imagen)
      .find(Boolean);
    const fotoPedido = usaPack
      ? (pack!.fotos[0] ?? variante.imagen ?? funnel.imagenes[0] ?? null)
      : (fotoColor ?? variante.imagen ?? funnel.imagenes[0] ?? null);
    // Fotos de cada color elegido (para el collage/gracias del pack de polos)
    const fotosColores = selectores
      .map((s, i) => normalizarOpciones(s.opciones).find(o => o.valor === elecciones[i])?.imagen)
      .filter(Boolean) as string[];
    const imagenesPack = usaPack ? pack!.fotos : (esPolos && fotosColores.length > 1 ? fotosColores : undefined); // para el collage x2/x3

    // Fila del catálogo elegida (para que el servidor descuente/valide el stock real).
    const colorOpSel = selectores
      .map((s, i) => normalizarOpciones(s.opciones).find(o => o.valor === elecciones[i]))
      .find(o => o && (o as any).catColorId);
    const catColorId = (colorOpSel as any)?.catColorId || (variante as any)?.catColorId || null;

    // El resumen viaja a la página de gracias sin tener que consultarlo de nuevo
    try {
      sessionStorage.setItem('quin_ultimo_pedido', JSON.stringify({
        producto: nombreProducto,
        seleccion: seleccionFinal,
        valor: variante.precio,
        foto: fotoPedido,
        imagenes: imagenesPack,
        nombre: datos.nombre,
        referencia,
      }));
    } catch { /* si el navegador no deja guardar, no pasa nada */ }

    // Avisar a los píxeles de una vez
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

    // Cookies del píxel de Meta: mejoran la coincidencia del evento server-side
    const cookie = (n: string) =>
      (typeof document !== 'undefined'
        ? document.cookie.split('; ').find(c => c.startsWith(`${n}=`))?.split('=')[1]
        : '') ?? '';

    const cuerpo = JSON.stringify({
      referencia,
      slug: funnel.slug,
      variante: nombreProducto,
      precio: variante.precio,
      talla: seleccionFinal,
      catColorId, // fila del catálogo elegida (stock real)
      imagen: fotoPedido, // foto real del producto, para que la plantilla siempre entregue
      imagenes: imagenesPack, // fotos de cada buzo del pack (para armar el collage x2)
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc'),
      ...datos,
      utms,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });

    // El pedido se envía y, si el servidor se demora en armar la foto y el
    // mensaje de WhatsApp, no dejamos al cliente esperando: seguimos a la
    // página de gracias. La petición continúa en segundo plano.
    const envio = fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
    });

    const espera = new Promise<'lento'>(r => setTimeout(() => r('lento'), 2500));

    try {
      const resultado = await Promise.race([envio, espera]);

      // Si respondió a tiempo y hubo un problema real, se le avisa
      if (resultado !== 'lento') {
        const res = resultado as Response;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? 'No pudimos registrar tu pedido. Intenta de nuevo.');
          setEnviando(false);
          return;
        }
      }
      router.push(`/${funnel.slug}/gracias?ref=${encodeURIComponent(referencia)}`);
    } catch {
      alert('No pudimos registrar tu pedido. Revisa tu conexión e intenta de nuevo.');
      setEnviando(false);
    }
  }

  // ── Trozos del checkout ────────────────────────────────────────────────────
  // Cada trozo se escribe UNA sola vez. El checkout de siempre los muestra en el
  // orden fijo de siempre; el checkout por bloques los ordena como estén armados.

  const campoInput = (c: CampoCk) => (
    <div key={c.id} data-campo={c.id}>
      <label className="block font-bold text-[15px] mb-1.5">
        {c.label}{c.obligatorio && <span className="text-[#C1121F]"> *</span>}
      </label>
      <input
        type={c.tipo ?? 'text'}
        inputMode={c.id === 'whatsapp' ? 'numeric' : undefined}
        autoComplete={c.auto ?? 'off'}
        value={datos[c.id]}
        onChange={e => set(c.id, e.target.value)}
        placeholder={c.placeholder}
        className={`w-full px-4 py-3 rounded-lg border text-[16px] outline-none transition-colors ${
          errores[c.id] ? 'border-[#C1121F] bg-[#FEF2F2]' : 'border-[#C9C9C9] focus:border-[#0D8A3E]'
        } ${señalando === c.id ? 'sacudir' : ''}`}
      />
      {errores[c.id] && (
        <p className="text-[12px] font-semibold text-[#C1121F] mt-1">⚠️ {errores[c.id]}</p>
      )}
    </div>
  );

  const secVariantes = (titulo: string) => (
    <>
      {!!titulo && <h2 className="text-center font-extrabold text-lg py-3">{titulo}</h2>}

      <div className="px-3 space-y-2">
        {variantes.map(v => {
          const activa = v.id === varianteId;
          const agotada = varianteAgotada(v);
          // Aviso de "quedan pocas" (stock definido, > 0 y ≤ 5) aunque no bloquee.
          const quedan = (typeof v.stock === 'number' && v.stock > 0 && v.stock <= 5) ? v.stock : null;
          const esPackX2 = /(^|\s)(pack\s*x?\s*2|x2|dos\s+prendas)/i.test(v.nombre || '')
            || (v.estilo === 'polos' && new Set((v.selectores ?? []).map(s => s.grupo?.trim()).filter(Boolean)).size === 2);
          return (
            <div key={v.id} className={`relative rounded-lg border-2 transition-colors ${agotada ? 'border-[#E0E0E0] opacity-60' : activa ? 'border-[#0D8A3E]' : 'border-[#E0E0E0]'}`}>
              {agotada ? (
                <span className="absolute -top-2.5 right-2 z-10 bg-[#6B6B6B] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">AGOTADO</span>
              ) : esPackX2 && (
                <span className="absolute -top-2.5 right-2 z-10 bg-[#C1121F] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">🔥 MÁS VENDIDO</span>
              )}
              <button
                onClick={() => { if (agotada) return; setVarianteId(v.id); setElecciones([]); }}
                disabled={agotada}
                className={`w-full flex items-center gap-3 p-3 text-left ${agotada ? 'cursor-not-allowed' : ''}`}
              >
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${activa ? 'border-[#0D8A3E]' : 'border-[#C9C9C9]'}`}>
                  {activa && <span className="w-2.5 h-2.5 rounded-full bg-[#0D8A3E]" />}
                </span>
                {v.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.imagen} alt="" className={`w-14 h-14 object-cover rounded shrink-0 ${agotada ? 'grayscale' : ''}`} loading="lazy" />
                )}
                <span className="flex-1 font-semibold text-[15px] leading-tight">
                  {v.nombre}
                  {agotada && <span className="block text-[12px] font-bold text-[#6B6B6B]">Sin unidades disponibles</span>}
                  {!agotada && quedan != null && <span className="block text-[12px] font-bold text-[#C1121F]">¡Solo quedan {quedan}!</span>}
                </span>
                <span className="text-right shrink-0">
                  {v.precioAntes && (
                    <span className="block text-[13px] text-[#C1121F] line-through">{pesos(v.precioAntes)}</span>
                  )}
                  <span className="block font-bold">{pesos(v.precio)}</span>
                </span>
              </button>

              {activa && v.armarPack && (
                <div className="pb-3" data-campo="talla">
                  <ArmarPackSelector config={v.armarPack} acento={acento} onChange={setPack} />
                </div>
              )}

              {activa && !v.armarPack && (
                <div className={`px-3 pb-3 ${señalando === 'talla' ? 'barrido' : ''}`} data-campo="talla">
                  {esPolos && grupos.map((g, gi) => {
                    const idxColor = g.indices.find(i => /color/i.test(selectores[i].etiqueta ?? '') || normalizarOpciones(selectores[i].opciones).some(o => o.imagen));
                    const idxTalla = g.indices.find(i => /talla/i.test(selectores[i].etiqueta ?? ''));
                    const colorSel = idxColor != null ? normalizarOpciones(selectores[idxColor].opciones).find(o => o.valor === elecciones[idxColor]) : undefined;
                    const tono = acento.boton;
                    const listoPolo = g.indices.every(i => elecciones[i]);
                    const prendaNueva = g.indices.every(i => !elecciones[i]) && gi > 0;
                    return (
                      <div key={`polo-${gi}`} ref={el => { gruposRef.current[gi] = el; }}
                           className={`border-t border-[#EEE] pt-2 mb-2 rounded-lg overflow-hidden transition-all ${prendaNueva ? 'ring-2 ring-[#0D8A3E] ring-offset-2 animate-pulse' : ''}`}>
                        <div className="text-white px-3 py-2 flex items-center justify-center gap-2 font-extrabold text-sm tracking-wide flex-wrap" style={{ background: tono }}>
                          <span>🎽 {g.titulo}</span>
                          {idxColor != null && elecciones[idxColor] && (
                            <span className="bg-white text-[#0D8A3E] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                              ✅ {elecciones[idxColor]}{idxTalla != null && elecciones[idxTalla] ? ` · TALLA ${elecciones[idxTalla]}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="p-3 flex items-stretch gap-3 border border-t-0 border-[#EEE] rounded-b-lg">
                          <div className="w-[36%] shrink-0">
                            {colorSel?.imagen ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={colorSel.imagen} alt="" className="w-full h-full object-cover rounded-lg border border-[#E0E0E0]" loading="lazy" />
                            ) : (
                              <div className="w-full h-full min-h-[110px] rounded-lg bg-[#F2F2F2] flex items-center justify-center text-3xl text-[#CCC]">🎽</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2.5">
                            {idxColor != null && (
                              <div>
                                <p className="text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>🎨 Elige el color</p>
                                <select value={elecciones[idxColor] || ''} onChange={e => { const val = e.target.value; setElecciones(prev => { const c = [...prev]; c[idxColor] = val; return c; }); }}
                                  className="w-full px-2 py-2.5 rounded-lg border-2 text-[13px] font-semibold bg-white focus:outline-none"
                                  style={{ borderColor: elecciones[idxColor] ? tono : '#E0E0E0' }}>
                                  <option value="">— Elige color —</option>
                                  {normalizarOpciones(selectores[idxColor].opciones).map(o => (<option key={o.valor} value={o.valor}>{o.valor}</option>))}
                                </select>
                              </div>
                            )}
                            {idxTalla != null && (
                              <div>
                                <p className="text-[12px] font-extrabold mb-1" style={{ color: acento.texto }}>📏 Elige la talla</p>
                                <select value={elecciones[idxTalla] || ''} onChange={e => { const val = e.target.value; setElecciones(prev => { const c = [...prev]; c[idxTalla] = val; return c; }); }}
                                  className="w-full px-2 py-2.5 rounded-lg border-2 text-[13px] font-semibold bg-white focus:outline-none"
                                  style={{ borderColor: elecciones[idxTalla] ? tono : '#E0E0E0' }}>
                                  <option value="">— Elige talla —</option>
                                  {normalizarOpciones(selectores[idxTalla].opciones).map(o => (<option key={o.valor} value={o.valor}>{o.valor}</option>))}
                                </select>
                              </div>
                            )}
                            {listoPolo && (
                              <p className="text-center text-[12px] font-bold text-[#0D8A3E] bg-[#0D8A3E]/10 rounded-lg py-1">✅ Polo listo</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!esPolos && grupos.map((g, gi) => {
                    const listo   = grupoCompleto(g);
                    const abierto = abiertoManual === gi || (abiertoManual === null && gi === grupoAbierto) || !g.titulo;
                    // Nº de paso entre las prendas con título (para "Paso 1 de 2")
                    const totalPasos = grupos.filter(x => x.titulo).length;
                    const paso = grupos.slice(0, gi + 1).filter(x => x.titulo).length;

                    // Bloque cerrado: resumen de lo que eligió
                    if (g.titulo && listo && !abierto) {
                      // El que tiene fotos es el color; el resto (talla, género) va al centro
                      const conFoto = g.indices.find(i =>
                        normalizarOpciones(selectores[i].opciones).some(o => o.imagen)
                      );
                      const elegidaColor = conFoto !== undefined
                        ? normalizarOpciones(selectores[conFoto].opciones).find(o => o.valor === elecciones[conFoto])
                        : undefined;
                      const resto = g.indices
                        .filter(i => i !== conFoto)
                        .map(i => elecciones[i])
                        .filter(Boolean)
                        .join('  ');

                      return (
                        <button
                          key={gi}
                          ref={el => { gruposRef.current[gi] = el as unknown as HTMLDivElement; }}
                          onClick={() => setAbiertoManual(gi)}
                          className="w-full flex items-center gap-3 border-t border-[#EEE] py-3 text-left"
                        >
                          <span className="shrink-0 w-[92px] leading-tight">
                            <span className="flex items-center gap-1 text-[13px] font-extrabold text-[#0D8A3E] uppercase">
                              <span className="w-4 h-4 rounded-full bg-[#0D8A3E] text-white text-[10px] flex items-center justify-center">✓</span>
                              {g.titulo}
                            </span>
                          </span>

                          <span className="flex-1 text-center font-extrabold text-[19px] text-[#0D0D0D] leading-tight break-words">
                            {resto || elecciones[g.indices[0]]}
                          </span>

                          <span className="shrink-0 text-center w-[74px]">
                            {elegidaColor?.imagen ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={elegidaColor.imagen} alt="" className="w-[62px] h-[62px] object-cover rounded mx-auto border border-[#E0E0E0]" />
                                <span className="block text-[11px] font-bold text-[#0D0D0D] mt-0.5 leading-tight">
                                  {elegidaColor.valor}
                                </span>
                              </>
                            ) : (
                              <span className="text-[#0D8A3E] text-xl">✓</span>
                            )}
                            <span className="block text-[11px] text-[#9A9A9A]">cambiar</span>
                          </span>
                        </button>
                      );
                    }

                    // ¿Qué le toca ahora al cliente en esta prenda?
                    const idxColor = g.indices.find(i => normalizarOpciones(selectores[i].opciones).some(o => o.imagen));
                    const faltaColor = idxColor !== undefined && !elecciones[idxColor];
                    const faltaTalla = g.indices.some(i => i !== idxColor && !elecciones[i]);
                    const pista = faltaColor
                      ? '👉 Elige el color'
                      : faltaTalla
                        ? '👉 Ahora elige la talla'
                        : '';

                    // El primer dato que falta en esta prenda: es el que se anima
                    const primerFaltante = g.indices.find(i => !elecciones[i]);
                    // Solo se anima si el cliente ya empezó a elegir (no al abrir la página)
                    const yaEmpezo = elecciones.some(Boolean);
                    // Prenda nueva sin nada elegido (ej. el 2º buzo del pack) → palpita
                    const prendaNueva = g.indices.every(i => !elecciones[i]) && gi > 0;

                    // Bloque abierto
                    return (
                      <div key={gi} ref={el => { gruposRef.current[gi] = el; }}
                           className={`border-t border-[#EEE] pt-2 rounded-lg transition-all ${
                             prendaNueva ? 'ring-2 ring-[#0D8A3E] ring-offset-2 animate-pulse' : ''
                           }`}>
                        {g.titulo && (
                          <>
                            <p className="text-center font-extrabold text-[15px] bg-[#0D0D0D] text-white rounded py-1.5 mb-1 flex items-center justify-center gap-2">
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Paso {paso} de {totalPasos}</span>
                              {g.titulo}
                            </p>
                            {pista && (
                              <p className="text-center text-[13px] font-bold text-[#0D8A3E] mb-2 pide-atencion">{pista}</p>
                            )}
                          </>
                        )}

                        {g.indices.map(idx => {
                          const s   = selectores[idx];
                          const ops = normalizarOpciones(s.opciones);
                          const elegida = ops.find(o => o.valor === elecciones[idx]);

                          return (
                            <div key={idx} className="mb-2">
                              {s.etiqueta?.trim() && (
                                <p className="text-center text-[12px] text-[#6B6B6B] font-semibold mb-1.5">
                                  {s.etiqueta}
                                </p>
                              )}

                              <div className="flex items-start gap-2">
                                {/* Vista del color elegido — NUNCA en la talla */}
                                {!/talla/i.test(s.etiqueta ?? '') && ops.some(o => o.imagen) && (
                                  <div className="w-[72px] shrink-0">
                                    {elegida?.imagen ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={elegida.imagen} alt={elegida.valor} className="w-[72px] h-[72px] object-cover rounded border border-[#E0E0E0]" />
                                    ) : (
                                      <div className="w-[72px] h-[72px] rounded border border-dashed border-[#C9C9C9] flex items-center justify-center text-[9px] text-[#9A9A9A] text-center px-1">
                                        Elige un color
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-1.5 flex-1 justify-center">
                                  {ops.map((op, oi) => {
                                    // Los botones se mueven en cascada cuando:
                                    //  · el cliente intentó comprar sin elegir, o
                                    //  · es justo el dato que sigue (ej. acaba de elegir el color
                                    //    → se animan las tallas para que sepa qué hacer)
                                    const esElQueSigue = idx === primerFaltante && yaEmpezo;
                                    const esError = señalando === 'talla' && !elecciones[idx];
                                    const marcar = esError || esElQueSigue;
                                    const claseAnim = esError ? 'pide-atencion' : esElQueSigue ? 'guia-siguiente' : '';
                                    const activo = elecciones[idx] === op.valor;
                                    const opAgot = opcionAgotada(op);
                                    return (
                                      <button
                                        key={op.valor}
                                        disabled={opAgot}
                                        onClick={() => {
                                          if (opAgot) return;
                                          setElecciones(prev => {
                                            const c = [...prev];
                                            c[idx] = op.valor;
                                            return c;
                                          });
                                          setErrores(e => ({ ...e, talla: '' }));
                                          setSeñalando(null);
                                          setAbiertoManual(null);
                                          setRecienElegido(`${idx}-${op.valor}`);
                                          setTimeout(() => setRecienElegido(r => (r === `${idx}-${op.valor}` ? null : r)), 450);
                                        }}
                                        style={marcar && !opAgot ? { animationDelay: `${oi * 70}ms` } : undefined}
                                        className={`px-3 py-2 rounded-lg border text-[13px] font-semibold transition-all duration-200 ${
                                          opAgot
                                            ? 'bg-[#F2F1EE] text-[#B5B5B5] border-[#E0E0E0] line-through cursor-not-allowed'
                                            : activo
                                            ? 'bg-[#0D8A3E] text-white border-[#0D8A3E] scale-105 shadow-md'
                                            : 'bg-white border-[#C9C9C9] text-[#0D0D0D] hover:scale-105'
                                        } ${opAgot ? '' : claseAnim} ${recienElegido === `${idx}-${op.valor}` ? 'elegido-pop' : ''}`}
                                      >{opAgot ? `${op.valor} · agotado` : activo ? `✓ ${op.valor}` : op.valor}</button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Confirmación cuando eligió todo lo de esta prenda */}
                        {g.indices.every(i => elecciones[i]) && (
                          <p className="entra-ok text-center text-[13px] font-bold text-[#0D8A3E] bg-[#0D8A3E]/10 rounded-lg py-1.5 mt-1">
                            ✅ Color y talla seleccionados correctamente
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {errores.talla && (
                    <p className="text-[13px] font-bold text-[#C1121F] mt-2 text-center">
                      👆 {errores.talla}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const secBoton = (texto: string, color: string, forma: string) => (
    <button
      ref={botonRef}
      onClick={enviar}
      disabled={enviando}
      style={{ background: color || acento.boton }}
      className={`boton-compra relative overflow-hidden block w-[calc(100%-1.5rem)] mx-3 mt-6 mb-4 ${forma === 'cuadrado' ? 'rounded-none' : forma === 'redondeado' ? 'rounded-xl' : 'rounded-full'} hover:opacity-90 disabled:opacity-60 text-white text-center font-extrabold text-xl py-4 transition-opacity`}
    >
      {enviando ? 'ENVIANDO…' : (texto || 'COMPLETAR MI PEDIDO')}
    </button>
  );

  const secSellos = (items: { emoji?: string; texto?: string }[]) => (
    <div className="flex flex-wrap justify-center gap-2 px-3 mb-2">
      {items.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-[#F2F1EE] rounded-full px-3 py-1.5">
          <span>{x.emoji || '✅'}</span>{x.texto}
        </span>
      ))}
    </div>
  );

  const secPago = (texto: string, color: string) => (
    <div className="mx-3 mt-3 border border-[#E0E0E0] rounded-lg px-4 py-3 flex items-center gap-2">
      <span className="w-4 h-4 rounded-full shrink-0" style={{ background: color || '#F97316' }} />
      <span className="font-bold text-[#6B6B6B] text-[15px]">{texto || 'CONTRA ENTREGA'}</span>
    </div>
  );

  // El resumen: los TEXTOS los pone el dueño; los NÚMEROS salen del producto.
  const secResumen = (L: { producto: string; precio: string; total: string; envio: string; textoEnvio: string }) => {
    const R = resumenDelPedido(variante, { textoEnvio: L.textoEnvio });
    return (
      <>
        <div className="mx-3 border border-[#E0E0E0] rounded-lg overflow-hidden">
        <div className="flex justify-between px-4 py-2.5 bg-[#FAFAFA] font-bold text-[13px]">
          <span>{L.producto}</span><span>{L.precio}</span>
        </div>

        <div className="px-4 py-3 border-t border-[#EEE]">
          <div className="flex justify-between items-start gap-3 mb-2">
            <span className="text-[14px] font-semibold">{variante.nombre}</span>
            <span className="text-right shrink-0">
              {variante.precioAntes && (
                <span className="block text-[13px] text-[#C1121F] line-through">{pesos(variante.precioAntes)}</span>
              )}
              <span className="block font-bold">{pesos(variante.precio)}</span>
            </span>
          </div>

          {/* Una fila/tarjeta por prenda: su foto + talla + color */}
          {variante.armarPack ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(pack?.buzos ?? []).map((b, bi) => (b.escuderia || b.color || b.talla) ? (
                  <div key={bi} className="flex items-center gap-2 border border-[#EEE] rounded-lg px-2 py-1.5">
                    {b.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.foto} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    ) : (
                      <span className="w-12 h-12 rounded bg-[#F2F2F2] shrink-0 flex items-center justify-center text-[#CCC]">👕</span>
                    )}
                    <span className="text-[12px] leading-tight">
                      <span className="block font-bold">{b.escuderia || '—'}</span>
                      <span className="block text-[#6B6B6B]">{[b.color, b.talla].filter(Boolean).join(' · ') || '…'}</span>
                    </span>
                  </div>
                ) : null)}
              </div>
              {!pack?.completo && (
                <p className="text-[12px] text-[#C1121F] mt-1">Completa cada buzo arriba (escudería, color y talla).</p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {grupos.map((g, gi) => {
                  const conFoto = g.indices.find(i =>
                    normalizarOpciones(selectores[i].opciones).some(o => o.imagen)
                  );
                  const color = conFoto !== undefined
                    ? normalizarOpciones(selectores[conFoto].opciones).find(o => o.valor === elecciones[conFoto])
                    : undefined;
                  const resto = g.indices
                    .filter(i => i !== conFoto)
                    .map(i => elecciones[i])
                    .filter(Boolean)
                    .join(' ');

                  if (!resto && !color) return null;

                  return (
                    <div key={gi} className="flex items-center gap-2 border border-[#EEE] rounded-lg px-2 py-1.5">
                      {color?.imagen && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={color.imagen} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <span className="text-[12px] leading-tight">
                        <span className="block font-bold">{resto || '—'}</span>
                        {color && <span className="block text-[#6B6B6B]">{color.valor}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!seleccion && (
                <p className="text-[12px] text-[#C1121F] mt-1">
                  Elige {selectores.map(s => s.etiqueta.toLowerCase()).join(' y ')} arriba.
                </p>
              )}
            </>
          )}
        </div>

        {R.envio && (
          <div className="flex justify-between px-4 py-2 border-t border-[#EEE] text-[14px]">
            <span>{L.envio}</span><span className="font-bold">{R.envio}</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-3 border-t border-[#EEE] font-bold">
          <span>{L.total}</span><span>{R.total == null ? '—' : pesos(R.total)}</span>
        </div>
      </div>
      </>
    );
  };

  const RES_FIJO = { producto: 'PRODUCTO', precio: 'PRECIO', total: 'Total', envio: 'Envío', textoEnvio: '' };

  // Texto y color del botón: los manda su bloque si el checkout está armado.
  const bBoton  = bloques?.find(b => b.tipo === 'boton' && b.visible !== false) ?? null;
  const btnTexto   = String(bBoton?.props?.texto ?? '') || cTextoBoton;
  const btnColor   = String(bBoton?.props?.color ?? '') || cColorBoton;
  const btnFlotante = bloques ? (bBoton ? bBoton.props?.flotante !== false : false) : true;

  // El primer dato del cliente es el ancla a la que la página lleva sola al
  // cliente cuando termina de elegir color y talla.
  const primerCampoId = bloques?.find(x => x.tipo === 'campo' && x.visible !== false)?.id ?? null;

  /** Dibuja un bloque del checkout armado. Lo que no se reconoce, no se dibuja. */
  const trozo = (b: BloqueCk) => {
    const P: any = b.props ?? {};
    const alin = P.align === 'center' ? 'text-center' : P.align === 'right' ? 'text-right' : 'text-left';
    switch (b.tipo) {
      case 'variantes': return secVariantes(String(P.titulo ?? ''));
      case 'campo': {
        const c = CAMPOS.find(x => x.id === P.campo);
        if (!c) return null;
        return (
          <div ref={b.id === primerCampoId ? datosRef : undefined} className="px-3 py-2 scroll-mt-2">
            {campoInput(c)}
          </div>
        );
      }
      case 'titulo':
        return <h2 className={`font-extrabold px-3 pt-6 pb-1 ${alin}`} style={{ fontSize: Number(P.size) || 18, color: P.color || undefined }}>{P.texto}</h2>;
      case 'texto':
        return <p className={`px-3 mb-2 ${alin} ${P.italica ? 'italic' : ''}`} style={{ fontSize: Number(P.size) || 12, color: P.color || '#6B6B6B' }}>{P.texto}</p>;
      case 'espaciador':
        return <div style={{ height: Math.max(0, Number(P.alto) || 0) }} />;
      case 'producto': {
        const R = resumenDelPedido(variante);
        const foto = variante.imagen || funnel.imagenes?.[0] || null;
        return (
          <div className="mx-3 mt-3 border border-[#E0E0E0] rounded-lg p-3 flex items-center gap-3">
            {P.mostrarFoto !== false && foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="w-16 h-16 rounded object-cover shrink-0" loading="lazy" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-[15px] leading-tight truncate">{R.nombre || funnel.producto}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px]">
                {R.precioAntes != null && (
                  <span className="text-[#6B6B6B]">{P.etiquetaNormal || 'PRECIO NORMAL'} <s className="text-[#C1121F]">{pesos(R.precioAntes)}</s></span>
                )}
                <span className="font-bold text-[#0D8A3E]">{P.etiquetaOferta || 'PRECIO EN PROMOCIÓN'} {R.precio == null ? '—' : pesos(R.precio)}</span>
              </div>
            </div>
          </div>
        );
      }
      case 'resumen': return secResumen({
        producto: String(P.etiquetaProducto ?? '') || 'PRODUCTO',
        precio: String(P.etiquetaPrecio ?? '') || 'PRECIO',
        total: String(P.etiquetaTotal ?? '') || 'Total',
        envio: String(P.etiquetaEnvio ?? '') || 'Envío',
        textoEnvio: String(P.textoEnvio ?? ''),
      });
      case 'sellos': return secSellos(Array.isArray(P.items) ? P.items : []);
      case 'pago':   return secPago(String(P.texto ?? ''), String(P.color ?? ''));
      case 'boton':  return secBoton(btnTexto, btnColor, String(P.forma ?? 'pill'));
      default: return null;
    }
  };

  return (
    <div>
      {bloques ? (
        bloques.filter(b => b.visible !== false).map(b => (
          <Fragment key={b.id}>{trozo(b)}</Fragment>
        ))
      ) : (<>
        {/* Checkout de siempre: mismo orden y mismos textos de toda la vida. */}
        {secVariantes('ELIGE COLOR Y TALLA ⬇️')}
        <div ref={datosRef} className="scroll-mt-2" />
        <h2 className="font-extrabold text-lg px-3 pt-6 pb-1">{cTituloDatos}</h2>
        <p className="px-3 text-[12px] italic text-[#6B6B6B] mb-4">
          Sus datos están protegidos y solo se usan para gestionar su pedido.
        </p>
        <div className="px-3 space-y-4">{CAMPOS.map(campoInput)}</div>
        {secBoton(cTextoBoton, cColorBoton, 'pill')}
        {secResumen(RES_FIJO)}
        {secPago('CONTRA ENTREGA', '#F97316')}
        <p className="text-center text-[12px] text-[#6B6B6B] py-6 px-6">
          Pagas cuando recibes. Te escribimos por WhatsApp para confirmar tu pedido.
        </p>
      </>)}

      {/* Espacio para que la barra flotante no tape el final */}
      {botonFlotante && btnFlotante && <div className="h-24" />}

      {/* Botón que acompaña al cliente hasta que termina */}
      {botonFlotante && btnFlotante && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-lg mx-auto">
            {faltantes.length > 0 && (
              <p className="text-center text-[11px] font-semibold text-[#C1121F] mb-1.5">
                Te falta: {faltantes.join(', ')}
              </p>
            )}
            <button
              onClick={enviar}
              disabled={enviando}
              style={{ background: btnColor }}
              className="w-full rounded-full hover:opacity-90 disabled:opacity-60 text-white text-center font-extrabold text-lg py-3.5 shadow-lg transition-opacity"
            >
              {enviando ? 'ENVIANDO…' : btnTexto}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
