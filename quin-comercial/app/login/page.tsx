'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap');
.ql *{box-sizing:border-box;margin:0;padding:0}
.ql{--bg:#060B1A;--bg2:#0A1330;--card:rgba(255,255,255,.05);--line:rgba(255,255,255,.10);
  --teal:#00C4B4;--teal2:#00A89D;--cyan:#28E0D4;--ink:#EAF2FF;--muted:#9DB0D0;
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);
  -webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh;position:relative}
.ql h1,.ql h2,.ql h3,.ql .brand{font-family:'Poppins',sans-serif}
.ql a{text-decoration:none;color:inherit}
.ql .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.ql .bgfx{position:fixed;inset:0;z-index:0;background:
  radial-gradient(60% 50% at 50% -5%,rgba(0,196,180,.18),transparent 60%),
  radial-gradient(45% 40% at 12% 20%,rgba(40,120,255,.14),transparent 60%),
  radial-gradient(50% 45% at 90% 30%,rgba(0,196,180,.12),transparent 60%),
  linear-gradient(180deg,var(--bg),var(--bg2) 60%,var(--bg))}
.ql .grid-lines{position:fixed;inset:0;z-index:0;opacity:.35;
  background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
  background-size:60px 60px;-webkit-mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent);mask-image:radial-gradient(70% 60% at 50% 30%,#000,transparent)}
.ql .content{position:relative;z-index:1}
.ql header{position:sticky;top:0;z-index:40;backdrop-filter:blur(10px);background:rgba(6,11,26,.55);border-bottom:1px solid var(--line)}
.ql nav{display:flex;align-items:center;justify-content:space-between;height:72px}
.ql .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.02em}
.ql .brand img{height:38px;width:auto}
.ql .brand b{color:#fff}.ql .brand i{font-style:normal;color:var(--teal)}
.ql .navlinks{display:flex;gap:28px;align-items:center}
.ql .navlinks a{color:var(--muted);font-size:14px;font-weight:500;transition:.2s}
.ql .navlinks a:hover{color:#fff}
.ql .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;font-weight:600;font-size:14px;padding:11px 20px;cursor:pointer;border:0;transition:.2s;font-family:'Inter',sans-serif}
.ql .btn-ghost{background:transparent;color:#fff;border:1px solid var(--line)}
.ql .btn-ghost:hover{border-color:var(--teal);color:var(--teal)}
.ql .btn-primary{background:linear-gradient(135deg,var(--cyan),var(--teal2));color:#022;box-shadow:0 8px 26px rgba(0,196,180,.35)}
.ql .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,196,180,.5)}
.ql .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center;padding:64px 0 40px}
.ql .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);border:1px solid rgba(0,196,180,.35);border-radius:999px;padding:7px 16px;background:rgba(0,196,180,.06)}
.ql .hero h1{font-size:clamp(34px,5vw,58px);line-height:1.03;font-weight:900;letter-spacing:-.03em;margin:20px 0 0}
.ql .hero h1 .grad{background:linear-gradient(120deg,#fff 10%,var(--cyan) 55%,var(--teal) 90%);-webkit-background-clip:text;background-clip:text;color:transparent}
.ql .hero p.lead{margin:18px 0 0;color:var(--muted);font-size:16px;line-height:1.6;max-width:520px}
.ql .pills{display:flex;flex-wrap:wrap;gap:9px;margin:22px 0 0}
.ql .pill{font-size:12px;font-weight:600;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:rgba(255,255,255,.03)}
.ql .pill b{color:var(--teal)}
/* login card */
.ql .login{background:rgba(6,11,26,.6);border:1px solid var(--line);border-radius:20px;padding:30px;box-shadow:0 30px 70px rgba(0,0,0,.5)}
.ql .login h3{font-size:22px;font-weight:700;margin-bottom:4px}
.ql .login .fp{color:var(--muted);font-size:13px;margin-bottom:22px}
.ql .field{margin-bottom:15px}
.ql .field label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:7px;font-weight:600}
.ql .field input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:13px 14px;color:#fff;font-size:14px;font-family:'Inter'}
.ql .field input::placeholder{color:rgba(157,176,208,.5)}
.ql .field input:focus{outline:none;border-color:var(--teal);background:rgba(0,196,180,.06)}
.ql .login .btn-primary{width:100%;margin-top:6px;padding:14px}
.ql .err{color:#ff8087;font-size:12px;text-align:center;background:rgba(255,80,90,.08);border:1px solid rgba(255,80,90,.3);border-radius:10px;padding:9px;margin-bottom:6px}
.ql .login .small{text-align:center;color:var(--muted);font-size:12px;margin-top:14px}
.ql .login .small a{color:var(--teal);font-weight:600}
/* secciones */
.ql section{padding:64px 0;position:relative}
.ql .kicker{color:var(--teal);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:12px}
.ql .h2{font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.02em;margin-top:10px}
.ql .h2.c,.ql .kicker.c,.ql .sub.c{text-align:center}
.ql .sub{color:var(--muted);max-width:560px;margin:14px auto 0;font-size:15px}
/* video */
.ql .video-box{margin:34px auto 0;max-width:900px;aspect-ratio:16/9;border-radius:20px;overflow:hidden;border:1px solid var(--line);position:relative;background:linear-gradient(135deg,rgba(20,32,66,.9),rgba(8,14,32,.95));box-shadow:0 40px 80px rgba(0,0,0,.5)}
.ql .video-box iframe,.ql .video-box video{width:100%;height:100%;border:0;display:block}
.ql .video-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--muted)}
.ql .play{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;font-size:26px;color:#022;background:linear-gradient(135deg,var(--cyan),var(--teal2));box-shadow:0 12px 34px rgba(0,196,180,.5)}
.ql .video-glow{position:absolute;inset:-30px -10px auto;height:160px;background:radial-gradient(50% 100% at 50% 0,rgba(0,196,180,.3),transparent);filter:blur(20px)}
/* embudo */
.ql .spot{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center;border:1px solid var(--line);border-radius:24px;padding:44px;background:linear-gradient(135deg,rgba(0,196,180,.08),rgba(20,32,66,.5))}
.ql .spot h2{font-size:clamp(24px,3.4vw,36px);font-weight:800;letter-spacing:-.02em;line-height:1.1}
.ql .spot h2 .grad{background:linear-gradient(120deg,#fff,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.ql .spot p{color:var(--muted);margin-top:16px;line-height:1.6;font-size:15px}
.ql .spot ul{list-style:none;margin-top:20px;display:flex;flex-direction:column;gap:12px}
.ql .spot li{display:flex;gap:12px;align-items:flex-start;font-size:14px}
.ql .spot li .ck{color:var(--teal);font-weight:800;margin-top:1px}
.ql .spot li b{color:#fff;font-weight:600}
.ql .builder{border:1px solid var(--line);border-radius:18px;padding:18px;background:rgba(6,11,26,.55)}
.ql .builder .bh{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-bottom:14px}
.ql .conv{margin-left:auto;color:var(--teal);font-weight:700;font-size:12px;border:1px solid rgba(0,196,180,.4);border-radius:999px;padding:3px 10px;background:rgba(0,196,180,.08)}
.ql .step{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;background:linear-gradient(90deg,rgba(0,196,180,.06),transparent);transition:.2s}
.ql .step:hover{border-color:rgba(0,196,180,.5);transform:translateX(4px)}
.ql .step .gr{cursor:grab;color:#5f6f8f;font-size:14px}
.ql .step .em{font-size:20px}
.ql .step .tx{flex:1}.ql .step .tx .t{font-size:13px;font-weight:600}.ql .step .tx .d{font-size:11px;color:var(--muted)}
.ql .step .pc{font-size:11px;font-weight:700;color:var(--teal)}
.ql .funnel-bar{height:8px;border-radius:6px;background:rgba(255,255,255,.06);margin-top:14px;overflow:hidden}
.ql .funnel-bar>div{height:100%;width:72%;border-radius:6px;background:linear-gradient(90deg,var(--cyan),var(--teal2))}
/* features */
.ql .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:46px}
.ql .feat{border:1px solid var(--line);border-radius:18px;padding:26px;background:var(--card);transition:.25s}
.ql .feat:hover{transform:translateY(-6px);border-color:rgba(0,196,180,.5);background:rgba(0,196,180,.06)}
.ql .feat .ic{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:24px;margin-bottom:16px;background:linear-gradient(135deg,rgba(0,196,180,.25),rgba(40,120,255,.18));border:1px solid rgba(0,196,180,.3)}
.ql .feat h3{font-size:18px;font-weight:700;margin-bottom:8px}
.ql .feat p{color:var(--muted);font-size:14px;line-height:1.6}
/* stats */
.ql .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;border:1px solid var(--line);border-radius:20px;padding:30px;background:linear-gradient(180deg,rgba(0,196,180,.08),transparent)}
.ql .stat{text-align:center}
.ql .stat .n{font-family:'Poppins';font-size:32px;font-weight:800;background:linear-gradient(120deg,#fff,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
.ql .stat .l{color:var(--muted);font-size:13px;margin-top:4px}
/* footer */
.ql footer{border-top:1px solid var(--line);background:rgba(6,11,26,.6)}
.ql .foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 30px;padding:26px 0}
.ql .foot .ci{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px}
.ql .foot .ci .b{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(0,196,180,.14);border:1px solid rgba(0,196,180,.35);color:var(--teal)}
.ql .foot .sep{width:1px;height:22px;background:var(--line)}
.ql .copy{text-align:center;color:#5f6f8f;font-size:12px;padding:0 0 24px}
@media(max-width:900px){
  .ql .navlinks{display:none}
  .ql .hero{grid-template-columns:1fr;gap:30px}
  .ql .cards{grid-template-columns:1fr}
  .ql .stats{grid-template-columns:repeat(2,1fr)}
  .ql .spot{grid-template-columns:1fr;padding:28px}
}
`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) { router.push('/panel'); router.refresh(); }
    else setError('Correo o contraseña incorrectos.');
  }

  return (
    <main className="ql">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bgfx" />
      <div className="grid-lines" />
      <div className="content">

        {/* NAV */}
        <header>
          <div className="wrap">
            <nav>
              <a className="brand" href="#top"><img src="/logo-quin-app.png" alt="Quin" /> <b>Quin</b><i>Chat</i></a>
              <div className="navlinks">
                <a href="#video">Video</a>
                <a href="#embudo">Embudos</a>
                <a href="#funciones">Funciones</a>
                <a href="#resultados">Resultados</a>
                <a href="#login" className="btn btn-primary">Iniciar sesión</a>
              </div>
            </nav>
          </div>
        </header>

        {/* HERO + LOGIN */}
        <span id="top" />
        <div className="wrap">
          <div className="hero">
            <div>
              <span className="eyebrow">● Agencia Quin · Bots con IA</span>
              <h1>Convierte cada chat de<br /><span className="grad">WhatsApp en una venta</span></h1>
              <p className="lead">QuinChat es el bot con inteligencia artificial que atiende, envía tu catálogo, cotiza y cierra ventas por ti — 24/7, sin que se te escape ningún cliente.</p>
              <div className="pills">
                <span className="pill"><b>●</b> Bot de ventas 24/7</span>
                <span className="pill"><b>●</b> Embudos que convierten</span>
                <span className="pill"><b>●</b> Catálogos automáticos</span>
                <span className="pill"><b>●</b> Cobro de abonos</span>
              </div>
            </div>

            {/* LOGIN CARD (funcional) */}
            <form id="login" className="login" onSubmit={handleSubmit}>
              <h3>Iniciar sesión</h3>
              <p className="fp">Entra a tu panel de QuinChat.</p>
              {error && <p className="err">{error}</p>}
              <div className="field">
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" required autoComplete="email" />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              </div>
              <button type="submit" disabled={loading || !email || !password} className="btn btn-primary">
                {loading ? 'Ingresando…' : 'Ingresar →'}
              </button>
              <p className="small">¿No tienes cuenta? <Link href="/registro">Regístrate</Link></p>
            </form>
          </div>
        </div>

        {/* VIDEO — pega aquí tu YouTube/Vimeo o un <video> */}
        <section id="video">
          <div className="wrap">
            <p className="kicker c">Míralo en acción</p>
            <h2 className="h2 c">Así trabaja tu bot</h2>
            <p className="sub c">Un vistazo de 1 minuto a cómo QuinChat atiende y vende dentro de tu WhatsApp.</p>
            <div className="video-box">
              <div className="video-glow" />
              {/*
                PARA PONER TU VIDEO: reemplaza el bloque .video-ph de abajo por uno de estos —
                YouTube:  <iframe src="https://www.youtube.com/embed/TU_ID" allowfullscreen></iframe>
                Vimeo:    <iframe src="https://player.vimeo.com/video/TU_ID" allowfullscreen></iframe>
                Archivo:  <video src="/mi-video.mp4" controls poster="/portada.jpg"></video>
              */}
              <div className="video-ph">
                <div className="play">▶</div>
                <div>Tu video aquí</div>
              </div>
            </div>
          </div>
        </section>

        {/* EMBUDO */}
        <section id="embudo" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="spot">
              <div>
                <p className="kicker">Embudos de venta</p>
                <h2>Un embudo <span className="grad">fácil de editar</span> y de <span className="grad">alta conversión</span></h2>
                <p>Arma tu página de venta y su flujo completo arrastrando bloques — sin programar. Cambias precios, fotos y textos en segundos, y cada visita fluye del anuncio hasta el cierre sin fricción.</p>
                <ul>
                  <li><span className="ck">✓</span> <span><b>Edítalo tú mismo:</b> arrastra, suelta y publica. Sin diseñador ni código.</span></li>
                  <li><span className="ck">✓</span> <span><b>Pensado para convertir:</b> del anuncio al buzo, del buzo al pedido, del pedido al pago.</span></li>
                  <li><span className="ck">✓</span> <span><b>Conectado con el bot:</b> el embudo entrega el cliente al bot, que lo atiende y cierra.</span></li>
                  <li><span className="ck">✓</span> <span><b>Todo medido:</b> mira cuántos entran, cuántos compran y dónde se caen.</span></li>
                </ul>
              </div>
              <div className="builder">
                <div className="bh">🧩 Editor de embudo <span className="conv">Conversión 24%</span></div>
                <div className="step"><span className="gr">⠿</span><span className="em">🎯</span><span className="tx"><div className="t">Anuncio: Buzo Yamaha</div><div className="d">Meta Ads → WhatsApp</div></span><span className="pc">100%</span></div>
                <div className="step"><span className="gr">⠿</span><span className="em">🧥</span><span className="tx"><div className="t">Catálogo con fotos y precios</div><div className="d">El bot muestra el buzo</div></span><span className="pc">61%</span></div>
                <div className="step"><span className="gr">⠿</span><span className="em">📝</span><span className="tx"><div className="t">Toma de datos del pedido</div><div className="d">Color, talla y dirección</div></span><span className="pc">38%</span></div>
                <div className="step"><span className="gr">⠿</span><span className="em">💳</span><span className="tx"><div className="t">Cierre y pago / abono</div><div className="d">Comprobante confirmado</div></span><span className="pc">24%</span></div>
                <div className="funnel-bar"><div /></div>
              </div>
            </div>
          </div>
        </section>

        {/* FUNCIONES */}
        <section id="funciones" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="kicker c">Todo lo que hace por ti</p>
            <h2 className="h2 c">Un vendedor que nunca duerme</h2>
            <p className="sub c">QuinChat trabaja dentro de tu WhatsApp: responde, muestra productos y cierra ventas mientras tú haces otras cosas.</p>
            <div className="cards">
              <div className="feat"><div className="ic">🤖</div><h3>Bot que vende solo</h3><p>Atiende cada mensaje al instante, muestra el catálogo y lleva al cliente hasta el cierre — sin que muevas un dedo.</p></div>
              <div className="feat"><div className="ic">📸</div><h3>Catálogos con fotos</h3><p>Cuando preguntan por un buzo, envía las fotos y los precios automáticamente, con tu llamado a la acción.</p></div>
              <div className="feat"><div className="ic">💳</div><h3>Cobro de abonos</h3><p>Recibe el comprobante, lo reconoce con visión y confirma el pedido para despacho, sin errores.</p></div>
              <div className="feat"><div className="ic">⚡</div><h3>IA que nunca se apaga</h3><p>Conecta varias IA gratis con respaldo automático: si una se agota, salta a la siguiente. Tu bot nunca queda mudo.</p></div>
              <div className="feat"><div className="ic">👁️</div><h3>Entiende fotos</h3><p>Si el cliente manda una imagen, el bot la lee y responde como un vendedor de verdad.</p></div>
              <div className="feat"><div className="ic">📊</div><h3>Panel todo-en-uno</h3><p>Chats, embudos, catálogos, entrenamiento y estadísticas en un solo lugar, fácil de manejar.</p></div>
            </div>
          </div>
        </section>

        {/* RESULTADOS */}
        <section id="resultados" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="stats">
              <div className="stat"><div className="n">24/7</div><div className="l">Atención sin parar</div></div>
              <div className="stat"><div className="n">5+</div><div className="l">IA gratis conectadas</div></div>
              <div className="stat"><div className="n">0</div><div className="l">Ventas que se escapan</div></div>
              <div className="stat"><div className="n">1 clic</div><div className="l">Para armar tu bot</div></div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="foot">
              <div className="ci"><span className="b">📱</span> WhatsApp: +57 300 000 0000</div>
              <div className="sep" />
              <div className="ci"><span className="b">✉️</span> agenciaquin43@gmail.com</div>
              <div className="sep" />
              <div className="ci"><span className="b">🌐</span> quinchat.app</div>
            </div>
            <p className="copy">© {new Date().getFullYear()} QuinChat · Agencia Quin — Bots de ventas con IA para WhatsApp.</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
