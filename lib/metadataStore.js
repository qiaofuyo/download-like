import fs from 'node:fs';
import path from 'node:path';

/**
 * 读取 NDJSON(JSONL) 元数据到内存中并维护索引的简单实现。
 * 每行应为一个 JSON 对象，且包含唯一的 workId 字段。
 * @module lib/metadataStore
 */

/**
 * 确保目标文件与其父目录存在；如果不存在则创建空文件。
 * 该函数不会抛出异常（上层调用可捕获）。
 *
 * @param {string} filePath - 要确保存在的文件路径
 * @returns {void}
 */
function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
}

/**
 * 在文件系统中基于 NDJSON 存储并在内存中维护索引的元数据存储类。
 * 适用于防止重复记录并快速判断某个 workId 是否已存在。
 */
export default class MetadataStore {
  /**
   * 创建 MetadataStore 实例并加载现有索引。
   * @param {string} filePath - 用于持久化 NDJSON 的文件路径（相对或绝对）
   */
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    ensureFile(this.filePath);
    this._loadIndex();
  }

  /**
   * 从文件中读取所有行并构建 workId 索引（Set）。
   * 忽略解析失败的行，发生 IO 错误时静默处理。
   * @private
   * @returns {void}
   */
  _loadIndex() {
    this.index = new Set();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw) return;
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const l of lines) {
        try {
          const obj = JSON.parse(l);
          if (obj && obj.workId) this.index.add(String(obj.workId));
        } catch (e) {
          // skip malformed
        }
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 判断指定 workId 是否已存在于索引中。
   * @param {string|number} workId - 要检查的作品 ID
   * @returns {boolean} 已存在返回 true，否则 false
   */
  has(workId) {
    return this.index.has(String(workId));
  }

  /**
   * 将一条元数据追加到 NDJSON 文件并更新索引。
   * 如果对象不包含 workId 会抛出错误；如果记录已存在则不写入并返回 false。
   *
   * @param {Object} obj - 要追加的元数据对象（必须包含 workId 字段）
   * @param {string|number} obj.workId - 作品唯一 ID
   * @returns {boolean} 写入成功返回 true，已存在或写入失败返回 false
   * @throws {Error} 当 obj 或 obj.workId 缺失时抛出
   */
  append(obj) {
    if (!obj || !obj.workId) throw new Error('metadata must include workId');
    const id = String(obj.workId);
    if (this.index.has(id)) return false;
    try {
      fs.appendFileSync(this.filePath, JSON.stringify(obj) + '\n', 'utf8');
      this.index.add(id);
      return true;
    } catch (e) {
      return false;
    }
  }
}
