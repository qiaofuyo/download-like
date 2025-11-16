import fs from 'node:fs';
import path from 'node:path';

/**
 * 当前项目根目录（process.cwd()）
 * @constant {string}
 */
const root = process.cwd();

/**
 * 复制模板文件到目标位置（仅在目标不存在时）
 *
 * 如果目标文件已存在则不做任何操作并返回 false。
 * 如果模板文件不存在会打印警告并返回 false。
 * 在复制前会确保目标父目录存在，出错时会打印错误并返回 false（以避免 postinstall 失败）。
 *
 * @param {string} src - 模板源路径（绝对或相对）
 * @param {string} dst - 目标文件路径（绝对或相对）
 * @param {string} name - 人类可读的文件名用于日志输出
 * @returns {boolean} 返回 true 表示已创建文件，false 表示跳过或失败
 */
function copyIfMissing(src, dst, name) {
  try {
    if (!fs.existsSync(dst)) {
      if (!fs.existsSync(src)) {
        console.warn(`[createFile] template for ${name} not found: ${src}`);
        return false;
      }
      // ensure parent dir exists
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      console.log(`[createFile] created ${name} -> ${dst}`);
      return true;
    } else {
      console.log(`[createFile] ${name} already exists, skip: ${dst}`);
      return false;
    }
  } catch (e) {
    console.error(`[createFile] failed to create ${name}:`, e);
    // postinstall 不应该因为这个而导致整个安装失败
    return false;
  }
}

const tplFilter = path.resolve(root, 'scripts/filterList.js.template');
const dstFilter = path.resolve(root, 'lib/filterList.js');
copyIfMissing(tplFilter, dstFilter, 'lib/filterList.js');

const tplEnv = path.resolve(root, 'scripts/.env.template');
const dstEnv = path.resolve(root, '.env');
copyIfMissing(tplEnv, dstEnv, '.env');