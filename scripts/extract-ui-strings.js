import fs from 'fs';
import path from 'path';
import { loadAdapter } from './i18n-adapters/index.js';

// 从页面中提取的界面词（中文源）。新增界面词时在此登记。
const UI_STRINGS = {
  'nav.home': '出海资讯',
  'nav.back': '← 返回列表',
  'section.featured': '今日精选',
  'section.latest': '最新资讯',
  'article.source': '来源',
  'article.readmore': '阅读原文 →',
  'article.featured_badge': '精选',
  'article.score_suffix': '分',
  'footer.tagline': '每日自动更新',
  'footer.source_note': '数据来源于公开 RSS 订阅',
  'lang.zh': '中文',
  'lang.en': 'English',
  'lang.ja': '日本語',
  'lang.ar': 'العربية',
  'status.loading': '加载中',
  'status.no_articles': '暂无资讯',
  'status.count': '{count} 篇资讯',
};

function writeLocale(lang, strings) {
  const dir = path.join('public', 'locales', lang);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'ui.json');
  fs.writeFileSync(outPath, JSON.stringify(strings, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${outPath} (${Object.keys(strings).length} 条)`);
}

async function main() {
  const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  const targetLangs = config.languages.filter((l) => l !== 'zh');

  console.log(`提取界面词：共 ${Object.keys(UI_STRINGS).length} 条`);

  // 中文源直接写出
  writeLocale('zh', UI_STRINGS);

  // 加载配置指定的 i18n 适配器（direct / tolgee / weblate...）
  const { translateUIStrings } = await loadAdapter();
  console.log(`使用适配器: ${config.active_i18n_tool || 'direct'}，目标语言: ${targetLangs.join(', ')}\n`);

  for (const lang of targetLangs) {
    console.log(`翻译界面词 → ${lang}`);
    const translated = await translateUIStrings(UI_STRINGS, lang);
    writeLocale(lang, translated);
  }

  console.log('\n界面词提取完成！');
}

main().catch((err) => {
  console.error(`界面词提取失败: ${err.message}`);
  process.exit(1);
});
