// =====================================================
// Guía por sección para Quino (copiloto de toda la app).
// Según en qué pantalla esté parado el usuario, Quino recibe esta guía
// para orientarlo justo en eso. NO reemplaza el conocimiento profundo de
// conexión de WhatsApp (ese va aparte cuando aplica).
// =====================================================

export interface GuiaSeccion { titulo: string; guia: string }

const S: Record<string, GuiaSeccion> = {
  chat: { titulo: 'Chats (Funnel)', guia: 'Aquí ve y responde las conversaciones que entran desde sus páginas de venta (embudos). Puede leer el chat, responder y ponerle etiquetas al cliente.' },
  chat_ventas: { titulo: 'Chats (WhatsApp)', guia: 'Conversaciones que entran por WhatsApp. Las responde aquí; el bot también responde solo si está activo y conectado.' },
  plantillas_embudo: { titulo: 'Plantillas de embudo', guia: 'Plantillas listas de páginas de venta. Elige una y con "Usar esta plantilla" se copia a sus Embudos para editarla con su producto, precios y píxeles.' },
  embudos: { titulo: 'Embudos', guia: 'Sus páginas de venta. Con "+ Nuevo embudo" crea uno. En cada embudo edita producto, precio, fotos, variantes/tallas, música y los píxeles de Meta/TikTok (sección desplegable abajo). Con "Copiar" obtiene el link para poner en sus anuncios.' },
  pedidos: { titulo: 'Ventas (Pedidos)', guia: 'Aquí llegan los pedidos que hacen los clientes desde los embudos y el chat. Puede ver y hacer seguimiento a cada venta.' },
  estadisticas: { titulo: 'Estadísticas', guia: 'Métricas de sus embudos y ventas: cuánto vende, qué embudo funciona mejor, etc.' },
  ventas: { titulo: 'Estado en Effi', guia: 'Cruza sus ventas (Funnel + WhatsApp) con el reporte de Effi para que ninguna quede sin subir. Sube el archivo de Effi una vez y se cruza solo.' },
  vendedores: { titulo: 'Vendedores', guia: 'Administra su equipo de vendedores y revisa las ventas de cada uno.' },
  seguimiento: { titulo: 'Meta Ads', guia: 'Seguimiento de sus anuncios de Meta: costo por venta, rendimiento y qué anuncio trae mejores resultados.' },
  objeciones: { titulo: 'Objeciones', guia: 'Las razones por las que los clientes no compran, detectadas de los chats, para que el bot las maneje mejor.' },
  memoria: { titulo: 'Memoria del bot', guia: 'Lo que el bot ha aprendido atendiendo clientes. Aquí aprueba o descarta cada cosa que propone aprender.' },
  faq: { titulo: 'Preguntas frecuentes', guia: 'Las respuestas que el bot da a las dudas comunes. Aquí las agrega o edita para que responda como usted quiere.' },
  entrenamiento: { titulo: 'Entrenamiento', guia: 'Personaliza el comportamiento y el tono del bot de ventas (su instrucción/plantilla). Aquí define cómo saluda, cómo vende y qué datos pide.' },
  plantillas: { titulo: 'Plantillas de WhatsApp', guia: 'Mensajes plantilla (aprobados por Meta) para enviar por WhatsApp, por ejemplo confirmaciones de pedido.' },
  disparadores: { titulo: 'Disparadores', guia: 'Automatizaciones que envían mensajes según condiciones (por ejemplo, si el cliente no responde en X tiempo).' },
  contactos: { titulo: 'Contactos', guia: 'Su lista de clientes/contactos. Puede buscar, ver y organizar.' },
  etiquetas: { titulo: 'Etiquetas', guia: 'Crea etiquetas de colores para clasificar a sus clientes en los chats (ej. "interesado", "pagó", "por confirmar").' },
  catalogos: { titulo: 'Catálogos del bot', guia: 'Los productos, colores y fotos que el bot usa para vender y armar los pedidos. Aquí los agrega y organiza.' },
  integraciones: { titulo: 'Integraciones', guia: 'Conecta QuinChat con otras herramientas de su negocio.' },
  ajustes: { titulo: 'Ajustes', guia: 'Configuración general de su cuenta y su negocio.' },
  manual: { titulo: 'Manual', guia: 'Guía de uso de la plataforma.' },
  wa_config: { titulo: 'Conexión de WhatsApp', guia: 'Aquí conecta su WhatsApp Business con Meta pegando los datos (Access Token, Phone Number ID, Verify Token, etc.) y la URL del Webhook. Este es el lugar para dejar el bot conectado.' },
  empresas: { titulo: 'Empresas (admin)', guia: 'Da de alta clientes nuevos: crea su empresa y su usuario de acceso.' },
  quino_aprendizaje: { titulo: 'Aprendizaje de Quino (admin)', guia: 'Revisa, edita y aprueba lo que el asistente va aprendiendo de los clientes.' },
};

const DEFECTO: GuiaSeccion = { titulo: 'la app', guia: 'Oriéntalo sobre lo que está viendo. Si no sabes qué pantalla es, pregúntale qué quiere hacer.' };

export function guiaSeccion(seccion?: string | null): GuiaSeccion {
  return (seccion && S[seccion]) ? S[seccion] : DEFECTO;
}

/** ¿La duda es sobre conectar WhatsApp con Meta? (para inyectar el manual). */
export function esTemaConexion(seccion?: string | null, texto?: string): boolean {
  if (seccion === 'wa_config') return true;
  const t = (texto ?? '').toLowerCase();
  return /(whatsapp|webhook|token|phone number|meta|waba|portafolio|verificar|conect|pixel|píxel|cloud api|app id)/.test(t);
}
