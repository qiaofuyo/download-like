import https from 'node:https';
import { URL } from 'node:url';
import zlib from 'node:zlib';

/**
 * 发起 HTTP(S) 请求并尝试按 JSON 解析响应的简易工具。
 *
 * 支持自动处理常见的响应压缩编码（gzip、deflate、br）。
 * 使用 node:https 创建请求，适用于简单的 API 调用（GET/POST 等）。
 *
 * @param {string} urlStr - 完整请求 URL（例如 "https://example.com/api"）
 * @param {string} [method='GET'] - HTTP 方法
 * @param {Object} [headers={}] - 请求头对象
 * @param {Object|string|null} [body=null] - 请求体（如果是对象会被 JSON.stringify）
 * @param {number} [timeout=10000] - 请求超时时间（毫秒）
 * @returns {Promise<any>} 解析后的响应对象（JSON）
 * @throws {Error} 当请求失败、超时、或响应无法解析为 JSON 时会以 Error 的形式拒绝
 *
 * @example
 * const resp = await fetchApi('https://api.example.com/data', 'POST', { 'Content-Type': 'application/json' }, { foo: 'bar' });
 */
export async function fetchApi(urlStr, method = 'GET', headers = {}, body = null, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers,
        family: 4,
        timeout,
      };

      const req = https.request(options, (res) => {
        let stream = res;
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = JSON.parse(txt);
            if (res.statusCode !== 200 || (parsed.result && parsed.result !== 1)) {
              return reject(new Error(`API 请求失败，状态码: ${res.statusCode}`));
            }
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('timeout', () => req.destroy(new Error('Request timed out.')));
      req.on('error', reject);

      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
