'use client';

import { useState, useEffect } from 'react';

interface Empresa {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creado_at: string;
  wa_conectado: boolean;
  usuarios: number;
  conversaciones: number;
  ia_agencia: boolean;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export default function EmpresasPanel() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  // form
  const [nombre, setNombre] = useState('');
  const [slug, setSlug]     = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');

  async function cargar() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/tenants');
      const d = await r.json();
      if (r.ok) setEmpresas(d.empresas ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, []);

  function onNombre(v: string) {
    setNombre(v);
    if (!slugTocado) setSlug(slugify(v));
    setMsg(null);
  }

  async function crear() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, slug, usuario: { email, password: pass, nombre } }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ ok: true, text: `Empresa "${nombre}" creada. El cliente ya puede entrar con ${email}.` });
        setNombre(''); setSlug(''); setSlugTocado(false); setEmail(''); setPass('');
        setShowForm(false);
        cargar();
      } else {
        setMsg({ ok: false, text: d.error ?? 'Error al crear' });
      }
    } catch {
      setMsg({ ok: false, text: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  }

  // El dueño activa/desactiva el acceso de una empresa a la IA de agencia.
  const [tocandoIA, setTocandoIA] = useState<string | null>(null);
  async function toggleIaAgencia(id: string, valor: boolean) {
    setTocandoIA(id);
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ia_agencia: valor } : e)); // optimista
    try {
      const r = await fetch('/api/admin/tenants', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ia_agencia: valor }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg({ ok: false, text: d.error ?? 'No se pudo cambiar el acceso' }); cargar(); }
    } catch { setMsg({ ok: false, text: 'Error de conexión' }); cargar(); }
    finally { setTocandoIA(null); }
  }

  const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[#0D0D0D] font-bold text-lg">Empresas</h1>
          <button
            onClick={() => { setShowForm(s => !s); setMsg(null); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] active:scale-95 transition-all"
          >
            {showForm ? 'Cancelar' : '+ Nueva empresa'}
          </button>
        </div>
        <p className="text-xs text-[#6B6B6B] mb-5">Da de alta un cliente nuevo: crea su empresa y su usuario de acceso. En la columna <b>IA Agencia</b> decides tú, y solo tú, qué empresa puede usar tu IA de respaldo (con créditos). Los clientes nuevos entran apagados; la enciendes con el interruptor cuando quieras.</p>

        {msg && (
          <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {showForm && (
          <div className="mb-6 rounded-2xl border border-[#E8E8E8] bg-white p-4 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-[#0D0D0D] mb-1">Nombre de la empresa</label>
              <input value={nombre} onChange={e => onNombre(e.target.value)} className={inputCls} placeholder="Ej: Buzos La 33" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0D0D0D] mb-1">Slug (para la URL del webhook)</label>
              <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTocado(true); }} className={inputCls + ' font-mono'} placeholder="buzos-la-33" autoComplete="off" />
              <p className="text-[11px] text-[#9A9A9A] mt-1">Minúsculas, números y guiones. Debe ser único.</p>
            </div>
            <div className="border-t border-[#EFEFEF] pt-3">
              <p className="text-xs font-semibold text-[#0D0D0D] mb-2">Usuario de acceso del cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={email} onChange={e => { setEmail(e.target.value); setMsg(null); }} className={inputCls} placeholder="correo@empresa.com" autoComplete="off" />
                <input value={pass} onChange={e => { setPass(e.target.value); setMsg(null); }} className={inputCls} placeholder="contraseña (mín. 8)" autoComplete="new-password" />
              </div>
            </div>
            <button
              onClick={crear}
              disabled={saving || !nombre || !slug || !email || pass.length < 8}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#00A89D] text-white hover:bg-[#00847A] disabled:opacity-40 transition-all"
            >
              {saving ? 'Creando…' : 'Crear empresa'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-[#9A9A9A] text-sm">Cargando…</div>
        ) : empresas.length === 0 ? (
          <div className="text-[#9A9A9A] text-sm">Aún no hay empresas.</div>
        ) : (
          <div className="rounded-2xl border border-[#E8E8E8] overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F5F5] text-[#6B6B6B] text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Empresa</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Slug</th>
                  <th className="text-center px-4 py-2.5 font-semibold">WhatsApp</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Usuarios</th>
                  <th className="text-center px-4 py-2.5 font-semibold" title="Conversaciones atendidas por el bot (acumulado). Se cuentan aunque esté gratis.">Conversaciones</th>
                  <th className="text-center px-4 py-2.5 font-semibold" title="Acceso a tu IA de agencia (respaldo con créditos)">IA Agencia</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map(e => (
                  <tr key={e.id} className="border-t border-[#F0F0F0] text-[#3A3A3A]">
                    <td className="px-4 py-2.5 font-medium">{e.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-[#9A9A9A]">{e.slug}</td>
                    <td className="px-4 py-2.5 text-center">{e.wa_conectado ? '🟢' : '⚪'}</td>
                    <td className="px-4 py-2.5 text-center">{e.usuarios}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-[#00847A]">{(e.conversaciones ?? 0).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleIaAgencia(e.id, !e.ia_agencia)}
                        disabled={tocandoIA === e.id}
                        title={e.ia_agencia ? 'Acceso activo — clic para quitar' : 'Sin acceso — clic para dar acceso'}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${e.ia_agencia ? 'bg-[#00A89D]' : 'bg-[#D5D5D5]'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${e.ia_agencia ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">{e.activo ? <span className="text-emerald-600 font-medium">activa</span> : <span className="text-[#9A9A9A]">inactiva</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
