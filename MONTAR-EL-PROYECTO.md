# Montar el proyecto en un equipo nuevo

**Escrito el 01-09-2026.** Nace de un caso real: una compañera abrió
`quin-comercial/` en Antigravity y le salieron **14 errores rojos**. No había
nada roto. Faltaba un comando que nadie le dijo.

Este archivo existe para que el siguiente no pierda la mañana en lo mismo.

> [!CAUTION]
> **LO PRIMERO, ANTES DE TOCAR NADA**
>
> **Si abres el proyecto y ves errores rojos en el editor, NO corrijas el
> código.** Casi seguro no hay ningún error: le falta la instalación.
>
> Este sistema **está en producción y funcionando**. `www.klixmant.shop`,
> `tienda.skioo.shop` y `pedido.klixmant.shop` están vivos ahora mismo.
> «Arreglar» esos rojos editando archivos ensucia código que funciona y puede
> tumbar una tienda que está vendiendo.
>
> **Instala primero. Mira después.**

---

## 1 · El síntoma

En `quin-comercial/app/p/[slug]/pedido/page.tsx`, el panel **Problems** marca 14:

| Error | Cuántos |
| --- | --- |
| `Cannot find module 'next/navigation'` | 1 |
| `react/jsx-runtime` no existe · `JSX.IntrinsicElements` no existe | 2 |
| **`'f' is possibly null`** | 9 |
| `Type 'Funnel \| null' is not assignable to type 'Funnel'` | 1 |

Aparece igual en VS Code, Antigravity o Cursor: el que se queja es TypeScript,
no el editor.

## 2 · La causa (comprobada)

**`quin-comercial/node_modules` no existe.** Esa carpeta guarda el código
prestado —Next, React, Supabase— y **nunca viaja en GitHub**: está en el
`.gitignore` desde siempre. Cada equipo se la trae él.

Medido el 01-09-2026 en el equipo creador:

| | |
| --- | --- |
| Peso de `node_modules` de una app | **454 MB** en **24.317 archivos** |
| Paquetes en el candado de `quin-comercial` | 603 |
| Paquetes en el candado de `quinchat` | 595 |
| **Idénticos entre las dos, misma versión exacta** | **560** |
| Caché de npm ya en disco (`%LOCALAPPDATA%\npm-cache`) | 1.771 MB |

### Por qué 9 de los 14 errores son un espejismo

El archivo hace esto en la línea 26:

```tsx
const f = await obtenerFunnel(slug);
if (!f) notFound();
```

`notFound()` de Next devuelve `never` — «aquí se acaba la ejecución». Con esa
firma a la vista, TypeScript entiende que a partir de esa línea `f` ya no puede
ser `null` y se calla.

Sin `node_modules` no puede leer esa firma, `notFound` le queda como `any`, no
hay descarte, y protesta en **cada** uso posterior de `f`. Nueve veces.

**El código está bien.** El ciego es el editor.

## 3 · La solución

En el equipo donde salen los rojos:

```powershell
cd "D:\PROYECTO IA\FUNNELISH\quin-comercial"
npm ci --prefer-offline
```

Al terminar, cerrar y reabrir el editor.

Si algún rojo de JSX sobrevive, falta `next-env.d.ts` — lo genera Next, y por
eso tampoco viaja en GitHub:

```powershell
npm run dev
```

Que arranque, y cortarlo con `Ctrl+C` en cuanto diga `Ready`.

### Por qué esto NO toca producción

| | |
| --- | --- |
| ¿Modifica archivos del proyecto? | **No.** Solo crea la carpeta `node_modules` |
| ¿Aparece en el panel de cambios de git? | **No.** Está en `.gitignore` |
| ¿Hay que hacer commit de algo? | **No** |
| ¿Toca el servidor o la base de datos? | **No.** Solo baja archivos a su disco |
| ¿Se puede deshacer? | **Sí.** Borrando la carpeta se vuelve al punto de partida |

`--prefer-offline` le dice a npm que use primero la caché del disco. Como 560 de
los 603 paquetes son los mismos que ya tiene `quinchat`, la mayoría se copian sin
tocar internet.

---

## 4 · Tres cosas que NO se deben hacer

> [!CAUTION]
> Las tres parecen buenas ideas y las tres han costado —o costarían— un fallo en
> producción. Ninguna se hace sin aprobación de dirección.

### 4.1 · No subir `node_modules` a GitHub

Parece la solución obvia —«que viaje siempre y ya»— y es la peor de todas.

No es el peso. Es que **ahí dentro hay programas compilados para un sistema
concreto**. `sharp` es el caso: en Windows lleva `libvips` metido dentro del
`.node`; en Linux va aparte. Subir la carpeta desde un Windows le mandaría al
servidor los binarios equivocados.

Eso ya pasó. El 31-08-2026 tumbó la subida de imágenes con
`ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6`. Está en `CLAUDE.md`, observación 1.

Cada máquina necesita **su propia versión** de los ingredientes: los de ella para
Windows, los del servidor para Linux. Por eso no viajan.

### 4.2 · No cambiar npm por pnpm ni por yarn

Ahorraría disco de verdad —las dos apps dejarían de duplicar 454 MB cada una—,
pero **Vercel construye con lo que encuentre en el repositorio**. Cambiar el
gestor cambia cómo se construyen las tres tiendas.

Desde el 31-08 `quinchat-agencia-quin` publica solo con cada envío a `master`
(`CLAUDE.md`, observación 4). Un experimento de este tipo llega a producción sin
que nadie lo apruebe. **No compensa: el problema es una instalación de dos
minutos, una sola vez.**

### 4.3 · No «arreglar» los `'f' is possibly null`

La tentación es poner `f!` o `f?.` y ver desaparecer los rojos. Sería **ensuciar
código correcto y en producción** para tapar un aviso falso. Cuando se instale
`node_modules`, esos avisos se van solos.

---

## 5 · Suposiciones sin comprobar

> [!WARNING]
> Lo del apartado 2 está medido. **Esto no.** Se anota como hueco abierto, no
> como certeza — y se cierra antes de dar el caso por resuelto.

Escrito desde el equipo creador, **sin acceso a la máquina de la compañera**. Lo
de arriba está medido; esto no. Se anota como hueco abierto, no como certeza.

| # | Suposición | Por qué se cree | Cómo se cierra |
| --- | --- | --- | --- |
| S1 | **Los 14 errores desaparecen con instalar** | Los 14 encajan con la cascada de un `node_modules` ausente | Instalar y volver a mirar el panel **Problems** |
| S2 | **No hay errores de tipos reales escondidos detrás** | Nadie ha ejecutado `tsc` sobre `quin-comercial` — **tampoco aquí**, porque en el equipo creador tampoco está instalado | `npm ci` aquí y `npx tsc --noEmit` |
| S3 | **`npm ci` va a funcionar** | El candado es `lockfileVersion: 3` y coherente | Ejecutarlo una vez |
| S4 | **Ella tiene `quinchat` instalado** | Trabaja ahí a diario | Si no, se baja los 603 paquetes: más lento, mismo resultado |
| S5 | **Su Node sirve** | Aquí va Node v24.18.0 con npm 11.16.0, y **ningún `package.json` declara `engines`** | `node -v` en su equipo |

> [!TIP]
> **La prueba más barata está en el equipo creador.**
> **S1, S2 y S3 se cierran las tres a la vez** instalando `quin-comercial` aquí
> y pasando `npx tsc --noEmit`. No afecta a producción —crea una carpeta
> ignorada por git y nada más— y quita la duda antes de que ella toque su
> equipo. Está sin hacer **a propósito**: pendiente de aprobación.

> [!CAUTION]
> **Aviso de S2, por si sale que sí.**
> Si al instalar aparecieran errores de tipos **de verdad**, la respuesta
> correcta es **anotarlos aquí y no corregirlos en caliente**. `quin-comercial`
> sirve `www.klixmant.shop` y `tienda.skioo.shop`; cualquier cambio se planifica
> y se revisa como los demás.

---

## 6 · Recordatorio: hay dos apps y se llaman igual

| Carpeta | Proyecto Vercel | Sirve | ¿Instalada en el equipo creador? |
| --- | --- | --- | --- |
| `quinchat/` | `quinchat-agencia-quin` | `pedido.klixmant.shop` | ✅ sí |
| `quin-comercial/` | `quinchat-comercial` | `www.klixmant.shop`, `tienda.skioo.shop` | ❌ **no** |

**Las dos tienen el mismo `name` en su `package.json`** (`quinchat-agencia-quin`),
así que el nombre no las distingue: hay que mirar **la ruta de la carpeta**. En
la captura del caso real se veía `quin-comercial\app\p\[slug]\pedido` — por ahí
se supo cuál era.

Antes de ejecutar nada, comprobar dónde se está:

```powershell
pwd
```

---

## 7 · Resumen para quien llega nuevo

```powershell
# 1. Situarse en la app que se va a tocar
cd "D:\PROYECTO IA\FUNNELISH\quin-comercial"   # o \quinchat

# 2. Traer el código prestado (~2 min, no toca nada del proyecto)
npm ci --prefer-offline

# 3. Reabrir el editor
```

Si después de esto siguen saliendo errores rojos, **entonces sí** hay algo que
mirar: anotarlo en este archivo, en el apartado 5, y avisar antes de cambiar
nada.
