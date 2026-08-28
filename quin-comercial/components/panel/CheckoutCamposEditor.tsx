'use client';

// Editor de los CAMPOS del checkout (compartido): renombrar/ocultar los campos
// fijos del formulario y agregar campos personalizados. Se usa en dos lugares
// (el panel "Productos del checkout" y el editor de bloques) sobre el MISMO dato:
// funnel.checkout_config. Es un componente de nivel de módulo (import estable),
// así que no se remonta al escribir → no se pierde el foco.

type CampoFijoCfg = { label?: string; oculto?: boolean };
type TipoCampoExtra = 'texto' | 'notas' | 'telefono' | 'email' | 'selector' | 'checkbox' | 'fecha';
type CampoExtra = { id: string; label: string; tipo: TipoCampoExtra; requerido?: boolean; placeholder?: string; opciones?: string[] };
type CheckoutCfg = { camposFijos?: Record<string, CampoFijoCfg>; camposExtra?: CampoExtra[]; [k: string]: any };

const FIJOS: { id: string; def: string; ocultable?: boolean }[] = [
  { id: 'nombre', def: 'NOMBRE' }, { id: 'apellidos', def: 'APELLIDOS' },
  { id: 'whatsapp', def: 'WHATSAPP' }, { id: 'correo', def: 'CORREO ELECTRÓNICO', ocultable: true },
  { id: 'direccion', def: 'DIRECCIÓN' }, { id: 'barrio', def: 'BARRIO' },
  { id: 'municipio', def: 'MUNICIPIO (CIUDAD)' }, { id: 'departamento', def: 'DEPARTAMENTO' },
];
const TIPOS: { v: TipoCampoExtra; l: string }[] = [
  { v: 'texto', l: 'Texto corto' }, { v: 'notas', l: 'Notas (texto largo)' },
  { v: 'telefono', l: 'Teléfono' }, { v: 'email', l: 'Correo' },
  { v: 'selector', l: 'Selector (desplegable)' }, { v: 'checkbox', l: 'Casilla (sí/no)' },
  { v: 'fecha', l: 'Fecha' },
];
const nid = () => 'campo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function CheckoutCamposEditor({ config, onChange }: {
  config: CheckoutCfg | null | undefined;
  onChange: (cfg: CheckoutCfg) => void;
}) {
  const cfg: CheckoutCfg = config ?? {};
  const cFijos: Record<string, CampoFijoCfg> = cfg.camposFijos ?? {};
  const cExtra: CampoExtra[] = Array.isArray(cfg.camposExtra) ? cfg.camposExtra : [];

  const setFijo = (id: string, patch: CampoFijoCfg) =>
    onChange({ ...cfg, camposFijos: { ...cFijos, [id]: { ...(cFijos[id] ?? {}), ...patch } } });
  const setExtras = (nv: CampoExtra[]) => onChange({ ...cfg, camposExtra: nv });
  const addExtra = () => setExtras([...cExtra, { id: nid(), label: 'Nuevo campo', tipo: 'texto', requerido: false }]);
  const updE = (i: number, patch: Partial<CampoExtra>) => setExtras(cExtra.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const delE = (i: number) => setExtras(cExtra.filter((_, j) => j !== i));
  const moveE = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= cExtra.length) return; const a = [...cExtra]; [a[i], a[j]] = [a[j], a[i]]; setExtras(a); };

  const inp = 'text-[12px] border border-[#E8E8E8] rounded px-2 py-1.5';

  return (
    <div className="space-y-3">
      {/* Cómo se muestran color/talla al cliente */}
      <label className="flex items-center gap-2 rounded-xl border border-[#E8E8E8] p-3 bg-white cursor-pointer">
        <input type="checkbox" checked={cfg.variablesDesplegable === true} onChange={e => onChange({ ...cfg, variablesDesplegable: e.target.checked })} className="w-4 h-4" />
        <span className="text-[12px]"><b>Mostrar color y talla como desplegable (▼)</b> — en vez de botones. El color elegido muestra su foto al lado.</span>
      </label>

      {/* Renombrar / ocultar los campos fijos */}
      <div className="rounded-xl border border-[#E8E8E8] p-3 bg-white space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#9A9A9A]">Campos del formulario (renombrar)</div>
        {FIJOS.map(f => (
          <div key={f.id} className="flex items-center gap-2">
            <input
              value={cFijos[f.id]?.label ?? ''}
              onChange={e => setFijo(f.id, { label: e.target.value })}
              placeholder={f.def}
              className={`flex-1 ${inp}`}
            />
            {f.ocultable ? (
              <label className="flex items-center gap-1 text-[11px] shrink-0" title="Ocultar este campo en el checkout">
                <input type="checkbox" checked={cFijos[f.id]?.oculto === true} onChange={e => setFijo(f.id, { oculto: e.target.checked })} /> ocultar
              </label>
            ) : <span className="w-[52px] shrink-0" />}
          </div>
        ))}
        <p className="text-[10px] text-[#9A9A9A]">Deja vacío para el nombre por defecto. Solo el Correo se puede ocultar (los demás son obligatorios para el pedido).</p>
      </div>

      {/* Campos personalizados */}
      <div className="rounded-xl border border-[#E8E8E8] p-3 bg-white space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#9A9A9A]">Campos personalizados</div>
        {cExtra.length === 0 && <p className="text-[11px] text-[#9A9A9A]">Agrega campos extra (texto, teléfono, notas, selector…). Se muestran en el checkout y llegan en el pedido/confirmación.</p>}
        {cExtra.map((f, i) => (
          <div key={f.id ?? i} className="rounded-lg border border-[#EEE] p-2 space-y-1.5 bg-[#FAFAF8]">
            <div className="flex items-center gap-1">
              <input value={f.label ?? ''} onChange={e => updE(i, { label: e.target.value })} placeholder="Nombre del campo (ej. Punto de referencia)" className={`flex-1 ${inp}`} />
              <button onClick={() => moveE(i, -1)} disabled={i === 0} className="text-[12px] px-1 disabled:opacity-25" title="Subir">↑</button>
              <button onClick={() => moveE(i, 1)} disabled={i === cExtra.length - 1} className="text-[12px] px-1 disabled:opacity-25" title="Bajar">↓</button>
              <button onClick={() => delE(i)} className="text-[12px] px-1 text-[#DC2626]" title="Eliminar">🗑</button>
            </div>
            <div className="flex items-center gap-2">
              <select value={f.tipo ?? 'texto'} onChange={e => updE(i, { tipo: e.target.value as TipoCampoExtra })} className={`flex-1 ${inp} bg-white`}>
                {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[11px] shrink-0"><input type="checkbox" checked={f.requerido === true} onChange={e => updE(i, { requerido: e.target.checked })} /> obligatorio</label>
            </div>
            {f.tipo === 'selector' && (
              <textarea
                value={Array.isArray(f.opciones) ? f.opciones.join('\n') : ''}
                onChange={e => updE(i, { opciones: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                rows={3} placeholder={'Una opción por línea…\nOpción A\nOpción B'}
                className={`w-full ${inp}`}
              />
            )}
            {f.tipo !== 'selector' && f.tipo !== 'checkbox' && (
              <input value={f.placeholder ?? ''} onChange={e => updE(i, { placeholder: e.target.value })} placeholder="Texto de ayuda (opcional)" className={`w-full ${inp}`} />
            )}
          </div>
        ))}
        <button onClick={addExtra} className="w-full text-[12px] text-[#00A89D] font-semibold border border-dashed border-[#00A89D]/40 rounded-lg py-1.5 hover:bg-[#00A89D]/5">+ Agregar campo personalizado</button>
      </div>

      <p className="text-[11px] text-[#9A9A9A]">Los campos personalizados aparecen en la confirmación de WhatsApp como líneas “Etiqueta: valor”. No cambian la lógica del pedido.</p>
    </div>
  );
}
