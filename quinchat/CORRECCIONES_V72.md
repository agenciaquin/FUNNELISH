# CORRECCIONES V72 — Fix permisos plantillas (API Routes con service role)

**Proyecto:** QuinChat — KLIXMANT  
**Fecha:** 2026-07-15  
**Problema:** `permission denied for table plantillas (code: 42501)` — el cliente browser usa la anon key que no puede hacer INSERT/UPDATE/DELETE aunque el SQL de permisos se ejecutó. La solución es mover las operaciones de BD a API routes del servidor que usan la service role key (acceso total).

**Archivos a crear/modificar:**
- `app/api/plantillas/route.ts` ← NUEVO
- `app/api/plantillas/[id]/route.ts` ← NUEVO
- `components/panel/PlantillasPanel.tsx` ← MODIFICAR (solo funciones load/save/deleteP)

---

## ARCHIVO 1 — CREAR: `app/api/plantillas/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('plantillas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('plantillas')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

---

## ARCHIVO 2 — CREAR: `app/api/plantillas/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('plantillas')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('plantillas')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

---

## ARCHIVO 3 — MODIFICAR: `components/panel/PlantillasPanel.tsx`

Reemplazar SOLO las tres funciones `load`, `save` y `deleteP` con estas versiones. El resto del archivo queda igual.

### Reemplazar función `load` (líneas 47-54):

```typescript
  async function load() {
    const res = await fetch('/api/plantillas');
    const data = await res.json();
    setPlantillas(Array.isArray(data) ? data : []);
    setLoading(false);
  }
```

### Reemplazar función `save` (líneas 134-163):

```typescript
  async function save() {
    if (saving) return;
    if (!current.nombre.trim()) { alert('El nombre es requerido.'); return; }
    if (current.tipo !== 'imagen' && !current.contenido.trim()) { alert('El texto es requerido.'); return; }
    if (current.tipo !== 'texto' && !current.imagen_url.trim()) { alert('La imagen es requerida.'); return; }

    setSaving(true);
    const payload = {
      nombre:     current.nombre.trim(),
      tipo:       current.tipo,
      contenido:  current.contenido.trim(),
      imagen_url: current.imagen_url.trim(),
    };

    let res: Response;
    if (isNew) {
      res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`/api/plantillas/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      alert('Error al guardar: ' + (err.error ?? res.statusText));
      return;
    }
    await load();
    backToList();
  }
```

### Reemplazar función `deleteP` (líneas 165-170):

```typescript
  async function deleteP() {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await fetch(`/api/plantillas/${current.id}`, { method: 'DELETE' });
    await load();
    backToList();
  }
```

---

## Instrucciones para Claude Code

```
1. Crear archivo: app/api/plantillas/route.ts (contenido del ARCHIVO 1)
2. Crear archivo: app/api/plantillas/[id]/route.ts (contenido del ARCHIVO 2)
3. Modificar: components/panel/PlantillasPanel.tsx
   - Reemplazar función load() con la nueva versión
   - Reemplazar función save() con la nueva versión
   - Reemplazar función deleteP() con la nueva versión
4. Commit y push:

git add quinchat/app/api/plantillas/route.ts quinchat/app/api/plantillas/[id]/route.ts quinchat/components/panel/PlantillasPanel.tsx quinchat/CORRECCIONES_V72.md
git commit -m "fix: plantillas via API routes (service role bypass RLS)"
git push

5. Deploy:
cd quinchat
npx vercel --prod
```

---

## Por qué esto funciona

El cliente browser usaba la `anon` key → Supabase la bloqueaba por permisos.  
Ahora `load/save/deleteP` llaman a `/api/plantillas` (Next.js API routes) que corren en el servidor con la `SUPABASE_SERVICE_ROLE_KEY` → acceso completo sin restricciones.  
La subida de imágenes sigue usando el cliente browser → Storage ya tiene las políticas correctas desde antes.

---

## Verificación

- [ ] `app/api/plantillas/route.ts` creado
- [ ] `app/api/plantillas/[id]/route.ts` creado
- [ ] PlantillasPanel.tsx: funciones load/save/deleteP actualizadas
- [ ] Deploy exitoso en Vercel
- [ ] Crear plantilla → guarda sin error
- [ ] La plantilla aparece en la lista
- [ ] Editar plantilla → actualiza correctamente
- [ ] Eliminar plantilla → desaparece de la lista
