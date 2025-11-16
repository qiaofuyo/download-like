import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';  // __dirname、__filename（在 ESM 中默认没有），需自行定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { downloadToFile } from './lib/downloader.js';
import { getLikedList, cancelLike } from './services/kuaishouApi.js';
import MetadataStore from './lib/metadataStore.js';
import * as logger from './lib/logger.js';
import { getTimeString } from './utils/time.js';

import { Listr } from 'listr2';

// ensure filterList
let userBlacklist = [];
let workBlacklist = [];
try {// 动态 import：不存在时会抛错
  const mod = await import('./lib/filterList.js');
  userBlacklist = mod.userBlacklist ?? [];
  workBlacklist = mod.workBlacklist ?? [];
} catch (e) {
  userBlacklist = [];
  workBlacklist = [];
}

// config from env
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, 'downloads', 'videos');
const IMAGE_DIR = process.env.IMAGE_DIR || path.join(__dirname, 'downloads', 'images');
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const AUTO_CANCEL = (process.env.AUTO_CANCEL || 'false').toLowerCase() === 'true';
const LOG_KEEP_DAYS = Number(process.env.LOG_KEEP_DAYS || 30);
// logger.debug('main', 'test');

// ensure directories
for (const d of [VIDEO_DIR, IMAGE_DIR, path.join(__dirname, 'meta'), path.join(__dirname, 'logs')]) {
  fs.mkdirSync(d, { recursive: true });
}

// 轮换日志
try { logger.rotateKeepDays(LOG_KEEP_DAYS); } catch (e) { console.error('log rotate failed', e); }

// metadata stores
const metadata = new MetadataStore(path.join(__dirname, 'meta', 'work.ndjson'));

//
async function processAll() {
  logger.info('main', 'start', { concurrency: CONCURRENCY, autoCancel: AUTO_CANCEL });

  // fetch liked list (service)
  const tasks = await getLikedList();

  // filter blacklist
  const filtered = tasks.filter(t => {
    if (!t.workId || !t.playUrl) {
      logger.warn('main', '跳过无效任务', { task: t });
      return false;
    }
    if (userBlacklist.includes(String(t.userId))) {
      logger.warn('main', '跳过黑名单用户', { userId: t.userId, workId: t.workId });
      return false;
    }
    if (workBlacklist.includes(String(t.workId))) {
      logger.warn('main', '跳过黑名单作品', { userId: t.userId, workId: t.workId });
      return false;
    }
    if (metadata.has(t.workId)) {
      logger.warn('main', '已经拥有元数据', { workId: t.workId, filename: t.filename });
      return false;
    }
    return true;
  });

  logger.info('main', '将处理总数', { total: filtered.length });

  if (filtered.length === 0) {
    logger.info('main', '✔ 没有需要处理的作品', '', true);
    return [];
  }

  // 带有并发池的进程
  const listr = new Listr(
    filtered.map(originalTask => ({
      // 安全标题：绝不让 listr2 碰到数组
      title: typeof originalTask.filename === 'string' ? originalTask.filename : Array.isArray(originalTask.filename) ? `${originalTask.filename[0]} 等 ${originalTask.filename.length}P` : originalTask.workId,
      task: (ctx, listrTask) => {
        const task = originalTask;
        // 区分 video 和 image
        const isVideo = task.workType === 'video' || typeof task.playUrl === 'string';
        const urls = isVideo ? [task.playUrl] : task.playUrl;
        const filenames = isVideo ? [task.filename] : (task.filename || []);

        const total = urls.length;
        return listrTask.newListr([{
          // 初始标题随便写，后面会实时覆盖
          title: isVideo ? '下载视频中...' : `下载图片 1/${total}`,
          task: async (_, subTask) => {
            for (let i = 0; i < urls.length; i++) {
              if (!isVideo) {
                subTask.title = `下载图片 ${i + 1}/${total}`;
              }

              let filename = filenames[i];
              const dest = path.join(isVideo ? VIDEO_DIR : IMAGE_DIR, filename);

              await downloadToFile(urls[i], dest, { retries: 3, timeoutMs: 30_000 });
            }

            if (AUTO_CANCEL) {
              subTask.title = '取消点赞中…';
              await cancelLike(task.workId, task.userId);
              subTask.title = '已取消点赞';
            }

            // write metadata
            metadata.append({
              filename: task.filename,
              userId: task.userId,
              workId: task.workId,
              url: task.url,
              playUrl: task.playUrl,
              savedAt: getTimeString()
            });

            subTask.title = `完成 → ${task.filename || task.workId}`;
            logger.info('main', '下载保存', { workId: task.workId });
          }
        }], { concurrent: false });
      }
    })), {
    concurrent: CONCURRENCY,     // 控制并发运行的任务数
    exitOnError: false,          // 遇到单个任务失败时是否停止剩余任务
    renderer: 'default',         // Listr2 的输出渲染器
    // renderer: 'verbose',      // 调试时可以打开看详细信息
    rendererOptions: {
      detectWindowsAnsi: false,  // 关闭检测代码，不再生成 $null 文件
      collapse: false,           // 不折叠子任务输出
      collapseErrors: false,     // 错误不折叠，直接显示细节
      clearOutput: false         // 任务完成后不清除输出，便于查看历史输出
    }
  }
  );

  try {
    await listr.run();
    logger.info('main', '全部处理完成');
  } catch (e) {
    // listr2 已经帮标记了失败的任务，这里不需要额外处理
  }

  return filtered;
}

// run
processAll().catch(e => {
  logger.error('main', 'fatal', { err: String(e) });
  console.error(e);
  process.exit(1);
});