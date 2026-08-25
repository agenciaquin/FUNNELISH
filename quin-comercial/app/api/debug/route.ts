import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Check env vars
  results.env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING',
    anonKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) ?? 'MISSING',
    serviceKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) ?? 'MISSING',
  };

  // 2. Try server-side Supabase query
  try {
    const supabase = createServerSupabaseClient();
    const { data, error, count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact' });

    results.serverQuery = {
      error: error?.message ?? null,
      rowCount: count ?? data?.length ?? 0,
      rows: data?.slice(0, 3) ?? [],
    };
  } catch (e: any) {
    results.serverQuery = { error: e.message };
  }

  return NextResponse.json(results, { status: 200 });
}
