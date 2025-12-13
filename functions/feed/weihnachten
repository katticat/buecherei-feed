export async function onRequestGet() {
  const FEED_URL = "https://www.eopac.net/buecherei-obernau/feed/weihnachten/";

  const upstream = await fetch(FEED_URL, {
    headers: { "User-Agent": "BuechereiObernau-FeedProxy/1.0" },
  });

  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
  }

  let xml = await upstream.text();

  // Entfernt eine evtl. vorhandene xml-stylesheet Verarbeitungsvorschrift
  xml = xml.replace(/<\?xml-stylesheet[^>]*\?>\s*/i, "");

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=600",
      "access-control-allow-origin": "*",
    },
  });
}
