const Anthropic = require("@anthropic-ai/sdk");

const SYSTEM_PROMPT = `You are a translation engine for "The Sunday Nest," a newsletter by Ana Carolina Mexia Ponce about venture capital, AI, and technology in Latin America.  Translate English newsletter posts into Latin American Spanish while preserving Ana's authentic voice.  Ana's writing style: - Conversational and direct, like talking to a smart friend - Analytical but accessible — uses data and frameworks without being dry - Warm but confident — strong opinions shared clearly - Occasional rhetorical questions to engage readers - Short punchy paragraphs mixed with longer analytical ones - First person perspective ("I think", "I've seen")  Translation rules: - Use Latin American Spanish (ustedes, not vosotros) - Keep proper nouns, company names, product names in English (e.g., "venture capital," "B2B," "startup," "seed stage," "copilot") - Common tech terms with natural Spanish equivalents should use Spanish (e.g., "inteligencia artificial," "cadena de suministro") - Preserve all markdown formatting exactly (**, ##, links, etc.) - Preserve emojis exactly - Keep same paragraph structure and line breaks - "The Sunday Nest" and "Nido Ventures" stay in English (brand names) - Translate idioms to equivalent Spanish idioms, not literal - Do NOT include a sign-off like "Ana 🪺" at the end — omit it entirely  Return ONLY the translated text. No preamble, no explanation.`;

// In-memory cache: postId -> { title, subtitle, content }
const translationCache = new Map();

const client = new Anthropic();

/**
 * Translate a newsletter post from English to Spanish.
 * Returns cached result if available.
 */
async function translatePost({ postId, title, subtitle, content }) {
  // Check cache first
  if (translationCache.has(postId)) {
    return translationCache.get(postId);
  }

  // Build the text block to translate
  const parts = [];
  if (title) parts.push(`# ${title}`);
  if (subtitle) parts.push(`### ${subtitle}`);
  if (content) parts.push(content);

  const textToTranslate = parts.join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Translate the following newsletter post from English to Latin American Spanish:\n\n${textToTranslate}`,
      },
    ],
  });

  const translatedText = response.content[0].text;

  // Parse back into title / subtitle / content
  const lines = translatedText.split("\n");
  let translatedTitle = "";
  let translatedSubtitle = "";
  const contentLines = [];
  let pastHeaders = false;

  for (const line of lines) {
    if (!pastHeaders && line.startsWith("# ") && !translatedTitle) {
      translatedTitle = line.replace(/^# /, "");
    } else if (!pastHeaders && line.startsWith("### ") && !translatedSubtitle) {
      translatedSubtitle = line.replace(/^### /, "");
    } else if (line.trim() === "" && !pastHeaders && contentLines.length === 0) {
      // skip blank lines between headers
    } else {
      pastHeaders = true;
      contentLines.push(line);
    }
  }

  const result = {
    title: translatedTitle || title,
    subtitle: translatedSubtitle || subtitle,
    content: contentLines.join("\n").trim(),
  };

  // Cache result
  translationCache.set(postId, result);

  return result;
}

/**
 * Check if a post is already cached.
 */
function isCached(postId) {
  return translationCache.has(postId);
}

module.exports = { translatePost, isCached, translationCache };
