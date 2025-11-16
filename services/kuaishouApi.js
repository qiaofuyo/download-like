import { fetchApi } from '../lib/fetchApi.js';

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
      Cookie: (process.env.COOKIE_PC || '').trim(),
      Referer: 'https://live.kuaishou.com/',
    },
    app: {
      Cookie: (process.env.COOKIE_APP || '').trim(),
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
 * 从给定 URL 中提取文件扩展名（不包含 query/hash）
 * 例如 "https://a/b/c.mp4?x=1" -> "mp4"
 * @param {string} url - 需要解析的 URL
 * @returns {string} 小写的文件扩展名（无点），找不到返回空字符串
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
 * 获取当前用户喜欢的作品列表并转换为下载任务数组
 * 根据 MODE（pc/app）从不同接口获取并解析字段。
 * @async
 * @returns {Promise<LikedTask[]>} 解析后的任务列表
 * @throws {Error} 当接口返回 errors 时抛出错误
 */
export async function getLikedList() {
  const url = MODE === 'pc' ? `${CONFIG.api.pc}?count=${CONFIG.requestCount}&principalId=${CONFIG.ksID}` : CONFIG.api.app;
  const resp = await fetchApi(url, CONFIG.method[MODE], CONFIG.headers[MODE], CONFIG.body[MODE], 10000);
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
 * 取消/恢复 点赞（不同模式调用不同接口）
 * @async
 * @param {string} worksID - 作品 ID（photoId）
 * @param {string} userID - 作者/主页 ID（principalId/photoAuthorId）
 * @param {number} [cancel=1] - 取消或恢复，1 表示取消点赞，0 表示恢复（根据接口定义）
 * @returns {Promise<any>} 接口返回的原始响应
 * @throws {Error} 当缺少必需参数时抛出
 */
export async function cancelLike(worksID, userID, cancel = 1) {
  if (!worksID || !userID) throw new Error('missing worksID or userID');

  if (MODE === 'pc') {
    const url = `${CONFIG.api.pc_no_d}?photoId=${encodeURIComponent(worksID)}&principalId=${encodeURIComponent(userID)}&cancel=${Number(cancel)}`;
    return await fetchApi(url, CONFIG.method.pc, CONFIG.headers.pc, CONFIG.body.pc_video_like, 10000);
  } else {
    const body = CONFIG.body.app_video_like;
    body.variables = { photoId: worksID, photoAuthorId: userID, cancel };
    return await fetchApi(CONFIG.api.app, CONFIG.method.app, CONFIG.headers.app, body, 10000);
  }
}
