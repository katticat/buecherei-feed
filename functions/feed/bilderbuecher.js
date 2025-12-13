export async function onRequestGet() {
  const FEED_URL = "https://www.eopac.net/buecherei-obernau/feed/bilderbucher/";

  const upstream = await fetch(FEED_URL, {
    headers: { "User-Agent": "BuechereiObernau-FeedProxy/1.0" },
  });

  // Wenn der Feed mal hakt: Fehler durchreichen
  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
  }

  const xml = await upstream.text();

  // Optional: kleines Edge-Cache (10 Minuten)
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600",
      // CORS ist hier nicht zwingend nötig, schadet aber nicht:
      "access-control-allow-origin": "*",
    },
  });
}
