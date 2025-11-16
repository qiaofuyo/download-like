/**
 * 简单异步池（async pool）
 *
 * 将数组中的异步任务以并发限制执行，函数会尽可能保持最多 `limit` 个任务同时执行。
 * 所有任务提交后会等待它们完成并返回 Promise.allSettled 的结果数组（包含每个任务的状态与值/原因）。
 *
 * 设计要点：
 * - iteratorFn 的调用被放入微任务（Promise.resolve().then(...)），保证即使 iteratorFn 是同步函数抛错也会转为 rejected Promise，不会中断循环。
 * - 当正在执行的任务数达到 limit 时，使用 Promise.race 等待任意一个完成后再提交新任务。
 *
 * @module lib/concurrencyPool
 */

/**
 * 执行受限并发的异步任务池
 *
 * @template T,U
 * @param {number} limit - 并发上限，必须 >= 1
 * @param {T[]} array - 待处理的项数组
 * @param {(item: T) => Promise<U>|U} iteratorFn - 对每个项的处理函数，返回 Promise 或值
 * @returns {Promise<PromiseSettledResult<U>[]>} 返回每个任务的 allSettled 结果数组
 * @throws {TypeError} 当 limit < 1 时抛出
 *
 * @example
 * const results = await asyncPool(5, urls, async (url) => {
 *   const res = await fetch(url);
 *   return res.text();
 * });
 */
export async function asyncPool(limit, array, iteratorFn) {
  if (limit < 1) throw new TypeError('limit must be >= 1');
  
  const ret = [];
  const executing = new Set();
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));  // 将调用放到微任务中，保证 iteratorFn 的执行是异步的；若 iteratorFn 同步抛错，会变成 rejected Promise，不会中断循环。
    ret.push(p);

    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= limit) {
      try { await Promise.race(executing); } catch (e) { /* ignore single task errors here */ }
    }
  }
  return Promise.allSettled(ret);
}