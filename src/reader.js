const cheerio = require("cheerio");

const SUBSTACK_BASE =
  process.env.SUBSTACK_URL || "https://elcontenido.substack.com";

/**
 * Fetch a Substack post and extract title, subtitle, content HTML, and metadata.
 */
async function fetchPost(slug) {
  const url = `${SUBSTACK_BASE}/p/${slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NestTranslator/1.0; +https://github.com/nest-translator)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch post: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $("h1.post-title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "";

  // Extract subtitle
  const subtitle =
    $("h3.subtitle").first().text().trim() ||
    "";

  // Extract post body HTML
  const bodyEl = $(".body.markup").first();
  const contentHtml = bodyEl.length ? bodyEl.html().trim() : "";

  // Extract plain text for translation
  const contentText = bodyEl.length ? bodyEl.text().trim() : "";

  // Extract metadata from JSON-LD
  let meta = {};
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data["@type"] === "NewsArticle") {
        meta = {
          authors: (data.author || []).map((a) => a.name).join(", "),
          datePublished: data.datePublished || "",
          image: Array.isArray(data.image)
            ? data.image[0]?.url || ""
            : data.image || "",
          description: data.description || "",
          url: data.url || url,
        };
      }
    } catch (_e) {
      // ignore parse errors
    }
  });

  return {
    slug,
    title,
    subtitle,
    contentHtml,
    contentText,
    originalUrl: url,
    meta,
  };
}

module.exports = { fetchPost };
