const cheerio = require("cheerio");

const SUBSTACK_BASE =
  process.env.SUBSTACK_URL || "https://elcontenido.substack.com";

/**
 * Extract a post identifier (slug or UUID) and any query params from input.
 */
function parseInput(slugOrUrl) {
  if (slugOrUrl.startsWith("http")) {
    const parsed = new URL(slugOrUrl);
    const pathMatch = parsed.pathname.match(/\/p\/([a-z0-9-]+)/i);
    return pathMatch ? pathMatch[1] : slugOrUrl;
  }
  return slugOrUrl;
}

/**
 * Fetch a Substack post via the API and extract title, subtitle, content, and metadata.
 * Accepts a slug ("product-truth"), a UUID, or a full URL (including draft preview links).
 * Works for both published posts and drafts.
 */
async function fetchPost(slugOrUrl) {
  const identifier = parseInput(slugOrUrl);

  // Use Substack's API — works for slugs, UUIDs, published posts, and drafts
  const apiUrl = `${SUBSTACK_BASE}/api/v1/posts/${identifier}`;
  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NestTranslator/1.0; +https://github.com/nest-translator)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch post: ${res.status} ${res.statusText}`);
  }

  const post = await res.json();

  // The API returns the real slug even when fetched by UUID
  const slug = post.slug || identifier;

  // Extract plain text from body_html for translation
  let contentText = "";
  const contentHtml = post.body_html || "";
  if (contentHtml) {
    const $ = cheerio.load(contentHtml);
    contentText = $.text().trim();
  }

  const meta = {
    authors: (post.publishedBylines || []).map((a) => a.name).join(", ") || "",
    datePublished: post.post_date || "",
    image: post.cover_image || "",
    description: post.description || post.subtitle || "",
    url: post.canonical_url || `${SUBSTACK_BASE}/p/${slug}`,
  };

  return {
    slug,
    title: post.title || "",
    subtitle: post.subtitle || "",
    contentHtml,
    contentText,
    originalUrl: post.canonical_url || `${SUBSTACK_BASE}/p/${slug}`,
    meta,
  };
}

module.exports = { fetchPost };
