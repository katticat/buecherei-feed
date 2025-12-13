export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  if (!target) return new Response("Missing parameter u", { status: 400 });

  // URL prüfen
  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error();
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Detailseite laden (serverseitig)
  const res = await fetch(targetUrl.toString(), {
    headers: { "User-Agent": "BuechereiObernau-Cover/1.0" },
  });
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const html = await res.text();

  // 1) Erst versuchen: og:image (wenn vorhanden)
  let m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);

  // 2) Dann: erstes <img ...> (Fallback)
  if (!m) {
    m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  }

  let img = m ? m[1] : "";

  // Relative URLs auflösen
  if (img) {
    try {
      img = new URL(img, targetUrl).toString();
    } catch {
      img = "";
    }
  }

  return new Response(JSON.stringify({ cover: img }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400", // 1 Tag Cache
      "access-control-allow-origin": "*",
    },
  });
}
