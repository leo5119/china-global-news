import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function scoreArticle(article) {
  const prompt = `你是一个新闻编辑，专注于中国企业的全球化动态。
请判断下面这条新闻是否与以下任意一个主题相关：

1. 中国企业在海外的业务、投资、并购、合作
2. 中国品牌进入海外市场（电商、游戏、App、硬件、新能源等）
3. 跨境电商平台（SHEIN、Temu、速卖通、TikTok Shop等）
4. 海外监管政策对中国企业的影响
5. 中国企业在特定地区的扩张（东南亚、中东、拉美、非洲、欧洲）
6. 中国科技公司的国际化动态（华为、小米、字节、腾讯、阿里、比亚迪等）
7. 中国品牌在海外的口碑、销量、市场表现

注意：以下类型的新闻不算出海相关，请标记为 relevant: false：
- 军事、武器、防务、军工相关
- 纯政治外交，没有商业内容
- 制裁、贸易战等负面政治事件
- 纯国内市场的新闻

新闻标题：${article.title}
新闻摘要：${article.summary.slice(0, 300)}

请只返回一个 JSON 对象，格式如下：
{
  "relevant": true或false,
  "score": 1到10的整数（10分最相关）,
  "reason": "一句话说明原因"
}

不要返回任何其他内容。`;

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });

    const text = response.choices[0].message.content.trim();
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    return json;
  } catch (err) {
    console.error(`  ✗ 评分失败: ${err.message}`);
    return { relevant: false, score: 0, reason: '评分失败' };
  }
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const inputPath = path.join('src', 'content', 'raw', `${today}.json`);

  if (!fs.existsSync(inputPath)) {
    console.error(`找不到文件: ${inputPath}`);
    console.error('请先运行 fetch-news.js');
    process.exit(1);
  }

  const articles = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`共 ${articles.length} 条新闻待筛选\n`);

  const results = [];

  for (const article of articles) {
    console.log(`评分: ${article.title.slice(0, 40)}...`);
    const score = await scoreArticle(article);
    console.log(`  → 相关: ${score.relevant}, 分数: ${score.score}, ${score.reason}`);
    results.push({ ...article, ...score });
  }

  const relevant = results
    .filter(a => a.relevant && a.score >= 6)
    .sort((a, b) => b.score - a.score);

  console.log(`\n筛选结果: ${relevant.length} 条出海相关新闻`);

  const outputDir = path.join('src', 'content', 'filtered');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${today}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(relevant, null, 2), 'utf-8');
  console.log(`已保存到 ${outputPath}`);

  if (relevant.length > 0) {
    const featured = relevant[0];
    console.log(`\n今日精选: ${featured.title}`);
    const featuredPath = path.join('src', 'content', 'filtered', `${today}-featured.json`);
    fs.writeFileSync(featuredPath, JSON.stringify(featured, null, 2), 'utf-8');
  }
}

main();