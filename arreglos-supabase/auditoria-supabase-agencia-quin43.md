# Auditoría de seguridad — Supabase de Agencia Quin 43

**Organización:** `confirma-ya` · plan Pro
**Cuenta:** agenciaquin43@gmail.com
**Fecha:** 28 de agosto de 2026
**Alcance:** los 3 proyectos de la organización
**Método:** solo consultas de lectura. No se modificó ninguna configuración ni dato.

---

## Resumen ejecutivo

| Proyecto | Ref | Región | Estado |
|---|---|---|---|
| `quinchat` | `bjbjqmbuzpyjvcugbusx` | us-west-2 | 🔴 **Crítico** |
| `confirma-ya` | `glmnuqfnxwaibckufgtr` | us-east-2 | 🟢 Bien protegido |
| `master-quin` | `oejbsibpjiwakpsgkyvq` | us-west-2 | 🟢 Limpio |

Los tres corren Postgres 17 y están `ACTIVE_HEALTHY`.

**Un solo proyecto tiene exposición real: `quinchat`.** Es además el que más datos de clientes acumula. Los otros dos están correctamente cerrados y sus avisos son de diseño, no de exposición.

Un matiz que atraviesa todo el informe: **el linter de Supabase avisa por RLS desactivado, pero RLS no es la única barrera.** Si al rol `anon` se le revocan los permisos de tabla, no puede leer aunque RLS esté apagado. Por eso se comprobaron los `GRANT` reales de cada tabla en lugar de quedarse con el aviso. En `confirma-ya` esa diferencia lo cambia todo.

---

## 🔴 `quinchat` — crítico

### El origen del problema

El proyecto tiene **0 usuarios en `auth.users`**. La aplicación no tiene autenticación: funciona enteramente con la clave anónima, que por definición viaja en el cliente y es pública. En toda la base hay **3 policies definidas**.

### Exposición

25 tablas sin RLS. De esas, **14 tienen permisos reales para `anon`**, y 13 con CRUD completo (`SELECT`, `INSERT`, `UPDATE`, `DELETE`):

| Tabla | Filas aprox. | Contenido |
|---|---|---|
| `messages` | 40.000 | contenido de las conversaciones |
| `conversations` | 2.584 | nombre de contacto, último mensaje, notas |
| `vendedor_preguntas` | 2.115 | |
| `objeciones_analisis` | 870 | |
| `effi_guias` | 735 | guías de envío |
| `faq_bot` | 660 | |
| `vendedor_reportes` | 342 | |
| `campanas_gasto` | 323 | gasto publicitario |
| `catalogo_colores` | 157 | |
| `memoria_bot` | 30 | |
| `catalogos_bot` | 27 | |
| `configuracion` | 3 | ajustes y plantillas |
| `push_subscriptions` | 2 | credenciales de notificaciones push |
| `funnels` | 27 | **solo `SELECT`** |

Cualquiera con la clave anónima puede leer los 40.000 mensajes, y también modificarlos o borrarlos.

Los **3 buckets de storage son públicos**.

### Lo que sí está bien

La tabla `ajustes` contiene columnas de la API de WhatsApp (`access_token`, `webhook_verify_token`, `phone_number_id`, `waba_id`, `meta_app_id`), pero **no está expuesta**: a `anon` se le revocó el `SELECT`. Además el `access_token` está vacío. Lo mismo aplica a `contactos`, `carritos_abandonados` y `funnel_eventos` — sin RLS, pero sin permisos para `anon`.

### Cómo NO arreglarlo

Supabase sugiere un `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` por cada tabla afectada.

> **No ejecutes ese SQL tal cual.** Sin autenticación y sin policies, activar RLS deja la aplicación sin acceso a nada y la rompe en el acto.

### Cómo abordarlo

Hay que decidir primero el modelo de acceso. Dos caminos razonables:

1. **Backend con service role.** Las escrituras y lecturas sensibles pasan por un servidor propio que usa la `service_role` key. El cliente conserva la clave anónima solo para lo que de verdad debe ver en público. Es el cambio menos invasivo si la app ya tiene un backend.
2. **Autenticación real.** Se añade Supabase Auth y las policies se escriben contra `auth.uid()`. Más trabajo, pero es la solución correcta a medio plazo.

En cualquiera de los dos, el orden es: escribir las policies primero, verificarlas, y activar RLS después — tabla por tabla, empezando por `messages` y `conversations`.

### Rendimiento (menor)

- `vendedor_reportes` no tiene clave primaria.
- Índices duplicados en `carritos_abandonados`: `carritos_abandonados_uniq` y `carritos_uniq` son idénticos.
- 9 índices sin uso registrado, candidatos a eliminar.
- El servidor de Auth está limitado a 10 conexiones en absoluto en vez de por porcentaje.

---

## 🟢 `confirma-ya` — bien protegido

El linter marca 11 tablas sin RLS, pero al comprobar los permisos reales el resultado es **cero tablas accesibles desde la API pública**. A `anon` y `authenticated` solo les quedan `REFERENCES`, `TRIGGER` y `TRUNCATE` — ningún `SELECT`, `INSERT`, `UPDATE` ni `DELETE`.

Es protección por grants en lugar de por RLS. Menos habitual, pero efectiva.

Importa porque lo que guardan esas tablas es sensible:

- **`tenants`** (4 filas) — `wa_access_token`, `wa_verify_token`, `wa_phone_number_id`, `wa_waba_id`, `wa_app_id`, además de `creditos` y `creditos_tope`. **2 de los 4 tenants tienen un token real cargado.**
- **`usuarios`** (3 filas) — `email`, `password`, `rol`, `tenant_id`.

Nada de eso es alcanzable desde fuera.

`ai_integraciones` guarda 6 claves API cifradas (`api_key_cifrada`) con RLS activo y sin policies, lo que equivale a denegar a todos los roles públicos. Correcto.

### A mejorar

**1. `usuarios.password` es almacenamiento propio de contraseñas.**
Los 3 valores miden exactamente 168 caracteres y ninguno empieza por `$2`, `$argon` ni `$scrypt`, así que no es un hash estándar reconocible. Se está manteniendo un sistema de contraseñas propio teniendo Supabase Auth disponible en el mismo proyecto. La recomendación es migrar a Auth: elimina la tabla como superficie de ataque y quita la responsabilidad de almacenar contraseñas.

**2. `set_tenant_id_from_jwt` no tiene `search_path` fijo.**
En una función que decide el tenant, eso es más delicado de lo normal. Se corrige añadiendo `SET search_path = public` a la definición.

---

## 🟢 `master-quin` — limpio

Plataforma de cursos (LMS): cursos, lecciones, planes, membresías, pagos y comunidad. **Las 16 tablas tienen RLS activado.**

Las policies permisivas (`using true`) son todas de solo lectura y sobre datos genuinamente públicos —`plans`, `plan_courses`, `brands`, `site_settings`, `testimonials`— o de comunidad restringidas al rol `authenticated`. `payments`, `profiles`, `memberships` y `lesson_progress` tienen policies restrictivas de verdad. No hay ninguna policy de escritura con `true`.

### A mejorar

**Funciones de trigger expuestas como RPC.** `handle_new_user()` y `prevent_role_escalation()` son funciones de trigger, pero están publicadas como endpoints invocables en `/rest/v1/rpc/`. No deberían serlo:

```sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM anon, authenticated;
```

Las otras cuatro (`current_user_role`, `has_course_access`, `leaderboard`, `mi_ranking`) sí tienen sentido como RPC; el aviso del linter sobre ellas es informativo.

**Protección de contraseñas filtradas desactivada** en Auth. Se activa desde el dashboard.
[Documentación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

---

## Prioridades

| # | Acción | Proyecto | Riesgo si no se hace | Esfuerzo |
|---|---|---|---|---|
| 1 | Definir modelo de acceso y cerrar las 14 tablas expuestas | `quinchat` | Lectura y borrado público de 40.000 mensajes y datos de clientes | Alto |
| 2 | Revocar `EXECUTE` de las 2 funciones de trigger | `master-quin` | Invocación directa de lógica interna | Bajo |
| 3 | Revisar los 3 buckets públicos | `quinchat` | Archivos accesibles sin control | Bajo |
| 4 | Migrar `usuarios` a Supabase Auth | `confirma-ya` | Contraseñas gestionadas a mano | Medio |
| 5 | Fijar `search_path` en `set_tenant_id_from_jwt` | `confirma-ya` | Resolución de esquema manipulable | Bajo |
| 6 | Activar protección de contraseñas filtradas | `master-quin` | Contraseñas comprometidas admitidas | Trivial |

Los puntos 2, 5 y 6 se pueden hacer hoy sin riesgo de romper nada. El 1 requiere decisión de arquitectura antes de tocar código.

---

## Anexo — qué se revisó

Por cada proyecto:

- Advisors de seguridad y de rendimiento del linter de Supabase
- Inventario de tablas del esquema `public` con estado de RLS y número de filas
- Policies de RLS: rol, comando y expresiones `USING` / `WITH CHECK`
- **Permisos de tabla reales** (`information_schema.role_table_grants`) para `anon` y `authenticated`
- Columnas de las tablas que podían contener credenciales o datos personales
- Funciones `SECURITY DEFINER`, su `search_path` y quién puede ejecutarlas
- Edge functions
- Buckets de storage y su visibilidad
- Recuento de usuarios en `auth.users`

**Limitaciones.** No se revisó el código de las aplicaciones que consumen estas bases, ni dónde se almacenan las claves `service_role`, ni la configuración de red o de backups del plan Pro. No se verificó la exposición desde fuera lanzando peticiones reales con la clave anónima: las conclusiones salen del estado de la base, no de una prueba de penetración.

**En ningún momento se leyeron ni se transcribieron valores de credenciales.** Donde hacía falta comprobar si un secreto estaba cargado, se consultó únicamente su longitud.
