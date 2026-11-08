/**
 * Foto VIGENTE de un color del catálogo (08-nov-2026).
 *
 * Los embudos guardan, en sus selectores, la URL de la foto del color tal como estaba el día que se
 * armó el embudo. Cuando después se cambian las fotos del catálogo (p. ej. por las rotuladas de
 * KlixmSoft), el embudo sigue apuntando a la vieja y la confirmación salía con la foto sin el nombre
 * del catálogo. Dos formas de URL vieja:
 *   · catalogo/marcas/<id del COLOR>-s2-xxxx.jpg         → la foto actual de ese color
 *   · catalogo/marcas/<id del CATÁLOGO>-179-s2-xxxx.jpg   → la foto actual del color pedido en ese catálogo
 *     (para esta hace falta el color: se pasa en `colores`, en el mismo orden que las URLs)
 * Solo lee; no modifica el embudo ni el catálogo. Si algo falla, devuelve la URL original.
 */
const ID_EN_URL = /\/catalogo\/marcas\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i;
const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function fotosVigentes(supabase: any, urls: string[], colores: (string | null | undefined)[] = []): Promise<string[]> {
  try {
    const idDe = (u: string) => String(u ?? '').match(ID_EN_URL)?.[1]?.toLowerCase() ?? null;
    const ids = [...new Set(urls.map(idDe).filter(Boolean) as string[])];
    if (!ids.length) return urls;
    const [{ data: porColor }, { data: porCatalogo }] = await Promise.all([
      supabase.from('catalogo_colores').select('id, url_imagen, activo').in('id', ids),
      supabase.from('catalogo_colores').select('catalogo_id, color, url_imagen, activo').in('catalogo_id', ids),
    ]);
    const deColor = new Map<string, string>(((porColor ?? []) as any[])
      .filter(r => r.url_imagen && r.activo !== false).map(r => [String(r.id).toLowerCase(), String(r.url_imagen)]));
    const deCatalogo = new Map<string, { color: string; url: string }[]>();
    for (const r of (porCatalogo ?? []) as any[]) {
      if (!r.url_imagen || r.activo === false) continue;
      const k = String(r.catalogo_id).toLowerCase();
      deCatalogo.set(k, [...(deCatalogo.get(k) ?? []), { color: norm(r.color), url: String(r.url_imagen) }]);
    }
    return urls.map((u, i) => {
      const id = idDe(u);
      if (!id) return u;
      if (deColor.has(id)) return deColor.get(id)!;
      const filas = deCatalogo.get(id);
      const c = norm(colores[i]);
      if (filas && c) {
        const f = filas.find(x => x.color === c) ?? filas.find(x => x.color.startsWith(c) || c.startsWith(x.color));
        if (f) return f.url;
      }
      return u;
    });
  } catch {
    return urls;
  }
}
