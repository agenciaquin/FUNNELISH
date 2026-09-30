/**
 * Servidor PostgREST FALSO en 127.0.0.1 (puerto libre), para ejercitar el cliente
 * REAL de Supabase (`@supabase/supabase-js`, vía `lib/supabase.ts`) sin tocar
 * ninguna base. Guarda las tablas en memoria y anota cada petición.
 *
 * Uso: const db = await arrancarPostgrest({ tenants: [...] });
 *      process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;   // ANTES de crear clientes
 *
 * Filtros soportados: eq, neq, gt, gte, lt, lte, is, in, not.is. Cuenta con
 * `Prefer: count=exact` (Content-Range). No es PostgREST: solo lo que usan las
 * pruebas. Es infraestructura de prueba, no lógica de la app.
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

export type Peticion = { metodo: string; tabla: string; query: URLSearchParams; cuerpo: any; prefer: string };

export interface PostgrestFalso {
  url: string;
  tablas: Record<string, any[]>;
  peticiones: Peticion[];
  /** Si devuelve true, la petición responde 500. */
  fallar: (p: Peticion) => boolean;
  /** Demora (ms) antes de procesar cada petición: sirve para ver carreras. */
  demoraMs: number;
  cerrar(): Promise<void>;
}

const NO_FILTRO = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function cumple(valor: any, expr: string): boolean {
  if (expr.startsWith('not.')) return !cumple(valor, expr.slice(4));
  const i = expr.indexOf('.');
  const op = expr.slice(0, i);
  const arg = expr.slice(i + 1);
  const v = valor === undefined ? null : valor;
  switch (op) {
    case 'eq': return v !== null && String(v) === arg;
    case 'neq': return v !== null && String(v) !== arg;
    case 'gt': return v !== null && String(v) > arg;
    case 'gte': return v !== null && String(v) >= arg;
    case 'lt': return v !== null && String(v) < arg;
    case 'lte': return v !== null && String(v) <= arg;
    case 'is': return arg === 'null' ? v === null : String(v) === arg;
    case 'in': {
      const lista = arg.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
      return v !== null && lista.includes(String(v));
    }
    default: throw new Error(`filtro no soportado: ${expr}`);
  }
}

function filtrar(filas: any[], q: URLSearchParams): any[] {
  return filas.filter(f => {
    for (const [k, v] of q.entries()) {
      if (NO_FILTRO.has(k)) continue;
      if (!cumple(f[k], v)) return false;
    }
    return true;
  });
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((ok, mal) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', c => { s += c; });
    req.on('end', () => ok(s));
    req.on('error', mal);
  });
}

export async function arrancarPostgrest(inicial: Record<string, any[]> = {}): Promise<PostgrestFalso> {
  const db: PostgrestFalso = {
    url: '',
    tablas: JSON.parse(JSON.stringify(inicial)),
    peticiones: [],
    fallar: () => false,
    demoraMs: 0,
    cerrar: async () => {},
  };

  const servidor = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const m = u.pathname.match(/^\/rest\/v1\/([^/]+)$/);
    const texto = await leerCuerpo(req);
    const p: Peticion = {
      metodo: req.method ?? 'GET',
      tabla: m ? decodeURIComponent(m[1]) : u.pathname,
      query: u.searchParams,
      cuerpo: texto ? JSON.parse(texto) : undefined,
      prefer: String(req.headers['prefer'] ?? ''),
    };
    db.peticiones.push(p);
    if (db.demoraMs) await new Promise(r => setTimeout(r, db.demoraMs));

    const json = (status: number, cuerpo: any, extra: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
      res.end(p.metodo === 'HEAD' || cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
    };

    if (!m) return json(404, { message: 'ruta desconocida' });
    if (db.fallar(p)) return json(500, { message: 'fallo simulado', code: 'XX000' });

    const tabla = (db.tablas[p.tabla] ??= []);
    const coinciden = filtrar(tabla, p.query);
    const quiereFilas = p.prefer.includes('return=representation');
    const objeto = String(req.headers['accept'] ?? '').includes('vnd.pgrst.object+json');

    try {
      switch (p.metodo) {
        case 'GET':
        case 'HEAD': {
          const extra: Record<string, string> = {};
          if (p.prefer.includes('count=exact')) {
            extra['Content-Range'] = coinciden.length ? `0-${coinciden.length - 1}/${coinciden.length}` : `*/0`;
          }
          if (objeto) {
            if (coinciden.length !== 1) return json(406, { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
            return json(200, coinciden[0], extra);
          }
          return json(200, coinciden, extra);
        }
        case 'POST': {
          const filas = (Array.isArray(p.cuerpo) ? p.cuerpo : [p.cuerpo])
            .map((f: any) => ({ id: randomUUID(), creado_at: new Date().toISOString(), ...f }));
          tabla.push(...filas);
          return quiereFilas ? json(201, filas) : json(201, undefined);
        }
        case 'PATCH': {
          for (const f of coinciden) Object.assign(f, p.cuerpo);
          return quiereFilas ? json(200, coinciden) : json(204, undefined);
        }
        case 'DELETE': {
          db.tablas[p.tabla] = tabla.filter(f => !coinciden.includes(f));
          return quiereFilas ? json(200, coinciden) : json(204, undefined);
        }
        default:
          return json(405, { message: 'método no soportado' });
      }
    } catch (e: any) {
      return json(400, { message: String(e?.message ?? e) });
    }
  });

  await new Promise<void>(ok => servidor.listen(0, '127.0.0.1', () => ok()));
  const { port } = servidor.address() as AddressInfo;
  db.url = `http://127.0.0.1:${port}`;
  db.cerrar = () => new Promise<void>(ok => { servidor.closeAllConnections?.(); servidor.close(() => ok()); });
  return db;
}

/** Peticiones a una tabla (opcionalmente de un método). */
export function de(db: PostgrestFalso, tabla: string, metodo?: string): Peticion[] {
  return db.peticiones.filter(p => p.tabla === tabla && (!metodo || p.metodo === metodo));
}
