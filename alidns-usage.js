/* AliDNS HTTPDNS 用量面板（优化精简版）
 * 计费口径：HTTP=1x；HTTPS/DoH/DoT=5x。HttpsCount 已含 DoH，勿再叠加 DohTotalCount。
 * 凭据仅用于本地签名，请求直发阿里云 OpenAPI，不经过第三方。
 */

const API = "https://alidns.aliyuncs.com/";
const ARGS = parseArgument(String($argument || ""));
const QUOTA = positive(ARGS.quota, 1e7);   // 每账号月度免费额度
const ACCOUNTS = parseAccounts(ARGS);

/* ---------- 参数解析 ---------- */

function parseArgument(raw) {
  return raw.split("&").filter(Boolean).reduce((o, p) => {
    const i = p.indexOf("=");
    const k = i < 0 ? p : p.slice(0, i);
    o[decode(k)] = decode(i < 0 ? "" : p.slice(i + 1));
    return o;
  }, {});
}

function decode(v) { try { return decodeURIComponent(v); } catch { return v; } }
function positive(v, fb) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fb; }

// 新格式 name1/id1/secret1...；旧格式 accounts=名称|ID|Secret;...
function parseAccounts(o) {
  const slots = {};
  for (const k in o) {
    const m = k.match(/^(?:name|id|secret)(\d+)$/);
    if (m) {
      const s = m[1];
      slots[s] = slots[s] || {};
      slots[s][m[0].replace(/\d+$/, "")] = String(o[k]).trim();
    }
  }
  const list = Object.keys(slots)
    .sort((a, b) => a - b)
    .map((s) => slots[s])
    .filter((a) => a.name && a.name !== "#" && a.id && a.secret)
    .map((a) => ({ name: a.name, accessKeyId: a.id, accessKeySecret: a.secret }));
  if (list.length) return list;

  return String(o.accounts || "").split(";").filter(Boolean).map((item, i) => {
    const p = item.split("|").map((x) => x.trim());
    return { name: p[0] || `账号${i + 1}`, accessKeyId: p[1] || "", accessKeySecret: p.slice(2).join("|") || "" };
  }).filter((a) => a.accessKeyId && a.accessKeySecret);
}

/* ---------- 阿里云 RPC 签名 ---------- */

const enc = (s) =>
  encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const RANGE = { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };

function signedUrl(account) {
  const p = {
    AccessKeyId: account.accessKeyId,
    Action: "DescribePdnsRequestStatistic",
    EndDate: RANGE.end,
    Format: "JSON",
    Lang: "zh",
    Type: "ACCOUNT",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    SignatureVersion: "1.0",
    StartDate: RANGE.start,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2015-01-09",
  };
  const qs = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&");
  const toSign = `GET&${enc("/")}&${enc(qs)}`;
  return `${API}?Signature=${enc(b64(hmacSha1(account.accessKeySecret + "&", toSign)))}&${qs}`;
}

/* ---------- 紧凑 SHA-1 / HMAC-SHA1 / Base64（纯 JS，兼容所有引擎） ---------- */

const utf8 = (s) => [...unescape(encodeURIComponent(String(s)))].map((c) => c.charCodeAt(0));

function sha1(m) {
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
  return h.flatMap((x) => [x >>> 24 & 0xff, x >>> 16 & 0xff, x >>> 8 & 0xff, x & 0xff]);
}

function hmacSha1(key, msg) {
  let k = utf8(key);
  if (k.length > 64) k = sha1(k);
  while (k.length < 64) k.push(0);
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  return sha1(opad.concat(sha1(ipad.concat(utf8(msg)))));
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

/* ---------- 请求与统计 ---------- */

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, timeout: 15 }, (err, resp, data) => {
      if (err) return reject(new Error(String(err)));
      const status = Number(resp && resp.status);
      if (!status || status < 200 || status >= 300)
        return reject(new Error(`HTTP ${status || "未知"}: ${errMsg(data)}`));
      try { resolve(JSON.parse(String(data || "{}"))); }
      catch { reject(new Error("阿里云返回了无法解析的数据")); }
    });
  });
}

const errMsg = (data) => {
  try {
    const o = typeof data === "object" && data ? data : JSON.parse(String(data || "{}"));
    return o.Message || o.Code || "请求失败";
  } catch { return String(data || "请求失败").slice(0, 100); }
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function sumStats(data) {
  const t = { http: 0, https: 0 };
  (Array.isArray(data) ? data : []).forEach((x) => {
    t.http += x.HttpCount != null ? num(x.HttpCount) : num(x.V4HttpCount) + num(x.V6HttpCount);
    t.https += x.HttpsCount != null ? num(x.HttpsCount) : num(x.V4HttpsCount) + num(x.V6HttpsCount);
  });
  return t;
}

/* ---------- 面板展示 ---------- */

const mask = (n) => (/^1\d{10}$/.test(n) ? n.slice(0, 3) + "****" + n.slice(-4) : n);

const compact = (v) =>
  v >= 1e8 ? `${trim(v / 1e8)}亿`
  : v >= 1e4 ? `${trim(v / 1e4)}万`
  : Math.round(v).toLocaleString("zh-CN");

const trim = (v) => Number(v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)).toString();

const bar = (pct) => {
  pct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  let n = Math.round(pct / 20);
  if (pct > 0 && n === 0) n = 1;   // 有使用量时至少 1 格
  return "●".repeat(n) + "○".repeat(5 - n);
};

const pct = (v) => (Number.isFinite(v) ? v.toFixed(2).replace(/\.00$/, "") : "0");

const accountPanel = (name, billable) => {
  const percent = QUOTA > 0 ? (billable / QUOTA) * 100 : 0;
  const head = `${name}  ${bar(percent)} ${pct(percent)}%`;
  return billable > QUOTA
    ? `${head}  超${compact(billable - QUOTA)} ⚠️`
    : `${head}  余${compact(QUOTA - billable)}`;
};

/* ---------- 主流程 ---------- */

(async () => {
  if (!ACCOUNTS.length) throw new Error("请在模块参数中填写账号名称、AccessKey ID 和 AccessKey Secret");

  const results = await Promise.allSettled(ACCOUNTS.map(async (a) => {
    const s = sumStats((await httpGet(signedUrl(a))).Data);
    return s.http + s.https * 5;   // 折算后的计费量
  }));

  const lines = ACCOUNTS.map((a, i) => {
    const name = mask(a.name.trim());
    return results[i].status === "fulfilled"
      ? accountPanel(name, results[i].value)
      : [name, "查询失败", (results[i].reason.message || String(results[i].reason)).slice(0, 80)].join("\n");
  });

  const ok = results.some((r) => r.status === "fulfilled");
  $done({ title: "阿里 HTTPDNS", content: lines.join("\n\n"), icon: "cloud.fill", "icon-color": ok ? "#ff6a00" : "#ff3b30" });
})().catch((e) => {
  console.log(`[AliDNS Usage] ${e.message}`);
  $done({ title: "阿里 HTTPDNS", content: `更新失败：${e.message}`, icon: "cloud.fill", "icon-color": "#ff3b30" });
  });