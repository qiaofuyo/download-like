// const MODE = process.argv?.slice(2)[0] == 'y' ? 'app' : 'pc'
const MODE = 'app'

const appCookie = 

const pcCookie = 

const fs = require('fs')
const request = require("request")
const https = require("node:https")
const zlib = require('zlib');
const path = require('path');
const extra = require('fs-extra')

// const filterList = require('./filterList.js')
const { userBlacklist, workBlacklist } = require('./filterList.js')
const { resolve } = require('path');

const log = path.join(__dirname + '/log.txt')
const imgageMetadata = path.join(__dirname + '/imgageMetadata.txt')
const videoMetadata = path.join(__dirname + '/videoMetadata.txt')

const count = 999 // 请求数
let filterCount = 0 // 过滤数
let userId = '3xgaiws3d3uy7dy'

let downSingleUserAllWork = false
let from = 'app'
let url = ''
let headers = ''
let body = ''
// app
const HP1 = {
  url: 'https://www.kuaishou.com/graphql',
  headers: {
    "Content-Type": "application/json",
    "Cookie": appCookie
  },
  body: {
    "operationName": "visionProfileLikePhotoList",
    "variables": {
      "pcursor": "",
      "page": "profile"
    },
    "query": "fragment photoContent on PhotoEntity {\n  __typename\n  id\n  duration\n  caption\n  originCaption\n  likeCount\n  viewCount\n  commentCount\n  realLikeCount\n  coverUrl\n  photoUrl\n  photoH265Url\n  manifest\n  manifestH265\n  videoResource\n  coverUrls {\n    url\n    __typename\n  }\n  timestamp\n  expTag\n  animatedCoverUrl\n  distance\n  videoRatio\n  liked\n  stereoType\n  profileUserTopPhoto\n  musicBlocked\n}\n\nfragment recoPhotoFragment on recoPhotoEntity {\n  __typename\n  id\n  duration\n  caption\n  originCaption\n  likeCount\n  viewCount\n  commentCount\n  realLikeCount\n  coverUrl\n  photoUrl\n  photoH265Url\n  manifest\n  manifestH265\n  videoResource\n  coverUrls {\n    url\n    __typename\n  }\n  timestamp\n  expTag\n  animatedCoverUrl\n  distance\n  videoRatio\n  liked\n  stereoType\n  profileUserTopPhoto\n  musicBlocked\n}\n\nfragment feedContent on Feed {\n  type\n  author {\n    id\n    name\n    headerUrl\n    following\n    headerUrls {\n      url\n      __typename\n    }\n    __typename\n  }\n  photo {\n    ...photoContent\n    ...recoPhotoFragment\n    __typename\n  }\n  canAddComment\n  llsid\n  status\n  currentPcursor\n  tags {\n    type\n    name\n    __typename\n  }\n  __typename\n}\n\nquery visionProfileLikePhotoList($pcursor: String, $page: String, $webPageArea: String) {\n  visionProfileLikePhotoList(pcursor: $pcursor, page: $page, webPageArea: $webPageArea) {\n    result\n    llsid\n    webPageArea\n    feeds {\n      ...feedContent\n      __typename\n    }\n    hostName\n    pcursor\n    __typename\n  }\n}\n"
  }
}
// 改版 pc
const HP2 = {
  url: 'https://live.kuaishou.com/live_api/profile/liked',
  headers: {
    "Cookie": pcCookie
  }
}

let imgageArr = []
let videoArr = []

function sleep(timeout = 1000) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout)
  })
}
async function timedCount(c = 4) {
  while (c > 0) {
    console.log(c);
    c--
    await sleep()
  }
}

// 对单个作品进行点赞、取消点赞
async function cancelLike(userID, worksID, c = 0) {
  return await new Promise((resolve, reject) => {
    let cancel = !c ? 1 : 0

    let body = null
    if (from === 'app') {
      body = {
        "operationName": "visionVideoLike",
        "variables": {
          "photoId": worksID,
          "photoAuthorId": userID,
          "cancel": cancel,
          "expTag": "1_i/2001204455790233234_xpcwebprofilexxnull0"
        },
        "query": "mutation visionVideoLike($photoId: String, $photoAuthorId: String, $cancel: Int, $expTag: String) {\n  visionVideoLike(photoId: $photoId, photoAuthorId: $photoAuthorId, cancel: $cancel, expTag: $expTag) {\n    result\n    __typename\n  }\n}\n"
      }
      
      request({
        url,
        method: "POST",
        json: true,
        headers,
        body,
        family: 4
      }, async (error, response, body) => {
        try {
          // console.log(response);
          // fs.writeFileSync(log, JSON.stringify(response))
          let result = from === 'app' ? response.body.data.visionVideoLike.result : response.body.data.likeVideo.result
          let statusCode = response.statusCode
          if (statusCode !== 200 && result !== 1) throw `${ cancel ? '取消点赞'  : '点赞' }失败，http 状态码：${ statusCode }`
          console.log(`${ cancel ? '取消点赞' : '点赞' }成功`);
      
          await timedCount()
          resolve()
        } catch (e) {
          console.log(e);
          reject()
        }
      })
    } else {
      let url = 'https://live.kuaishou.com/live_api/profile/like'
      let options = {
        // photoId: worksID,
        // principalId: userID,
        // cancel,
        family: 4, // 强制使用 IPv4
        headers: {
          Cookie: HP2.headers.Cookie,
          Referer: `https://live.kuaishou.com/u/${ userID }/${ worksID }`,
          Host: 'live.kuaishou.com'
        }
      }
      let link = `${ url }?photoId=${ worksID }&principalId=${ userID }&cancel=${ cancel }`
      https.get(link, options, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', async () => {
          try{
            data = JSON.parse(data)
            let { result, error_msg } = data.data
            if (result !== 1 && error_msg) throw `${ cancel ? '取消点赞'  : '点赞' }失败，${ error_msg }`
            
            console.log(`${ cancel ? '取消点赞' : '点赞' }成功`);
            
            await timedCount()
            resolve()
          }catch(e){
            console.log(e);
            reject()
          }
        })
      })
      .on('error', (e) => {
        console.log(e);
        reject()
      })
    }
  })
}

function readFile(path) {
  let cache = fs.readFileSync(path, 'utf8')
  let cacheFile = JSON.parse(cache)
  return cacheFile
}

async function downloadVideo() {
  let dir = await checkDirectory('video')

  let likeArr = readFile(videoMetadata)

  let total = 0
  let userCount = 0
  let skip_count = 0

  for await (let item of likeArr) {
    // 下载单个用户全部视频时过滤掉前 n 个
    if (skip_count-- > 0) continue
    
    // from = item.author?.id ? 'app' : 'pc'
    from = item?.id ? 'pc' : 'app'
    
    let userID = item.author?.id || item.user.id // 用户 id
    let userName = item.author?.name || item.user.name // 用户名
    let worksID = item.photo?.id || item.id // 作品 id
    let caption = item.photo?.caption || item.caption // 作品标题

    userCount++
    console.log(`\n${ userCount }/${ videoArr.length } 用户 ID：${ userID } 用户名：${ userName }`)

    let filename = userID + '_' + worksID + '.mp4'
    let stream = fs.createWriteStream(dir + "/" + filename)

    if (from === 'app') {
      await new Promise((resolve, reject) => {
        request(item.photo.photoUrl, { family: 4 })
          .pipe(stream)
          .on('close', () => {
            total++
            console.log(`${ userCount }/${ videoArr.length } 文件名：${ filename } 标题：${ caption }`);
            resolve()
          })
          .on('error', e => {
            console.log(`出错 ${ total }/${ videoArr.length } 文件名：${ filename } 标题：${ caption }`);
            console.log(e);
            reject()
          })
      })

      // await cancelLike(userID, worksID)
      if (!workBlacklist.includes(worksID)) {
        await cancelLike(userID, worksID)
      }
    } else {
      await new Promise((resolve, reject) => {
        try{
          request(item.playUrl, { family: 4 })
            .pipe(stream)
            // .on('finish', () => console.log(`${ ++total } 文件名：${ filename }`))
            .on('close', () => {
              total++
              console.log(`${ userCount }/${ videoArr.length } 文件名：${ filename } 标题：${ caption }`);
              resolve()
            })
            .on('error', e => {
              console.log(
                `出错 ${ total }/${ videoArr.length } 文件名：${ filename } 标题：${ caption }`);
              console.log(e);
              reject()
            })
        }catch(e){
          console.log(e);
          reject(e)
        }
      })
      
      if (downSingleUserAllWork) {
        await timedCount()
        continue
      }
      // await cancelLike(userID, worksID)
      if (!workBlacklist.includes(worksID)) {
        await cancelLike(userID, worksID)
      }
    }
  }
}

  async function downloadImg() {
  let dir = await checkDirectory('images')

  let likeArr = readFile(imgageMetadata)

  let total = 0
  let userCount = 0

  for await (let item of likeArr) {
    // from = item.author?.id ? 'app' : 'pc'
    from = 'pc'
    
    let userID = item.author.id // 用户 id
    let userName = item.author.name // 用户名
    let worksID = item.id // 作品 id
    let caption = item.caption // 作品标题

    userCount++
    console.log(
      `\n${ userCount }/${ imgageArr.length } 用户 ID：${ userID } 用户名：${ userName } 共${ item.imgUrls.length }张`)

    let index = 0
    for await (let downLoadURL of item.imgUrls) {
      await new Promise(async resolve => {
        // let random = downLoadURL.split('atlas/')[1] || 'BMNjg2NzQw' + Math.floor(Math.random() * 99999) + '.webp'
        let filename = userID + '_' + worksID + '_' + (index++) + '.webp'
        let stream = fs.createWriteStream(dir + "/" + filename)
        request(downLoadURL, { family: 4 })
          .pipe(stream)
          // .on('finish', () => console.log(`${ ++total } 文件名：${ filename }`))
          .on('close', () => {
            total++
            console.log(`${ userCount }/${ imgageArr.length } 文件名：${ filename } 标题：${ caption }`);
            resolve()
          })
          .on('error', e => {
            console.log(`出错 ${ total } 文件名：${ filename } 标题：${ caption }`);
            console.log(e);
            reject()
          })
      })
    }
    
    if (downSingleUserAllWork) continue
    // await cancelLike(userID, worksID)
    if (!workBlacklist.includes(worksID)) {
      await cancelLike(userID, worksID)
    }
  }
}

async function getList() {
  return await new Promise((resolve, reject) => {
    if (from === 'pc') {
      let list = null
      let options = {
        // count,
        // principalId: userId,
        // pcursor: '',
        // hasMore: true,
        family: 4, // 强制使用 IPv4
        headers: HP2.headers
      }
      let link = `${ url }?count=${ count }&principalId=${ userId }`
      https.get(link, options, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try{
            list = JSON.parse(data)
            if (data === undefined) {
              console.error('数据为空，无法写入文件');
              reject();
              return;
            }
            fs.writeFileSync(log, data)
            let statusCode = res.statusCode
            if (statusCode !== 200) throw `获取列表失败，http 状态码：${ statusCode }`
            
            list = list.data?.list ?? []
            list.map(item => {
              const userId = item.author?.id || item.user?.id || ''
              const workId = item.photo?.id || item.id || ''

              // 检查用户ID或作品ID是否在黑名单中
              if (userBlacklist.includes(userId)) {
                filterCount++
                console.log(`过滤用户: ${userId}`);
                return
              }

              if (workBlacklist.includes(workId)) {
                filterCount++;
                console.log(`过滤作品: ${workId}`);
                return;
              }

              let arr = []
              arr = item.imgUrls?.length ? imgageArr : videoArr
              arr.unshift(item)
            })
            
            console.log(`请求数：${ list.length }/${ count }条，需过滤：${ filterCount }条`);
            
            let separate =
              `时间戳：${ Date.now() } \n共 ${ list.length } 条，视频：${ videoArr.length }，图片：${ imgageArr.length }，过滤：${ filterCount }`
            // let content = separate.concat(JSON.stringify(list), `\n\n\n\n\n`)
            let content = separate.concat(`\n\n\n\n\n`)
            fs.writeFileSync(log, content, {
              flag: 'a'
            })
            fs.writeFileSync(imgageMetadata, JSON.stringify(imgageArr))
            fs.writeFileSync(videoMetadata, JSON.stringify(videoArr))
            console.log(`元数据写入成功，视频：${ videoArr.length }，图片：${ imgageArr.length }`);
            
            resolve()
          }catch(e){
            console.log(e);
          }
        })
      }).on('error', (e) => {
        console.error(e);
      })
    }
    if (from === 'app') {
      // 1. 构造请求体
      
      const postData = JSON.stringify(body);

      // 2. 配置请求选项
      const options = {
        hostname: 'www.kuaishou.com',
        path: '/graphql',
        method: 'POST',
        family: 4,        // 强制 IPv4
        headers,
        timeout: 10_000   // 10 秒超时
      };

      const req = https.request(options, (res) => {
        let stream = res;
        const encoding = res.headers['content-encoding'];

        // 根据 Content-Encoding 选择解压流
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }
        // 否则不解压，直接用 res

        // 收集解压后的数据
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const response = Buffer.concat(chunks).toString('utf8');
          // console.log('Status:', res.statusCode);
          // console.log('Headers:', res.headers);
          // console.log('Body:', response);
          const responseBody = JSON.parse(response);
          fs.writeFileSync(log, JSON.stringify(response), { flag: 'w' })
          let statusCode = res.statusCode
          if (statusCode !== 200) throw `获取列表失败，http 状态码：${ statusCode }`
          
          let list = from === 'app' ? responseBody.data.visionProfileLikePhotoList.feeds : (responseBody.data.likedFeeds?.list ?? responseBody.data.privateFeeds.list)
      
          // 以某用户为分割线，不下载更早的点赞
          // let lockIndex = list.findIndex(item => item.user.id === 'cangzhougongqingtuan')
          // if (lockIndex !== -1) {
          //   console.log('锁', lockIndex);
          //   list = list.slice(0, lockIndex)
          // }
          
          list.map(item => {
            const userId = from === 'app' ? item.author.id : (from === 'pc' ? item.user.id : '')
            const workId = item.photo?.id || item.id || ''

            // 检查用户ID或作品ID是否在黑名单中
            if (userBlacklist.includes(userId)) {
              filterCount++
              console.log(`过滤用户: ${userId}`);
              return
            }

            if (workBlacklist.includes(workId)) {
              filterCount++;
              console.log(`过滤作品: ${workId}`);
              return;
            }

            let arr = []
            if (from === 'app') {
              arr = videoArr
            } else {
              arr = item.imgUrls?.length ? imgageArr : videoArr
            }
            arr.unshift(item)
          })
      
          console.log(`请求数：${ list.length }/${ count }条，需过滤：${ filterCount }条`);
      
          let separate =
            `时间戳：${ Date.now() } \n共 ${ list.length } 条，视频：${ videoArr.length }，图片：${ imgageArr.length }，过滤：${ filterCount }`
          // let content = separate.concat(JSON.stringify(list), `\n\n\n\n\n`)
          let content = separate.concat(`\n\n\n\n\n`)
          fs.writeFileSync(log, content, {
            flag: 'a'
          })
          fs.writeFileSync(imgageMetadata, JSON.stringify(imgageArr))
          fs.writeFileSync(videoMetadata, JSON.stringify(videoArr))
          console.log(`元数据写入成功，视频：${ videoArr.length }，图片：${ imgageArr.length }`);
      
          resolve()
        });
      });

      req.on('timeout', () => {
        console.error('请求超时');
        req.destroy();
        reject();
      });

      req.on('error', (err) => {
        console.error('请求出错:', err);
        reject();
      });

      // 写入请求体并结束
      req.write(postData);
      req.end();
    }
  })
}

async function checkDirectory(fileName) {
  let dir = path.join(__dirname + '/' + fileName)
  if (!fs.existsSync(dir)) {
    console.log('创建目录');
    await fs.mkdirSync(dir)
  }
  // else {
  //   await extra.remove(dir)
  //     .catch(err => console.log(err))
  //     .finally(async () => {
  //       console.log('创建目录');
  //       await fs.mkdirSync(dir)
  //     })
  // }

  if (fileName === 'video') {
    dir = 'E:\\数据\\快手\\收藏'
  }
  if (fileName === 'images') {
    dir = 'E:\\数据\\快手\\cache'
  }
  return dir
}

async function downLikeWork() {
  if (MODE === 'pc') {
    // 改版 pc
    console.log('pc');
    from = 'pc'
    url = HP2.url
    await getList()
    await downloadVideo()
    await downloadImg()
  } else {
    console.log('app');
    from = 'app'
    url = HP1.url
    headers = HP1.headers
    body = HP1.body
    await getList()
    await downloadVideo()
  }
  
  // 处理单个用户单个作品点赞
  // await cancelLike('biyaoyao5753', '3x7kx2uejg2297w', 1)
}

async function downUserAllWork(principalId) {
  console.log('pc');
  
  // HP2.body.operationName = 'privateFeedsQuery'
  // HP2.body.variables.principalId = principalId
  // HP2.body.variables.count = count
  // HP2.body.query = "query privateFeedsQuery($principalId: String, $pcursor: String, $count: Int) {\n  privateFeeds(principalId: $principalId, pcursor: $pcursor, count: $count) {\n    pcursor\n    list {\n      id\n      thumbnailUrl\n      poster\n      workType\n      type\n      useVideoPlayer\n      imgUrls\n      imgSizes\n      magicFace\n      musicName\n      caption\n      location\n      liked\n      onlyFollowerCanComment\n      relativeHeight\n      timestamp\n      width\n      height\n      counts {\n        displayView\n        displayLike\n        displayComment\n        __typename\n      }\n      user {\n        id\n        eid\n        name\n        avatar\n        __typename\n      }\n      expTag\n      isSpherical\n      __typename\n    }\n    __typename\n  }\n}\n"
  
  downSingleUserAllWork = true
  from = 'pc'
  url = 'https://live.kuaishou.com/live_api/profile/public'
  headers = HP2.headers
  // body = HP2.body
  userId = principalId
  
  await getList()
  await downloadVideo()
  await downloadImg()
}

// 处理点赞作品
downLikeWork()

// 下载指定用户的所有作品
// downUserAllWork('3xgknmj8dn3kece')
