/**
 * 获取指定时区的时间字符串，格式为 "YYYY-MM-DD HH:mm:ss"
 * @param {Date} date - 要格式化的日期对象（默认当前时间）
 * @param {string} timeZone - 时区名称（如 'Asia/Shanghai'）
 * @param {string} locale - 语言区域（默认 'zh-CN'）
 * @returns {string} 格式化后的时间字符串
 */
export function getTimeString(date = new Date(), timeZone = 'Asia/Shanghai', locale = 'zh-CN') {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value.padStart(2, '0');

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}