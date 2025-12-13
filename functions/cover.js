export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  if (!target) return new Response("Missing parameter u", { status: 400 });

  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error();
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  // Detailseite holen (serverseitig, kein CORS-Problem)
  const res = await fetch(targetUrl.toString(), {
    headers: { "User-Agent": "BuechereiObernau-Cover/1.0" },
  });
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const html = await res.text();

  // ISBN aus der Seite ziehen (10 oder 13-stellig, oft mit Bindestrichen)
  const m = html.match(/ISBN\s*([0-9Xx\- ]{10,20})/);
  const isbnRaw = m ? m[1] : "";
  const isbn = isbnRaw.replace(/[^0-9Xx]/g, "").toUpperCase();

  let cover = "";

  if (isbn.length === 10 || isbn.length === 13) {
    // Open Library Cover URL
    const candidate = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;

    // Prüfen ob existiert (sonst liefert Open Library oft 404)
    const head = await fetch(candidate, { method: "HEAD" });
    if (head.ok) cover = candidate;
  }

  return new Response(JSON.stringify({ cover, isbn }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400", // 1 Tag cachen
      "access-control-allow-origin": "*",
    },
  });
}
