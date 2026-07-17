import { NextRequest, NextResponse } from 'next/server';
import { getProductImageUrl, PRODUCT_NAMES, FALLBACK_IMAGE } from '@/lib/product-catalog';

/**
 * GET /api/catalogos/buscar-imagen?q=NEGRO+NEW+YORK
 * Devuelve la URL de imagen y sugerencias de productos del catálogo.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const url = getProductImageUrl(q);
  const isFallback = url === FALLBACK_IMAGE;

  // Sugerencias: productos del catálogo que contienen las palabras del query
  const words = q.toUpperCase().split(/\s+/).filter(w => w.length >= 3);
  const sugerencias = words.length
    ? PRODUCT_NAMES.filter(name => words.some(w => name.toUpperCase().includes(w))).slice(0, 8)
    : [];

  return NextResponse.json({ url: isFallback ? null : url, sugerencias });
}
