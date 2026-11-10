const Jimp = require('jimp'); const path = require('path');
(async () => {
  const H = 900, banda = Math.round(H*0.13);
  const cargar = async (t, f) => { try { return await Jimp.loadFont(path.join(process.cwd(), 'fonts', `open-sans-${t}-black`, `open-sans-${t}-black.fnt`)); } catch (e) { console.log('fallback', e.message); return await Jimp.loadFont(f); } };
  const im = await Jimp.read('/tmp/t1.jpg'); im.resize(Jimp.AUTO, H - banda);
  const W = im.getWidth(); const lienzo = new Jimp(W, H, 0xffffffff); lienzo.composite(im, 0, banda);
  let txt = 'CAMISETA NEGRO NACIONAL SPORT DAMA';
  let font = await cargar(64, Jimp.FONT_SANS_64_BLACK);
  if (Jimp.measureText(font, txt) > W - 40) font = await cargar(32, Jimp.FONT_SANS_32_BLACK);
  while (Jimp.measureText(font, txt) > W - 40 && txt.length > 6) txt = txt.slice(0, -1);
  const alto = Jimp.measureTextHeight(font, txt, W);
  lienzo.print(font, 0, Math.max(0, Math.round((banda - alto) / 2)), { text: txt, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, W);
  lienzo.scan(0, banda - 3, W, 3, function (_x, _y, idx) { this.bitmap.data[idx]=210; this.bitmap.data[idx+1]=210; this.bitmap.data[idx+2]=210; this.bitmap.data[idx+3]=255; });
  await lienzo.quality(85).writeAsync('/sessions/compassionate-vibrant-maxwell/mnt/outputs/rotulo-test.jpg'); console.log('ok', W, H);
})();
