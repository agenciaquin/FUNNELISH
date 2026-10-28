/**
 * Freno de escrituras en local.
 *
 * localhost y producción usan la MISMA base de Supabase: "probar en local" escribe
 * en los datos reales. En local se puede leer todo, pero nada se guarda, salvo que
 * se abra a propósito con NEXT_PUBLIC_ESCRITURA_LOCAL=abierta en .env.local.
 */

export const ESCRITURA_LOCAL_ABIERTA = process.env.NEXT_PUBLIC_ESCRITURA_LOCAL === 'abierta';

export function esHostLocal(host: string): boolean {
  const h = host.toLowerCase().split(':')[0];
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
}

// El servidor no ve el navegador: es local si corre con `next dev` o si .env.local lo marca.
// Producción no tiene ninguna de las dos cosas, así que allí nunca se frena.
export const SERVIDOR_LOCAL = process.env.NODE_ENV === 'development' || process.env.QUINCHAT_LOCAL === '1';

const ESCRITURAS_TABLA = new Set(['insert', 'update', 'upsert', 'delete']);
const ESCRITURAS_ARCHIVO = new Set(['upload', 'update', 'remove', 'move', 'copy', 'uploadToSignedUrl']);

// Responde como Supabase cuando falla ({ data: null, error }), para que el código que ya
// revisa `error` muestre el fallo y deshaga lo que pintó. Encadenable: .insert().select().single()
function bloqueada(que: string): any {
  console.warn(`[local protegido] ${que}: no se guarda en la base real`);
  const resultado = {
    data: null, count: null, status: 423, statusText: 'Locked',
    error: { message: `Local protegido: ${que} no se guarda en la base real.`, code: 'LOCAL_SOLO_LECTURA', details: '', hint: '' },
  };
  const cadena: any = new Proxy(function () {}, {
    get: (_, k) => (k === 'then' ? (ok: any, mal: any) => Promise.resolve(resultado).then(ok, mal) : () => cadena),
    apply: () => cadena,
  });
  return cadena;
}

function interceptar<T extends object>(obj: T, bloquear: Set<string>, nombre: string): T {
  return new Proxy(obj, {
    get(t, k) {
      if (typeof k === 'string' && bloquear.has(k)) return () => bloqueada(`${k} en ${nombre}`);
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

export function frenarEscrituras<T extends object>(cliente: T): T {
  return new Proxy(cliente, {
    get(t: any, k) {
      if (k === 'from') return (tabla: string) => interceptar(t.from(tabla), ESCRITURAS_TABLA, tabla);
      if (k === 'storage') {
        return new Proxy(t.storage, {
          get(st: any, m) {
            if (m === 'from') return (bucket: string) => interceptar(st.from(bucket), ESCRITURAS_ARCHIVO, `archivos/${bucket}`);
            const v = Reflect.get(st, m);
            return typeof v === 'function' ? v.bind(st) : v;
          },
        });
      }
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}
