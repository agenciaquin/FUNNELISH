import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { clasificar, extraerPoster, optimizarImagen, optimizarVideo } from './optimizar.js';
import { anotar } from './registro.js';
import { subir, urlPublica } from './storage.js';

const app = express();

// En memoria: el archivo se procesa y se sube, nunca toca el disco de la API.
// El tope de 200 MB cubre el vídeo más grande que hay hoy en el bucket (45 MB)
// con margen de sobra.
const carga = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.use((req, res, siguiente) => {
  if (req.path === '/salud') return siguiente();
  if (!config.apiToken) {
    return res.status(500).json({ error: 'La API no tiene API_TOKEN configurado y no acepta peticiones.' });
  }
  if (req.get('x-api-token') !== config.apiToken) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
  return siguiente();
});

app.get('/salud', (_req, res) => {
  res.json({ ok: true, bucket: config.bucket });
});

/**
 * Recibe un archivo, lo recomprime y lo sube ya optimizado.
 *
 * Sustituye a la subida directa a Supabase: el servidor manda aquí el archivo
 * tal cual llega del usuario y recibe de vuelta la URL pública definitiva.
 *
 *   POST /optimizar
 *   x-api-token: <token>
 *   multipart/form-data
 *     archivo: <binario>
 *     ruta:    embudos/mi-funnel/1787525205501-fxc0p.png
 *     poster:  "1" para generar además un poster del vídeo (opcional)
 */
app.post('/optimizar', carga.single('archivo'), async (req, res) => {
  const archivo = req.file;
  const ruta = typeof req.body?.ruta === 'string' ? req.body.ruta.trim() : '';

  if (!archivo) return res.status(400).json({ error: 'Falta el campo "archivo".' });
  if (!ruta) return res.status(400).json({ error: 'Falta el campo "ruta".' });
  if (ruta.startsWith('/') || ruta.includes('..')) {
    return res.status(400).json({ error: 'La ruta no puede ser absoluta ni contener "..".' });
  }

  const clase = clasificar(archivo.buffer, archivo.mimetype);
  if (clase === 'otro') {
    // Audio, PDF y demás pasan sin tocarse: no hay nada que ganar recomprimiendo.
    await subir(ruta, archivo.buffer, archivo.mimetype);
    return res.json({
      url: urlPublica(ruta),
      ruta,
      clase,
      optimizado: false,
      motivo: 'tipo de archivo no optimizable',
      bytesOriginal: archivo.buffer.length,
      bytesFinal: archivo.buffer.length,
    });
  }

  const resultado = clase === 'imagen'
    ? await optimizarImagen(archivo.buffer)
    : await optimizarVideo(archivo.buffer);

  const contenido = resultado.buffer ?? archivo.buffer;
  const contentType = resultado.buffer ? resultado.contentType : archivo.mimetype;

  await subir(ruta, contenido, contentType);

  let urlPoster: string | undefined;
  if (clase === 'video' && req.body?.poster === '1') {
    const poster = await extraerPoster(archivo.buffer);
    const rutaPoster = `${ruta.replace(/\.[^./]+$/, '')}-poster.jpg`;
    await subir(rutaPoster, poster, 'image/jpeg');
    urlPoster = urlPublica(rutaPoster);
  }

  if (resultado.buffer) {
    await anotar({
      ruta,
      clase,
      bytesOriginal: resultado.bytesOriginal,
      bytesFinal: resultado.bytesFinal,
      contentType,
      respaldo: null, // subida nueva: no hay original previo que respaldar
    });
  }

  return res.json({
    url: urlPublica(ruta),
    urlPoster,
    ruta,
    clase,
    optimizado: resultado.buffer !== null,
    motivo: resultado.motivo,
    bytesOriginal: resultado.bytesOriginal,
    bytesFinal: resultado.bytesFinal,
  });
});

app.use((error: Error, _req: express.Request, res: express.Response, _siguiente: express.NextFunction) => {
  console.error('[media-api]', error);
  res.status(500).json({ error: error.message });
});

app.listen(config.puerto, () => {
  console.log(`[media-api] escuchando en :${config.puerto} sobre el bucket "${config.bucket}"`);
});
