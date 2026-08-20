/*!
 * AliDNS HTTPDNS 用量面板 · Surge Panel（DeepSeek 重构版）
 * 数据源：阿里云 DescribePdnsRequestStatistic（当月 1 日至今，北京时区）
 * 计费：HTTP=1x；HTTPS/DoH/DoT=5x（HttpsCount 已含 DoH，勿叠加）；UDP 默认不计
 * AccessKey 仅本地签名，请求直发阿里云，不经第三方
 * 参数：quota=10000000(全局额度,quotaN=单账号覆盖) https-factor=5 udp-factor=0 timeout=15 debug=1
 * 账号：name1=备注&id1=AccessKeyId&secret1=Secret[&quota1=额度] 多账号顺延；旧格式 accounts=名称|ID|Secret;…
 * 说明：name 以 # 开头跳过；含特殊字符的值请 URL 编码
 */

"use strict";

/* ---- 配置 ---- */
const API = "https://alidns.aliyuncs.com/";
const ARGS = parseArgument(String($argument || ""));
const QUOTA = positive(ARGS.quota, 1e7);
const HTTPS_FACTOR = positive(ARGS["https-factor"], 5);
const UDP_FACTOR = nonNegative(ARGS["udp-factor"], 0);
const TIMEOUT = positive(ARGS.timeout, 15);
const DEBUG = ARGS.debug === "1" || ARGS.debug === "true";
const ACCOUNTS = parseAccounts(ARGS);

/* ---- 参数解析 ---- */
function parseArgument(raw) {
  return raw.split("&").filter(Boolean).reduce((o, p) => {
    const i = p.indexOf("=");
    const k = i < 0 ? p : p.slice(0, i);
    o[decode(k)] = decode(i < 0 ? "" : p.slice(i + 1));
    return o;
  }, {});
}

function decode(v) {
  try { return decodeURIComponent(v); } catch { return v; }
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

function nonNegative(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fb;
}

function parseAccounts(o) {
  const slots = {};
  for (const k in o) {
    const m = k.match(/^(?:name|id|secret|quota)(\d+)$/);
    if (!m) continue;
    const s = m[1];
    slots[s] = slots[s] || {};
    slots[s][m[0].replace(/\d+$/, "")] = String(o[k]).trim();
  }
  const list = Object.keys(slots)
    .sort((a, b) => a - b)
    .map((s) => slots[s])
    .filter((a) => a.name && a.id && a.secret && !/^#/.test(a.name))
    .map((a) => ({
      name: a.name,
      accessKeyId: a.id,
      accessKeySecret: a.secret,
      quota: a.quota != null && a.quota !== "" ? positive(a.quota, QUOTA) : QUOTA,
    }));
  if (list.length) return list;

  return String(o.accounts || "").split(";").filter(Boolean).map((item, i) => {
    const p = item.split("|").map((x) => x.trim());
    return {
      name: p[0] || `账号${i + 1}`,
      accessKeyId: p[1] || "",
      accessKeySecret: p.slice(2).join("|") || "",
      quota: QUOTA,
    };
  }).filter((a) => a.accessKeyId && a.accessKeySecret && !/^#/.test(a.name));
}

/* ---- 阿里云 RPC 签名 ---- */
const enc = (s) =>
  encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// 阿里云按北京时区统计，与设备时区无关
const CN_TZ = 8 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, "0");

function monthInfo(now) {
  const cn = new Date((now || new Date()).getTime() + CN_TZ);
  const y = cn.getUTCFullYear();
  const m = cn.getUTCMonth();
  const day = cn.getUTCDate();
  const fmt = (t) => {
    const d = new Date(t + CN_TZ);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  return {
    start: fmt(Date.UTC(y, m, 1)),
    end: fmt(Date.UTC(y, m, day)),
    month: m + 1,
    elapsed: day,
    totalDays: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
  };
}

function signedUrl(account, range) {
  const p = {
    AccessKeyId: account.accessKeyId,
    Action: "DescribePdnsRequestStatistic",
    EndDate: range.end,
    Format: "JSON",
    Lang: "zh",
    Type: "ACCOUNT",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    SignatureVersion: "1.0",
    StartDate: range.start,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2015-01-09",
  };
  const qs = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const toSign = `GET&${enc("/")}&${enc(qs)}`;
  return `${API}?Signature=${enc(b64(hmacSha1(account.accessKeySecret + "&", toSign)))}&${qs}`;
}

/* ---- SHA-1 / HMAC-SHA1 / Base64（纯 JS，兼容各引擎） ---- */
const utf8 = (s) => [...unescape(encodeURIComponent(String(s)))].map((c) => c.charCodeAt(0));

function sha1Bytes(m) {
  const len = m.length * 8;
  m = m.concat([0x80]);
  while (m.length % 64 !== 56) m.push(0);
  for (let i = 7; i >= 0; i--) m.push((len / 2 ** (8 * i)) & 0xff);
  const rol = (v, n) => ((v << n) | (v >>> (32 - n))) >>> 0;
  let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  for (let o = 0; o < m.length; o += 64) {
    const w = new Array(80);
    for (let i = 0; i < 16; i++)
      w[i] = ((m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3]) >>> 0;
    for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (rol(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h = [(h[0] + a) >>> 0, (h[1] + b) >>> 0, (h[2] + c) >>> 0, (h[3] + d) >>> 0, (h[4] + e) >>> 0];
  }
  const out = [];
  for (const x of h) out.push(x >>> 24 & 0xff, x >>> 16 & 0xff, x >>> 8 & 0xff, x & 0xff);
  return out;
}

function hmacSha1(key, msg) {
  let k = utf8(key);
  if (k.length > 64) k = sha1Bytes(k);
  while (k.length < 64) k.push(0);
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(utf8(msg)))));
}

function b64(b) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    s += A[(n >>> 18) & 63] + A[(n >>> 12) & 63]
      + (i + 1 < b.length ? A[(n >>> 6) & 63] : "=")
      + (i + 2 < b.length ? A[n & 63] : "=");
  }
  return s;
}

/* ---- 请求 ---- */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, timeout: TIMEOUT }, (err, resp, data) => {
      if (err) return reject(new Error(`网络错误：${String(err).slice(0, 120)}`));
      const status = Number(resp && resp.status);
      if (!status || status < 200 || status >= 300)
        return reject(new Error(`HTTP ${status || "未知"}：${errMsg(data)}`));
      try { resolve(JSON.parse(String(data || "{}"))); }
      catch { reject(new Error("响应不是合法 JSON")); }
    });
  });
}