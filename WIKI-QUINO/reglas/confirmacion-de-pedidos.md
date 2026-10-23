---
tipo: regla
titulo: Reglas de negocio de la confirmación
tags: [reglas, confirmacion, pedidos, bot]
actualizado: 2026-09-04
estado: vigente
---

# Reglas de confirmación

Aplican a **los dos bots** → [[bots-quino]].

## Normalización de datos

| Caso | Regla |
|---|---|
| Teléfono con `+57` | Quitar el prefijo, dejar 10 dígitos |
| Sin correo | Usar `Gerenciaquin7@gmail.com` |
| Sin valor a pagar | Usar el valor por defecto del pedido |
| Talla sin género | Asumir **Hombre** |

## Valor a pagar

> El valor a pagar del pedido es **FIJO**.

El bot **nunca** lo cambia ni inventa precios de promoción. Usa el valor real que trae el pedido
(`clientes_funnelish.valor` → [[pedidos]]).

## Recoger en oficina (Interrapidísimo)

- **Nunca negar** la opción de oficina.
- Requiere **abono obligatorio de $5.000**, que se descuenta del total.
- Sin abono aceptado y coordinado, **no se cierra** el pedido a oficina
  (no vale decir "abono requerido" y confirmar igual) → [[tokens-del-bot]].

## Dirección por partes

Cuando el cliente completa la dirección a pedazos (torre, apartamento, casa, barrio, conjunto,
ciudadela), el bot **arma la dirección completa** juntando lo que ya tenía + lo nuevo y la
**guarda** con `[[ACTUALIZAR]]`. Si se la muestra al cliente, esa misma dirección debe quedar
guardada. Mostrar sin guardar es un bug.

## Qué cuenta como confirmación

Además de "CONFIRMO" y equivalentes, cuenta como sí un **emoji afirmativo** (👍 👌 ✅ 🙏) enviado
después de pedir la confirmación → marca **VENTA REALIZADA**.

## Paso a humano

`[[HUMANO]]` es **silencioso para el cliente** y genera aviso a **Lilibeth** (soporte) con
**nombre + celular**.

---

Plantilla de mensaje de la herramienta original → [[herramienta-legado-confirmaya]].
