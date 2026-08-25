// Lee el Entrenamiento principal (y el comportamiento) del bot desde Supabase
// y lo guarda en "entrenamiento-actual.txt" para revisarlo.
// Uso:  node dump-entrenamiento.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function cargarEnv(p) {
  const env = {};
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch { /* no env */ }
  return env;
}

const env = cargarEnv('.env.local');
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('No encontré SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const out = [];
const log = (s = '') => { out.push(String(s)); console.log(s); };

log('DB: ' + url.replace(/https:\/\/|\.supabase\.co/g, ''));

// bot_config SIN asumir columnas: traemos todo y filtramos en JS.
const { data: cfgs, error } = await sb.from('bot_config').select('*');
if (error) { log('ERROR leyendo bot_config: ' + error.message); }
else {
  log(`\nTotal filas en bot_config: ${(cfgs || []).length}`);
  const keys = [...new Set((cfgs || []).map(c => c.key))];
  log('Claves (key) que existen: ' + keys.join(', '));

  for (const clave of ['system_prompt', 'comportamiento']) {
    const filas = (cfgs || []).filter(c => c.key === clave);
    log(`\n\n===================== ${clave.toUpperCase()} (${filas.length}) =====================`);
    for (const c of filas) {
      const tid = c.tenant_id ?? c.empresa_id ?? '(sin tenant)';
      log(`\n---------- tenant=${tid} | ${String(c.value || '').length} caracteres ----------`);
      log(String(c.value || '(vacío)'));
    }
  }
}

fs.writeFileSync('entrenamiento-actual.txt', out.join('\n'), 'utf8');
console.log('\n\n✅ Guardado en entrenamiento-actual.txt');
