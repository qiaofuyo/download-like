// JSONL + human-friendly pretty log (dual-write)
import fs from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';

import { getTimeString } from '../utils/time.js';

/**
 * 日志目录，优先使用环境变量 LOG_DIR，否则使用项目下的 logs 目录。
 * @constant {string}
 */
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) { /* ignore */ }

/**
 * 获取今日或偏移天数的日期字符串（YYYY-MM-DD）。
 * @param {number} [offsetDays=0] - 相对于今天的偏移天数，负数表示过去的日期
 * @returns {string} YYYY-MM-DD 格式的日期字符串
 */
function todayDateStr(offsetDays = 0) {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return getTimeString(d).slice(0, 10);
}

/**
 * 将任意值安全序列化为字符串，用于日志记录。
 * @param {*} v - 任意值
 * @returns {string} 字符串表示，JSON 序列化失败时返回 String(v)
 */
function safeStringify(v) {
  try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return String(v); }
}

/**
 * 生成元数据的简短人类可读摘要，用于 pretty log。
 * 仅浅层展示若干字段并限制长度，避免输出过长内容。
 * @param {*} meta - 任意元数据（对象或原始类型）
 * @returns {string} 简短摘要字符串
 */
function metaSummary(meta) {
  if (meta == null) return '';
  if (typeof meta === 'string') return meta;
  if (typeof meta !== 'object') return String(meta);

  // 将浅层键显示为 key=value, 并限制长度
  try {
    const parts = [];
    for (const [k, v] of Object.entries(meta)) {
      if (v == null) continue;
      const short = (typeof v === 'object') ? safeStringify(v).slice(0, 80) : String(v);
      parts.push(`${k}=${short}`);
      if (parts.length >= 6) break; // 限制字段数
    }
    const s = parts.join(' ');
    return s.length ? s : safeStringify(meta).slice(0, 200);
  } catch (e) {
    return safeStringify(meta).slice(0, 200);
  }
}

/**
 * 将记录以 JSONL 格式追加到当日日志文件（logs/YYYY-MM-DD.log）。
 * 若写入失败会在控制台报错作为回退。
 * @param {Object} record - 日志记录对象，包含 ts, level, module, message, meta 等字段
 * @returns {void}
 */
function writeJsonLine(record) {
  const filename = path.join(LOG_DIR, `${todayDateStr()}.log`);
  try {
    let content = safeStringify(record) + '\n';
    if (record.message === 'start') content = '\n' + content;
    fs.appendFileSync(filename, content, 'utf8');
    // console.log(`${record.message}: ${safeStringify(record.meta)}`);
  } catch (e) {
    // fallback
    console.error('logger write failed', e);
  }
}

/**
 * 将记录追加到当日的可读日志（logs/YYYY-MM-DD.pretty.log），格式化为易读文本。
 * @param {Object} record - 日志记录对象
 * @returns {void}
 */
function writePrettyLine(record) {
  const filename = path.join(LOG_DIR, `${todayDateStr()}.pretty.log`);
  const metaStr = metaSummary(record.meta);
  let line = `[${record.ts}] [${record.level}] ${record.module} - ${record.message}` + (metaStr ? ` -- ${metaStr}` : '') + '\n';
  try {
    if (record.message === 'start') line = '\n' + line;
    fs.appendFileSync(filename, line, 'utf8');
  } catch (e) {
    console.error('logger pretty write failed', e);
  }
}

/**
 * 核心日志记录函数，负责格式化输出到控制台并写入日志文件。
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'} level - 日志等级
 * @param {string} moduleName - 模块名称（通常为文件名）
 * @param {string|*} message - 主消息
 * @param {*} [meta] - 附加元数据，可为任意类型
 * @param {boolean} [isPrint=false] - 是否同时打印到控制台
 * @returns {void}
 */
function _log(level, moduleName, message, meta, isPrint=false) {
  const record = {
    ts: getTimeString(),
    level,
    module: moduleName,
    message: safeStringify(message),
    meta: meta || null
  };

  // 定义日志等级对应颜色函数和输出函数
  const levelMap = {
    INFO:  { colorFn: msg => styleText('green', msg),   output: console.log },
    WARN:  { colorFn: msg => styleText('yellow', msg),  output: console.warn },
    ERROR: { colorFn: msg => styleText('red', msg),     output: console.error },
    DEBUG: { colorFn: msg => styleText('magenta', msg), output: console.log },
  };
  const { colorFn, output } = levelMap[level] || levelMap.INFO;
  // 构造格式化消息
  let levelForm = level === 'ERROR' ? styleText(['white', 'bgRed'], level) : styleText('white', level);
  let formatted = `[${styleText('cyan', record.ts)}] [${levelForm}] ${moduleName} - ${record.message}`;
  if (isPrint) output(colorFn(formatted));
  // 输出 meta 对象，如果存在，缩进显示
  if (meta) {
    const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2);
    if (isPrint) output(styleText('gray', metaStr));
  }

  // 写入日志文件
  writeJsonLine(record);
  writePrettyLine(record);
}

/**
 * 记录 INFO 级别日志的快捷函数。
 * @param {string} moduleName - 模块名
 * @param {string|*} msg - 日志消息
 * @param {*} [meta] - 附加元数据
 * @param {boolean} [isPrint=false] - 是否打印到控制台
 */
export const info = (moduleName, msg, meta, isPrint) => _log('INFO', moduleName, msg, meta, isPrint);
/**
 * 记录 WARN 级别日志的快捷函数。
 * @param {string} moduleName
 * @param {string|*} msg
 * @param {*} [meta]
 * @param {boolean} [isPrint=false]
 */
export const warn = (moduleName, msg, meta, isPrint) => _log('WARN', moduleName, msg, meta, isPrint);
/**
 * 记录 ERROR 级别日志的快捷函数。
 * @param {string} moduleName
 * @param {string|*} msg
 * @param {*} [meta]
 * @param {boolean} [isPrint=false]
 */
export const error = (moduleName, msg, meta, isPrint) => _log('ERROR', moduleName, msg, meta, isPrint);
/**
 * 记录 DEBUG 级别日志的快捷函数。
 * @param {string} moduleName
 * @param {string|*} msg
 * @param {*} [meta]
 * @param {boolean} [isPrint=false]
 */
export const debug = (moduleName, msg, meta, isPrint) => _log('DEBUG', moduleName, msg, meta, isPrint);

/**
 * 删除超过指定天数的日志文件（保留最近 `days` 天）。
 * 非阻塞且遇到错误时静默忽略。
 * @param {number} [days=30] - 要保留的天数
 * @returns {void}
 */
export function rotateKeepDays(days = 30) {
  try {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log') || f.endsWith('.pretty.log'));
    const keep = new Set();
    for (let i = 0; i < days; i++) keep.add(todayDateStr(-i));
    for (const f of files) {
      const dateStr = f.slice(0, 10);
      if (!keep.has(dateStr)) {
        try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }
}
