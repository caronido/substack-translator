const cheerio = require("cheerio");

const SUBSTACK_BASE =
  process.env.SUBSTACK_URL || "https://elcontenido.substack.com";

/**
 * Convert HTML to markdown-ish text preserving links, bold, italic, headings.
 */
function htmlToMarkdown(html) {
  const $ = cheerio.load(html);

  // Convert links to markdown
  $("a").each((_i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text();
    if (href && text) {
      $(el).replaceWith(`[${text}](${href})`);
    }
  });

  // Convert bold/strong
  $("strong, b").each((_i, el) => {
    $(el).replaceWith(`**${$(el).text()}**`);
  });

  // Convert italic/em
  $("em, i").each((_i, el) => {
    $(el).replaceWith(`*${$(el).text()}*`);
  });

  // Convert headings
  $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
    const level = el.tagName.replace("h", "");
    const prefix = "#".repeat(Number(level));
    $(el).replaceWith(`\n\n${prefix} ${$(el).text()}\n\n`);
  });

  // Convert paragraphs and divs to double newlines
  $("p, div").each((_i, el) => {
    $(el).append("\n\n");
  });

  // Convert line breaks
  $("br").each((_i, el) => {
    $(el).replaceWith("\n");
  });

  return $.text().replace(/\n{3,}/g, "\n\n").trim();
}

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

  // Convert body_html to markdown-ish text that preserves links
  let contentText = "";
  const contentHtml = post.body_html || "";
  if (contentHtml) {
    contentText = htmlToMarkdown(contentHtml);
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
