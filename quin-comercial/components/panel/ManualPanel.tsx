'use client';

import { useState } from 'react';

/* ─── Brand tokens ─────────────────────────────────────────────────────────── */
const TEAL   = '#00A89D';
const TEAL_D = '#007A72';
const TEAL_L = '#4ECDC4';
const GOLD   = '#00A89D';
const BG     = '#0A0A0A';
const CARD   = '#111111';
const BORDER = '#1C1C1C';

/* ─── Section data ─────────────────────────────────────────────────────────── */
interface Section {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  content: ContentBlock[];
}

interface ContentBlock {
  type: 'steps' | 'cards' | 'tip' | 'table' | 'warning';
  heading?: string;
  items?: StepItem[] | CardItem[] | TableRow[];
  text?: string;
}

interface StepItem { num: number; title: string; desc: string; }
interface CardItem  { icon: string; title: string; desc: string; }
interface TableRow  { campo: string; valor: string; }

const SECTIONS: Section[] = [
  {
    id: 'bienvenida',
    icon: '✦',
    title: 'Bienvenida',
    subtitle: '¿Qué es QUINCHAT?',
    color: TEAL,
    content: [
      {
        type: 'cards',
        heading: 'El hub de comunicaciones de KLIXMANT',
        items: [
          { icon: '💬', title: 'Gestión de chats', desc: 'Visualiza y responde todas las conversaciones de WhatsApp desde un solo panel.' },
          { icon: '🤖', title: 'Bot automatizado', desc: 'El bot envía confirmaciones de pedido automáticamente cuando llega un nuevo cliente desde Funnelish.' },
          { icon: '⚡', title: 'Tiempo real', desc: 'Mensajes y conversaciones se actualizan al instante vía Supabase Realtime.' },
          { icon: '🔗', title: 'Integrado con Funnelish', desc: 'Cada compra genera automáticamente un mensaje de confirmación al cliente por WhatsApp.' },
        ] as CardItem[],
      },
      {
        type: 'tip',
        text: 'QUINCHAT es el activo digital de KLIXMANT para automatizar la confirmación de pedidos y mantener comunicación directa con los clientes vía WhatsApp Business.',
      },
    ],
  },
  {
    id: 'antes_campanas',
    icon: '✅',
    title: 'Antes de activar campañas',
    subtitle: 'Lo que debes dejar listo (checklist)',
    color: '#E8A13A',
    content: [
      {
        type: 'warning',
        text: '⚠️ IMPORTANTE — Regla de las 24 horas de WhatsApp: si un cliente compra en tu landing pero NO te ha escrito al WhatsApp en las últimas 24 horas, Meta NO deja enviarle un mensaje normal (verás el error 131047 “re-engagement”). Para poder escribirle tú primero (el mensaje de confirmación del pedido) necesitas una PLANTILLA de WhatsApp aprobada por Meta. Sin plantilla aprobada, las confirmaciones de compras hechas en la web no llegan.',
      },
      {
        type: 'steps',
        heading: 'Checklist antes de lanzar pauta / campañas',
        items: [
          { num: 1, title: 'Conecta tu WhatsApp Business', desc: 'En “Conexión de WhatsApp” pon el Phone Number ID, el Access Token y el Verify Token, y finaliza el registro del número. Sin esto el bot no envía ni recibe nada.' },
          { num: 2, title: 'Crea y aprueba tu PLANTILLA de confirmación', desc: 'En “Plantillas WhatsApp” crea la plantilla del mensaje de confirmación de pedido y mándala a revisión. Es OBLIGATORIA para escribirle al cliente que compró en la landing. Espera a que Meta la deje en estado APROBADA antes de lanzar campañas.' },
          { num: 3, title: 'Carga tu catálogo con fotos', desc: 'En “Catálogos” crea tus categorías y productos con sus fotos reales. Así el bot muestra y envía las fotos correctas y no inventa modelos.' },
          { num: 4, title: 'Vincula cada anuncio con su catálogo', desc: 'Enlaza el ID del anuncio a su catálogo, o pon el nombre del producto en el título de la campaña (ej. “SPIDERMAN…”). Así, aunque el cliente solo escriba “info”, el bot manda el catálogo correcto de esa campaña.' },
          { num: 5, title: 'Completa el Entrenamiento principal', desc: 'Identidad/marca, precios y promos, envíos, ubicación real de la tienda, formas de pago y garantía. El bot toma TODO de ahí: si un dato no está, no lo puede dar.' },
          { num: 6, title: 'Revisa comportamiento, disparadores y FAQ', desc: 'Confirma que el tono, las reglas de etiqueta y las preguntas frecuentes estén como quieres antes de recibir tráfico real.' },
          { num: 7, title: 'Haz un pedido de PRUEBA de punta a punta', desc: 'Antes de gastar en pauta: compra tú mismo en la landing y verifica que llegue la confirmación por WhatsApp y que el bot responda bien. Si la confirmación no llega, casi siempre es la plantilla (paso 2).' },
        ] as StepItem[],
      },
      {
        type: 'tip',
        text: 'Regla de oro: no enciendas campañas hasta tener los pasos 1, 2 y 3 listos (WhatsApp conectado + plantilla APROBADA + catálogo con fotos). Con eso garantizas que cada compra reciba su confirmación y que el bot pueda vender bien.',
      },
    ],
  },
  {
    id: 'chat',
    icon: '💬',
    title: 'Chat',
    subtitle: 'Panel de conversaciones',
    color: '#5B8DEF',
    content: [
      {
        type: 'steps',
        heading: 'Cómo gestionar conversaciones',
        items: [
          { num: 1, title: 'Selecciona una conversación', desc: 'En la columna izquierda aparecen todos los clientes que han iniciado contacto. Las no leídas muestran un punto de color.' },
          { num: 2, title: 'Lee y responde mensajes', desc: 'En el área central ves el historial completo del chat. Escribe en el campo de texto abajo y presiona Enter o el botón de enviar.' },
          { num: 3, title: 'Activa / desactiva el bot', desc: 'Cada conversación tiene un interruptor para habilitar o deshabilitar las respuestas automáticas del bot.' },
          { num: 4, title: 'Confirma el pedido', desc: 'Cuando el cliente responde CONFIRMO, el sistema registra la confirmación y cambia el estado del pedido.' },
        ] as StepItem[],
      },
      {
        type: 'tip',
        text: 'Las nuevas conversaciones aparecen automáticamente cuando Funnelish registra una compra. No necesitas hacer nada manual.',
      },
    ],
  },
  {
    id: 'entrenamiento',
    icon: '🎓',
    title: 'Entrenamiento',
    subtitle: 'Configurar el bot',
    color: '#A855F7',
    content: [
      {
        type: 'steps',
        heading: 'Cómo personalizar la IA',
        items: [
          { num: 1, title: 'Abre el panel Entrenamiento', desc: 'Haz clic en "Entrenamiento" en la barra lateral izquierda.' },
          { num: 2, title: 'Edita el System Prompt', desc: 'El campo de texto contiene las instrucciones que definen cómo responde el bot. Personalízalas para tu marca.' },
          { num: 3, title: 'Guarda los cambios', desc: 'Presiona "Guardar" para aplicar el nuevo comportamiento. Los cambios toman efecto inmediatamente.' },
        ] as StepItem[],
      },
      {
        type: 'tip',
        text: 'Puedes definir el tono, el nombre del agente, los productos que vende, y cómo manejar casos especiales como reclamos o cambios.',
      },
    ],
  },
  {
    id: 'plantillas',
    icon: '📋',
    title: 'Plantillas',
    subtitle: 'Mensajes rápidos',
    color: '#F59E0B',
    content: [
      {
        type: 'steps',
        heading: 'Crear y usar plantillas',
        items: [
          { num: 1, title: 'Crea una plantilla', desc: 'En el panel Plantillas, escribe el nombre y el contenido del mensaje. Puedes usar variables como {nombre}, {producto}.' },
          { num: 2, title: 'Selecciona al responder', desc: 'En el chat, haz clic en el ícono de plantilla para elegir un mensaje preescrito y enviarlo con un clic.' },
          { num: 3, title: 'Edita o elimina', desc: 'Gestiona tus plantillas en cualquier momento desde el mismo panel.' },
        ] as StepItem[],
      },
      {
        type: 'cards',
        heading: 'Ejemplos de plantillas útiles',
        items: [
          { icon: '✅', title: 'Confirmación de envío', desc: '"Hola {nombre}, tu pedido #{referencia} fue enviado hoy. Llegará en 3-5 días hábiles."' },
          { icon: '📦', title: 'Seguimiento', desc: '"Tu paquete está en camino. Número de guía: {guia}. Puedes rastrearlo en {enlace}."' },
          { icon: '💛', title: 'Postventa', desc: '"Hola {nombre}, ¿recibiste tu pedido? Nos encantaría saber tu opinión."' },
          { icon: '🔁', title: 'Cambio o devolución', desc: '"Entendemos tu solicitud. Por favor envíanos fotos del producto para iniciar el proceso."' },
        ] as CardItem[],
      },
    ],
  },
  {
    id: 'disparadores',
    icon: '⚡',
    title: 'Disparadores',
    subtitle: 'Automatizaciones',
    color: '#EF4444',
    content: [
      {
        type: 'steps',
        heading: 'Cómo funcionan los disparadores',
        items: [
          { num: 1, title: 'Define la condición', desc: 'Un disparador se activa cuando el cliente escribe una palabra o frase específica, por ejemplo "CONFIRMO" o "cancelar".' },
          { num: 2, title: 'Define la acción', desc: 'Al activarse, el bot ejecuta una acción: enviar un mensaje, cambiar el estado del pedido, o notificar al equipo.' },
          { num: 3, title: 'Actívalo', desc: 'Guarda el disparador y actívalo. Desde ese momento opera en tiempo real en todas las conversaciones.' },
        ] as StepItem[],
      },
      {
        type: 'warning',
        text: 'Los disparadores distinguen entre mayúsculas y minúsculas por defecto. Asegúrate de configurar las variaciones que el cliente pueda escribir.',
      },
    ],
  },
  {
    id: 'contactos',
    icon: '👥',
    title: 'Contactos',
    subtitle: 'Base de clientes',
    color: '#10B981',
    content: [
      {
        type: 'steps',
        heading: 'Gestión de contactos',
        items: [
          { num: 1, title: 'Clientes automáticos', desc: 'Cada cliente que hace una compra en Funnelish se registra automáticamente en contactos con su nombre, teléfono y pedido.' },
          { num: 2, title: 'Busca y filtra', desc: 'Usa la barra de búsqueda para encontrar un cliente por nombre o teléfono rápidamente.' },
          { num: 3, title: 'Historial de pedidos', desc: 'Al abrir un contacto ves todos sus pedidos y conversaciones anteriores.' },
        ] as StepItem[],
      },
    ],
  },
  {
    id: 'integraciones',
    icon: '🔗',
    title: 'Integraciones',
    subtitle: 'Funnelish + ConfirmaYa',
    color: TEAL,
    content: [
      {
        type: 'cards',
        heading: 'Ecosistema KLIXMANT',
        items: [
          { icon: '🛒', title: 'Funnelish → QUINCHAT', desc: 'Al registrarse una compra en Funnelish, el webhook dispara automáticamente el mensaje de confirmación por WhatsApp.' },
          { icon: '📱', title: 'WhatsApp Business', desc: 'Los mensajes se envían desde el número oficial +57 317 265 3897 vía WhatsApp Cloud API de Meta.' },
          { icon: '✅', title: 'ConfirmaYa', desc: 'Herramienta paralela para generar manualmente el mensaje de confirmación y buscar la foto del producto.' },
          { icon: '🗄️', title: 'Supabase', desc: 'Base de datos en tiempo real donde se guardan conversaciones, mensajes, contactos y configuraciones.' },
        ] as CardItem[],
      },
      {
        type: 'table',
        heading: 'Flujo de una compra',
        items: [
          { campo: '1. Compra en Funnelish', valor: 'Cliente paga el pedido en la tienda online' },
          { campo: '2. Webhook llega a QUINCHAT', valor: 'POST /api/funnelish/webhook con datos del pedido' },
          { campo: '3. Bot envía WA', valor: 'Mensaje de confirmación al número del cliente' },
          { campo: '4. Cliente responde', valor: '"CONFIRMO" activa el disparador de confirmación' },
          { campo: '5. Pedido confirmado', valor: 'Estado actualizado en Supabase, equipo notificado' },
        ] as TableRow[],
      },
    ],
  },
  {
    id: 'ajustes',
    icon: '⚙️',
    title: 'Ajustes',
    subtitle: 'Configuración general',
    color: '#6B7280',
    content: [
      {
        type: 'cards',
        heading: 'Qué puedes configurar',
        items: [
          { icon: '📱', title: 'Número de WhatsApp', desc: 'ID del número de WhatsApp Business conectado a la cuenta Meta.' },
          { icon: '🔑', title: 'Token de acceso', desc: 'Token permanente del System User de Meta Business para autenticar la API.' },
          { icon: '🤖', title: 'Modelo de IA', desc: 'Selecciona el modelo de Claude que usa el bot para generar respuestas inteligentes.' },
          { icon: '🛡️', title: 'Modo prueba', desc: 'Whitelist de números que reciben mensajes reales. El resto no recibe nada hasta activar producción.' },
        ] as CardItem[],
      },
      {
        type: 'warning',
        text: 'Los cambios en Ajustes requieren actualizar las variables de entorno en Vercel y hacer redeploy para tomar efecto en producción.',
      },
    ],
  },
];

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function StepBlock({ items }: { items: StepItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(step => (
        <div
          key={step.num}
          style={{
            display: 'flex', gap: 16, padding: '16px 20px',
            background: '#161616', borderRadius: 12,
            border: `1px solid ${BORDER}`,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${TEAL}18`, border: `1px solid ${TEAL}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 13, fontWeight: 700, color: TEAL, flexShrink: 0,
          }}>
            {step.num}
          </div>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, color: '#F5F5F5', marginBottom: 4 }}>
              {step.title}
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: '#6B6B6B', lineHeight: 1.6 }}>
              {step.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CardGrid({ items }: { items: CardItem[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {items.map(card => (
        <div
          key={card.title}
          style={{
            padding: '16px', background: '#161616', borderRadius: 12,
            border: `1px solid ${BORDER}`,
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = `${TEAL}50`)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
        >
          <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, color: '#E5E5E5', marginBottom: 6 }}>
            {card.title}
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#6B6B6B', lineHeight: 1.6 }}>
            {card.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

function TipBlock({ text, type = 'tip' }: { text: string; type?: 'tip' | 'warning' }) {
  const isTip = type === 'tip';
  return (
    <div style={{
      padding: '14px 18px', borderRadius: 10,
      background: isTip ? `${TEAL}0D` : '#F59E0B0D',
      border: `1px solid ${isTip ? TEAL + '30' : '#F59E0B30'}`,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{isTip ? '💡' : '⚠️'}</span>
      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: isTip ? TEAL_L : '#F59E0B', lineHeight: 1.65 }}>
        {text}
      </span>
    </div>
  );
}

function TableBlock({ items }: { items: TableRow[] }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      {items.map((row, i) => (
        <div
          key={row.campo}
          style={{
            display: 'flex', gap: 0,
            borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}
        >
          <div style={{
            width: 220, padding: '11px 16px', flexShrink: 0,
            background: '#141414',
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
            color: TEAL,
            borderRight: `1px solid ${BORDER}`,
          }}>
            {row.campo}
          </div>
          <div style={{
            flex: 1, padding: '11px 16px',
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#9CA3AF',
          }}>
            {row.valor}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionContent({ section }: { section: Section }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {section.content.map((block, i) => (
        <div key={i}>
          {block.heading && (
            <div style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 13, fontWeight: 700,
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 14,
            }}>
              {block.heading}
            </div>
          )}

          {block.type === 'steps'   && <StepBlock items={block.items as StepItem[]} />}
          {block.type === 'cards'   && <CardGrid  items={block.items as CardItem[]} />}
          {block.type === 'table'   && <TableBlock items={block.items as TableRow[]} />}
          {block.type === 'tip'     && <TipBlock text={block.text!} type="tip" />}
          {block.type === 'warning' && <TipBlock text={block.text!} type="warning" />}
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function ManualPanel() {
  const [activeId, setActiveId] = useState('bienvenida');
  const activeSection = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: BG, overflow: 'hidden',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* ── Hero header ── */}
      <div style={{
        padding: '28px 36px 24px',
        borderBottom: `1px solid ${BORDER}`,
        background: '#0D0D0D',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${TEAL}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: 200,
          width: 160, height: 160, borderRadius: '50%',
          background: `radial-gradient(circle, ${GOLD}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${TEAL}20`,
            border: `1.5px solid ${TEAL}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            📖
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ color: TEAL, fontWeight: 800, fontSize: 18, letterSpacing: '0.12em' }}>QUIN</span>
              <span style={{ color: '#F5F5F5', fontWeight: 800, fontSize: 18, letterSpacing: '0.12em' }}>CHAT</span>
            </div>
            <div style={{ fontSize: 10, color: '#6B6B6B', letterSpacing: '0.06em', marginTop: 1 }}>
              MANUAL DE USUARIO · AGENCIA QUIN
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6B6B6B', maxWidth: 520 }}>
          Guía completa para aprovechar al máximo QUINCHAT, el hub de comunicaciones de KLIXMANT.
        </div>
      </div>

      {/* ── Body: nav + content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left nav */}
        <div style={{
          width: 200, borderRight: `1px solid ${BORDER}`,
          background: '#0D0D0D', padding: '16px 10px',
          display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {SECTIONS.map(sec => {
            const isActive = sec.id === activeId;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveId(sec.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: '9px 12px', borderRadius: 10,
                  border: isActive ? `1px solid ${TEAL}30` : '1px solid transparent',
                  background: isActive ? `${TEAL}12` : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#ffffff07';
                    e.currentTarget.style.borderColor = '#ffffff10';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{sec.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: isActive ? 700 : 500,
                    color: isActive ? TEAL : '#9CA3AF',
                    letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sec.title}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#4B5563', marginTop: 1, letterSpacing: '0.02em' }}>
                    {sec.subtitle}
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
                    background: TEAL, flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}

          {/* Badge */}
          <div style={{
            marginTop: 'auto', padding: '12px 10px 4px',
            borderTop: `1px solid ${BORDER}`,
          }}>
            <div style={{
              fontSize: 9.5, color: '#4B5563', letterSpacing: '0.05em',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              AGENCIA QUIN<br />
              <span style={{ color: TEAL }}>quinchat-agencia-quin.vercel.app</span>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>

          {/* Section header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                padding: '3px 10px', borderRadius: 20,
                background: `${activeSection.color}18`,
                border: `1px solid ${activeSection.color}35`,
                fontSize: 10, fontWeight: 700,
                color: activeSection.color,
                letterSpacing: '0.08em',
              }}>
                {activeSection.icon} {activeSection.id.toUpperCase()}
              </div>
            </div>
            <h2 style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 22, fontWeight: 800,
              color: '#F5F5F5', margin: 0, marginBottom: 6,
              letterSpacing: '-0.02em',
            }}>
              {activeSection.title}
            </h2>
            <div style={{ fontSize: 13, color: '#6B6B6B' }}>
              {activeSection.subtitle}
            </div>

            {/* Divider with accent */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 0 }}>
              <div style={{ height: 2, width: 24, borderRadius: 2, background: activeSection.color }} />
              <div style={{ height: 1, flex: 1, background: BORDER }} />
            </div>
          </div>

          {/* Section content */}
          <SectionContent section={activeSection} />

          {/* Footer nav */}
          <div style={{
            marginTop: 40, paddingTop: 20,
            borderTop: `1px solid ${BORDER}`,
            display: 'flex', justifyContent: 'space-between',
          }}>
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === activeId);
              const prev = SECTIONS[idx - 1];
              const next = SECTIONS[idx + 1];
              return (
                <>
                  <div>
                    {prev && (
                      <button
                        onClick={() => setActiveId(prev.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 14px', borderRadius: 8,
                          border: `1px solid ${BORDER}`,
                          background: 'transparent', cursor: 'pointer',
                          color: '#6B6B6B', fontSize: 11, fontFamily: 'Montserrat, sans-serif',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = TEAL + '50'; e.currentTarget.style.color = TEAL; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = '#6B6B6B'; }}
                      >
                        ← {prev.icon} {prev.title}
                      </button>
                    )}
                  </div>
                  <div>
                    {next && (
                      <button
                        onClick={() => setActiveId(next.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 14px', borderRadius: 8,
                          border: `1px solid ${TEAL}40`,
                          background: `${TEAL}10`, cursor: 'pointer',
                          color: TEAL, fontSize: 11, fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = TEAL + '20'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = TEAL + '10'; }}
                      >
                        {next.icon} {next.title} →
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Version badge */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <span style={{
              fontSize: 10, color: '#374151',
              fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em',
            }}>
              QUINCHAT · Agencia Quin © 2025 · v1.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
