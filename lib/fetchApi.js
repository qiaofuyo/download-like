/**
 * 基于原生 Fetch API 封装的通用请求工具函数。
 * * 该函数实现了以下特性：
 * 1. 自动 JSON 序列化：传入对象类型的 body 会自动转为 JSON 字符串。
 * 2. 超时控制：支持通过 AbortController 实现请求超时中断。
 * 3. 错误处理：将非 2xx 的 HTTP 状态码包装为带 status 属性的错误抛出。
 * 4. 业务校验：自动拦截快手 API 常见的非 1 结果码业务错误。
 *
 * @async
 * @param {string} urlStr - 待请求的完整 URL 字符串。
 * @param {string} [method='GET'] - HTTP 请求方法。支持 'GET', 'POST', 'PUT', 'DELETE' 等。
 * @param {Object} [headers={}] - 自定义请求头对象。默认包含 'Content-Type': 'application/json'。
 * @param {Object|string|null} [body=null] - 请求体数据。如果是对象类型，将自动执行 JSON.stringify。
 * @param {number} [timeout=10000] - 请求超时限制（毫秒），默认为 10 秒。
 * * @returns {Promise<any>} 返回解析后的 JSON 响应数据。
 * * @throws {Error} 抛出的错误包含以下情况：
 * - 网络错误：如断网或 DNS 解析失败。
 * - 超时错误：错误消息为 '请求超时'。
 * - HTTP 错误：状态码非 2xx，Error 对象会包含一个额外的 `status` 属性。
 * - 业务错误：响应数据中的 `result` 字段不等于 1。
 * * @example
 * try {
 * const data = await fetchApi('https://api.example.com/data', 'POST', {}, { id: 123 });
 * console.log(data);
 * } catch (err) {
 * if (err.status === 401) console.error('身份验证失效');
 * else console.error(err.message);
 * }
 */
export async function fetchApi(urlStr, method = 'GET', headers = {}, body = null, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: controller.signal
    };

    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(urlStr, fetchOptions);

    // 注意：fetch 只有在网络错误时才 reject，这里非 200 状态码我们需要手动抛出错误。
    if (!response.ok) {
      // 抛出带状态码的错误，方便 service 层捕获
      const error = new Error(`API 请求失败，状态码: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    // 保留原有逻辑中对 parsed.result 的校验
    if (data.result && data.result !== 1) {
      throw new Error(`业务逻辑失败，结果码: ${data.result}`);
    }

    return data;

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}