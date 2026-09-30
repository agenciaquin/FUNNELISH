import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Lee el cuerpo de un webhook de Meta y comprueba que venga de Meta.
 *
 * Meta firma cada aviso con la clave secreta de la app (App Secret) y la manda
 * en `X-Hub-Signature-256: sha256=<hmac>`. Sin esta comprobación, cualquiera que
 * conozca la URL puede inventarse mensajes: el bot llama a la IA y responde por
 * WhatsApp, y eso se paga.
 *
 * La firma se calcula sobre el texto EXACTO que llega, por eso se lee con
 * `req.text()` y se convierte a JSON después.
 *
 * Si `WHATSAPP_APP_SECRET` no está configurada, se deja pasar y se avisa en el
 * registro: cortar todos los mensajes entrantes por una variable que falta sería
 * peor. Configurarla es un paso obligatorio antes de reactivar el bot.
 */
export async function leerAvisoDeMeta(
  req: Request,
  appSecret = process.env.WHATSAPP_APP_SECRET,
): Promise<{ valido: true; body: any } | { valido: false; motivo: string }> {
  const crudo = await req.text();

  if (!appSecret) {
    if (appSecret === undefined) console.warn('[Webhook] WHATSAPP_APP_SECRET no configurada: no se comprueba la firma de Meta.');
  } else {
    const firma = req.headers.get('x-hub-signature-256') ?? '';
    const esperada = 'sha256=' + createHmac('sha256', appSecret).update(crudo, 'utf8').digest('hex');
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valido: false, motivo: firma ? 'firma incorrecta' : 'sin firma' };
    }
  }

  try {
    return { valido: true, body: JSON.parse(crudo) };
  } catch {
    return { valido: true, body: null };
  }
}
