export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  const debug = url.searchParams.get("debug") === "1";
  const noCache = url.searchParams.get("nocache") === "1";

  if (!target) return json({ ok: false, error: "missing_u" }, 400);

  // Validate target URL
  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error();
  } catch {
    return json({ ok: false, error: "invalid_u" }, 400);
  }

  // 1) Load detail page (server-side)
  const detailRes = await fetch(targetUrl.toString(), {
    headers: { "User-Agent": "BuechereiObernau-Cover/1.0" },
  });

  if (!detailRes.ok) {
    return json(
      { ok: false, error: "upstream_error", status: detailRes.status, target: targetUrl.toString() },
      502
    );
  }

  const html = await detailRes.text();

  // 2) Extract ISBN (10/13; accepts hyphens/spaces; also “ISBN-13:” etc)
  const isbnMatch =
    html.match(/ISBN(?:-1[03])?\s*[:]?[\s]*([0-9Xx][0-9Xx\-\s]{8,20}[0-9Xx])/i) ||
    html.match(/ISBN\s*([0-9Xx\- ]{10,20})/i);

  const isbnRaw = isbnMatch ? isbnMatch[1] : "";
  const isbn = isbnRaw.replace(/[^0-9Xx]/g, "").toUpperCase();

  let cover = "";
  let source = "";
  const debugInfo = {
    target: targetUrl.toString(),
    isbnRaw,
    isbn,
    openLibrary: { tried: false, candidate: "", headStatus: null },
    googleBooks: { tried: false, apiUrl: "", status: null, found: false, thumb: "" },
  };

  // Helper: check if image exists
  async function headOk(imgUrl) {
    try {
      const h = await fetch(imgUrl, { method: "HEAD" });
      return { ok: h.ok, status: h.status };
    } catch {
      return { ok: false, status: null };
    }
  }

  // 3) Try Open Library by ISBN
  if (isbn.length === 10 || isbn.length === 13) {
    const candidate = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
    debugInfo.openLibrary.tried = true;
    debugInfo.openLibrary.candidate = candidate;

    const h = await headOk(candidate);
    debugInfo.openLibrary.headStatus = h.status;

    if (h.ok) {
      cover = candidate;
      source = "openlibrary";
    }
  }

  // 4) Fallback: Google Books API by ISBN (better coverage for DE)
  if (!cover && (isbn.length === 10 || isbn.length === 13)) {
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
    debugInfo.googleBooks.tried = true;
    debugInfo.googleBooks.apiUrl = apiUrl;

    try {
      const gbRes = await fetch(apiUrl, {
        headers: { "User-Agent": "BuechereiObernau-Cover/1.0" },
      });
      debugInfo.googleBooks.status = gbRes.status;

      if (gbRes.ok) {
        const data = await gbRes.json();
        const first = data?.items?.[0]?.volumeInfo;
        const links = first?.imageLinks || {};

        // Prefer bigger if available
        let thumb =
          links.thumbnail ||
          links.smallThumbnail ||
          links.medium ||
          links.large ||
          links.extraLarge ||
          "";

        if (thumb) {
          // ensure https
          thumb = thumb.replace(/^http:\/\//i, "https://");
          debugInfo.googleBooks.found = true;
          debugInfo.googleBooks.thumb = thumb;

          // Optional: some thumbnails may be hotlink-protected; usually ok
          cover = thumb;
          source = "googlebooks";
        }
      }
    } catch {
      // ignore, keep cover empty
    }
  }

  const payload = {
    ok: true,
    isbn,
    cover,       // empty string if none found
    source,      // "openlibrary" | "googlebooks" | ""
  };

  if (debug) payload.debug = debugInfo;

  return json(payload, 200, {
    // no-store for debug/nocache
    "cache-control": noCache || debug ? "no-store" : "public, max-age=86400",
  });

  // ---- helpers ----
  function json(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        ...extraHeaders,
      },
    });
  }
}
