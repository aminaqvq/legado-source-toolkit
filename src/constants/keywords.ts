// ── Emoji & symbol patterns for name cleaning ──

/** Emoji characters commonly found in book source names */
export const EMOJI_CHARS = new Set([
  '❤️', '💓', '💞', '💕', '💗', '💖', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍',
  '🎧', '🎨', '🚖', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️',
  '⭐', '🌟', '✨', '🔥', '💥', '💫', '🌈', '☀️', '🌙', '🌸', '🌺', '🌻', '🌹', '🍀',
  '✅', '✔️', '☑️', '❌', '✖️', '❗', '❓', '‼️', '⁉️',
  '🎯', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅',
  '📖', '📚', '📕', '📗', '📘', '📙',
  '🎵', '🎶', '🎼', '🎤', '🎬', '🎭', '🎪',
  '💎', '🔮', '🪄', '🧿',
  '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
  '▶️', '⏯️', '⏭️', '⏮️', '🔄', '🔁', '🔂',
  '🆕', '🆓', '🆙', '🆗', '🆒',
  '🔞', '⚠️', '🚫', '⛔', '🚷',
  '♂️', '♀️', '⚧️',
  '✍️', '👁️', '👀', '🗣️', '👤', '👥',
  '💬', '🗨️', '🗯️', '💭',
  '⌚', '📱', '💻', '🖥️', '⌨️', '🖱️',
  '🎁', '🎉', '🎊', '🎈',
  '🔍', '🔎',
  '♻️', '💲',
  '©️', '®️', '™️',
]);

/** Regex that matches any common emoji (code point ranges only — combining chars like ZWJ/VS16 removed from class per no-misleading-character-class) */
export const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;

/** Fancy bracket/symbol characters to strip */
export const FANCY_SYMBOLS = ['【', '】', '『', '』', '「', '」', '《', '》', '〈', '〉'];

/** Patterns for maintainer suffixes like @xxx, by xxx, #xxx */
export const MAINTAINER_PATTERNS = [
  /@\S+/g,
  /\s+[Bb][Yy]\s+\S+/g,
  /\s*[┃|｜]\s*\S+/g,
];

/** Pattern for trailing # followed by CJK/annotation comment (NOT #digits) */
export const TRAILING_HASH_CJK = /#[^\d\s][^\s]*\s*$/g;

/** Pattern for trailing #digits (version/duplicate marker, like 笔趣阁#21) */
export const TRAILING_HASH_DIGIT = /#[0-9]+\s*$/g;

/** Quality marker keywords — removed from names */
export const QUALITY_MARKERS = new Set([
  '优',
  '优+',
  '优++',
  '优+++',
  '可用',
  '修复',
  '推荐',
  '新站',
  '备用',
  '失效',
  '校验超时',
  '需登录',
  '需VIP',
  '需付费',
  '已失效',
  '已恢复',
  '首发',
  '正版',
  '纯净',
  '无广告',
  '广告',
  '暂不可用',
  '恢复',
  '维护中',
]);

// ── Classification keywords ──

export const COMIC_KEYWORDS = [
  '漫画', '动漫', 'comic', 'manga', 'manhua', 'acg', 'dmzj',
  'webtoon', 'kuaikan', '快看', '哔哩漫画', '腾讯动漫', '看漫画',
  '动漫之家', '漫客栈', '有妖气', '动漫屋', '风之动漫', '古风漫画',
  '韩漫', '日漫', '国漫',
];

export const NOVEL_KEYWORDS = [
  '小说', '文学', '阅读', '笔趣', '起点', '纵横', '晋江',
  '番茄', '七猫', '书城', 'novel', 'book', 'txt', '笔趣阁',
  '全本', '完本', '看书', '书吧', '书坊', '书屋', '书阁', '书斋',
  '书苑', '典籍', '经典', '文库', '追书', '搜书', '淘书',
  '掌阅', '多看', '豆瓣阅读', '微信读书', '蜗牛',
];

export const AUDIO_KEYWORDS = [
  '有声', '听书', '音频', 'FM', '电台', '广播剧', '猫耳', '喜马拉雅',
  '懒人听书', 'mp3', 'm4a', 'audio', '倾听', '聆听',
  '播客', 'podcast',
];

export const VIDEO_KEYWORDS = [
  '影视', '电影', '电视', '剧集', '视频', '短剧', '影院',
  '动漫番剧', 'm3u8', 'mp4', 'video', 'tv', 'movie', 'vod',
  '放映', '点播', '观影', '看片',
];

export const DOWNLOAD_KEYWORDS = [
  '下载', 'epub', 'pdf', 'azw3', 'mobi', '文件', '书仓', '藏书',
  '离线', '下载站', 'txt下载', '全本下载', '网盘',
];

// ── Domain prefixes to strip ──

export const DOMAIN_PREFIXES = ['www.', 'm.', 'wap.', 'mobile.', 'read.', 'api.', 'app.', 'h5.'];

// ── Complex JS indicators (do NOT execute) ──

export const COMPLEX_JS_PATTERNS = [
  /<js>/i,
  /@js:/i,
  /java\.ajax/i,
  /source\.getKey/i,
  /source\.login/i,
  /\bcookie\b/i,
  /\bcache\b/i,
  /\beval\b/i,
  /Reload/i,
  /WebView/i,
];
