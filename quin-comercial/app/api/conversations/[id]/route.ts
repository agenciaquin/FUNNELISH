import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // Delete messages first (FK dependency) — solo de ESTE tenant.
  const { error: msgErr } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', id)
    .eq('tenant_id', tid);

  if (msgErr) {
    console.error('[DELETE conversation] messages error:', msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Delete conversation — solo de ESTE tenant.
  const { error: convErr } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tid);

  if (convErr) {
    console.error('[DELETE conversation] conversation error:', convErr);
    return NextResponse.json({ error: convErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: id });
}
