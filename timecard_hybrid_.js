/* 节假日信息 v5.0 —— 混合版（在线查节假日 + 离线算农历）
 *
 * 设计：
 *   1) 在线层：$httpClient 调 timor.tech 全年假期接口，拿当年所有放假日 + 名称，
 *      本地用原生 Date 算出「距最近一个节假日 X 天」。彻底取代硬编码 HOLIDAYS 表。
 *   2) 离线层：solar2lunar() 农历换算（保留那张不可压缩的小数据表），提供农历/干支/生肖/星座。
 *   3) 兜底：在线失败时回退到内置节假日常用表，保证断网也能用。
 *   4) 当天为节假日 → persistentStore 去重发通知；图标按剩余天数切换。
 */

// ========== 一、农历换算（保留完整功能，仅保留被用到的 solar2lunar 依赖链） ==========
// NOTE: 下方两大表由 build_hybrid.js 注入

const LUNAR_INFO = [0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,//1900-1909
        0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,//1910-1919
        0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,//1920-1929
        0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,//1930-1939
        0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,//1940-1949
        0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,//1950-1959
        0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,//1960-1969
        0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,//1970-1979
        0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,//1980-1989
        0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,//1990-1999
        0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,//2000-2009
        0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,//2010-2019
        0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,//2020-2029
        0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,//2030-2039
        0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,//2040-2049
        /**Add By JJonline@JJonline.Cn**/
        0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,//2050-2059
        0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,//2060-2069
        0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,//2070-2079
        0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,//2080-2089
        0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,//2090-2099
        0x0d520];      // 1900-2100 每年数据（201 个十六进制数）
const STAR_TERM_INFO = ['9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c3598082c95f8c965cc920f',
        '97bd0b06bdb0722c965ce1cfcc920f', 'b027097bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e',
        '97bcf97c359801ec95f8c965cc920f', '97bd0b06bdb0722c965ce1cfcc920f', 'b027097bd097c36b0b6fc9274c91aa',
        '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd0b06bdb0722c965ce1cfcc920f',
        'b027097bd097c36b0b6fc9274c91aa', '9778397bd19801ec9210c965cc920e', '97b6b97bd19801ec95f8c965cc920f',
        '97bd09801d98082c95f8e1cfcc920f', '97bd097bd097c36b0b6fc9210c8dc2', '9778397bd197c36c9210c9274c91aa',
        '97b6b97bd19801ec95f8c965cc920e', '97bd09801d98082c95f8e1cfcc920f', '97bd097bd097c36b0b6fc9210c8dc2',
        '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec95f8c965cc920e', '97bcf97c3598082c95f8e1cfcc920f',
        '97bd097bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec9210c965cc920e',
        '97bcf97c3598082c95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b97bd19801ec9210c965cc920e', '97bcf97c3598082c95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722',
        '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f',
        '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e',
        '97bcf97c359801ec95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd097bd07f595b0b6fc920fb0722',
        '9778397bd097c36b0b6fc9210c8dc2', '9778397bd19801ec9210c9274c920e', '97b6b97bd19801ec95f8c965cc920f',
        '97bd07f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c920e',
        '97b6b97bd19801ec95f8c965cc920f', '97bd07f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2',
        '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bd07f1487f595b0b0bc920fb0722',
        '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e',
        '97bcf7f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722',
        '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f531b0b0bb0b6fb0722',
        '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e',
        '97bcf7f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b97bd19801ec9210c9274c920e', '97bcf7f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722',
        '9778397bd097c36b0b6fc9210c91aa', '97b6b97bd197c36c9210c9274c920e', '97bcf7f0e47f531b0b0bb0b6fb0722',
        '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c920e',
        '97b6b7f0e47f531b0723b0b6fb0722', '7f0e37f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2',
        '9778397bd097c36b0b70c9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e37f1487f595b0b0bb0b6fb0722',
        '7f0e397bd097c35b0b6fc9210c8dc2', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721',
        '7f0e27f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722',
        '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722',
        '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721',
        '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9274c91aa',
        '97b6b7f0e47f531b0723b0787b0721', '7f0e27f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722',
        '9778397bd097c36b0b6fc9210c91aa', '97b6b7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722',
        '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c8dc2', '977837f0e37f149b0723b0787b0721',
        '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f5307f595b0b0bc920fb0722', '7f0e397bd097c35b0b6fc9210c8dc2',
        '977837f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e37f1487f595b0b0bb0b6fb0722',
        '7f0e397bd097c35b0b6fc9210c8dc2', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721',
        '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '977837f0e37f14998082b0787b06bd',
        '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722',
        '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722',
        '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721',
        '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14998082b0787b06bd',
        '7f07e7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722',
        '977837f0e37f14998082b0723b06bd', '7f07e7f0e37f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722',
        '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b0721',
        '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f1487f595b0b0bb0b6fb0722', '7f0e37f0e37f14898082b0723b02d5',
        '7ec967f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f1487f531b0b0bb0b6fb0722',
        '7f0e37f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721',
        '7f0e37f1487f531b0b0bb0b6fb0722', '7f0e37f0e37f14898082b072297c35', '7ec967f0e37f14998082b0787b06bd',
        '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e37f0e37f14898082b072297c35',
        '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722',
        '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f149b0723b0787b0721',
        '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14998082b0723b06bd',
        '7f07e7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722', '7f0e37f0e366aa89801eb072297c35',
        '7ec967f0e37f14998082b0723b06bd', '7f07e7f0e37f14998083b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722',
        '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14898082b0723b02d5', '7f07e7f0e37f14998082b0787b0721',
        '7f07e7f0e47f531b0723b0b6fb0722', '7f0e36665b66aa89801e9808297c35', '665f67f0e37f14898082b0723b02d5',
        '7ec967f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e36665b66a449801e9808297c35',
        '665f67f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721',
        '7f0e36665b66a449801e9808297c35', '665f67f0e37f14898082b072297c35', '7ec967f0e37f14998082b0787b06bd',
        '7f07e7f0e47f531b0723b0b6fb0721', '7f0e26665b66a449801e9808297c35', '665f67f0e37f1489801eb072297c35',
        '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722']; // 节气信息表（200 段）

const nStr1 = ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const nStr2 = ["初", "十", "廿", "卅"];
const nStr3 = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const Gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const Zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const Animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
const solarMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const solarTerm = ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨",
  "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑",
  "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];
const festival = {}; // 阳历节日表（仅装饰用途，未在面板拼接）
const lFestival = {}; // 农历节日表（仅装饰用途）

// —— 农历工具函数 ——
function lYearDays(y) {
  let i, sum = 348;
  for (i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}
function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function leapDays(y) {
  if (leapMonth(y)) return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  return 0;
}
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function solarDays(y, m) {
  if (m === 2) { const d = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28; return d; }
  return solarMonth[m - 1];
}
function toGanZhiYear(lYear) { return Gan[(lYear - 4) % 10] + Zhi[(lYear - 4) % 12]; }
function toAstro(m, d) {
  const s = "摩羯水瓶双鱼白羊金牛双子巨蟹狮子处女天秤天蝎射手摩羯";
  const arr = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22];
  return s.substr(m * 2 - (d < arr[m - 1] ? 2 : 0), 2) + "座";
}
function toGanZhi(offset) {
  return Gan[offset % 10] + Zhi[offset % 12];
}
function getTerm(y, n) {
  if (y < 1900 || y > 2100 || n < 1 || n > 24) return -1;
  const table = STAR_TERM_INFO[y - 1900];
  const calcDay = [];
  for (let index = 0; index < table.length; index += 5) {
    const chunk = parseInt("0x" + table.substr(index, 5)).toString();
    calcDay.push(chunk[0], chunk.substr(1, 2), chunk[3], chunk.substr(4, 2));
  }
  return parseInt(calcDay[n - 1]);
}
function toChinaMonth(m) {
  if (m > 10) return nStr3[m - 10] + "月";
  return nStr3[m - 1] + "月";
}
function toChinaDay(d) {
  switch (d) {
    case 10: return "初十"; case 20: return "二十"; case 30: return "三十";
    case 0: return "初一"; default:
  }
  return nStr2[Math.floor(d / 10)] + nStr1[d % 10];
}
function getAnimal(y) { return Animals[(y - 4) % 12]; }

// —— 核心换算：公历 → 农历对象 ——
function solar2lunar(yPara, mPara, dPara) {
  let y = parseInt(yPara), m = parseInt(mPara), d = parseInt(dPara);
  if (y < 1900 || y > 2100) return -1;
  if (y === 1900 && m === 1 && d < 31) return -1;
  let objDate;
  if (!y) objDate = new Date();
  else objDate = new Date(y, parseInt(m) - 1, d);
  let i, leap = 0, temp = 0;
  y = objDate.getFullYear(); m = objDate.getMonth() + 1; d = objDate.getDate();
  let offset = (Date.UTC(objDate.getFullYear(), objDate.getMonth(), objDate.getDate()) - Date.UTC(1900, 0, 31)) / 86400000;
  for (i = 1900; i < 2101 && offset > 0; i++) { temp = lYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  let isTodayObj = new Date(), isToday = false;
  if (isTodayObj.getFullYear() === y && isTodayObj.getMonth() + 1 === m && isTodayObj.getDate() === d) isToday = true;
  let nWeek = objDate.getDay(), cWeek = nStr1[nWeek];
  if (nWeek === 0) nWeek = 7;
  const year = i;
  leap = leapMonth(i);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === (leap + 1) && isLeap === false) { --i; isLeap = true; temp = leapDays(year); }
    else { temp = monthDays(year, i); }
    if (isLeap === true && i === (leap + 1)) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) isLeap = false; else { isLeap = true; --i; }
  }
  if (offset < 0) { offset += temp; --i; }
  const month = i;
  const day = offset + 1;
  const sm = m - 1;
  const gzY = toGanZhiYear(year);
  const firstNode = getTerm(y, m * 2 - 1);
  const secondNode = getTerm(y, m * 2);
  let gzM = toGanZhi((y - 1900) * 12 + m + 11);
  if (d >= firstNode) gzM = toGanZhi((y - 1900) * 12 + m + 12);
  let isTerm = false, Term = null;
  if (firstNode === d) { isTerm = true; Term = solarTerm[m * 2 - 2]; }
  if (secondNode === d) { isTerm = true; Term = solarTerm[m * 2 - 1]; }
  const dayCyclical = Date.UTC(y, sm, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10;
  const gzD = toGanZhi(dayCyclical + d - 1);
  const astro = toAstro(m, d);
  const solarDate = y + "-" + m + "-" + d;
  const lunarDate = year + "-" + month + "-" + day;
  const festivalDate = m + "-" + d;
  let lunarFestivalDate = month + "-" + day;
  if (month === 12 && day === 29 && monthDays(year, month) === 29) lunarFestivalDate = "12-30";
  return {
    lYear: year, lMonth: month, lDay: day,
    Animal: getAnimal(year),
    IMonthCn: (isLeap ? "闰" : "") + toChinaMonth(month),
    IDayCn: toChinaDay(day),
    cYear: y, cMonth: m, cDay: d,
    gzYear: gzY, gzMonth: gzM, gzDay: gzD,
    isToday: isToday, isLeap: isLeap,
    nWeek: nWeek, ncWeek: "星期" + cWeek,
    isTerm: isTerm, Term: Term, astro: astro
  };
}

/* ================= 二、在线查节假日（GitHub 静态数据文件 + 本地缓存） =================
   数据源：https://github.com/NateScarlet/holiday-cn
   每个年份一个 JSON 文件，数据来自国务院官方文件（gov.cn），社区维护，免费无 key。
   结构：{ year, days:[{ name, date, isOffDay }] }  isOffDay:true=放假 false=调休补班日。
   拉取成功后整份缓存进 $persistentStore，断网也能靠缓存显示节假日。 */

// 缓存键 + 兜底表（仅当在线查询和缓存都失败时使用，防完全空白）
const HOL_CACHE_KEY = "timecard_holidays_v2";
const FALLBACK_HOLIDAYS = [
  ["元旦", "2027-01-01"], ["春节", "2027-02-06"], ["元宵", "2027-02-20"],
  ["清明", "2027-04-05"], ["劳动节", "2027-05-01"], ["端午节", "2027-06-09"],
  ["中秋节", "2027-09-15"], ["国庆节", "2027-10-01"]
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - now) / 86400000);
}
// 全年放假日 → 筛"今天及以后"，按名称聚类只留放假区间起点，按天数升序
function buildUpcoming(list) {
  const upcoming = list
    .map(it => ({ name: it.name, date: it.date, days: daysUntil(it.date) }))
    .filter(x => x.days >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set(), dedup = [];
  for (const it of upcoming) {
    if (seen.has(it.name)) continue;
    seen.add(it.name);
    dedup.push(it);
  }
  return dedup.sort((a, b) => a.days - b.days);
}
function iconFor(days) {
  if (days <= 0) return "gift";
  if (days <= 3) return "timer";
  if (days <= 7) return "hare";
  return "tortoise";
}
const TITLES = [
  "距离放假，还要摸鱼多少天？", "坚持住，就快放假啦！", "上班好累呀，下顿吃啥？",
  "努力，我还能加班24小时！", "今日宜：吃饭饭  忌：减肥", "躺平中，等放假",
  "只有摸鱼才是赚老板的钱", "小乌龟慢慢爬", "加油，明天会更好！",
  "生活本该如此轻松", "好累，但还能坚持一会儿", "快放假啦，期待放松的时光",
  "今天的目标是先活下去", "给自己加个鸡腿！", "只要努力工作，老板的午餐就是我的",
  "今天的任务是：不干活！", "用力生活，用力摸鱼"
];
function render(upcoming) {
  const next = upcoming[0];
  const lunar = solar2lunar();
  const nowLunar = `${lunar.IMonthCn}${lunar.IDayCn} ${lunar.gzYear}${lunar.gzMonth}${lunar.gzDay} ${lunar.Animal}年`;
  const nowSolar = `${lunar.cMonth}月${lunar.cDay}日（${lunar.astro}）`;
  const pool = [...TITLES];
  pool.splice(2, 0, nowLunar, nowSolar);
  let title;
  if (!next) title = "暂无假期安排";
  else if (next.days === 0) title = "节日快乐，万事大吉";
  else title = pool[Math.floor(Math.random() * pool.length)];
  const content = upcoming.slice(0, 3)
    .map(h => `${h.name}:${h.days === 0 ? "🎉" : h.days + "天"}`)
    .join(",");
  return { title, icon: next ? iconFor(next.days) : "tortoise", content };
}
function notifyIfNeeded(upcoming) {
  const next = upcoming[0];
  if (!next || next.days !== 0) return;
  const key = "timecard_hybrid_notified";
  if ($persistentStore.read(key) === next.date) return;
  if (new Date().getHours() < 6) return;
  $persistentStore.write(next.date, key);
  const lunar = solar2lunar();
  $notification.post(
    `🎉 今天是${next.date} ${next.name}`,
    `农历${lunar.IMonthCn}${lunar.IDayCn} ${lunar.Animal}年`,
    `放假的第1天，好好休息吧！`
  );
}

const BASE_URL = "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/";
function fetchDays(year) {
  const url = BASE_URL + year + ".json";
  return new Promise(resolve => {
    $httpClient.get({ url, timeout: 8 }, (err, resp, data) => {
      try {
        if (err || !data) return resolve(null);
        const body = JSON.parse(data);
        const arr = (body.days || []).filter(d => d && d.isOffDay === true && d.date);
        resolve(arr.map(d => ({ name: d.name, date: d.date })));
      } catch (e) { resolve(null); }
    });
  });
}
// 拉当前年 + 下一年（年末下一个节日可能已跨年），写入缓存
async function loadHolidays() {
  const y = new Date().getFullYear();
  // 优先读缓存（断网可用）
  const cached = $persistentStore.read(HOL_CACHE_KEY);
  if (cached) {
    try {
      const c = JSON.parse(cached);
      if (Array.isArray(c) && c.length) return c;
    } catch (e) {}
  }
  const [a, b] = await Promise.all([fetchDays(y), fetchDays(y + 1)]);
  const merged = [...(a || []), ...(b || [])];
  if (merged.length) $persistentStore.write(JSON.stringify(merged), HOL_CACHE_KEY);
  return merged;
}
// —— 主入口：优先在线+缓存，全失败或"当前年节日已过且无下一年数据"时回退兜底 ——
async function main() {
  let list = await loadHolidays();
  let upcoming = buildUpcoming(list);
  // 若 list 为空，或缓存里的节日都已过去且没拉到下一年数据 → 用兜底表
  if (!upcoming.length) {
    upcoming = buildUpcoming(FALLBACK_HOLIDAYS.map(h => ({ name: h[0], date: h[1] })));
  }
  notifyIfNeeded(upcoming);
  $done(render(upcoming));
}
main(); 