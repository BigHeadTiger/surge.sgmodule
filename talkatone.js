// talkatone_ad_block.js
let body = $response.body;

// 去除顶部广告横幅
body = body.replace(/<div class=".*?top-banner.*?">.*?<\/div>/g, '');

// 去除中部的 "Premium SMS" 提示广告
body = body.replace(/<div class=".*?premium-sms-ad.*?">.*?<\/div>/g, '');
body = body.replace(/<div class=".*?ads-section.*?">.*?<\/div>/g, '');

// 去除底部广告横幅
body = body.replace(/<div class=".*?bottom-banner.*?">.*?<\/div>/g, '');

$done({ body });
