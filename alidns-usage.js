/*!
 * AliDNS HTTPDNS 用量面板 · Surge Panel（精简版）
 * 数据源：DescribePdnsRequestStatistic（当月，北京时区）；计费：HTTP=1x HTTPS/DoH/DoT=5x UDP 默认不计
 * 参数：quota=10000000(全局额度,quotaN=单账号覆盖) https-factor=5 udp-factor=0 timeout=15 debug=1
 * 账号：name1=备注&id1=AccessKeyId&secret1=Secret[&quota1=额度]；旧格式 accounts=名称|ID|Secret;…
 * 成功静默零日志；debug=1 输出统计区间/每账号明细/重试日志；出错时输出「更新失败」
 */
"use strict";

/* ---- 配置 ---- */
const API = "https://alidns.aliyuncs.com/";
const ARGS = parseArgument(String($argument || ""));
const num = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const gt0 = (v, fb) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fb; };
const QUOTA = gt0(ARGS.quota, 1e7);
const HTTPS_FACTOR = gt0(ARGS["https-factor"], 5);
const UDP_FACTOR = Math.max(0, num(ARGS["udp-factor"], 0));
const TIMEOUT = gt0(ARGS.timeout, 15);
const DEBUG = ARGS.debug === "1" || ARGS.debug === "true";
const ACCOUNTS = parseAccounts(ARGS);

function parseArgument(raw) {
  const o = {};
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  for (const p of raw.split("&")) {
    if (!p) continue;
    const i = p.indexOf("=");
    o[dec(i < 0 ? p : p.slice(0, i))] = dec(i < 0 ? "" : p.slice(i + 1));
  }
  return o;
}

function parseAccounts(o) {
  const slots = {};
  for (const k in o) {
    const m = k.match(/^(name|id|secret|quota)(\d+)$/);
    if (m) (slots[m[2]] = slots[m[2]] || {})[m[1]] = String(o[k]).trim();
  }
  const list = Object.keys(slots).sort((a, b) => a - b).map((s) => slots[s])
    .filter((a) => a.name && a.id && a.secret && a.name[0] !== "#")
    .map((a) => ({
      name: a.name, accessKeyId: a.id, accessKeySecret: a.secret,
      quota: a.quota != null && a.quota !== "" ? gt0(a.quota, QUOTA) : QUOTA,
    }));
  if (list.length) return list;
  return String(o.accounts || "").split(";").filter(Boolean).map((it, i) => {
    const p = it.split("|").map((x) => x.trim());
    return { name: p[0] || `账号${i + 1}`, accessKeyId: p[1] || "", accessKeySecret: p.slice(2).join("|") || "", quota: QUOTA };
  }).filter((a) => a.accessKeyId && a.accessKeySecret && a.name[0] !== "#");
}

/* ---- 阿里云 RPC 签名（阿里云按北京时区统计，与设备时区无关） ---- */
const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const CN = 8 * 3600 * 1000;
const iso = (t) => { const d = new Date(t + CN); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

function monthInfo(now) {
  const cn = new Date((now || new Date()).getTime() + CN);
  const y = cn.getUTCFullYear(), m = cn.getUTCMonth(), d = cn.getUTCDate();
  return { start: iso(Date.UTC(y, m, 1)), end: iso(Date.UTC(y, m, d)), month: m + 1, elapsed: d };
}

function signedUrl(account, range) {
  const now = new Date();
  const p = {
    AccessKeyId: account.accessKeyId, Action: "DescribePdnsRequestStatistic",
    EndDate: range.end, Format: "JSON", Lang: "zh", Type: "ACCOUNT",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: `${now.getTime()}-${Math.random().toString(36).slice(2, 12)}`,
    SignatureVersion: "1.0", StartDate: range.start,
    Timestamp: now.toISOString().replace(/\.\d{3}Z$/, "Z"), Version: "2015-01-09",
  };
  const qs = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  return `${API}?Signature=${enc(b64(hmacSha1(account.accessKeySecret + "&", `GET&${enc("/")}&${enc(qs)}`)))}&${qs}`;
}

/* ---- SHA-1 / HMAC-SHA1 / Base64（纯 JS，兼容 JSCore/WebView） ---- */
const utf8 = (s) => [...unescape(encodeURIComponent(String(s)))].map((c) => c.charCodeAt(0));

function sha1(m) {
  const len = m.length * 8;
  const rol = (v, n) => ((v << n) | (v >>> (32 - n))) >>> 0;
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  m = m.concat([0x80]);
  while (m.length % 64 !== 56) m.push(0);
  for (let i = 7; i >= 0; i--) m.push((len / 2 ** (8 * i)) & 0xff);
  let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  for (let o = 0; o < m.length; o += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = ((m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const t = (rol(a, 5) + f + e + K[(i / 20) | 0] + w[i]) >>> 0;
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h = [(h[0] + a) >>> 0, (h[1] + b) >>> 0, (h[2] + c) >>> 0, (h[3] + d) >>> 0, (h[4] + e) >>> 0];
  }
  const out = [];
  for (let i = 0; i < 20; i++) out.push((h[i >> 2] >>> (24 - 8 * (i & 3))) & 0xff);
  return out;
}

function hmacSha1(key, msg) {
  let k = utf8(key);
  if (k.length > 64) k = sha1(k);
  while (k.length < 64) k.push(0);
  const x = (b) => k.map((v) => v ^ b);
  return sha1(x(0x5c).concat(sha1(x(0x36).concat(utf8(msg)))));
}

function b64(b) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    s += A[(n >>> 18) & 63] + A[(n >>> 12) & 63] + (i + 1 < b.length ? A[(n >>> 6) & 63] : "=") + (i + 2 < b.length ? A[n & 63] : "=");
  }
  return s;
}

/* ---- 请求（瞬时故障自动重试一次） ---- */
const errMsg = (data) => {
  try {
    const o = typeof data === "object" && data ? data : JSON.parse(String(data || "{}"));
    return o.Message || o.Code || "请求失败";
  } catch { return String(data || "请求失败").slice(0, 100); }
};

function httpJson(url, retried) {
  return new Promise((resolve, reject) => {
    const fail = (err) => {
      if (!retried) {
        if (DEBUG) console.log(`[AliDNS] 首次请求失败，重试：${err}`);
        return httpJson(url, true).then(resolve, reject);
      }
      reject(new Error(err));
    };
    try {
      $httpClient.get({ url, timeout: TIMEOUT }, (err, resp, data) => {
        const status = Number(resp && resp.status);
        if (!err && status >= 200 && status < 300) {
          try { return resolve(JSON.parse(String(data || "{}"))); }
          catch { return fail("响应不是合法 JSON"); }
        }
        fail(err ? `网络错误：${String(err).slice(0, 120)}` : `HTTP ${status || "未知"}：${errMsg(data)}`);
      });
    } catch (e) { fail(`网络错误：${String(e).slice(0, 120)}`); }
  });
}

/* ---- 统计与展示 ---- */
const sumStats = (data) => {
  const t = { http: 0, https: 0, udp: 0 };
  if (!Array.isArray(data)) return t;
  for (const x of data) {
    t.http += num(x.HttpCount != null ? x.HttpCount : num(x.V4HttpCount) + num(x.V6HttpCount));
    t.https += num(x.HttpsCount != null ? x.HttpsCount : num(x.V4HttpsCount) + num(x.V6HttpsCount));
    t.udp += num(x.UdpTotalCount);
  }
  return t;
};

const billable = (s) => s.http + s.https * HTTPS_FACTOR + s.udp * UDP_FACTOR;
const maskName = (n) => (/^1\d{10}$/.test(n) ? n.slice(0, 3) + "****" + n.slice(-4) : n);
const trim = (v) => Number(v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)).toString();
const compact = (v) => v >= 1e8 ? `${trim(v / 1e8)}亿` : v >= 1e4 ? `${trim(v / 1e4)}万` : Math.round(v).toLocaleString("zh-CN");

// 单账号只输出一行「日均 X · 已用 Y」；多账号/失败时前缀账号名；level: ok | over | error
function accountBlock(a, r, info, showName) {
  const name = maskName(a.name);
  const head = showName ? `${name}\n` : "";
  if (r.status !== "fulfilled") {
    const msg = String(r.reason && r.reason.message ? r.reason.message : r.reason).replace(/\s+/g, " ").slice(0, 90);
    return { text: `${head}⚠️ 查询失败\n${msg}`, level: "error" };
  }
  const used = r.value;
  return {
    text: `${head}日均 ${compact(used / info.elapsed)} · 已用 ${compact(used)}`,
    level: used > a.quota ? "over" : "ok",
  };
}

/* ---- 主流程 ---- */
if (typeof Promise.allSettled !== "function")
  Promise.allSettled = (ps) => Promise.all([...ps].map((p) => Promise.resolve(p).then(
    (value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason }))));

(async () => {
  // 占位符未替换 = 参数表没填，给出明确指引而非带垃圾值请求
  if (String($argument || "").indexOf("{{{") >= 0)
    throw new Error("模块参数未填写：请在 Surge 中编辑本模块的参数，填入 id1/secret1 后重新加载");

  if (!ACCOUNTS.length)
    throw new Error("未配置账号：请在 Surge 中编辑本模块的参数，填写 name1/id1/secret1（或旧格式 accounts=名称|ID|Secret）");

  const info = monthInfo();
  if (DEBUG) console.log(`[AliDNS] 统计区间 ${info.start} ~ ${info.end}（本月已过 ${info.elapsed} 天）`);
  const results = await Promise.allSettled(ACCOUNTS.map(async (a) => {
    const data = await httpJson(signedUrl(a, info));
    const s = sumStats(data && data.Data);
    const b = billable(s);
    if (DEBUG) console.log(`[AliDNS] ${a.name}: HTTP=${s.http} HTTPS=${s.https} UDP=${s.udp} → 折合 ${b}`);
    return b;
  }));

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const used = results.reduce((t, r) => t + (r.status === "fulfilled" ? r.value : 0), 0);
  const avg = compact(used / info.elapsed);

  const blocks = ACCOUNTS.map((a, i) => accountBlock(a, results[i], info, ACCOUNTS.length > 1));
  const parts = [];
  if (ACCOUNTS.length > 1) parts.push(`合计\n日均 ${avg} · 已用 ${compact(used)}`);
  parts.push(...blocks.map((b) => b.text));

  const color = ok === 0 ? "#ff3b30" : blocks.some((b) => b.level !== "ok") ? "#ff9f0a" : "#34c759";
  $done({
    title: `阿里 HTTPDNS · ${info.month}月`,
    content: parts.filter(Boolean).join("\n\n"),
    icon: "network",
    "icon-color": color,
  });
})().catch((e) => {
  console.log(`[AliDNS] 更新失败：${e.message}`);
  $done({ title: "阿里 HTTPDNS", content: `更新失败：${e.message}`, icon: "network", "icon-color": "#ff3b30" });
});