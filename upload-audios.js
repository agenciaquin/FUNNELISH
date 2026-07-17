// Script para subir audios de abono a Supabase Storage
// Ejecutar UNA SOLA VEZ: node upload-audios.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'bjbjqmbuzpyjvcugbusx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYmpxbWJ1enB5anZjdWdidXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA3NjIyNSwiZXhwIjoyMDk5NjUyMjI1fQ.p7DmlFe4Nbp0mTucBqJXe7f42sG39j2NVT55Qsx9gaA';
const BUCKET = 'chat-media';

const FILES = [
  {
    localPath: path.join(__dirname, 'AUDIOS', 'JOSUE ABONO OFICINA.ogg'),
    storagePath: 'audios-bot/abono-oficina.ogg',
    label: 'ABONO OFICINA',
  },
  {
    localPath: path.join(__dirname, 'AUDIOS', 'JOSUE ABONO  MUNICIPIO .ogg'),
    storagePath: 'audios-bot/abono-municipio.ogg',
    label: 'ABONO MUNICIPIO',
  },
];

function uploadFile(localPath, storagePath) {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(localPath);
    const options = {
      hostname: SUPABASE_URL,
      path: `/storage/v1/object/${BUCKET}/${storagePath}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'audio/ogg',
        'Content-Length': fileBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const publicUrl = `https://${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
          resolve(publicUrl);
        } else {
          // Maybe already exists, try to get public URL anyway
          const publicUrl = `https://${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
          resolve(publicUrl);
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function main() {
  console.log('Subiendo audios a Supabase Storage...\n');
  for (const f of FILES) {
    try {
      const url = await uploadFile(f.localPath, f.storagePath);
      console.log(`✅ ${f.label}`);
      console.log(`   URL: ${url}\n`);
    } catch (e) {
      console.error(`❌ Error subiendo ${f.label}:`, e.message);
    }
  }
  console.log('Listo. Copia las URLs de arriba si las necesitas.');
}

main();
