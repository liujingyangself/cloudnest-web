// 报纸内容按 YYYYMM 目录、YYYYMMDD_报名.pdf 命名。用户每天扫的是日期，
// 而原始名字要在脑子里做一次转换才能读。这里只改「显示」，不碰真实名字 ——
// 路径、导航、下载全部仍用 obj.name。
//
// 不匹配的名字原样返回：百度网盘那边是「哆啦A梦」「xhs_clips」这类任意名称，
// 绝不能被误伤。

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 校验是不是一个真实存在的日期，挡掉 20260231 这种。 */
const isRealDate = (y: number, m: number, d: number): boolean => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  )
}

/** 目录名 YYYYMM → 2026年9月 */
const monthFolder = (name: string): string | null => {
  const m = /^(\d{4})(\d{2})$/.exec(name)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (year < 1900 || year > 2999 || month < 1 || month > 12) return null
  return `${year}年${month}月`
}

/** 文件名 YYYYMMDD_标题.ext → 9月3日 周四 · 标题 */
const datedFile = (name: string): string | null => {
  const m = /^(\d{4})(\d{2})(\d{2})[_\-\s]*(.*?)(\.[^.]+)?$/.exec(name)
  if (!m) return null
  const [, ys, ms, ds, rest] = m
  const year = Number(ys)
  const month = Number(ms)
  const day = Number(ds)
  if (year < 1900 || year > 2999 || !isRealDate(year, month, day)) return null

  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()]
  // 同年只写月日，父目录已经交代了年份；跨年（例如搜索结果里）才补上年份，
  // 否则会丢失关键信息。
  const head =
    year === new Date().getFullYear()
      ? `${month}月${day}日`
      : `${year}年${month}月${day}日`
  const label = `${head} ${weekday}`
  const title = rest.trim()
  return title ? `${label} · ${title}` : label
}

/**
 * 用于展示的名字。识别不出已知形态时原样返回，所以对任意命名都是安全的。
 */
export const displayName = (name: string, isDir: boolean): string => {
  if (!name) return name
  if (isDir) return monthFolder(name) ?? name
  return datedFile(name) ?? name
}
