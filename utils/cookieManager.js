// utils/cookieManager.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// ESM 中没有 __dirname，需要手动构建
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.resolve(__dirname, '../cookies.json');

// 定义目标 URL
const HOME_ID = process.env?.HOME_ID ?? '';
const TARGETS = {
  APP: `https://www.kuaishou.com/profile/${HOME_ID}`, // 对应 COOKIE_APP
  PC: `https://live.kuaishou.com/profile/${HOME_ID}`   // 对应 COOKIE_PC
};

class CookieManager {
  constructor() {
    this.cookie = { COOKIE_APP: '', COOKIE_PC: '' };
    // 1. 初始化 Promise，避免首次并发调用 getCookies 导致多次读取文件
    this.initPromise = this.loadCookies();
    // 2. 刷新锁：存储正在进行的刷新 Promise
    this.refreshPromise = null;
  }

  async loadCookies() {
    try {
      const data = await fs.readFile(COOKIE_PATH, 'utf-8');
      this.cookie = JSON.parse(data);
    } catch (e) {
      console.warn('⚠️ [CookieManager] 没有找到本地 Cookie，初始化将为空。');
    }
  }

  // 获取 Cookie (并发安全)
  async getCookies() {
    await this.initPromise;
    // 如果内存中没有 Cookie，且当前没有正在刷新的任务，则触发刷新
    if ((!this.cookie.COOKIE_APP || !this.cookie.COOKIE_PC) && !this.refreshPromise) {
      console.log('🔄 [CookieManager] Cookie 丢失/过期。刷新...');
      await this.refreshCookies();
    }

    // 如果正在刷新，等待刷新完成
    if (this.refreshPromise) {
      await this.refreshPromise;
    }

    return this.cookie;
  }

  // 刷新 Cookie (并发锁核心逻辑)
  async refreshCookies() {
    // 1. 如果已有任务在运行，直接返回该任务的 Promise (单例锁)
    if (this.refreshPromise) {
      console.log('⏳ [CookieManager] 正在刷新，等待中...');
      return this.refreshPromise;
    }

    // 2. 创建新的刷新任务
    this.refreshPromise = (async () => {
      console.log('🚀 [CookieManager] 开始浏览器 登录快手账号 流程...');
      const browser = await chromium.launch({
        headless: false, // 必须开启界面以进行人工扫码
        args: ['--no-sandbox']
      });

      try {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          // 使用真实 UA 降低风控概率
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        // 步骤 A: 访问主站获取 APP Cookie
        await page.goto(TARGETS.APP, { waitUntil: 'domcontentloaded' });
        try {
          // 等待登录成功的标识,超时时间设为 2 分钟，留足扫码时间
          await page.waitForSelector('#app >> .profile-top >> .btn-words >> text= 管理作品 ', { timeout: 120000 });
        } catch (e) {
          throw new Error('登录超时：用户未扫描二维码。');
        }
        const appCookies = await context.cookies([TARGETS.APP]);
        this.cookie.COOKIE_APP = this._formatCookie(appCookies);

        // 步骤 B: 访问直播站获取 PC Cookie，因为是同域 (.kuaishou.com)，登录态会自动继承，不需要再次扫码，但需要滑块验证
        await page.goto(TARGETS.PC, { waitUntil: 'networkidle' });
        const pcCookies = await context.cookies([TARGETS.PC]);
        this.cookie.COOKIE_PC = this._formatCookie(pcCookies);

        // 步骤 C: 持久化
        await fs.writeFile(COOKIE_PATH, JSON.stringify(this.cookie, null, 2));
        console.log('✅ [CookieManager] 刷新并保存 Cookie。');
        
        // 返回最新的 cookies
        return this.cookie;

      } catch (e) {
        console.error('💥 [CookieManager] 刷新失败:', e);
        throw e; // 抛出错误供调用方处理
      } finally {
        await browser.close();
        // 3. 任务结束，释放锁
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // 辅助函数：将 Playwright Cookie 数组转为 Header 字符串
  _formatCookie(cookies) {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
}

// 导出单例
export default new CookieManager();