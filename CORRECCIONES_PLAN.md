# Correcciones al PLAN.md — ConfirmaYa (pegar en Claude Code)

> Copia desde "Invoca al agente planeador..." hasta el final y pégalo en Claude Code.

---

Invoca al agente planeador para corregir PLAN.md (y ajustar TASKS.md donde corresponda) con estas correcciones. No reescribas el plan completo, solo ajusta lo señalado:

1. ERROR — Regla de género (sección 5.1, paso 2): está mal y se contradice. Los datos reales usan "Dama" y "Caballero", no "mujer"/"femenino". Reescríbela así:
   - Si la talla YA contiene un indicador de género (dama, mujer, femenino, hombre, caballero, en cualquier capitalización), dejarla tal cual.
   - Si la talla NO está vacía y NO contiene indicador de género, agregar el género por defecto al final.
   - Si la talla está vacía, dejarla en blanco (no agregar género a un campo vacío).

2. MEJORA — Normalización del teléfono (secciones 5.1 y 5.3): la regla actual solo quita el prefijo literal "+57" y puede generar links rotos. Reemplázala por: eliminar todos los caracteres que no sean dígitos; si el resultado tiene 12 dígitos y empieza por "57", usarlo tal cual; si tiene 10 dígitos, anteponer "57"; en otro caso, usar el mejor esfuerzo. El link final siempre debe quedar como wa.me/57XXXXXXXXXX sin duplicar el código de país.

3. MEJORA — Validación antes de generar: agregar al flujo (sección 5.1) una validación mínima. Si el teléfono está vacío o no queda válido tras la normalización, no habilitar el botón "Enviar a cliente" y mostrar un aviso claro. Define explícitamente que los demás campos faltantes se dejan en blanco en el mensaje.

4. MEJORA — Responsive (sección 8): el mensaje y la foto van lado a lado en escritorio, pero deben apilarse en vertical en pantallas angostas (celular). Especifícalo en el plan y corrige la frase "optimizado para escritorio" para que refleje que también funciona bien en móvil.

5. MEJORA — Coincidencia del catálogo (sección 6): normalizar las claves con trim() además de minúsculas antes de comparar, para que un espacio sobrante no impida encontrar la foto.

6. DECISIÓN PENDIENTE — Género por defecto: documenta en el plan que el género por defecto a insertar es "Hombre" (regla estándar) salvo que se indique lo contrario. Déjalo como una constante configurable al inicio de app.js para poder cambiarlo fácilmente a "Caballero" si se decide.

Al terminar, muéstrame el resumen de los cambios y detente para que yo apruebe antes de pasar al implementador.
