import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 根据 config.json 的 active_i18n_tool 字段加载对应的 i18n 适配器。
 * 每个适配器需导出 translateUIStrings(strings, targetLang)。
 * @param {string} configPath config.json 路径（默认项目根目录）
 * @returns {Promise<{ translateUIStrings: Function }>} 适配器模块
 */
export async function loadAdapter(configPath = 'config.json') {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const tool = config.active_i18n_tool || 'direct';

  const adapterPath = path.join(__dirname, `${tool}.js`);
  if (!fs.existsSync(adapterPath)) {
    throw new Error(
      `未知的 i18n 适配器: "${tool}"。请检查 config.json 的 active_i18n_tool 字段。` +
        `当前可用: ${listAdapters().join(', ')}`
    );
  }

  // Windows 下 import() 需要 file:// URL，不能直接用绝对路径字符串
  const adapter = await import(pathToFileURL(adapterPath).href);
  if (typeof adapter.translateUIStrings !== 'function') {
    throw new Error(`适配器 "${tool}" 未导出 translateUIStrings(strings, targetLang)`);
  }
  return adapter;
}

/** 列出 scripts/i18n-adapters 下所有可用适配器（除 index.js） */
export function listAdapters() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => f.replace(/\.js$/, ''));
}
