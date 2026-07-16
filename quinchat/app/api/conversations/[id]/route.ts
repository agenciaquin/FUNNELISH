import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // Delete messages first (FK dependency)
  const { error: msgErr } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', id);

  if (msgErr) {
    console.error('[DELETE conversation] messages error:', msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Delete conversation
  const { error: convErr } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);

  if (convErr) {
    console.error('[DELETE conversation] conversation error:', convErr);
    return NextResponse.json({ error: convErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: id });
}
