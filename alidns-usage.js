/* AliDNS HTTPDNS Usage Panel for Surge */

const API_ENDPOINT = "https://alidns.aliyuncs.com/";
const API_VERSION = "2015-01-09";
const ACTION = "DescribePdnsRequestStatistic";

const args = parseArgument(String($argument || ""));
const monthlyQuota = positiveNumber(args.quota, 10000000);
const accounts = parseAccounts(args);

function parseArgument(raw) {
  return Object.fromEntries(
    raw.split("&").filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      const key = index < 0 ? part : part.slice(0, index);
      const value = index < 0 ? "" : part.slice(index + 1);
      return [decodeURIComponent(key), decodeURIComponent(value)];
    }),
  );
}

function parseAccounts(values) {
  const separateFields = Array.from({ length: 5 }, (_, index) => {
    const slot = index + 1;

    const name = String(values[`name${slot}`] || "").trim();

    return {
      name: name && name !== "#" ? name : "",
      accessKeyId: String(values[`id${slot}`] || "").trim(),
      accessKeySecret: String(values[`secret${slot}`] || "").trim(),
    };
  }).filter(
    (item) =>
      item.name &&
      item.accessKeyId &&
      item.accessKeySecret
  );

  if (separateFields.length) return separateFields;

  // Compatibility with the old combined accounts format:
  // accounts=账号1|AccessKeyID|AccessKeySecret;账号2|AccessKeyID|AccessKeySecret
  return String(values.accounts || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const parts = item.split("|").map((part) => part.trim());

      return {
        name: parts[0] || `账号${index + 1}`,
        accessKeyId: parts[1] || "",
        accessKeySecret: parts.slice(2).join("|") || "",
      };
    })
    .filter(
      (item) =>
        item.accessKeyId &&
        item.accessKeySecret
    );
}

function positiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function monthRange() {
  const now = new Date();

  return {
    startDate: formatDate(
      new Date(now.getFullYear(), now.getMonth(), 1)
    ),
    endDate: formatDate(now),
  };
}

function nonce() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function isoTimestamp() {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function percentEncode(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (character) =>
      `%${character
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()}`
  );
}

function signedUrl(account, startDate, endDate) {
  const parameters = {
    AccessKeyId: account.accessKeyId,
    Action: ACTION,
    EndDate: endDate,
    Format: "JSON",
    Lang: "zh",
    Type: "ACCOUNT",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: nonce(),
    SignatureVersion: "1.0",
    StartDate: startDate,
    Timestamp: isoTimestamp(),
    Version: API_VERSION,
  };

  const canonicalizedQueryString = Object.keys(parameters)
    .sort()
    .map(
      (key) =>
        `${percentEncode(key)}=${percentEncode(
          parameters[key]
        )}`
    )
    .join("&");

  const stringToSign =
    `GET&${percentEncode("/")}&` +
    `${percentEncode(canonicalizedQueryString)}`;

  const signature = hmacSha1Base64(
    `${account.accessKeySecret}&`,
    stringToSign
  );

  return (
    `${API_ENDPOINT}?Signature=${percentEncode(signature)}` +
    `&${canonicalizedQueryString}`
  );
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        timeout: 15,
      },
      (error, response, data) => {
        if (error) {
          return reject(new Error(String(error)));
        }

        const status = Number(
          response && response.status
        );

        if (status < 200 || status >= 300) {
          return reject(
            new Error(
              `HTTP ${status || "未知"}: ${extractError(
                data
              )}`
            )
          );
        }

        try {
          resolve(JSON.parse(String(data || "{}")));
        } catch (_) {
          reject(
            new Error("阿里云返回了无法解析的数据")
          );
        }
      }
    );
  });
}

function extractError(data) {
  try {
    const parsed = JSON.parse(
      String(data || "{}")
    );

    return (
      parsed.Message ||
      parsed.Code ||
      "请求失败"
    );
  } catch (_) {
    return String(data || "请求失败").slice(
      0,
      100
    );
  }
}

/*
 * Aliyun billing:
 *
 * HTTP = 1x
 * HTTPS / DoH / DoT = 5x
 *
 * Important:
 * HttpsCount returned by DescribePdnsRequestStatistic
 * already includes DoH requests in the traffic-analysis
 * statistics, according to Aliyun's API documentation.
 *
 * Therefore DO NOT add DohTotalCount again.
 */
function sumStatistics(statistics) {
  return (
    Array.isArray(statistics)
      ? statistics
      : []
  ).reduce(
    (total, item) => {
      const http =
        item.HttpCount !== undefined
          ? number(item.HttpCount)
          : number(item.V4HttpCount) +
            number(item.V6HttpCount);

      const https =
        item.HttpsCount !== undefined
          ? number(item.HttpsCount)
          : number(item.V4HttpsCount) +
            number(item.V6HttpsCount);

      total.http += http;
      total.https += https;

      return total;
    },
    {
      http: 0,
      https: 0,
    }
  );
}

function number(value) {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

async function queryAccount(account, range) {
  const response = await httpGet(
    signedUrl(
      account,
      range.startDate,
      range.endDate
    )
  );

  const statistics = sumStatistics(
    response.Data
  );

  /*
   * Convert the actual request volume into
   * Aliyun's billable HTTP-equivalent usage.
   */
  const billable =
    statistics.http +
    statistics.https * 5;

  return {
    account,
    usage: {
      http: statistics.http,
      https: statistics.https,
      billable,
    },
  };
}

function displayAccountName(value) {
  const name = String(value || "").trim();

  // Mask 11-digit Chinese mobile numbers.
  if (/^1\d{10}$/.test(name)) {
    return `${name.slice(0, 3)}****${name.slice(-4)}`;
  }

  return name;
}

function compactNumber(value) {
  const numberValue = number(value);

  if (numberValue >= 100000000) {
    return `${trim(numberValue / 100000000)}亿`;
  }

  if (numberValue >= 10000) {
    return `${trim(numberValue / 10000)}万`;
  }

  return Math.round(
    numberValue
  ).toLocaleString("zh-CN");
}

function trim(value) {
  return Number(
    value.toFixed(
      value >= 100
        ? 0
        : value >= 10
        ? 1
        : 2
    )
  ).toString();
}

/*
 * Create a 10-character progress bar.
 *
 * Example:
 * 12.34% -> █░░░░░░░░░
 * 58.20% -> ██████░░░░
 * 100%   -> ██████████
 */
function progressBar(percent) {

  const total = 10;

  // 进度条最多填满 10 格

  const safePercent = Math.max(

    0,

    Math.min(100, percent)

  );

  const filled = percent > 0
  ? Math.max(1, Math.round((safePercent / 100) * total))
  : 0;

  return (

    "█".repeat(filled) +

    "░".repeat(total - filled)

  );
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value
    .toFixed(2)
    .replace(/\.00$/, "");
}

function accountPanel(

  accountName,

  billable,

  quota

) {

  const percent =

    quota > 0

      ? (billable / quota) * 100

      : 0;

  const bar = progressBar(percent);

  if (billable > quota) {

    const exceeded =

      billable - quota;

    return `${accountName}  ${bar} ${formatPercent(percent)}%  超${compactNumber(exceeded)} ⚠️`;

  }

  const remaining =

    quota - billable;

  return `${accountName}  ${bar} ${formatPercent(percent)}%  余${compactNumber(remaining)}`;

}

  const remaining =
    quota - billable;

  return [
    accountName,
    `${bar} ${formatPercent(percent)}%`,
    `${compactNumber(billable)} / ${compactNumber(quota)}`,
    `剩余 ${compactNumber(remaining)}`,
  ].join("\n");
}

function panelDone(
  title,
  content,
  style = "info"
) {
  $done({
    title,
    content,
    icon: "cloud.fill",
    "icon-color":
      style === "error"
        ? "#ff3b30"
        : "#ff6a00",
  });
}


/*
 * Pure JavaScript SHA-1/HMAC implementation.
 * Credentials never leave Surge except inside
 * signed requests sent to Aliyun.
 */

function hmacSha1Base64(
  key,
  message
) {
  const blockSize = 64;

  let keyBytes = utf8Bytes(key);

  if (keyBytes.length > blockSize) {
    keyBytes = sha1Bytes(keyBytes);
  }

  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  const outer = keyBytes.map(
    (byte) => byte ^ 0x5c
  );

  const inner = keyBytes.map(
    (byte) => byte ^ 0x36
  );

  return base64(
    sha1Bytes(
      outer.concat(
        sha1Bytes(
          inner.concat(
            utf8Bytes(message)
          )
        )
      )
    )
  );
}

function utf8Bytes(value) {
  const encoded = unescape(
    encodeURIComponent(String(value))
  );

  return Array.from(
    encoded,
    (character) =>
      character.charCodeAt(0)
  );
}

function sha1Bytes(bytes) {
  const message = bytes.slice();
  const bitLength =
    message.length * 8;

  message.push(0x80);

  while (
    message.length % 64 !==
    56
  ) {
    message.push(0);
  }

  const high = Math.floor(
    bitLength / 0x100000000
  );

  const low =
    bitLength >>> 0;

  for (
    let shift = 24;
    shift >= 0;
    shift -= 8
  ) {
    message.push(
      (high >>> shift) & 0xff
    );
  }

  for (
    let shift = 24;
    shift >= 0;
    shift -= 8
  ) {
    message.push(
      (low >>> shift) & 0xff
    );
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (
    let offset = 0;
    offset < message.length;
    offset += 64
  ) {
    const words = new Array(80);

    for (
      let index = 0;
      index < 16;
      index += 1
    ) {
      const position =
        offset + index * 4;

      words[index] =
        (
          (message[position] << 24) |
          (message[position + 1] << 16) |
          (message[position + 2] << 8) |
          message[position + 3]
        ) >>> 0;
    }

    for (
      let index = 16;
      index < 80;
      index += 1
    ) {
      words[index] =
        rotateLeft(
          words[index - 3] ^
            words[index - 8] ^
            words[index - 14] ^
            words[index - 16],
          1
        );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (
      let index = 0;
      index < 80;
      index += 1
    ) {
      let f;
      let k;

      if (index < 20) {
        f =
          (b & c) |
          (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f =
          (b & c) |
          (b & d) |
          (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp =
        (
          rotateLeft(a, 5) +
          f +
          e +
          k +
          words[index]
        ) >>> 0;

      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [
    h0,
    h1,
    h2,
    h3,
    h4,
  ].flatMap((word) => [
    (word >>> 24) & 0xff,
    (word >>> 16) & 0xff,
    (word >>> 8) & 0xff,
    word & 0xff,
  ]);
}

function rotateLeft(
  value,
  bits
) {
  return (
    (value << bits) |
    (value >>> (32 - bits))
  ) >>> 0;
}

function base64(bytes) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  let output = "";

  for (
    let index = 0;
    index < bytes.length;
    index += 3
  ) {
    const a = bytes[index];

    const b =
      index + 1 < bytes.length
        ? bytes[index + 1]
        : 0;

    const c =
      index + 2 < bytes.length
        ? bytes[index + 2]
        : 0;

    const triple =
      (a << 16) |
      (b << 8) |
      c;

    output +=
      alphabet[
        (triple >>> 18) & 63
      ];

    output +=
      alphabet[
        (triple >>> 12) & 63
      ];

    output +=
      index + 1 < bytes.length
        ? alphabet[
            (triple >>> 6) & 63
          ]
        : "=";

    output +=
      index + 2 < bytes.length
        ? alphabet[triple & 63]
        : "=";
  }

  return output;
}


(async () => {
  if (!accounts.length) {
    throw new Error(
      "请在模块参数中分别填写账号名称、AccessKey ID 和 AccessKey Secret"
    );
  }

  const range = monthRange();

  const settled =
    await Promise.allSettled(
      accounts.map(
        (account) =>
          queryAccount(
            account,
            range
          )
      )
    );

  const accountBlocks = [];

  let successCount = 0;

  settled.forEach(
    (result, index) => {
      const account =
        accounts[index];

      const displayName =
        displayAccountName(
          account.name
        );

      if (
        result.status ===
        "fulfilled"
      ) {
        const usage =
          result.value.usage;

        successCount += 1;

        accountBlocks.push(
          accountPanel(
            displayName,
            usage.billable,
            monthlyQuota
          )
        );
      } else {
        accountBlocks.push(
          [
            displayName,
            "查询失败",
            String(
              result.reason &&
                result.reason.message ||
                result.reason
            ).slice(0, 80),
          ].join("\n")
        );
      }
    }
  );

  panelDone(
    "阿里 HTTPDNS",
    accountBlocks.join("\n\n"),
    successCount
      ? "info"
      : "error"
  );
})().catch((error) => {
  console.log(
    `[AliDNS Usage] ${error.message}`
  );

  panelDone(
    "阿里 HTTPDNS",
    `更新失败：${error.message}`,
    "error"
  );
});