'use client';

import { ETIQUETA_ESTADO, colorEstado } from '@/lib/ventas-vendedores/estados';

export interface ItemVV {
  id: number; id_item: number | null; id_variante: number | null; id_catalogo: number | null; catalogo: string | null;
  nombre: string | null; referencia: string | null; tipo: string | null; genero: string | null; color: string | null;
  talla: string | null; cantidad: number; precio: number | null; sku: string | null; foto_oficial: string | null;
  foto_vendedor: string | null; confianza: number | null; estado: string; descripcion: string | null; candidatos: any;
}
export interface VentaVV {
  id: string; codigo: string; vendedor_tel: string; vendedor_nombre: string | null; estado: string;
  cliente_nombre: string | null; cliente_celular: string | null; cliente_identificacion: string | null; cliente_correo: string | null;
  departamento: string | null; municipio: string | null; direccion: string | null; barrio: string | null;
  complemento: string | null; referencia_dir: string | null; transportadora: string | null; tipo_pago: string | null;
  total: number | null; abono: number | null; observaciones: string | null; faltantes: string[]; motivo_revision: string | null;
  fotos_vendedor: string[]; es_prueba: boolean; effi_estado: string | null; effi_remision: string | null; effi_payload?: any; conversacion_id?: string | null;
  effi_intentos: number; effi_enviado_at: string | null; confirmado_at: string | null; creado_at: string; actualizado_at: string;
  items: ItemVV[];
}

export const pesos = (n: number | null | undefined) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
export const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).replace('.', '')} ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}`;
};
export const telBonito = (t: string | null) => String(t ?? '').replace(/^57/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1  $2  $3');

export function PildoraEstado({ estado }: { estado: string }) {
  const c = colorEstado(estado);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: c.color, background: c.fondo }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
      {estado === 'en_effi' ? 'En Effi' : ETIQUETA_ESTADO[estado as keyof typeof ETIQUETA_ESTADO] ?? estado}
    </span>
  );
}

