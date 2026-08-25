// Registro de proveedores de IA y cliente unificado.
// La mayoría son compatibles con el formato OpenAI (chat/completions): un solo
// código, solo cambia baseURL + apiKey + modelo. Anthropic usa su propio formato.

export type ProveedorId = 'gemini' | 'groq' | 'cerebras' | 'mistral' | 'openrouter' | 'github' | 'nvidia' | 'openai' | 'anthropic';

export interface ProveedorInfo {
  id: ProveedorId;
  nombre: string;
  baseURL: string;          // termina en /
  modeloDefault: string;
  gratis: boolean;
  formato: 'openai' | 'anthropic';
  ayuda: string;            // dónde saca la llave
  limiteDiarioGratis?: number; // aprox. de solicitudes/día del plan gratis (solo para las que NO reportan sus límites)
  soportaVision?: boolean;  // ¿el proveedor puede LEER imágenes?
  modeloVision?: string;    // modelo a usar cuando el mensaje trae imagen
  soportaAudio?: boolean;   // ¿el proveedor puede TRANSCRIBIR notas de voz?
  modeloAudio?: string;     // modelo de transcripción (Whisper) a usar
  recomendado?: boolean;    // se muestra con el sello "RECOMENDADO" en el panel
}

// Orden: primero las MÁS recomendadas / que dan más tokens gratis. El orden de
// este arreglo es el que se muestra en el panel (no afecta la rotación del bot,
// que va por la prioridad de cada llave guardada).
export const PROVEEDORES: ProveedorInfo[] = [
  { id: 'groq',       nombre: 'Groq',          baseURL: 'https://api.groq.com/openai/v1/',                           modeloDefault: 'llama-3.3-70b-versatile',  gratis: true,  formato: 'openai',    ayuda: 'console.groq.com/keys', soportaVision: true, modeloVision: 'meta-llama/llama-4-scout-17b-16e-instruct', soportaAudio: true, modeloAudio: 'whisper-large-v3', recomendado: true },
  { id: 'nvidia',     nombre: 'NVIDIA NIM',    baseURL: 'https://integrate.api.nvidia.com/v1/',                     modeloDefault: 'meta/llama-3.3-70b-instruct', gratis: true, formato: 'openai', ayuda: 'build.nvidia.com', limiteDiarioGratis: 1000, recomendado: true },
  { id: 'gemini',     nombre: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', modeloDefault: 'gemini-2.5-flash',        gratis: true,  formato: 'openai',    ayuda: 'aistudio.google.com/app/apikey', limiteDiarioGratis: 200, soportaVision: true, modeloVision: 'gemini-2.5-flash' },
  { id: 'cerebras',   nombre: 'Cerebras',      baseURL: 'https://api.cerebras.ai/v1/',                               modeloDefault: 'gpt-oss-120b',             gratis: true,  formato: 'openai',    ayuda: 'cloud.cerebras.ai' },
  { id: 'mistral',    nombre: 'Mistral AI',    baseURL: 'https://api.mistral.ai/v1/',                                modeloDefault: 'mistral-small-latest',     gratis: true,  formato: 'openai',    ayuda: 'console.mistral.ai/api-keys', soportaVision: true, modeloVision: 'pixtral-12b-2409' },
  { id: 'openrouter', nombre: 'OpenRouter',    baseURL: 'https://openrouter.ai/api/v1/',                             modeloDefault: 'meta-llama/llama-3.3-70b-instruct:free', gratis: true, formato: 'openai', ayuda: 'openrouter.ai/keys' },
  { id: 'github',     nombre: 'GitHub Models', baseURL: 'https://models.inference.ai.azure.com/',                    modeloDefault: 'gpt-4o-mini',              gratis: true,  formato: 'openai',    ayuda: 'github.com/marketplace/models', limiteDiarioGratis: 150 },
  { id: 'openai',     nombre: 'OpenAI',        baseURL: 'https://api.openai.com/v1/',                                modeloDefault: 'gpt-4o-mini',              gratis: false, formato: 'openai',    ayuda: 'platform.openai.com/api-keys', soportaVision: true, modeloVision: 'gpt-4o-mini', soportaAudio: true, modeloAudio: 'whisper-1' },
  { id: 'anthropic',  nombre: 'Anthropic (Claude)', baseURL: 'https://api.anthropic.com/v1/',                        modeloDefault: 'claude-3-5-haiku-latest',  gratis: false, formato: 'anthropic', ayuda: 'console.anthropic.com' },
];

export function proveedorDe(id: string): ProveedorInfo | undefined {
  return PROVEEDORES.find(p => p.id === id);
}

export interface Msg { role: 'system' | 'user' | 'assistant'; content: string }

/** Límite de uso que reporta el proveedor en las cabeceras de su respuesta. */
export interface RateInfo {
  limite: number | null;    // total de la ventana (ej. solicitudes del día)
  restante: number | null;  // lo que queda
  unidad: 'tokens' | 'solicitudes';
  resetSeg: number | null;  // segundos hasta que se recarga (si se puede saber)
}

const soloNum = (v: string | null): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : Math.round(n);
};

// Convierte el "reset" (que viene en formatos distintos) a segundos desde ahora.
function parseReset(v: string | null): number | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{13}$/.test(s)) { const d = Number(s) - Date.now();               return d > 0 ? Math.round(d / 1000) : 0; } // unix ms
  if (/^\d{10}$/.test(s)) { const d = Number(s) - Math.floor(Date.now()/1000); return d > 0 ? d : 0; }               // unix s
  let total = 0, ok = false;
  const grab = (re: RegExp, mult: number) => { const m = s.match(re); if (m) { total += parseFloat(m[1]) * mult; ok = true; } };
  grab(/([\d.]+)\s*h/, 3600);
  grab(/([\d.]+)\s*ms/, 0.001);
  grab(/([\d.]+)\s*m(?!s)/, 60);
  grab(/([\d.]+)\s*(?<!m)s/, 1);
  if (ok) return Math.round(total);
  const n = Number(s); return isNaN(n) ? null : Math.round(n); // segundos simples
}

// Lee los límites de las cabeceras (formato estilo OpenAI que usan Groq, Cerebras,
// Mistral, OpenRouter, GitHub…). Prioriza SOLICITUDES (suele ser el tope diario del
// plan gratis); si no, usa TOKENS (suele ser por minuto).
function leerLimites(h: Headers): RateInfo | null {
  let limite = soloNum(h.get('x-ratelimit-limit-requests'));
  let restante = soloNum(h.get('x-ratelimit-remaining-requests'));
  let resetRaw = h.get('x-ratelimit-reset-requests');
  let unidad: 'tokens' | 'solicitudes' = 'solicitudes';

  if (limite == null && restante == null) { // OpenRouter: x-ratelimit-limit / remaining / reset
    limite = soloNum(h.get('x-ratelimit-limit'));
    restante = soloNum(h.get('x-ratelimit-remaining'));
    resetRaw = h.get('x-ratelimit-reset');
  }
  if (limite == null && restante == null) { // por tokens (suele ser por minuto)
    limite = soloNum(h.get('x-ratelimit-limit-tokens'));
    restante = soloNum(h.get('x-ratelimit-remaining-tokens'));
    resetRaw = h.get('x-ratelimit-reset-tokens');
    unidad = 'tokens';
  }
  if (limite == null && restante == null) return null;
  return { limite, restante, unidad, resetSeg: parseReset(resetRaw) };
}

// Una imagen para visión puede llegar como URL/data-string o como objeto
// { mimeType, base64 } (lo que da WhatsApp). Ambos se normalizan a una URL
// que entienda el formato OpenAI multimodal (image_url).
export type ImagenIA = string | { mimeType?: string; base64?: string; url?: string };

function imagenAUrl(img: ImagenIA): string | null {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (img.url) return img.url;
  if (img.base64) return `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`;
  return null;
}

// Adjunta imágenes (URLs o {mimeType,base64}) al ÚLTIMO mensaje de usuario, en
// formato OpenAI multimodal (image_url). Sirve para Groq (Llama 4), Gemini, etc.
function conImagenes(mensajes: Msg[], imagenes: ImagenIA[]): any[] {
  const urls = imagenes.map(imagenAUrl).filter(Boolean) as string[];
  const out: any[] = mensajes.map(m => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === 'user') {
      const txt = typeof out[i].content === 'string' ? out[i].content : '';
      out[i] = {
        role: 'user',
        content: [
          { type: 'text', text: txt || '¿Qué ves en esta imagen? Responde según tu rol de ventas.' },
          ...urls.map(url => ({ type: 'image_url', image_url: { url } })),
        ],
      };
      break;
    }
  }
  return out;
}

/** Llama al proveedor. Si `imagenes` trae URLs o base64, las manda para visión. Devuelve el texto + límites. Lanza Error con .status en fallo. */
export async function llamarProveedor(p: ProveedorInfo, apiKey: string, modelo: string, mensajes: Msg[], maxTokens = 500, imagenes?: ImagenIA[]): Promise<{ texto: string; rate: RateInfo | null }> {
  if (p.formato === 'anthropic') { const texto = await llamarAnthropic(apiKey, modelo, mensajes, maxTokens); return { texto, rate: null }; }

  const hayImg = Array.isArray(imagenes) && imagenes.length > 0;
  const cuerpoMsgs = hayImg ? conImagenes(mensajes, imagenes!) : mensajes;

  const res = await fetch(p.baseURL + 'chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, messages: cuerpoMsgs, temperature: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) { const e: any = new Error('IA ' + res.status); e.status = res.status; throw e; }
  const rate = leerLimites(res.headers);
  const d = await res.json();
  return { texto: d?.choices?.[0]?.message?.content ?? '', rate };
}

async function llamarAnthropic(apiKey: string, modelo: string, mensajes: Msg[], maxTokens: number): Promise<string> {
  const system = mensajes.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const msgs = mensajes.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, system, messages: msgs, max_tokens: maxTokens }),
  });
  if (!res.ok) { const e: any = new Error('anthropic ' + res.status); e.status = res.status; throw e; }
  const d = await res.json();
  return d?.content?.[0]?.text ?? '';
}
