/* Código de acceso del cotizador (Vercel Routing Middleware).
 *
 * Bloquea todas las rutas, incluidos los JSON de data/, hasta que el visitante
 * ingresa el código guardado en la variable de entorno ACCESS_CODE del proyecto
 * en Vercel. Al acertar se guarda una cookie HttpOnly de 12 horas. Cambiar
 * ACCESS_CODE (y redesplegar) invalida todas las sesiones abiertas.
 * Sin ACCESS_CODE configurado el sitio queda cerrado.
 */
export const config = { matcher: "/:path*" };

const COOKIE = "soc_acceso";
const DURACION_S = 12 * 60 * 60;
const SEGURIDAD = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

async function token(codigo) {
  const datos = new TextEncoder().encode(`netmask-soc:${codigo}:${process.env.ACCESS_SECRET || ""}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante para no filtrar el token por tiempos de respuesta.
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function leerCookie(request, nombre) {
  const cookies = request.headers.get("cookie") || "";
  for (const parte of cookies.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return v.join("=");
  }
  return "";
}

function continuar() {
  return new Response(null, { headers: { "x-middleware-next": "1" } });
}

function redirigir(destino, cookie) {
  const headers = { Location: destino, ...SEGURIDAD };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 303, headers });
}

function paginaAcceso({ error = "", estado = 401 } = {}) {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Acceso · Cotizador SOC Netmask</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;600;800&display=swap">
<style>
  :root { --bg: #0a243f; --card: #ffffff; --ink: #0a243f; --muted: #607080; --line: #c7d2dd; --cyan: #00aff4; --red: #da291c; --bad: #c0261a; }
  @media (prefers-color-scheme: dark) { :root { --card: #0d2136; --ink: #e8f0f7; --muted: #8fa3b5; --line: #2a4a69; --bad: #ff7d72; color-scheme: dark; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
         font: 15px/1.5 "Host Grotesk", "Segoe UI", Roboto, Arial, sans-serif;
         padding: 24px max(16px, env(safe-area-inset-left, 0px)); }
  main { width: min(380px, 100%); background: var(--card); border-radius: 8px; padding: 28px; display: grid; gap: 16px;
         border-top: 6px solid var(--cyan); position: relative; overflow: hidden; }
  main::after { content: ""; position: absolute; right: 0; bottom: 0; width: 56px; height: 8px; background: var(--red); }
  .marca { font-weight: 800; font-size: 1.5rem; letter-spacing: -0.01em; }
  .marca span { color: var(--cyan); }
  .eyebrow { font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  h1 { margin: 0; font-size: 1.2rem; }
  p { margin: 0; color: var(--muted); }
  label { display: grid; gap: 6px; font-weight: 600; }
  input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 4px; background: transparent; color: var(--ink); letter-spacing: .08em; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
  button { font: 600 1rem inherit; font-family: inherit; padding: 10px 14px; border: 0; border-radius: 4px; background: var(--cyan); color: #04263b; cursor: pointer; }
  .error { color: var(--bad); font-weight: 600; }
  .pie { font-size: .78rem; }
</style>
</head>
<body>
<main>
  <div class="marca"><span>Net</span>mask</div>
  <div>
    <div class="eyebrow">Cotizador SOC OT · FortiSIEM MSSP</div>
    <h1>Ingresa el código de acceso</h1>
  </div>
  <p>Herramienta interna de Netmask. Pide el código al líder del SOC o al área comercial.</p>
  <form method="post" action="/acceso">
    <label for="codigo">Código de acceso
      <input id="codigo" name="codigo" type="password" autocomplete="current-password" required autofocus>
    </label>
    ${error ? `<p class="error" role="alert">${error}</p>` : ""}
    <p style="margin-top:12px"><button type="submit">Entrar</button></p>
  </form>
  <p class="pie">La sesión dura 12 horas en este navegador.</p>
</main>
</body>
</html>`;
  return new Response(html, { status: estado, headers: { "Content-Type": "text/html; charset=utf-8", ...SEGURIDAD } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const codigo = process.env.ACCESS_CODE || "";

  if (url.pathname === "/salir") {
    return redirigir("/", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }
  if (!codigo) {
    return paginaAcceso({ error: "El acceso no está configurado: falta la variable ACCESS_CODE en Vercel.", estado: 503 });
  }

  const esperado = await token(codigo);

  if (url.pathname === "/acceso" && request.method === "POST") {
    let ingresado = "";
    try {
      ingresado = String((await request.formData()).get("codigo") || "").trim();
    } catch (_) { /* formulario inválido */ }
    if (ingresado && iguales(await token(ingresado), esperado)) {
      return redirigir("/", `${COOKIE}=${esperado}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACION_S}`);
    }
    // Pausa breve para encarecer los intentos por fuerza bruta.
    await new Promise((r) => setTimeout(r, 800));
    return paginaAcceso({ error: "Código incorrecto. Revisa e intenta de nuevo." });
  }

  if (iguales(leerCookie(request, COOKIE), esperado)) return continuar();
  return paginaAcceso();
}
