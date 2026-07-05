import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const LANGUAGE_NAMES = {
  en: 'English',
  ja: '日本語',
  ar: 'العربية',
  ko: '한국어',
  ms: 'Bahasa Melayu',
  fr: 'Français',
  de: 'Deutsch',
};

// 这些 key 是各语言的自称（endonym），语言切换器里应始终显示各自的名字，
// 不随界面语言变化，因此原样保留、不翻译。
const KEEP_AS_IS_PREFIXES = ['lang.'];

function shouldKeepAsIs(key) {
  return KEEP_AS_IS_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * 直接调用 DeepSeek API 翻译界面词。
 * @param {Record<string, string>} strings 中文界面词，形如 { key: value }
 * @param {string} targetLang 目标语言代码（en/ja/ar...）
 * @returns {Promise<Record<string, string>>} 形如 { key: translatedValue }
 */
export async function translateUIStrings(strings, targetLang) {
  const langName = LANGUAGE_NAMES[targetLang] || targetLang;

  // 拆分：需要翻译的 key 和原样保留的 key
  const toTranslate = {};
  const passthrough = {};
  for (const [key, value] of Object.entries(strings)) {
    if (shouldKeepAsIs(key)) passthrough[key] = value;
    else toTranslate[key] = value;
  }

  if (Object.keys(toTranslate).length === 0) {
    return { ...passthrough };
  }

  const prompt = `You are localizing the UI strings of a web app into ${langName}.
You will receive a JSON object whose values are Chinese UI strings.
Translate ONLY the values into ${langName}. Follow these rules strictly:
- Return a JSON object with EXACTLY the same keys.
- Preserve any placeholder tokens wrapped in curly braces (e.g. {count}) verbatim — do not translate or remove them.
- Preserve arrow/symbol glyphs such as → and ← in their original position.
- Keep proper nouns and brand names as-is or use their official translations.
- Output ONLY the JSON object, no markdown fences, no commentary.

JSON to translate:
${JSON.stringify(toTranslate, null, 2)}`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  const raw = response.choices[0].message.content.trim();
  let translated;
  try {
    // 兜底：去掉可能出现的 ```json 代码围栏
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    translated = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`DeepSeek 返回的不是合法 JSON (${targetLang}): ${err.message}\n原始返回: ${raw}`);
  }

  // 以源 key 为准，确保每个 key 都有值；缺失的回退到中文源串
  const result = { ...passthrough };
  for (const key of Object.keys(toTranslate)) {
    result[key] = typeof translated[key] === 'string' ? translated[key] : toTranslate[key];
  }
  return result;
}
