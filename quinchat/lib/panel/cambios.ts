// =====================================================================
// Guardián de "cambios sin guardar" del panel.
//
// Un editor (ej. Embudos) llama a marcarSinGuardar(true) cuando el usuario
// edita algo, y a marcarSinGuardar(false) cuando guarda o descarta. Antes de
// navegar a otra sección, cerrar sesión o refrescar, el panel llama a
// confirmarSalida() para avisar y evitar perder el trabajo.
// =====================================================================

let sinGuardar = false;

/** Marca si hay cambios sin guardar en la pantalla actual. */
export function marcarSinGuardar(valor: boolean): void {
  sinGuardar = valor;
}

/** ¿Hay cambios sin guardar ahora mismo? */
export function haySinGuardar(): boolean {
  return sinGuardar;
}

/**
 * Pregunta antes de salir si hay cambios sin guardar. Devuelve true si se puede
 * continuar (no hay cambios, o el usuario aceptó salir) y en ese caso limpia el
 * estado. Devuelve false si el usuario decide quedarse.
 */
export function confirmarSalida(): boolean {
  if (!sinGuardar) return true;
  const ok = typeof window !== 'undefined'
    ? window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar? Se perderá lo que hiciste.')
    : true;
  if (ok) sinGuardar = false;
  return ok;
}
