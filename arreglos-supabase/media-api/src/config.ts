import 'dotenv/config';

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Copia .env.example a .env y rellénala.`);
  return valor;
}

function entero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (!valor) return porDefecto;
  const n = Number.parseInt(valor, 10);
  if (Number.isNaN(n)) throw new Error(`La variable ${nombre} debe ser un número entero, se recibió "${valor}".`);
  return n;
}

export const config = {
  supabaseUrl: requerido('SUPABASE_URL'),
  serviceRoleKey: requerido('SUPABASE_SERVICE_ROLE_KEY'),
  bucket: process.env.BUCKET ?? 'chat-media',
  puerto: entero('PORT', 8080),
  apiToken: process.env.API_TOKEN ?? '',
  cacheControl: process.env.CACHE_CONTROL ?? '31536000',

  /*
   * PERFILES DE CALIDAD — leer antes de bajarlos.
   *
   * Estos valores son deliberadamente conservadores: preservan la resolución
   * original en vez de recortarla. La tentación de bajarlos es fuerte porque el
   * ahorro sube, pero medido sobre archivos reales del bucket la diferencia no
   * compensa:
   *
   *   imagen 1920x1920 PNG de 5,53 MB      imagen 3264x3264 JPEG de 3,64 MB
   *     1920px q85 ->  495 kB  (-91,3%)      1920px q85 ->  630 kB  (-83,1%)
   *     1440px q82 ->  212 kB  (-96,3%)      1440px q82 ->  238 kB  (-93,6%)
   *     1080px q72 ->   98 kB  (-98,3%)      1080px q72 ->   79 kB  (-97,9%)
   *
   *   video 1080x1920 de 37,7 MB a 18.163 kb/s
   *     1080px CRF 23 -> 6,5 MB  (-82,8%)
   *      720px CRF 30 -> 1,5 MB  (-95,9%)
   *
   * La conclusión que importa: **el ahorro no viene de recortar calidad, viene
   * del formato**. Las imagenes estaban guardadas como PNG (sin pérdida, pésimo
   * para fotografía) y como JPEG sobrecodificado; los vídeos son exports crudos
   * de móvil a 18 Mbps. Solo pasarlas a WebP y H.264 a resolución y calidad
   * plenas ya elimina el 83-91% del peso.
   *
   * Bajar de aquí gana unos pocos puntos porcentuales sobre un egress que ya
   * queda muy por debajo del cupo del plan, a cambio de degradar fotos de
   * producto que son el escaparate del negocio. No merece la pena.
   */
  imagen: {
    anchoMax: entero('IMAGEN_ANCHO_MAX', 1920),
    calidad: entero('IMAGEN_CALIDAD', 85),
    // Por debajo de este tamaño no compensa recomprimir.
    minimoBytes: entero('IMAGEN_MINIMO_BYTES', 200_000),
  },

  video: {
    anchoMax: entero('VIDEO_ANCHO_MAX', 1080),
    crf: entero('VIDEO_CRF', 23),
    fpsMax: entero('VIDEO_FPS_MAX', 30),
    audioKbps: entero('VIDEO_AUDIO_KBPS', 128),
    minimoBytes: entero('VIDEO_MINIMO_BYTES', 500_000),
  },
} as const;

/**
 * Ahorro mínimo para que merezca la pena sustituir el archivo.
 * Si la versión optimizada no baja al menos un 10%, se descarta y se conserva
 * el original: no compensa perder calidad a cambio de nada.
 */
export const AHORRO_MINIMO = 0.1;
