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

  // ISBN suchen (10 oder 13-stellig, oft mit Bindestrichen)
  const m = html.match(/ISBN\s*([0-9Xx\- ]{10,20})/);
  const isbn = (m ? m[1] : "").replace(/[^0-9Xx]/g, "").toUpperCase();

  let cover = "";

  if (isbn.length === 10 || isbn.length === 13) {
    // Open Library Cover (Medium)
    //const candidate = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
    const candidate = `https://buchhandel-rest.prod.kubernetes.vlb.de/cover/${isbn}/${isbn}-cover-m.jpg`;

    // Existenz prüfen, sonst bleibt cover leer
    const head = await fetch(candidate, { method: "HEAD" });
    if (head.ok) cover = candidate;
  }

  return new Response(JSON.stringify({ cover, isbn }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400", // 1 Tag Cache
      "access-control-allow-origin": "*",
    },
  });
}
