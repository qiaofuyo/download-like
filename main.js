const fs = require('fs');
const https = require('node:https');
const zlib = require('zlib');
const path = require('path');
const {
  userBlacklist,
  workBlacklist
} = require('./filterList.js');

// --- 1. 配置管理 ---
let MODE = 'app';  // 模式：'app' 或 'pc'
const config = {
  // 快手 API 地址
  api: {
    pc: 'https://live.kuaishou.com/live_api/profile/liked',
    pc_no_d: 'https://live.kuaishou.com/live_api/profile/like',
    app: 'https://www.kuaishou.com/graphql',
  },
  // API 请求头
  headers: {
    pc: {
      Cookie: "clientid=3; did=web_7a5f0f05bc4555036d043815e1cc0663; client_key=65890b29; kpn=GAME_ZONE; did=web_792f6ae2bb5fa1cfa0794c6fce9559b5; userId=130398874; clientid=3; did=web_7a5f0f05bc4555036d043815e1cc0663; client_key=65890b29; kpn=GAME_ZONE; didv=1731398147190; userId=130398874; AMP_07c61c6ea8=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjIzNzMzMTJjYy04NWZlLTQ1MTgtOGI1Ny1kMzQzYWZmNzZjYzQlMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzQ5MTkxMzM2OTczJTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc0OTE5MjE3NTg2NCUyQyUyMmxhc3RFdmVudElkJTIyJTNBOSU3RA==; bUserId=1000260490400; kuaishou.web.cp.api_st=ChZrdWFpc2hvdS53ZWIuY3AuYXBpLnN0ErABNfT-Cn_H4HO24Z-vNzvp2QXFMDI_gkBMvNOFOukpVIi29LHRhNaEnIMK-sFfHl8ESrPFEIw0JFPg5qH4Y0TX1qbxQrbXQrAzErsI8f3Nmle86fsiGyfX8jQibkcbSdFyXuXpipItPG1IjSwv4GslL985T7zIRE8lEQp1DwZPxfrZytjCySROsWCGSnmtxE9BqeOMlahow1O1DZKvUCpPcZcpYaR-F3PWpF7m5sxX3rgaEizRDD0SwWQ3UiT9eGoHG0hz1iIgdSj5k2iM5_N31eRW55QrePxidXnVZhcXCe6dmXatvC4oBTAB; kuaishou.web.cp.api_ph=f90348e183edd6a0020a92ae25296be979cd; kuaishou.live.bfb1s=3e261140b0cf7444a0ba411c6f227d88; showFollowRedIcon=1; kwpsecproductname=PCLive; kuaishou.live.web_st=ChRrdWFpc2hvdS5saXZlLndlYi5zdBKgAZLBvDa1cJoZTBon2dJGqcAkeu3995WBH4HivcZnr8Qx7RZS5h9nHVSAlDuzvzAZO9UNcWeN0oNV8dVhQRjIqR32syq665g72IfWUPtj1ESHdOAvZdKlFgcJ9jhQTxhIhnZbAH2JD4qW8X5FxqCJD1mdrjHUxZKU9d9TaVpE5lL2wvsxEzGfZ5v3FfwPU8SdGAavWbPUqnO7mqrsAM8nnlAaEoMRdS355EPfvO-WEFcOv_Ls2yIgsKdzKNRW6DQhlSdH6zZIlAsc25gLFu1th606Z2DJLnAoBTAB; kuaishou.live.web_ph=c4488a27abf999c244c5c1daed6f25626fe3; kwfv1=PnGU+9+Y8008S+nH0U+0mjPf8fP08f+98f+nLlwnrIP9+Sw/ZFGfzY+eGlGf+f+e4SGfbYP0QfGnLFwBLU80mYGAPE+erFG0SfPnzfP/qlPAY0GAWUG0GF+9pj+04Y+9rl+BQYwerEP0G7Gnp0GAq780rA+ADAGAcAw/PEGfcl+/r=; kwssectoken=ARpCwEocUr06LooB1EzQeVo5xPeHbbjrJ4kUN/Q+3ciceQOJZAo2tlLQmwDtKWfAvTJEl3Nwe3caJ0B5SXsZRw==; kwscode=75d440673de879734b8700f363119968b4fabb4eb0369b1607e206d8e8c1ac9d",
      Referer: "https://live.kuaishou.com/",
    },
    app: {
      "Content-Type": "application/json",
      "Cookie": "kpf=PC_WEB; clientid=3; did=web_792f6ae2bb5fa1cfa0794c6fce9559b5; didv=1731398147190; userId=130398874; AMP_07c61c6ea8=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjIzNzMzMTJjYy04NWZlLTQ1MTgtOGI1Ny1kMzQzYWZmNzZjYzQlMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzQ5MTkxMzM2OTczJTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc0OTE5MjE3NTg2NCUyQyUyMmxhc3RFdmVudElkJTIyJTNBOSU3RA==; bUserId=1000260490400; kwpsecproductname=kuaishou-vision; kuaishou.server.webday7_st=ChprdWFpc2hvdS5zZXJ2ZXIud2ViZGF5Ny5zdBKwAfLE6ssAkYM3wzs85S1jzqAxGnzdw_uMcvTZRNxG8cNQmbF48t9LIh0g7fB6v8PmT7Ccq7cy7QPmzsGZFHM-aJjgiTAhAQ_x2tGredYp7hMrbR1TlO5RKnkoyJGQtK1W380yHfuyoz_h5aiE8OFLlYDhgsLCSP0bP9xYE_LEhn-n0BNXXgyWYK97IqUFJMoN8eZX3P63mc8367xPIpyjF3GbpRyufmTXwWUo9-aA_PQxGhKquV16S9dezebl5ZuYo_R_JKgiIHgGu9PorFTQxGmouf6OOURuBqLZt4XtygmdpuhQFQyHKAUwAQ; kuaishou.server.webday7_ph=a48d9db08b25ee46f00532dfb06afa55d5bb; kuaishou.web.cp.api_st=ChZrdWFpc2hvdS53ZWIuY3AuYXBpLnN0ErABNfT-Cn_H4HO24Z-vNzvp2QXFMDI_gkBMvNOFOukpVIi29LHRhNaEnIMK-sFfHl8ESrPFEIw0JFPg5qH4Y0TX1qbxQrbXQrAzErsI8f3Nmle86fsiGyfX8jQibkcbSdFyXuXpipItPG1IjSwv4GslL985T7zIRE8lEQp1DwZPxfrZytjCySROsWCGSnmtxE9BqeOMlahow1O1DZKvUCpPcZcpYaR-F3PWpF7m5sxX3rgaEizRDD0SwWQ3UiT9eGoHG0hz1iIgdSj5k2iM5_N31eRW55QrePxidXnVZhcXCe6dmXatvC4oBTAB; kuaishou.web.cp.api_ph=f90348e183edd6a0020a92ae25296be979cd; showFollowRedIcon=1; ktrace-context=1|MS44Nzg0NzI0NTc4Nzk2ODY5LjEyMjc5OTc2LjE3NTcxNDA1Mzc5NjIuMTM4NDUyMDg=|MS44Nzg0NzI0NTc4Nzk2ODY5Ljk1NjgyNzc5LjE3NTcxNDA1Mzc5NjIuMTM4NDUyMDk=|0|webservice-user-growth-node|webservice|true|src-Js; kpn=KUAISHOU_VISION; kwpsecproductname=kuaishou-vision; kwssectoken=iqgJLQArgLVob+ud8f1W+O5qiCgQ9+J6Jh2yBMzliM7Jg/xj1dm0TD9S5JCcdV87SIxss95zU0BUHpfuVwpoNg==; kwscode=8aad2d2b324d894df87afb11e3e354954b83d602bf936b28b41ffd3a68336160; kwfv1=PnGU+9+Y8008S+nH0U+0mjPf8fP08f+98f+nLlwnrIP9+Sw/ZFGfzY+eGlGf+f+e4SGfbYP0QfGnLFwBLU80mYGAZI+A4fPAzY+nPlGAPIP9rlw/PI8Brl+A80PBHMPerEPBHE8fPl80qFP0W7G0HI8ezSwe+f+9cF+fzD+fPAGfGlPeP78BPE+eHhGADEG9cA+98S8BbY8/W78eZM+ecM8Z=="
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
      "query": "fragment photoContent on PhotoEntity {\n  __typename\n  id\n  duration\n  caption\n  originCaption\n  likeCount\n  viewCount\n  commentCount\n  realLikeCount\n  coverUrl\n  photoUrl\n  photoH265Url\n  manifest\n  manifestH265\n  videoResource\n  coverUrls {\n    url\n    __typename\n  }\n  timestamp\n  expTag\n  animatedCoverUrl\n  distance\n  videoRatio\n  liked\n  stereoType\n  profileUserTopPhoto\n  musicBlocked\n}\n\nfragment recoPhotoFragment on recoPhotoEntity {\n  __typename\n  id\n  duration\n  caption\n  originCaption\n  likeCount\n  viewCount\n  commentCount\n  realLikeCount\n  coverUrl\n  photoUrl\n  photoH265Url\n  manifest\n  manifestH265\n  videoResource\n  coverUrls {\n    url\n    __typename\n  }\n  timestamp\n  expTag\n  animatedCoverUrl\n  distance\n  videoRatio\n  liked\n  stereoType\n  profileUserTopPhoto\n  musicBlocked\n}\n\nfragment feedContent on Feed {\n  type\n  author {\n    id\n    name\n    headerUrl\n    following\n    headerUrls {\n      url\n      __typename\n    }\n    __typename\n  }\n  photo {\n    ...photoContent\n    ...recoPhotoFragment\n    __typename\n  }\n  canAddComment\n  llsid\n  status\n  currentPcursor\n  tags {\n    type\n    name\n    __typename\n  }\n  __typename\n}\n\nquery visionProfileLikePhotoList($pcursor: String, $page: String, $webPageArea: String) {\n  visionProfileLikePhotoList(pcursor: $pcursor, page: $page, webPageArea: $webPageArea) {\n    result\n    llsid\n    webPageArea\n    feeds {\n      ...feedContent\n      __typename\n    }\n    hostName\n    pcursor\n    __typename\n  }\n}\n"
    }
  },
  // 文件路径
  paths: {
    log: path.join(__dirname, 'log.txt'),
    imageMetadata: path.join(__dirname, 'imageMetadata.txt'),
    videoMetadata: path.join(__dirname, 'videoMetadata.txt'),
    videoDir: 'E:\\数据\\快手\\收藏',
    imageDir: 'E:\\数据\\快手\\cache',
  },
  // 请求数量
  requestCount: 999,
  // 定义 ANSI 颜色常量
  COLORS: {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
  }
};

// --- 2. 核心函数封装 ---
// 通用请求函数，获取列表、点赞、取消点赞
async function fetchApi(url, method, headers, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      path: new URL(url).pathname + new URL(url).search,
      method,
      headers,
      family: 4,
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let stream = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      let chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const response = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = JSON.parse(response);
          if (res.statusCode !== 200 || (parsed.result && parsed.result !== 1)) {
            return reject(new Error(`API请求失败，状态码错误: ${res.statusCode}`));
          }
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out.'));
    });
    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 下载视频、图片
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath);
    https.get(url, {
      family: 4
    }, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(filePath, () => {});
        return reject(new Error(`下载失败，状态码: ${response.statusCode}`));
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// 延迟
const sleep = (timeout = 3000) => new Promise(resolve => setTimeout(resolve, timeout));

// 检查并创建目录
async function checkDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`创建目录: ${dirPath}`);
    await fs.mkdirSync(dirPath, {
      recursive: true
    });
  }
}

// --- 3. 业务逻辑函数 ---
async function getLikedList() {
  try {
    const {
      api,
      headers,
      body,
      requestCount
    } = config;
    const url = MODE === 'pc' ? `${api.pc}?count=${requestCount}&principalId=130398874` : api.app;
    const requestBody = MODE === 'app' ? body.app : null;

    console.log(`正在获取 ${MODE} 模式下的作品列表...`);
    const responseData = await fetchApi(url, MODE === 'pc' ? 'GET' : 'POST', headers[MODE], requestBody);

    let list = [];
    if (MODE === 'pc') {
      list = responseData.data?.list || [];
    } else { // app
      list = responseData.data?.visionProfileLikePhotoList?.feeds || [];
    }
    list.reverse();

    let filterCount = 0;
    const videoArr = [];
    const imageArr = [];

    list.forEach(item => {
      const userId = item.author?.id || item.user?.id;
      const workId = item.photo?.id || item.id;

      if (userBlacklist.includes(userId) || workBlacklist.includes(workId)) {
        filterCount++;
        console.log(`过滤作品 - 用户ID: ${userId}, 作品ID: ${workId}`);
        return;
      }

      if (MODE === 'pc') {
        if (item.imgUrls?.length) {
          imageArr.push(item);
        } else {
          videoArr.push(item);
        }
      } else { // app 模式目前只处理视频
        videoArr.push(item);
      }
    });

    console.log(`请求到 ${list.length} 条作品。视频：${videoArr.length}，图片：${imageArr.length}，过滤：${filterCount}。`);
    fs.writeFileSync(config.paths.videoMetadata, JSON.stringify(videoArr));
    fs.writeFileSync(config.paths.imageMetadata, JSON.stringify(imageArr));
    fs.writeFileSync(config.paths.log, `时间: ${new Date().toISOString()}\n视频: ${videoArr.length}, 图片: ${imageArr.length}, 过滤: ${filterCount}\n\n`, {
      flag: 'a'
    });
    console.log('元数据写入成功。');

    return {
      videoArr,
      imageArr
    };
  } catch (e) {
    console.error(`获取列表失败: ${e.message}`);
    throw e;
  }
}

// 生成批量下载
async function genBatchDownload(mediaType, list) {
  if (!list.length) return;

  const {
    paths,
    COLORS
  } = config;
  const dir = mediaType === 'video' ? paths.videoDir : paths.imageDir;
  await checkDirectory(dir);

  console.log(`\n开始下载 ${list.length} 个${mediaType === 'video' ? '视频' : '图片'}作品...`);
  let totalCount = 0;

  const tasks = list.map(async (item, index) => {
    let isDownloadSucceed = false;

    const userID = item.author?.id || item.user?.id;
    const worksID = item.photo?.id || item.id;
    const caption = item.photo?.caption || item.caption;
    
    if (mediaType === 'video') {
      const url = item.photo?.photoUrl || item.playUrl;
      const filename = `${userID}_${worksID}.mp4`;
      const filePath = path.join(dir, filename);
      try {
        await downloadFile(url, filePath);
        console.log(`${COLORS.GREEN}[${index + 1}/${list.length}] 下载成功:${COLORS.RESET} ${filename} - ${caption}`);
        totalCount++;
        isDownloadSucceed = true;
      } catch (e) {
        console.error(`${COLORS.RED}[${index + 1}/${list.length}] 下载失败:${COLORS.RESET} ${filename} - ${e.message}`);
        isDownloadSucceed = false;
      }
    } else { // images
      let imgUrls = item.photo?.coverUrls?.map(u => u.url) || item.imgUrls;
      if (!imgUrls) return;

      for (let i = 0; i < imgUrls.length; i++) {
        let url = imgUrls[i];
        try {
          const urlObject = new URL(url);
          urlObject.protocol = "https:";
          url = urlObject.href;
        } catch (e) {
          console.error(`${COLORS.RED}URL 格式错误，跳过:${COLORS.RESET} ${url}`);
          continue;
        }
        const filename = `${userID}_${worksID}_${i}.webp`;
        const filePath = path.join(dir, filename);
        try {
          await downloadFile(url, filePath);
          console.log(`${COLORS.GREEN}[${index + 1}_${i}/${list.length}] 下载成功:${COLORS.RESET} ${filename} - ${caption}`);
          totalCount++;
          isDownloadSucceed = true;
        } catch (e) {
          console.error(`${COLORS.RED}[${index + 1}_${i}/${list.length}] 下载失败:${COLORS.RESET} ${filename} - ${e.message}`);
          isDownloadSucceed = false;
        }
      }
    }

    // 不在作品黑名单中 且 下载成功
    if (!workBlacklist.includes(worksID) && isDownloadSucceed) {
      await cancelLike(userID, worksID, index + 1, list.length).catch(err => console.error(`${COLORS.RED}取消点赞失败:${COLORS.RESET} ${err.message}`));
    }
  });

  // 等待所有任务完成
  await Promise.all(tasks);

  await sleep();
  console.log(`\n下载任务完成。成功下载 ${totalCount} 个文件。`);
}

// 对单个作品进行点赞0、取消点赞1
async function cancelLike(userID, worksID, index, listLenght, cancel = 1) {
  try {
    const {
      api,
      headers,
      COLORS
    } = config;
    const url = MODE === 'pc' ? `${api.pc_no_d}?photoId=${worksID}&principalId=${userID}&cancel=${cancel}` : api.app;

    const requestBody = {
      "operationName": "visionVideoLike",
      "variables": {
        "photoId": worksID,
        "photoAuthorId": userID,
        "cancel": cancel,
      },
      "query": "mutation visionVideoLike($photoId: String, $photoAuthorId: String, $cancel: Int, $expTag: String) {\n  visionVideoLike(photoId: $photoId, photoAuthorId: $photoAuthorId, cancel: $cancel, expTag: $expTag) {\n    result\n    __typename\n  }\n}\n"
    };

    await fetchApi(url, MODE === 'pc' ? 'GET' : 'POST', headers[MODE], requestBody);
    console.log(`${COLORS.BLUE}[${index}/${listLenght}] ${cancel ? '取消点赞' : '点赞'}成功:${COLORS.RESET} 作品 ${worksID}`);
  } catch (e) {
    console.error(`${COLORS.RED}[${index}/${listLenght}] ${cancel ? '取消点赞' : '点赞'}失败:${COLORS.RESET} 作品 ${worksID} 信息: ${e.message}`);
  }
}

// --- 4. 主执行函数 ---
async function main() {
  MODE = process.argv.slice(2)[0] === 'n' || process.argv.slice(2)[0] === 'N' ? 'pc' : 'app'
  const {
    videoArr,
    imageArr
  } = await getLikedList();
  await genBatchDownload('video', videoArr);
  await genBatchDownload('image', imageArr);
}

// 启动
main().catch(e => console.error("脚本运行出错:", e));