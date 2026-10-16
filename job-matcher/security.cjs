'use strict';
// 岗位匹配安全工具（Node 可测，与 BrowserWindow 无关）
'use strict';

const MAX_URL_LEN = 2048;
const {isIP}=require('node:net');

function isPrivateIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some(x => x > 255)) return true; // 非法段视为不安全
  if (a === 0 || a === 10 || a === 127) return true;               // 本机/私网/环回
  if (a === 169 && b === 254) return true;                          // 链路本地（含云元数据 169.254.169.254）
  if (a === 172 && b >= 16 && b <= 31) return true;                 // 私网
  if (a === 192 && b === 168) return true;                          // 私网
  if (a === 100 && b >= 64 && b <= 127) return true;                // CGNAT
  if (a >= 224) return true;                                        // 组播/保留
  return false;
}

function isPrivateIPv6(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (/^f[cd]/.test(h)) return true;   // fc00::/7 唯一本地
  if (/^fe[89ab]/.test(h)) return true; // fe80::/10 链路本地
  if (/^::ffff:(\d{1,3}\.){3}\d{1,3}$/.test(h)) return isPrivateIPv4(h.slice(7)); // IPv4 映射
  return false;
}

function isLocalHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home')) return true;
  if (isPrivateIPv4(h)) return true;
  if (h.includes(':') || /^\[/.test(host)) return isPrivateIPv6(host.replace(/^\[|\]$/g, ''));
  return false;
}

function safePublicURL(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LEN) return false;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (isIP(u.hostname.replace(/^\[|\]$/g,'')) || !u.hostname.includes('.')) return false;
  if (isLocalHost(u.hostname)) return false;
  return true;
}

// 二级主域（最后两段；处理常见两段式后缀）
const TWO_PART_SUFFIXES = new Set(['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.hk', 'com.tw', 'co.jp', 'co.uk']);
function registrableDomain(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join('.');
  if (TWO_PART_SUFFIXES.has(last2)) return parts.slice(-3).join('.');
  return last2;
}

// 来源域内导航：HTTPS，主域与来源一致（子域可），禁止换到非来源平台
function allowedSourceURL(url, source, initialUrl) {
  if (!safePublicURL(url) || !safePublicURL(initialUrl)) return false;
  try {
    const a = registrableDomain(new URL(url).hostname);
    const b = registrableDomain(new URL(initialUrl).hostname);
    return a === b;
  } catch { return false; }
}

// BOSS 城市代码（已核对，其余未知不假造）
const BOSS_CITY_CODES = {
  '福州': '101230100', '北京': '101010100', '上海': '101020100', '广州': '101280100',
  '深圳': '101280600', '杭州': '101210100', '成都': '101270100'
};
const MAX_QUERY_LEN = 120;

function clampQuery(s) {
  return String(s || '').replace(/[\r\n\t#&=]+/g, ' ').trim().slice(0, MAX_QUERY_LEN);
}

// sourceURL：按来源构造已核对目标岗位/城市搜索入口；未知城市不带假代码
function sourceURL(source, prefs) {
  prefs = prefs && typeof prefs === 'object' ? prefs : {};
  const role = clampQuery(prefs.targetRole || prefs.role || '');
  const city = String(prefs.city || '').trim();
  const q = role ? 'query=' + encodeURIComponent(role) : '';
  let base;
  switch (source) {
    case 'boss': {
      const code = BOSS_CITY_CODES[city];
      base = 'https://www.zhipin.com/web/geek/job?' + q + (code ? '&city=' + code : '');
      break;
    }
    case 'liepin':
      base = 'https://www.liepin.com/zhaopin/?key=' + encodeURIComponent(role);
      break;
    case 'zhilian':
      base = 'https://sou.zhaopin.com/?kw=' + encodeURIComponent(role);
      break;
    case '51job': {
      const codes=require('./51job-city-codes.json');
      const key=city.replace(/市$/,''),code=Object.hasOwn(codes,key)?codes[key]:'';
      base='https://we.51job.com/pc/search?keyword='+encodeURIComponent(role)+'&searchType=2'+(code?'&jobArea='+code:'');
      break;
    }
    case 'lagou':
      base='https://www.lagou.com/wn/jobs?kd='+encodeURIComponent(role)+(city?'&city='+encodeURIComponent(city.replace(/市$/,'')):'');
      break;
    case 'shixiseng':
      base='https://www.shixiseng.com/interns?keyword='+encodeURIComponent(role)+(city?'&city='+encodeURIComponent(city.replace(/市$/,'')):'');
      break;
    case 'ncss':
      base='https://www.ncss.cn/student/jobs/index.html';
      break;
    case 'yingjiesheng':
      base='https://www.yingjiesheng.com/';
      break;
    case 'guopin':
      base='https://www.iguopin.com/job/list?keyword='+encodeURIComponent(role);
      break;
    case 'yupao':
      base='https://www.yupao.com/topic/a1c0/?keywords='+encodeURIComponent(role.slice(0,50));
      break;
    case 'discovery':
      base = 'https://www.bing.com/search?q=' + encodeURIComponent([role, city, '招聘'].filter(Boolean).join(' ').slice(0, MAX_QUERY_LEN));
      break;
    default:
      throw new Error('未知来源: ' + source);
  }
  base = base.replace(/[?&]+$/, '');
  if (base.length > MAX_URL_LEN) base = base.slice(0, MAX_URL_LEN);
  return base;
}

function safeExternalURL(url) { return safePublicURL(url); }

module.exports = { safePublicURL, allowedSourceURL, sourceURL, safeExternalURL, isLocalHost, registrableDomain, BOSS_CITY_CODES };
