---
tipo: indice
titulo: ConfirmaYa / QuinChat — visión general
tags: [quinchat, confirmaya, overview]
actualizado: 2026-09-04
estado: vigente
---

# ConfirmaYa (QuinChat)

Plataforma de **Agencia Quin / KLIXMANT** que recibe las ventas generadas por Funnelish y por los
embudos propios, y las **confirma automáticamente por WhatsApp** con el bot QUINO.

Objetivo: perder menos pedidos y dejar todo medido.

## Flujo central

```
Funnelish / embudo propio  ->  pedido entra al sistema (clientes_funnelish)
        ->  QUINO contacta al cliente por WhatsApp
        ->  valida datos y confirma
        ->  despacho + seguimiento (Effi)
```

Detalle por etapa: [[pedidos]] · [[bots-quino]] · [[confirmacion-de-pedidos]] · [[effi]]

## Módulos del panel

| Módulo | Página |
|---|---|
| Chat Funnel | [[bot-chat-funnel]] |
| Chat WhatsApp | [[bot-chat-whatsapp]] |
| Embudos | [[embudos]] |
| Pedidos | [[pedidos]] |
| Remarketing | [[remarketing]] |
| Estado en Effi | [[effi]] |
| Catálogos | [[catalogos]] |
| Tus Metas, Estadísticas, Vendedores, Objeciones | [[panel]] |
| Herramientas (Memoria, FAQ, Entrenamiento, Plantillas, Disparadores, Contactos, Etiquetas, Integraciones, Ajustes, Manual) | [[panel]] |
| META ADS | oculto — **no trabajar** |

## Dónde empezar

- Cómo está montado: [[stack]] · [[despliegue]] · [[supabase]]
- Cómo confirma un pedido: [[confirmacion-de-pedidos]]
- Lo que nunca se toca: [[reglas-duras]]
- Qué se ha decidido y por qué: carpeta `decisiones/`
