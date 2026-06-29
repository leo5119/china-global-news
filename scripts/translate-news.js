import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const LANGUAGES = config.languages;

const LANGUAGE_NAMES = {
  en: 'English',
  ja: '日本語',
  ar: 'العربية',
  ko: '한국어',
  ms: 'Bahasa Melayu',
  fr: 'Français',
  de: 'Deutsch',
};

async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return '';

  const prompt = `Translate the following Chinese or English text to ${LANGUAGE_NAMES[targetLang] || targetLang}.
Keep proper nouns (company names, brand names, person names) as-is or use their official translations.
Return only the translated text, nothing else.

Text to translate:
${text}`;

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error(`  ✗ 翻译失败 (${targetLang}): ${err.message}`);
    return text;
  }
}

async function translateArticle(article, targetLang) {
  console.log(`  翻译到 ${targetLang}...`);
  const [title, summary] = await Promise.all([
    translateText(article.title, targetLang),
    translateText(article.summary?.slice(0, 500) || '', targetLang),
  ]);
  return { ...article, title, summary, lang: targetLang };
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const inputPath = path.join('src', 'content', 'filtered', `${today}.json`);

  if (!fs.existsSync(inputPath)) {
    console.error(`找不到文件: ${inputPath}`);
    console.error('请先运行 filter-news.js');
    process.exit(1);
  }

  const articles = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`共 ${articles.length} 条新闻待翻译，目标语言: ${LANGUAGES.join(', ')}\n`);

  const outputDir = path.join('src', 'content', 'translated');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 翻译所有筛选通过的新闻（列表页用）
  const translatedAll = { zh: articles };

  for (const lang of LANGUAGES) {
    if (lang === 'zh') continue;
    console.log(`\n开始翻译列表新闻 → ${lang}`);
    const translated = [];
    for (const article of articles) {
      console.log(`  ${article.title.slice(0, 30)}...`);
      const result = await translateArticle(article, lang);
      translated.push(result);
    }
    translatedAll[lang] = translated;
  }

  // 保存列表翻译结果
  const listOutputPath = path.join(outputDir, `${today}.json`);
  fs.writeFileSync(listOutputPath, JSON.stringify(translatedAll, null, 2), 'utf-8');
  console.log(`\n列表翻译已保存到 ${listOutputPath}`);

  // 翻译今日精选（详情页用）
  const featuredPath = path.join('src', 'content', 'filtered', `${today}-featured.json`);
  if (fs.existsSync(featuredPath)) {
    const featured = JSON.parse(fs.readFileSync(featuredPath, 'utf-8'));
    console.log(`\n开始翻译今日精选: ${featured.title}`);

    const translatedFeatured = { zh: featured };
    for (const lang of LANGUAGES) {
      if (lang === 'zh') continue;
      console.log(`  翻译到 ${lang}...`);
      const [title, summary] = await Promise.all([
        translateText(featured.title, lang),
        translateText(featured.summary || '', lang),
      ]);
      translatedFeatured[lang] = { ...featured, title, summary, lang };
    }

    const featuredOutputPath = path.join(outputDir, `${today}-featured.json`);
    fs.writeFileSync(featuredOutputPath, JSON.stringify(translatedFeatured, null, 2), 'utf-8');
    console.log(`精选翻译已保存到 ${featuredOutputPath}`);
  }

  console.log('\n翻译完成！');
}

main();