import { fetchApi } from '../lib/fetchApi.js';
import cookieManager from '../utils/cookieManager.js';

/**
 * 配置常量（不可变）
 * @constant
 * @property {object} api - 各种 API 地址
 * @property {object} method - 不同模式的请求方法
 * @property {object} headers - 不同模式的请求头
 * @property {object} body - 不同模式的请求体
 * @property {number} requestCount - 每次请求拉取的数量
 * @property {string|undefined} ksID - 目标快手号（从环境变量读取）
 */
const CONFIG = Object.freeze({
  // 快手 API 地址
  api: {
    pc: 'https://live.kuaishou.com/live_api/profile/liked',
    pc_no_d: 'https://live.kuaishou.com/live_api/profile/like',
    app: 'https://www.kuaishou.com/graphql',
    work_video: 'https://www.kuaishou.com/short-video/',
    work_image_pc: 'https://live.kuaishou.com/u/'
  },
  // 请求方法
  method: {
    pc: 'GET',
    app: 'POSt'
  },
  // 请求头
  headers: {
    pc: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://live.kuaishou.com/',
    },
    app: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json'
    }
  },
  // 请求体 (App 模式)
  body: {
    app: {
      "operationName": "visionProfileLikePhotoList",
      "variables": {
        "pcursor": "",
        "page": "profile"
      },
      "query": `fragment photoContent on PhotoEntity {
  __typename
  id
  duration
  caption
  originCaption
  likeCount
  viewCount
  commentCount
  realLikeCount
  coverUrl
  photoUrl
  photoH265Url
  manifest
  manifestH265
  videoResource
  coverUrls {
    url
    __typename
  }
  timestamp
  expTag
  animatedCoverUrl
  distance
  videoRatio
  liked
  stereoType
  profileUserTopPhoto
  musicBlocked
}

fragment recoPhotoFragment on recoPhotoEntity {
  __typename
  id
  duration
  caption
  originCaption
  likeCount
  viewCount
  commentCount
  realLikeCount
  coverUrl
  photoUrl
  photoH265Url
  manifest
  manifestH265
  videoResource
  coverUrls {
    url
    __typename
  }
  timestamp
  expTag
  animatedCoverUrl
  distance
  videoRatio
  liked
  stereoType
  profileUserTopPhoto
  musicBlocked
}

fragment feedContent on Feed {
  type
  author {
    id
    name
    headerUrl
    following
    headerUrls {
      url
      __typename
    }
    __typename
  }
  photo {
    ...photoContent
    ...recoPhotoFragment
    __typename
  }
  canAddComment
  llsid
  status
  currentPcursor
  tags {
    type
    name
    __typename
  }
  __typename
}

query visionProfileLikePhotoList($pcursor: String, $page: String, $webPageArea: String) {
  visionProfileLikePhotoList(pcursor: $pcursor, page: $page, webPageArea: $webPageArea) {
    result
    llsid
    webPageArea
    feeds {
      ...feedContent
      __typename
    }
    hostName
    pcursor
    __typename
  }
}`
    },
    pc: null,
    app_video_like: {
      operationName: "visionVideoLike",
      query: `mutation visionVideoLike($photoId: String, $photoAuthorId: String, $cancel: Int, $expTag: String) { visionVideoLike(photoId: $photoId, photoAuthorId: $photoAuthorId, cancel: $cancel, expTag: $expTag) { result __typename } }`
    },
    pc_video_like: null
  },
  // 请求数量
  requestCount: Number(process.env.REQUEST_COUNT || 99),
  // 快手号
  ksID: process.env?.KS_ID
});

// 获取模式，默认 app
const arg = process.argv.slice(2)[0];
/**
 * 请求模式：'pc' 或 'app'，优先命令行参数 n/N 设置为 pc，否则读取环境变量 MODE，默认 'app'
 * @type {'pc'|'app'}
 */
const MODE = (arg === 'n' || arg === 'N') ? 'pc' : (process.env.MODE || 'app');

/**
 * 从给定的 URL 字符串中提取文件扩展名（后缀）。
 * * 该函数具备以下处理逻辑：
 * 1. **URL 清洗**: 自动忽略 `?` 后的查询参数和 `#` 后的哈希值，确保提取的是真实文件名。
 * 2. **健壮性**: 处理无文件名、无后缀或格式异常的 URL 时，不会抛出异常。
 * 3. **标准化**: 返回的扩展名会自动转换为全小写。
 *
 * @param {string} url - 需要解析的资源完整 URL 或路径。
 * @returns {string} 返回提取到的扩展名（不含点号，如 'mp4', 'jpg'）。如果解析失败或无后缀，则返回空字符串。
 * * @example
 * getFileExtFromUrl('https://example.com/video.MP4?token=123'); // 返回 'mp4'
 * getFileExtFromUrl('https://example.com/image.jpg#section');   // 返回 'jpg'
 * getFileExtFromUrl('https://example.com/README');             // 返回 ''
 */
function getFileExtFromUrl(url) {
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];  // 去除 query/hash
    const name = cleanUrl.split('/').pop();
    if (!name || !name.includes('.')) return '';
    const parts = name.split('.');
    const ext = parts.pop().toLowerCase();

    return ext;
  } catch {
    return '';
  }
}

/**
 * 核心请求分发器（带自动身份验证重试机制）。
 * * 该函数负责：
 * 1. 根据当前 {@link MODE} 自动注入对应的 Cookie (PC/APP)。
 * 2. 调用 {@link fetchApi} 执行网络请求。
 * 3. 拦截 401/403 错误，并利用 {@link cookieManager} 的并发锁机制自动刷新 Cookie 并重试。
 *
 * @async
 * @param {string} url - 请求的完整 URL 地址。
 * @param {string} [method='GET'] - HTTP 请求方法 (如 'GET', 'POST')。
 * @param {Object|null} [headers=null] - 请求头对象。函数内部会自动注入 Cookie。
 * @param {Object|string|null} [body=null] - 请求体。如果是对象，fetchApi 内部通常会处理为 JSON。
 * @param {number} [timeout=10000] - 请求超时时间（毫秒）。
 * @param {number} [retryCount=0] - 当前重试次数。用于限制递归深度，防止身份失效时无限循环。
 * * @returns {Promise<any>} 返回解析后的响应数据（通常为 JSON 对象）。
 * * @throws {Error} 如果重试一次后仍然失败，或者发生非认证类错误，将抛出异常。
 * * @example
 * const data = await request('https://live.kuaishou.com/api/profile', 'GET');
 */
async function request(url, method = 'GET', headers = null, body = null, timeout = 10000, retryCount = 0) {
  // 1. 异步获取 Cookie 映射（不再依赖 .env 直接读取）
  const allCookie = await cookieManager.getCookies();
  const currentCookie = MODE === 'pc' ? allCookie.COOKIE_PC : allCookie.COOKIE_APP;

  // 2. 构造完整的 Headers
  headers = headers ?? {};
  headers.Cookie = currentCookie ?? '';

  try {
    return await fetchApi(url, method, headers, body, timeout);
  } catch (error) {
    // 3. 401/403 并发锁重试逻辑
    const isAuthError = error.status === 401 || error.status === 403;
    if (isAuthError && retryCount < 1) {
      console.warn(`[KuaishouApi] ${MODE} 模式 Cookie 失效，尝试自动刷新...`);
      await cookieManager.refreshCookies();
      return request(url, method, headers, body, timeout, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 任务对象类型定义
 * @typedef {Object} LikedTask
 * @property {string} workType - 作品类型 'video' 或 'image'
 * @property {string} workId - 作品 ID
 * @property {string} userId - 作者 ID
 * @property {string|Array<string>} playUrl - 播放地址或图片数组
 * @property {string} url - 作品页面地址
 * @property {string|Array<string>} filename - 生成的文件名或文件名数组（含扩展名）
 * @property {Object} meta - 原始接口返回的条目对象
 */

/**
 * 获取当前登录用户的点赞作品列表，并将其标准化为统一的任务格式。
 * * 该函数根据全局 {@link MODE} 执行以下操作：
 * 1. **自动寻址**: PC 模式访问直播站 Restful 接口；APP 模式访问主站 GraphQL 接口。
 * 2. **自动倒序**: 为了方便从旧到新处理，函数会自动将获取到的列表进行 `reverse()`。
 * 3. **多态解析**: 
 * - PC 端支持视频 (video) 和图集 (multiple)，图集会生成文件名数组。
 * - APP 端目前仅适配视频类型解析。
 * 4. **异常拦截**: 自动识别 GraphQL 内部抛出的业务错误消息。
 *
 * @async
 * @returns {Promise<Array<Object>>} 返回标准化后的任务数组。每个任务包含：
 * @returns {string} Object.workType - 作品类型 ('video' 或 'multiple'/'image')。
 * @returns {string} Object.workId - 作品唯一 ID (photoId)。
 * @returns {string} Object.userId - 作者 ID。
 * @returns {string|string[]} Object.playUrl - 媒体资源地址（视频为字符串，图集可能为数组）。
 * @returns {string} Object.url - 作品详情页的网页地址。
 * @returns {string|string[]} Object.filename - 建议保存的文件名（包含作者和作品信息）。
 * @returns {Object} Object.meta - 接口返回的原始数据引用，用于调试或扩展。
 * * @throws {Error} 当接口返回 GraphQL 错误（resp.errors）或网络请求失败时。
 * * @example
 * const tasks = await getLikedList();
 * tasks.forEach(task => console.log(`发现作品: ${task.workId}, 类型: ${task.workType}`));
 */
export async function getLikedList() {
  const url = MODE === 'pc' ? `${CONFIG.api.pc}?count=${CONFIG.requestCount}&principalId=${CONFIG.ksID}` : CONFIG.api.app;
  const resp = await request(url, CONFIG.method[MODE], CONFIG.headers[MODE], CONFIG.body[MODE], 10000);
  if (resp.errors && resp.errors[0]?.message) throw new Error(resp.errors[0].message);

  let rawList = MODE === 'pc' ? (resp.data?.list || []) : (resp.data?.visionProfileLikePhotoList?.feeds || []);
  rawList = Array.isArray(rawList) ? rawList.slice().reverse() : [];

  const tasks = rawList.map(item => {
    let workType = '';
    let workId = '';
    let userId = item.author?.id;
    let playUrl = '';
    let url = '';
    let filename = '';  // 主页ID(快手ID)_作品ID

    if (MODE === 'pc') {  // pc
      workType = item.workType;  // video | multiple
      workId = item.id;
      playUrl = item.playUrl || item.imgUrls;
      if (workType === 'video' && !Array.isArray(playUrl)) {
        url = item?.url ?? `${CONFIG.api.work_video}${workId}`;
        filename = `${userId}_${workId}.${getFileExtFromUrl(playUrl)}`;
      } else {
        url = item?.url ?? `${CONFIG.api.work_image_pc}${userId}/${workId}`;
        filename = [];
        playUrl.map((item, index) => filename.push(`${userId}_${workId}_${index}.${getFileExtFromUrl(item)}`));
      }
    } else {  // app
      workType = 'video';  // app 模式只能获取视频
      workId = item.photo?.id;
      playUrl = item.photo?.photoUrl;
      url = item?.url ?? `${CONFIG.api.work_video}${workId}`;
      filename = `${userId}_${workId}.${getFileExtFromUrl(playUrl)}`;
    }

    return {
      workType,  // video|image
      workId,
      userId,
      playUrl,
      url,
      filename,
      meta: item
    };
  });

  return tasks;
}

/**
 * 取消或恢复对作品的点赞（支持 PC 和 APP 双模式）。
 * * 该函数会根据全局 {@link MODE} 变量自动切换逻辑：
 * - **PC 模式**: 构造带查询参数的 GET 请求，发送至直播站接口。
 * - **APP 模式**: 构造 GraphQL Mutation 请求，发送至主站接口。
 * * @async
 * @param {string} worksID - 作品的唯一标识（photoId）。
 * @param {string} userID - 作品作者的唯一标识（principalId 或 photoAuthorId）。
 * @param {number} [cancel=1] - 操作类型：`1` 表示取消点赞，`0` 表示恢复/执行点赞。
 * * @returns {Promise<Object>} 返回接口响应解析后的 JSON 对象。
 * * @throws {Error} 如果缺少 `worksID` 或 `userID` 参数，将抛出错误。
 * @throws {Error} 如果网络请求失败或身份认证过期（经过自动刷新重试后仍失败）。
 * * @example
 * // 取消点赞
 * await cancelLike('3xabc123', 'user_789');
 * * // 恢复点赞
 * await cancelLike('3xabc123', 'user_789', 0);
 */
export async function cancelLike(worksID, userID, cancel = 1) {
  if (!worksID || !userID) throw new Error('missing worksID or userID');

  if (MODE === 'pc') {
    const url = `${CONFIG.api.pc_no_d}?photoId=${encodeURIComponent(worksID)}&principalId=${encodeURIComponent(userID)}&cancel=${Number(cancel)}`;
    return await request(url, CONFIG.method.pc, CONFIG.headers.pc, CONFIG.body.pc_video_like, 10000);
  } else {
    const body = CONFIG.body.app_video_like;
    body.variables = { photoId: worksID, photoAuthorId: userID, cancel };
    return await request(CONFIG.api.app, CONFIG.method.app, CONFIG.headers.app, body, 10000);
  }
}
