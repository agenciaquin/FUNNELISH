/**
 * LEY DE PESO · la ÚNICA fuente de los topes.
 *
 * Aquí viven las cifras de `LEY-DE-PESO.md` §2 (definitivas, 30-09-2026). Nadie
 * más las escribe a mano: ni el compresor, ni las rutas, ni los paneles, ni las
 * pruebas. Si dirección cambia un tope, se cambia en este archivo y en ningún
 * otro.
 *
 * ARCHIVO IDÉNTICO EN `quinchat/lib/` Y `quin-comercial/lib/` (byte a byte; la
 * prueba `pruebas/ley-peso-unidad.ts` lo comprueba). Por eso NO importa nada:
 * ni `sharp`, ni `next`, ni nada de la app. Sirve igual en servidor y navegador.
 *
 * Unidades: 1 kB = 1024 bytes y 1 MB = 1024 kB, como en el resto del repo
 * (`MEDICION-TOPES.md` mide así).
 */

const KB = 1024;
const MB = 1024 * KB;

/** Todos los tipos de archivo que la ley distingue. */
export type TipoArchivo =
  | 'foto-web'        // foto de producto: landing o catálogo
  | 'foto-whatsapp'   // plantillas y chat saliente: solo JPEG o PNG
  | 'grafico-texto'   // banner, promo, remarketing: el texto exige más calidad
  | 'png-alfa'        // PNG con transparencia real
  | 'foto-entrante'   // la que manda el cliente por WhatsApp
  | 'video-landing'
  | 'video-chat'
  | 'svg'
  | 'gif'
  | 'documento';

/** Un escalón de compresión de imagen: lado mayor máximo y calidad. */
export interface Escalon {
  /** Lado mayor máximo en px. */
  lado: number;
  /** Calidad JPEG (1–100). */
  calidad: number;
  /** Croma 4:4:4: sin él, el texto fino se ensucia. Solo gráficos. */
  croma444?: boolean;
}

export interface Perfil {
  /** Tope en bytes. Un archivo de exactamente este peso CUMPLE. */
  tope: number;
  /** Sujeto con su artículo, para los mensajes («La foto pesa…»). */
  sujeto: string;
  /** Escalones, en orden. Solo imágenes. */
  escalones?: readonly Escalon[];
  /** Escalones extra del nivel 3 (rescate). Solo imágenes. */
  rescate?: readonly Escalon[];
  /** Mínimo de px que nunca se baja (lado mayor en imagen; lado corto en vídeo). */
  ladoMinimo?: number;
  /** Solo vídeo: velocidad máxima, en bits por segundo. */
  bitrateMax?: number;
}

/**
 * Suelo de dimensiones de las imágenes. Medido: a 1280 y 1080 px el SSIM cae a
 * 0,88–0,92 (la ley pide ≥ 0,95); a 1440 px se mantiene en 0,95–0,97.
 * Una imagen que ya mide menos NO se agranda: el suelo es «no bajar de aquí»,
 * no «llegar hasta aquí».
 */
export const LADO_MINIMO_IMAGEN = 1440;

/**
 * Escalones de una foto, de MÁS a MENOS calidad. Se baja CALIDAD antes que TAMAÑO, porque lo que vende
 * es la textura de la prenda y 18 de 22 fotos medidas ya miden ≤ 1600 px.
 */
export const ESCALONES_FOTO: readonly Escalon[] = [
  { lado: 1920, calidad: 90 },
  { lado: 1920, calidad: 85 },
  { lado: 1920, calidad: 80 },
  { lado: 1600, calidad: 85 },
  { lado: 1920, calidad: 75 },
  { lado: 1600, calidad: 80 },
  { lado: 1600, calidad: 75 },
  { lado: 1440, calidad: 75 },
];

/**
 * Parecido mínimo con el original (SSIM, grises a 1290 px) que debe tener lo que
 * se guarda en los niveles 1 y 2. El compresor lo MIDE en cada subida: el orden de
 * los escalones va de más a menos calidad y se elige el más ligero que lo cumple y cabe.
 * (Medido: una foto de 3 264 px a 1600/q75 quedaba en 0,93 con el orden antiguo.)
 */
export const SSIM_MINIMO = 0.95;

/**
 * Escalones de un gráfico con texto: q90 con croma 4:4:4 y solo se baja el
 * tamaño (la calidad es lo que protege las letras). Con el croma normal el
 * banner de la muestra se quedaba en SSIM 0,943.
 */
export const ESCALONES_GRAFICO: readonly Escalon[] = [
  { lado: 1920, calidad: 90, croma444: true },
  { lado: 1600, calidad: 90, croma444: true },
  { lado: 1440, calidad: 90, croma444: true },
];

/**
 * Escalones de RESCATE (LEY §1 punto 4, nivel 3). Solo se prueban cuando los
 * normales dejan la imagen por encima de tope + tolerancia. Aquí sí se baja de
 * 1440 px o de q75 (el SSIM puede quedar por debajo de 0,95: es el precio de
 * aceptar la subida en vez de rechazarla).
 */
export const ESCALONES_RESCATE_FOTO: readonly Escalon[] = [
  { lado: 1440, calidad: 70 },
  { lado: 1280, calidad: 70 },
];

/** Gráfico con texto: q85 con croma 4:4:4 (las letras aguantan mejor que con el croma normal). */
export const ESCALONES_RESCATE_GRAFICO: readonly Escalon[] = [
  { lado: 1440, calidad: 85, croma444: true },
];

/** Los perfiles. Aquí, y solo aquí, están las cifras de la LEY §2. */
export const PERFILES: Readonly<Record<TipoArchivo, Perfil>> = {
  'foto-web':      { sujeto: 'La foto', tope: 250 * KB, escalones: ESCALONES_FOTO, rescate: ESCALONES_RESCATE_FOTO, ladoMinimo: LADO_MINIMO_IMAGEN },
  'foto-whatsapp': { sujeto: 'La foto', tope: 250 * KB, escalones: ESCALONES_FOTO, rescate: ESCALONES_RESCATE_FOTO, ladoMinimo: LADO_MINIMO_IMAGEN },
  'grafico-texto': { sujeto: 'El gráfico', tope: 400 * KB, escalones: ESCALONES_GRAFICO, rescate: ESCALONES_RESCATE_GRAFICO, ladoMinimo: LADO_MINIMO_IMAGEN },
  'png-alfa':      { sujeto: 'La imagen PNG', tope: 250 * KB, escalones: ESCALONES_FOTO, rescate: ESCALONES_RESCATE_FOTO, ladoMinimo: LADO_MINIMO_IMAGEN },
  'foto-entrante': { sujeto: 'La foto del cliente', tope: 400 * KB, escalones: ESCALONES_FOTO, rescate: ESCALONES_RESCATE_FOTO, ladoMinimo: LADO_MINIMO_IMAGEN },
  // 2 Mb/s = 2 000 000 bits por segundo (el «Mb» de la ley es decimal, como en los códecs).
  'video-landing': { sujeto: 'El vídeo', tope: 4 * MB, ladoMinimo: 720, bitrateMax: 2_000_000 },
  'video-chat':    { sujeto: 'El vídeo', tope: 10 * MB, ladoMinimo: 480 },
  'svg':           { sujeto: 'El SVG', tope: 50 * KB },
  'gif':           { sujeto: 'El GIF', tope: 1.5 * MB },
  'documento':     { sujeto: 'El documento', tope: 5 * MB },
};

/** Tipos que pasan por el compresor de imágenes. */
export const TIPOS_IMAGEN: readonly TipoArchivo[] = [
  'foto-web', 'foto-whatsapp', 'grafico-texto', 'png-alfa', 'foto-entrante',
];

/** Tope en bytes de un tipo. */
export function topeDe(tipo: TipoArchivo): number {
  return PERFILES[tipo].tope;
}

/**
 * Cuánto por encima del tope se acepta tal cual (LEY §1 punto 4, nivel 2):
 * la calidad manda sobre unos kB. 0,5 = hasta un 50 % más.
 */
export const TOLERANCIA = 0.5;

/** Tope + tolerancia, en bytes (redondeado hacia abajo). */
export function topeConTolerancia(tipo: TipoArchivo): number {
  return Math.floor(topeDe(tipo) * (1 + TOLERANCIA));
}

/**
 * Nivel con el que se acepta un archivo (LEY §1 punto 4):
 *   1 cabe · 2 casi cabe (hasta tope + 50 %) · 3 rescate (cabe en tope + 50 % solo
 *   con escalones extra) · 4 aceptado con aviso (nada basta; se guarda la mejor).
 * `viaRescate` dice si el peso se consiguió con escalones de rescate. Un peso
 * inválido (NaN, negativo) es nivel 4: nunca se da por bueno en silencio.
 */
export type Nivel = 1 | 2 | 3 | 4;
export function nivelDe(tipo: TipoArchivo, bytes: number, viaRescate = false): Nivel {
  if (!Number.isFinite(bytes) || bytes < 0) return 4;
  if (bytes <= topeDe(tipo)) return 1;
  if (bytes <= topeConTolerancia(tipo)) return viaRescate ? 3 : 2;
  return 4;
}

/**
 * Código del nivel 4: «ni con rescate cupo». YA NO es un rechazo: el archivo se
 * guarda (la mejor versión) y se avisa. Solo sirve para registrar y vigilar.
 */
export type CodigoPeso = 'SUPERA_TOPE';

export interface VeredictoPeso {
  /** ¿Pesa como mucho el tope? (nivel 1). Un nivel 2–4 NO es un rechazo, ver `nivelDe`. */
  cumple: boolean;
  bytes: number;
  tope: number;
  /** Solo si no cumple. */
  codigo?: CodigoPeso;
  /** Solo si no cumple: texto listo para enseñar, con el peso y el tope. */
  mensaje?: string;
}

/**
 * ¿Un archivo de `bytes` cumple el tope de `tipo`? Peso exacto = cumple.
 * Un peso inválido (negativo, NaN) NO cumple: nunca se da por bueno en silencio.
 */
export function cumpleTope(tipo: TipoArchivo, bytes: number): VeredictoPeso {
  const tope = topeDe(tipo);
  if (Number.isFinite(bytes) && bytes >= 0 && bytes <= tope) return { cumple: true, bytes, tope };
  return { cumple: false, bytes, tope, codigo: 'SUPERA_TOPE', mensaje: mensajeSupera(tipo, bytes) };
}

/** «612 kB», «4,2 MB». Un decimal solo en MB; las cifras enteras de kB se leen mejor. */
export function formatearPeso(bytes: number): string {
  if (!Number.isFinite(bytes)) return '? kB';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / KB)} kB`;
}

/** Aviso del nivel 4 para el panel: visible pero NO bloqueante (LEY §1 punto 4). */
export function mensajeAviso(tipo: TipoArchivo, bytes: number): string {
  const p = PERFILES[tipo];
  return `Subida. Pesa ${formatearPeso(bytes)}, lo recomendado es ${formatearPeso(p.tope)}; si puedes, usa una versión más ligera.`;
}

/** Texto con el peso y el tope (el aviso y las alertas lo reutilizan). */
export function mensajeSupera(tipo: TipoArchivo, bytes: number): string {
  const p = PERFILES[tipo];
  return `${p.sujeto} pesa ${formatearPeso(bytes)} y el tope es ${formatearPeso(p.tope)}.`;
}
