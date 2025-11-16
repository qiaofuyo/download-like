// downloadToFile(url, dest, opts) 带有重试，超时和基本内容长度检查
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

/**
 * 简单的 sleep，返回在指定毫秒后解析的 Promise。
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * 将远程资源下载并保存到本地文件，支持自动重试、超时、指数退避以及基础内容长度检查。
 *
 * 参数 opts 支持：
 * - retries {number} 重试次数（默认 3）
 * - timeoutMs {number} 单次请求超时时间，毫秒（默认 30000）
 * - backoffBase {number} 退避基数，毫秒（默认 500）
 * - headers {Object} 请求头对象
 *
 * 行为：
 * - 在每次失败后会按指数退避重试（backoffBase * 2^attempt + 随机抖动）
 * - 下载期间会创建目标文件的父目录
 * - 成功后会做最小检查（文件大小 > 0），否则视为失败并重试
 *
 * @async
 * @param {string} url - 要下载的资源 URL
 * @param {string} destPath - 本地目标文件路径
 * @param {Object} [opts] - 选项对象
 * @param {number} [opts.retries=3] - 最大重试次数
 * @param {number} [opts.timeoutMs=30000] - 每次请求的超时时间（毫秒）
 * @param {number} [opts.backoffBase=500] - 指数退避基数（毫秒）
 * @param {Object} [opts.headers] - 附加请求头
 * @returns {Promise<boolean>} 成功返回 true，失败抛出 Error
 * @throws {Error} 下载失败或最终重试用尽时抛出最后一次错误
 */
export async function downloadToFile(url, destPath, opts = {}) {
  const retries = Number(opts.retries ?? 3);
  const timeoutMs = Number(opts.timeoutMs ?? 30_000);
  const backoffBase = Number(opts.backoffBase ?? 500); // ms

  let lastErr = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal, headers: opts.headers || {} });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // create parent dir
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      
      // stream to file
      await pipeline(res.body, fs.createWriteStream(destPath));

      // 最小检查：文件大小> 0
      const st = fs.statSync(destPath);
      if (st.size === 0) throw new Error('zero-length file');

      return true;
    } catch (err) {
      clearTimeout(id);
      lastErr = err;
      // 如果存在，删除文件
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) { /* ignore */ }
      const backoff = backoffBase * Math.pow(2, attempt);
      await sleep(backoff + Math.random() * 100);
    }
  }
  throw lastErr || new Error('download failed');
}