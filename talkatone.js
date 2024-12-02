// talkatone_ad_block.js
let body = $response.body;

// 去除顶部广告横幅
body = body.replace(/<div class=".*?ad-banner-top.*?">.*?<\/div>/g, '');

// 去除中部的 "Premium SMS" 提示广告
body = body.replace(/<div class=".*?premium-sms-ad.*?">.*?<\/div>/g, '');
body = body.replace(/<div class=".*?show-me.*?">.*?<\/div>/g, '');

// 去除底部广告横幅
body = body.replace(/<div class=".*?ad-banner-bottom.*?">.*?<\/div>/g, '');

$done({ body });
