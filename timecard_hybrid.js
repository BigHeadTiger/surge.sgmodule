/* 节假日信息 v5.5 —— 精简版
   节假日：在线读 NateScarlet/holiday-cn（国务院官方数据，免费无key），主源失败自动切换 CDN 镜像；缓存 7 天有效，断网退回旧缓存。
   农历：离线计算（干支/生肖/星座），兜底节假日按当年动态计算。 */

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
        0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,//2050-2059
        0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,//2060-2069
        0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,//2070-2079
        0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,//2080-2089
        0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,//2090-2099
        0x0d520];
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
        '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722'];

const nStr1 = ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const nStr2 = ["初", "十", "廿", "卅"];
const nStr3 = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const Gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const Zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const Animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

function lYearDays(y) {
  let i, sum = 348;
  for (i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}
function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function leapDays(y) { return (leapMonth(y)) ? (LUNAR_INFO[y - 1900] & 0x10000 ? 30 : 29) : 0; }
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function toGanZhiYear(lYear) { return Gan[(lYear - 4) % 10] + Zhi[(lYear - 4) % 12]; }
function toAstro(m, d) {
  const s = "摩羯水瓶双鱼白羊金牛双子巨蟹狮子处女天秤天蝎射手摩羯";
  const arr = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22];
  return s.substr(m * 2 - (d < arr[m - 1] ? 2 : 0), 2) + "座";
}
function toGanZhi(offset) { return Gan[offset % 10] + Zhi[offset % 12]; }
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
function toChinaMonth(m) { return nStr3[m - 1] + "月"; }
function toChinaDay(d) {
  switch (d) {
    case 10: return "初十"; case 20: return "二十"; case 30: return "三十";
  }
  return nStr2[Math.floor(d / 10)] + nStr1[d % 10];
}
function getAnimal(y) { return Animals[(y - 4) % 12]; }

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
  let gzM = toGanZhi((y - 1900) * 12 + m + 11);
  if (d >= firstNode) gzM = toGanZhi((y - 1900) * 12 + m + 12);
  const dayCyclical = Date.UTC(y, sm, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10;
  const gzD = toGanZhi(dayCyclical + d - 1);
  const astro = toAstro(m, d);
  return {
    Animal: getAnimal(year),
    IMonthCn: (isLeap ? "闰" : "") + toChinaMonth(month),
    IDayCn: toChinaDay(day),
    cMonth: m, cDay: d,
    month: month, day: day, isLeap: isLeap,
    gzYear: gzY, gzMonth: gzM, gzDay: gzD,
    astro: astro
  };
}

// 农历→公历（兜底用），以 1900-01-31 春节为锚点
function lunar2solar(lunarYear, lunarMonth, lunarDay, isLeap) {
  let days = 0;
  for (let i = 1900; i < lunarYear; i++) days += lYearDays(i);
  const base = new Date(Date.UTC(1900, 0, 31) + days * 86400000);
  const leap = leapMonth(lunarYear);
  let offset = lunarDay - 1;
  if (isLeap) {
    for (let m = 1; m <= lunarMonth; m++) offset += monthDays(lunarYear, m);
  } else {
    for (let m = 1; m < lunarMonth; m++) offset += monthDays(lunarYear, m);
    if (leap && lunarMonth > leap) offset += leapDays(lunarYear);
  }
  const d = new Date(base.getTime() + offset * 86400000);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}
function pad2(n) { return String(n).padStart(2, "0"); }
function solarStr(ymd) { return ymd[0] + "-" + pad2(ymd[1]) + "-" + pad2(ymd[2]); }

const TC_VERSION = "5.6";
let SOURCE_USED = "";      // 本次实际生效的数据源
let FETCH_TRAIL = [];      // 抓取/重试轨迹
let CACHE_INFO = { hit: false, count: 0, maxYear: 0, ageH: -1 };

// ---- 日志分级（学 iRingo 的 LogLevel）----
const LOG_LEVELS = { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, ALL: 5 };
let LOG_LEVEL = 2; // 默认 WARN：平时完全静默，仅异常（缓存损坏/数据源全挂/计算失败）时输出
function parseLogLevel(arg) {
  const m = /(?:^|[&,;\s])LogLevel=([A-Za-z]+)/.exec(arg || "");
  if (!m) return 2;
  const v = LOG_LEVELS[m[1].toUpperCase()];
  return (v === undefined) ? 2 : v;
}
function log(level, ...args) {
  if (level <= LOG_LEVEL) console.log(args.join(" "));
}
function srcLabel(i) { return i === 0 ? "主源(GitHub raw)" : "镜像(jsDelivr)"; }
const BASE_URLS = [
  "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/",
  "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/",
];
const HOL_CACHE_KEY = "timecard_holidays_v2";
const CACHE_TTL = 7 * 86400000;
function fallbackHolidays() {
  const y = new Date().getFullYear();
  const out = [];
  for (const Y of [y, y + 1]) {
    const qingming = getTerm(Y, 7); // 清明 = 第 7 节气（4 月）
    out.push(
      { name: "元旦", date: solarStr([Y, 1, 1]) },
      { name: "春节", date: solarStr(lunar2solar(Y, 1, 1)) },
      { name: "元宵", date: solarStr(lunar2solar(Y, 1, 15)) },
      { name: "清明", date: solarStr([Y, 4, qingming]) },
      { name: "劳动节", date: solarStr([Y, 5, 1]) },
      { name: "端午节", date: solarStr(lunar2solar(Y, 5, 5)) },
      { name: "中秋节", date: solarStr(lunar2solar(Y, 8, 15)) },
      { name: "国庆节", date: solarStr([Y, 10, 1]) }
    );
  }
  return out;
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - now) / 86400000);
}
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
  return dedup;
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
function render(upcoming, lunar) {
  const next = upcoming[0];
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
function fetchDays(year) {
  const tryFetch = i => new Promise(resolve => {
    if (i >= BASE_URLS.length) return resolve(null);
    const t0 = Date.now();
    $httpClient.get({ url: BASE_URLS[i] + year + ".json", timeout: 5 }, (err, resp, data) => {
      const ms = Date.now() - t0;
      const status = resp ? resp.status : -1;
      const tag = year + " " + srcLabel(i);
      try {
        if (err || !data) {
          FETCH_TRAIL.push(`${tag} ❌ ${err || ("HTTP " + status)} (${ms}ms)`);
          return resolve(tryFetch(i + 1));
        }
        const body = JSON.parse(data);
        const arr = (body.days || []).filter(d => d && d.isOffDay === true && d.date);
        if (arr.length) {
          SOURCE_USED = srcLabel(i);
          FETCH_TRAIL.push(`${tag} ✅ ${arr.length}条 · ${(data.length / 1024).toFixed(1)}KB · ${ms}ms`);
          return resolve(arr.map(d => ({ name: d.name, date: d.date })));
        }
        FETCH_TRAIL.push(`${tag} ⚠️ 空数据 (${ms}ms)`);
        resolve(tryFetch(i + 1));
      } catch (e) {
        FETCH_TRAIL.push(`${tag} ❌ 解析异常 ${e.message} (${ms}ms)`);
        resolve(tryFetch(i + 1));
      }
    });
  });
  return tryFetch(0);
}
async function loadHolidays() {
  const y = new Date().getFullYear();
  let cached = null, fresh = false, cacheTS = 0;
  const raw = $persistentStore.read(HOL_CACHE_KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw);
      if (Array.isArray(c)) cached = c; // 旧版数组格式，视为过期
      else if (Array.isArray(c.data) && c.data.length) {
        cached = c.data;
        fresh = c.ts > 0 && Date.now() - c.ts < CACHE_TTL;
        cacheTS = c.ts > 0 ? c.ts : 0;
      }
    } catch (e) { log(2, "缓存解析异常:", e.message); }
  }
  if (cached) {
    CACHE_INFO.hit = true;
    CACHE_INFO.count = cached.length;
    CACHE_INFO.maxYear = cached.reduce((mx, it) => {
      const yy = (it && typeof it.date === "string" && it.date.length >= 4) ? parseInt(it.date.slice(0, 4)) : 0;
      return Math.max(mx, isNaN(yy) ? 0 : yy);
    }, 0);
    CACHE_INFO.ageH = cacheTS ? (Date.now() - cacheTS) / 3600000 : -1;
  }
  // 缓存需覆盖到明年且 7 天内，否则重拉
  if (cached && fresh) {
    if (CACHE_INFO.maxYear >= y + 1) { SOURCE_USED = "本地缓存 (7天内有效)"; return cached; }
  }
  const [a, b] = await Promise.all([fetchDays(y), fetchDays(y + 1)]);
  if (a || b) {
    const merged = mergeByDate([...(cached || []), ...(a || []), ...(b || [])]);
    if (merged.length) $persistentStore.write(JSON.stringify({ ts: Date.now(), data: merged }), HOL_CACHE_KEY);
    return merged;
  }
  SOURCE_USED = "过期缓存兜底";
  return cached || [];
}
function mergeByDate(list) {
  const seen = new Set(), out = [];
  for (const it of list) { if (!seen.has(it.date)) { seen.add(it.date); out.push(it); } }
  return out;
}
async function main() {
  LOG_LEVEL = parseLogLevel(typeof $argument !== "undefined" ? $argument : "");

  // ===== 数据源 =====
  let tNet = Date.now();
  let list = await loadHolidays();
  tNet = Date.now() - tNet;
  let upcoming = buildUpcoming(list);
  let mode = "在线数据";
  if (!upcoming.length) {
    upcoming = buildUpcoming(fallbackHolidays());
    SOURCE_USED = "离线兜底计算 (本地农历计算)";
    mode = "离线兜底";
    log(1, "⚠️ 数据源不可用，已切换离线兜底计算 (网络耗时 " + tNet + "ms)");
  }
  if (mode === "离线兜底" && FETCH_TRAIL.length) {
    log(2, "数据源全挂，抓取轨迹: " + FETCH_TRAIL.join(" | "));
  }

  // ===== 计算 =====
  let lunar;
  try {
    lunar = solar2lunar();
  } catch (e) {
    log(1, "❌ 农历计算失败: " + e.message);
    lunar = { IMonthCn: "", IDayCn: "", gzDay: "", gzYear: "", gzMonth: "", Animal: "", astro: "", isLeap: false, cMonth: "", cDay: "" };
  }

  // ===== 通知 =====
  notifyIfNeeded(upcoming);

  // ===== 渲染 =====
  const result = render(upcoming, lunar);
  $done(result);
}
main();