import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';

const parser = new Parser();

const RSS_FEEDS = [
  { name: '36氪出海', url: 'https://36kr.com/feed', lang: 'zh' },
  { name: '钛媒体', url: 'https://www.tmtpost.com/feed', lang: 'zh' },
  { name: 'Rest of World', url: 'https://restofworld.org/feed', lang: 'en' },
  { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed', lang: 'en' },
  { name: 'SCMP Business', url: 'https://www.scmp.com/rss/91/feed', lang: 'en' },
  { name: 'Google News', url: 'https://news.google.com/rss/search?q=chinese+companies+global+expansion&hl=en&gl=US&ceid=US:en', lang: 'en' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', lang: 'en' },
  { name: 'Reuters Asia', url: 'https://feeds.reuters.com/reuters/businessNews', lang: 'en' },
];

const HOURS_LIMIT = 48;

function isRecent(dateStr) {
  if (!dateStr) return true;
  const published = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - published) / (1000 * 60 * 60);
  return diffHours <= HOURS_LIMIT;
}

async function fetchAllFeeds() {
  const results = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`抓取: ${feed.name}`);
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items
        .slice(0, 20)
        .filter(item => isRecent(item.pubDate || item.isoDate))
        .map(item => ({
          source: feed.name,
          lang: feed.lang,
          title: item.title || '',
          summary: item.contentSnippet || item.content || '',
          url: item.link || '',
          publishedAt: item.pubDate || item.isoDate || '',
        }));
      results.push(...items);
      console.log(`  ✓ 获取 ${items.length} 条（48小时内）`);
    } catch (err) {
      console.error(`  ✗ ${feed.name} 失败: ${err.message}`);
    }
  }

  return results;
}

async function main() {
  console.log('开始抓取 RSS feeds...\n');
  const articles = await fetchAllFeeds();
  console.log(`\n共抓取 ${articles.length} 条新闻`);

  const today = new Date().toISOString().split('T')[0];
  const outputDir = path.join('src', 'content', 'raw');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${today}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(articles, null, 2), 'utf-8');
  console.log(`\n已保存到 ${outputPath}`);
}

main();