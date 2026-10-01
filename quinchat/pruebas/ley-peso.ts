/**
 * PRUEBA DE LA LEY DE PESO EN EL COMPRESOR (P2 + P4)
 *
 * Importa el compresor REAL (`lib/optimizar-imagen-servidor.ts`) y el módulo de
 * topes REAL (`lib/ley-peso.ts`); nunca una copia. Las imágenes se GENERAN aquí
 * con sharp, así que corre en cualquier máquina sin muestras ni red, y no escribe
 * nada en Storage ni en ninguna base.
 *
 *   cd quinchat && npx tsx pruebas/ley-peso.ts
 *
 * Qué comprueba: peso <= tope, lado mayor >= 1440 px (suelo de la ley), los
 * NIVELES de aceptación (LEY §1 punto 4: 1 cabe, 2 casi cabe, 3 rescate, 4 aceptado
 * con aviso; el peso NUNCA rechaza) y que lo que ya cabe no se recomprime.
 * Una línea por caso; sale con código 1 si algo falla.
 */
import sharp from 'sharp';
import { optimizarImagen } from '../lib/optimizar-imagen-servidor.js';
import { LADO_MINIMO_IMAGEN, topeDe, type TipoArchivo } from '../lib/ley-peso.js';

let pasadas = 0;
let fallidas = 0;
function comprobar(caso: string, condicion: boolean, detalle = '') {
  if (condicion) { pasadas++; console.log(`  ok    ${caso.padEnd(54)} ${detalle}`); }
  else { fallidas++; console.log(`  FALLA ${caso.padEnd(54)} ${detalle}`); }
}
const kb = (n: number) => `${Math.round(n / 1024)} kB`;

/** Generador pseudoaleatorio con semilla: las imágenes salen iguales en cada ejecución. */
function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * «Foto con textura»: un degradado grande (lo que hace una prenda sobre fondo)
 * más grano fino de amplitud baja, como el de un sensor. Pesa MB en bruto pero
 * entra en 250 kB con los escalones.
 */
function texturaRaw(w: number, h: number, amplitud: number, canales: 3 | 4 = 3): Buffer {
  const rnd = aleatorio(7);
  const px = Buffer.alloc(w * h * canales);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * canales;
    const onda = 40 * Math.sin(x / 90) + 40 * Math.cos(y / 70);
    const g = (rnd() - 0.5) * amplitud;
    px[i] = Math.max(0, Math.min(255, 128 + onda + g + x / w * 30));
    px[i + 1] = Math.max(0, Math.min(255, 110 + onda * 0.8 + g + y / h * 30));
    px[i + 2] = Math.max(0, Math.min(255, 90 + onda * 0.6 + g));
    if (canales === 4) px[i + 3] = 255;
  }
  return px;
}

/** Ruido puro: no se comprime. Sirve para el caso «no cabe ni en el último escalón». */
function ruidoRaw(w: number, h: number, canales: 3 | 4): Buffer {
  const rnd = aleatorio(99);
  const px = Buffer.alloc(w * h * canales);
  for (let i = 0; i < px.length; i++) px[i] = (rnd() * 256) | 0;
  if (canales === 4) {
    // alfa con degradado real: así el canal alfa SÍ aporta (no es «opaco»).
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[(y * w + x) * 4 + 3] = Math.round(255 * x / w);
  }
  return px;
}

const desde = (px: Buffer, w: number, h: number, canales: 3 | 4) =>
  sharp(px, { raw: { width: w, height: h, channels: canales } });

/** Lado mayor y formato del resultado. */
async function ficha(buf: Buffer) {
  const m = await sharp(buf).metadata();
  return { lado: Math.max(m.width ?? 0, m.height ?? 0), formato: m.format, alfa: m.hasAlpha === true, croma: m.chromaSubsampling };
}

async function main() {
  console.log('\n  PRUEBA DE LA LEY DE PESO · compresor\n');
  console.log(`  ${'-'.repeat(86)}`);

  // 1 · Foto con textura (4000x3000): cabe en el tope, queda en JPEG y no baja de 1440.
  {
    const src = await desde(texturaRaw(4000, 3000, 14), 4000, 3000, 3).jpeg({ quality: 95 }).toBuffer();
    for (const tipo of ['foto-web', 'foto-whatsapp'] as TipoArchivo[]) {
      const r = await optimizarImagen(src, 'image/jpeg', tipo);
      const f = await ficha(r.buffer);
      comprobar(`foto con textura (${tipo}): peso <= tope`, r.buffer.length <= topeDe(tipo) && r.cumple,
        `${kb(src.length)} -> ${kb(r.buffer.length)} (${r.escalon})`);
      comprobar(`foto con textura (${tipo}): lado >= ${LADO_MINIMO_IMAGEN}`, f.lado >= LADO_MINIMO_IMAGEN, `${f.lado} px`);
      comprobar(`foto con textura (${tipo}): JPEG`, f.formato === 'jpeg' && r.contentType === 'image/jpeg', `${f.formato}`);
    }
    // Un escalón de más no debe haberse gastado: q85 solo si cabe a q85.
    const r = await optimizarImagen(src, 'image/jpeg', 'foto-web');
    comprobar('foto con textura: sin SUPERA_TOPE', r.codigo === undefined && r.mensaje === undefined);
  }

  // 2 · Lo que ya cabe no se recomprime (misma referencia, sin segunda pasada).
  {
    const src = await desde(texturaRaw(1200, 900, 6), 1200, 900, 3).jpeg({ quality: 80 }).toBuffer();
    const r = await optimizarImagen(src, 'image/jpeg', 'foto-web');
    comprobar('original que ya cabe: se devuelve intacto', src.length <= topeDe('foto-web') && !r.optimizada && r.buffer === src && r.cumple,
      kb(src.length));
  }

  // 3 · Con tope, el tope manda: un JPEG de 290 kB (que el 10 % de ahorro dejaba pasar) baja a <= 250 kB.
  {
    let calidad = 92; let src = Buffer.alloc(0);
    // Se busca una foto de 1600x1600 que pese entre 255 y 330 kB: justo lo que el compresor viejo dejaba por encima.
    for (; calidad >= 50; calidad -= 3) {
      src = await desde(texturaRaw(1600, 1600, 12), 1600, 1600, 3).jpeg({ quality: calidad }).toBuffer();
      if (src.length <= 330 * 1024) break;
    }
    const r = await optimizarImagen(src, 'image/jpeg', 'foto-web');
    comprobar('jpeg entre 250 y 330 kB: baja de 250 kB', src.length > topeDe('foto-web') && r.buffer.length <= topeDe('foto-web') && r.cumple,
      `${kb(src.length)} -> ${kb(r.buffer.length)} (${r.escalon})`);
  }

  // 4 · Banner con texto -> gráfico: <= 400 kB, croma 4:4:4 y sin bajar de 1440.
  {
    const w = 2400, h = 1350;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="100%" height="100%" fill="#101010"/>` +
      `<rect x="120" y="120" width="${w - 240}" height="${h - 240}" fill="none" stroke="#d4af37" stroke-width="10"/>` +
      `<text x="200" y="420" font-family="Arial, Helvetica, sans-serif" font-size="210" font-weight="bold" fill="#d4af37">OFERTA 2x1</text>` +
      `<text x="200" y="700" font-family="Arial, Helvetica, sans-serif" font-size="110" fill="#ffffff">Solo hasta agotar existencias</text>` +
      `<text x="200" y="900" font-family="Arial, Helvetica, sans-serif" font-size="48" fill="#cccccc">Envio gratis a toda Colombia - pago contra entrega</text></svg>`);
    // Grano suave sobre el fondo: sin él el PNG pesa 40 kB y no ejercita nada.
    const base = await sharp(svg).raw().toBuffer({ resolveWithObject: true });
    const rnd = aleatorio(3);
    for (let i = 0; i < base.data.length; i++) if (i % base.info.channels !== 3) base.data[i] = Math.max(0, Math.min(255, base.data[i]! + (rnd() - 0.5) * 22)); // solo color: el alfa queda opaco
    const src = await sharp(base.data, { raw: base.info }).png({ compressionLevel: 3 }).toBuffer();
    const r = await optimizarImagen(src, 'image/png', 'grafico-texto');
    const f = await ficha(r.buffer);
    comprobar('banner con texto: peso <= 400 kB', r.buffer.length <= topeDe('grafico-texto') && r.cumple,
      `${kb(src.length)} -> ${kb(r.buffer.length)} (${r.escalon})`);
    comprobar('banner con texto: croma 4:4:4', f.formato === 'jpeg' && f.croma === '4:4:4', `${f.croma}`);
    comprobar(`banner con texto: lado >= ${LADO_MINIMO_IMAGEN}`, f.lado >= LADO_MINIMO_IMAGEN, `${f.lado} px`);
  }

  // 5 · PNG con alfa REAL y ruido: no cabe ni con rescate -> NIVEL 4 (se acepta con aviso).
  //     Se comprueba el nivel, el aviso, el suelo del rescate (1280) y que sigue siendo PNG con alfa.
  {
    const w = 2400, h = 1800;
    const src = await desde(ruidoRaw(w, h, 4), w, h, 4).png({ compressionLevel: 1 }).toBuffer();
    const t0 = Date.now();
    const r = await optimizarImagen(src, 'image/png', 'png-alfa');
    const f = await ficha(r.buffer);
    comprobar('PNG alfa con ruido: nivel 4 (SUPERA_TOPE, no rechaza)', !r.cumple && r.nivel === 4 && r.codigo === 'SUPERA_TOPE',
      `${kb(src.length)} -> ${kb(r.buffer.length)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    comprobar('PNG alfa con ruido: aviso con peso y tope, no bloqueante', !!r.aviso && r.aviso.startsWith('Subida.') && r.aviso.includes('kB') && r.aviso.includes('250'), r.aviso ?? '(sin aviso)');
    comprobar('PNG alfa con ruido: no baja de 1280 (suelo del rescate)', f.lado >= 1280 && f.lado <= LADO_MINIMO_IMAGEN, `${f.lado} px`);
    comprobar('PNG alfa con ruido: sigue PNG con alfa', f.formato === 'png' && f.alfa && r.contentType === 'image/png', `${f.formato} alfa=${f.alfa}`);
    comprobar('PNG alfa con ruido: devuelve la mejor versión', r.buffer.length > 0 && r.buffer.length < src.length, kb(r.buffer.length));
  }

  // 6 · PNG con alfa REAL que sí cabe (logo con degradado de transparencia): sale PNG con alfa.
  {
    const w = 1800, h = 1800;
    const src = await desde(texturaRaw(w, h, 0, 4).map((v, i) => (i % 4 === 3 ? 0 : v)) as Buffer, w, h, 4)
      .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="900" cy="900" r="700" fill="#d4af37"/></svg>`) }])
      .png({ compressionLevel: 1 }).toBuffer();
    const r = await optimizarImagen(src, 'image/png', 'png-alfa');
    const f = await ficha(r.buffer);
    comprobar('PNG con alfa real: cumple y conserva la transparencia', r.cumple && f.formato === 'png' && f.alfa,
      `${kb(src.length)} -> ${kb(r.buffer.length)} (${r.escalon ?? 'intacto'})`);
  }

  // 7 · Ruido de 12 MP en JPEG (foto de producto): el último escalón normal deja ~326 kB, por
  //     encima de 250 kB pero dentro de tope + 50 % (375 kB): NIVEL 2, se acepta tal cual, sin aviso.
  {
    const w = 4000, h = 3000;
    const src = await desde(ruidoRaw(w, h, 3), w, h, 3).jpeg({ quality: 90 }).toBuffer();
    const r = await optimizarImagen(src, 'image/jpeg', 'foto-web');
    const f = await ficha(r.buffer);
    comprobar('ruido 12 MP (foto-web): nivel 2, sin aviso ni código', !r.cumple && r.nivel === 2 && r.codigo === undefined && r.aviso === undefined && r.buffer.length > 0,
      `${kb(src.length)} -> ${kb(r.buffer.length)} (tope ${kb(r.tope)})`);
    comprobar('ruido 12 MP (foto-web): escalón final 1440/q75', r.escalon === '1440/q75' && f.lado === LADO_MINIMO_IMAGEN, `${r.escalon} ${f.lado} px`);
  }

  // 7b · NIVEL 3 (rescate): grano fuerte; los escalones normales dejan > 375 kB y q70 / 1280 px sí caben.
  {
    const src = await desde(texturaRaw(2400, 1800, 255), 2400, 1800, 3).jpeg({ quality: 92 }).toBuffer();
    const silenciar = console.warn; console.warn = () => {};
    const r = await optimizarImagen(src, 'image/jpeg', 'foto-web');
    console.warn = silenciar;
    const f = await ficha(r.buffer);
    comprobar('grano fuerte (foto-web): nivel 3 por rescate', r.nivel === 3 && !r.cumple && r.buffer.length <= Math.floor(topeDe('foto-web') * 1.5) && (r.escalon ?? '').endsWith('/q70'),
      `${kb(src.length)} -> ${kb(r.buffer.length)} (${r.escalon})`);
    comprobar('grano fuerte: el rescate no baja de 1280 px', f.lado >= 1280, `${f.lado} px`);
    comprobar('grano fuerte: sin aviso (el nivel 3 no avisa al panel)', r.aviso === undefined);
  }

  // 8 · Entrante con transparencia real: JPG sobre blanco, no PNG pesado.
  {
    const w = 1400, h = 1400;
    const px = texturaRaw(w, h, 40, 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[(y * w + x) * 4 + 3] = x < w / 2 ? 0 : 255;
    const src = await desde(px, w, h, 4).png({ compressionLevel: 1 }).toBuffer();
    const r = await optimizarImagen(src, 'image/png', 'foto-entrante');
    const f = await ficha(r.buffer);
    comprobar('entrante con alfa: sale JPG y cumple', f.formato === 'jpeg' && !f.alfa && r.cumple, `${kb(src.length)} -> ${kb(r.buffer.length)}`);
  }

  // 9 · WebP estático hacia WhatsApp: nunca sale WebP.
  {
    const src = await desde(texturaRaw(1000, 1000, 10), 1000, 1000, 3).webp({ quality: 80 }).toBuffer();
    const r = await optimizarImagen(src, 'image/webp', 'foto-whatsapp');
    comprobar('WebP hacia WhatsApp: sale JPEG o PNG', r.contentType === 'image/jpeg' || r.contentType === 'image/png', r.contentType);
  }

  // 10 · Archivo ilegible: no lanza, marca el fallo y no da por buena una foto pesada.
  {
    const basura = Buffer.alloc(400 * 1024, 0x7f);
    const silenciar = console.warn; console.warn = () => {};
    const r = await optimizarImagen(basura, 'image/jpeg', 'foto-web');
    console.warn = silenciar;
    comprobar('archivo ilegible: fallo marcado y nivel 4 (aviso, no excepción)', r.fallo === true && r.buffer === basura && !r.cumple && r.nivel === 4 && r.codigo === 'SUPERA_TOPE');
  }

  console.log(`  ${'-'.repeat(86)}`);
  console.log(`\n  ${pasadas}/${pasadas + fallidas} ok · ${fallidas} fallidas\n`);
  if (fallidas) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
