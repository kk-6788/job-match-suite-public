'use strict';
// 页面岗位提取器：招聘平台 / 公司官网 / 官网发现
// UMD：浏览器挂 root.MatchExtractors，Node module.exports
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatchExtractors = api;
})(typeof window !== 'undefined' ? window : globalThis, function extractorFactory() {
  'use strict';

  const nowISO = () => new Date().toISOString();
  const txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  const cut = (v, n) => String(v || '').trim().slice(0, n || 300);

  function absUrl(href, base) {
    if (!href) return '';
    try { return new URL(href, base).toString(); } catch { return ''; }
  }
  function isDetailUrl(url, source) {
    if (!url) return false;
    let u;try{u=new URL(url);}catch{return false;}
    if(u.protocol!=='https:'||u.username||u.password)return false;
    if (source === 'liepin') return /(^|\.)liepin\.com$/i.test(u.hostname)&&/^\/job\/\d+\.shtml$/i.test(u.pathname);
    if (source === 'boss') return /(^|\.)zhipin\.com$/i.test(u.hostname)&&/^\/job_detail\/[^/]+\.html$/i.test(u.pathname);
    if (source === 'zhilian') return u.hostname==='jobs.zhaopin.com'&&/^\/[^/]+\.htm[l]?$/i.test(u.pathname);
    if (source === '51job') return u.hostname==='jobs.51job.com'&&/^\/[^/]+\/\d+\.html$/i.test(u.pathname);
    if(source==='ncss')return /^(?:www\.)?ncss\.cn$/i.test(u.hostname)&&/^\/student\/jobs\/[a-zA-Z0-9]{6,40}\/detail\.html$/.test(u.pathname);
    if(source==='yingjiesheng')return u.hostname==='q.yingjiesheng.com'&&/^\/jobdetail\/\d+\.html$/.test(u.pathname);
    if (source === 'guopin') return /^(?:www\.)?iguopin\.com$/i.test(u.hostname)&&u.pathname==='/job/detail'&&/^\d{1,30}$/.test(u.searchParams.get('id')||'');
    if (source === 'yupao') return /^(?:www\.)?yupao\.com$/i.test(u.hostname)&&/^\/zhaogong\/\d+\/[a-z0-9_-]+\.html$/i.test(u.pathname);
    if (source === 'lagou') return /(^|\.)lagou\.com$/i.test(u.hostname)&&/^\/jobs\/\d+\.html$/i.test(u.pathname);
    if (source === 'shixiseng') return /(^|\.)shixiseng\.com$/i.test(u.hostname)&&/^\/intern\/inn_[a-z0-9]+\/?$/i.test(u.pathname);
    return false;
  }
  // 非岗位链接（登录/资讯/产品/首页/搜索等泛导航）
  const NOISE_RE = /login|signin|register|signup|logout|captcha|verify|about|news|article|product|help|faq|terms|privacy|home$|\/$|search|recommend|city\/|zhaopin\/|market|vip|service|download|app/i;

  function result(status, message, extra) {
    return Object.assign({ jobs: [], status, message: message || '' }, extra || {});
  }

  // ---------------- 猎聘 ----------------
  function extractLiepin(doc, pageUrl) {
    const jobs = [];
    // 详情页自身（URL 即 /job/数字.shtml）直接整页提取
    if (isDetailUrl(pageUrl, 'liepin')) {
      const scope = doc.querySelector('.jobDetailBox') || doc.body;
      if (scope) {
        const titleEl = scope.querySelector('.jobTitleBox [title]');
        const title = titleEl ? (txt(titleEl) || titleEl.getAttribute('title')) : '';
        if (title) {
          const spans = scope.querySelectorAll('.jobTitleBox span');
          let salary = '', experience = '', education = '';
          for (const el of scope.querySelectorAll('.job-sal, [class*="salary"], span')) {
            const t = txt(el);
            if (!t || t === title) continue;
            if (!salary && /k|千|万|元|面议/i.test(t) && /\d/.test(t) && t.length < 30) salary = t;
            else if (!experience && /年/.test(t) && /经验不限|\d/.test(t) && t.length < 20) experience = t;
            else if (!education && /(本科|大专|硕士|博士|学历|统招)/.test(t) && t.length < 20) education = t;
          }
          const companyEl = scope.querySelector('.companyName');
          jobs.push(mkJob({ title: cut(title, 100), company: cut(txt(companyEl), 100), city: cut(spans.length > 1 ? txt(spans[1]) : '', 60), salary: cut(salary, 40), experience: cut(experience, 30), education: cut(education, 30), url: pageUrl, source: 'liepin', description: cut(txt(scope.querySelector('.job-detail-text, [class*="job-desc"], [class*="job-detail"]')), 20000), sourceUrl: pageUrl }));
          return jobs;
        }
      }
    }
    // 入口：真实详情锚点（data-nick 或 /job/数字.shtml），搜索入口不算
    const anchors = doc.querySelectorAll('a[data-nick="job-detail-job-info"], a[href*="liepin.com/job/"], a[href^="/job/"], a[href^="https://www.liepin.com/job/"]');
    const seen = new Set();
    for (const a of anchors) {
      const url = absUrl(a.getAttribute('href'), pageUrl);
      if (!isDetailUrl(url, 'liepin') || seen.has(url)) continue;
      seen.add(url);
      // 卡片内正文提取（最近 jobDetailBox 或锚点自身）
      const scope = a.querySelector('.jobDetailBox') || (a.closest('.jobDetailBox') || a);
      const titleEl = scope.querySelector('.jobTitleBox [title]') || scope.querySelector('.jobTitleBox > span:first-child') || scope.querySelector('[class*="jobTitle"] [title]');
      const title = titleEl ? (txt(titleEl) || titleEl.getAttribute('title')) : '';
      if (!title) continue; // 无真 title 节点不造
      const spans = scope.querySelectorAll('.jobTitleBox span');
      const city = Array.from(spans).map(txt).find(t=>t&&t!=='【'&&t!=='】'&&t!==title&&/[-·]|市|区/.test(t)) || (spans.length>1?txt(spans[1]):'');
      let salary = '', experience = '', education = '';
      const infoEls = scope.querySelectorAll('.job-sal, [class*="salary"], span');
      for (const el of infoEls) {
        const t = txt(el);
        if (!t || t === title || t === city) continue;
        if (!salary && /k|千|万|元|面议/i.test(t) && /\d/.test(t) && t.length < 30) salary = t;
        else if (!experience && /年/.test(t) && /经验不限|\d/.test(t) && t.length < 20) experience = t;
        else if (!education && /(本科|大专|硕士|博士|学历|统招)/.test(t) && t.length < 20) education = t;
      }
      const companyEl = scope.querySelector('.companyName') || scope.querySelector('[class*="company"] [class*="name"]');
      jobs.push(mkJob({ title: cut(title, 100), company: cut(txt(companyEl), 100), city: cut(city, 60), salary: cut(salary, 40), experience: cut(experience, 30), education: cut(education, 30), url, source: 'liepin', description: cut(txt(scope.querySelector('.job-detail-text, [class*="job-desc"], [class*="job-detail"]')), 20000), sourceUrl: pageUrl }));
    }
    return jobs;
  }

  // ---------------- BOSS ----------------
  function extractBoss(doc, pageUrl) {
    const jobs = [];
    const anchors = doc.querySelectorAll('a[href*="/job_detail/"]');
    const seen = new Set();
    for (const a of anchors) {
      const url = absUrl(a.getAttribute('href'), pageUrl);
      if (!isDetailUrl(url, 'boss') || seen.has(url)) continue;
      const scope = a.closest('.job-card-wrapper, .job-card-box, .job-card-wrap') || a.querySelector('.job-card-wrapper') || a;
      const nameEl = a.matches('.job-name') ? a : scope.querySelector('.job-name, [class*="job-name"]');
      const title = readable(nameEl);
      if (!title) continue;
      seen.add(url);
      const salaryEl = scope.querySelector('.salary, [class*="salary"]');
      const salary = readable(salaryEl);
      const company = readable(scope.querySelector('.company-name, [class*="company-name"], .boss-name'));
      const city = readable(scope.querySelector('.job-area, [class*="job-area"], .company-location'));
      const tags = [...scope.querySelectorAll('.tag-list li')].map(readable).filter(Boolean);
      const education = tags.find(t => /^(?:初中及以下|高中|中专|大专|本科|硕士|博士|学历不限)$/.test(t)) || '';
      const experience = tags.find(t => /^(?:经验不限|应届生|在校生|应届毕业生|\d+(?:-\d+)?年(?:以上|以内)?)$/.test(t)) || '';
      jobs.push(mkJob({ title: cut(title, 100), company: cut(company, 100), city: cut(city, 60), salary: cut(salary, 40), education, experience,
        url, source: 'boss', description: cut(tags.join(' ') || txt(scope.querySelector('.job-card-body, .info-desc')), 20000),
        availability: txt(salaryEl) && !salary ? '薪资使用特殊字体，请在详情页确认' : '', sourceUrl: pageUrl }));
    }
    return jobs;
  }

  // ---------------- 智联 ----------------
  function extractZhilian(doc, pageUrl) {
    const jobs = [];
    const anchors = doc.querySelectorAll('a[href*="jobs.zhaopin.com/"]');
    const seen = new Set();
    for (const a of anchors) {
      const url = absUrl(a.getAttribute('href'), pageUrl);
      if (!isDetailUrl(url, 'zhilian') || seen.has(url)) continue;
      seen.add(url);
      const scope = a.closest('.joblist-box__item, .joblist-box') || a;
      const nameEl = scope.querySelector('.iteminfo__line1__jobname, [class*="jobname"], .jobinfo__name');
      const title = txt(nameEl);
      if (!title) continue;
      const salary = txt(scope.querySelector('.iteminfo__line1__salary, [class*="salary"]'));
      const company = txt(scope.querySelector('.iteminfo__line2, [class*="companyname"], [class*="company__name"]'));
      const city = txt(scope.querySelector('[class*="city"], .iteminfo__line2__jobinfo'));
      jobs.push(mkJob({ title: cut(title, 100), company: cut(company, 100), city: cut(city, 60), salary: cut(salary, 40), url, source: 'zhilian', description: '', sourceUrl: pageUrl }));
    }
    return jobs;
  }

  // ---------------- 前程无忧 ----------------
  function valid51jobLink(job){
    if(!job||typeof job.id!=='string'||!/^\d{1,15}$/.test(job.id)||typeof job.url!=='string'||job.url.length>2048||!isDetailUrl(job.url,'51job'))return false;
    return new URL(job.url).pathname.split('/').pop()===job.id+'.html';
  }
  function extract51job(doc, pageUrl, publicLinks) {
    const jobs=[],seen=new Set();
    // 新版卡片无锚点；编号来自公开 DOM，详情链接来自同一渲染列表的 jobHref。
    // 不再拼接旧移动路由；无法拿到当前真实链接时不产生岗位。
    const links=new Map((Array.isArray(publicLinks)?publicLinks:[]).slice(0,50).filter(valid51jobLink).map(j=>[j.id,j.url]));
    for(const scope of doc.querySelectorAll('.joblist-item-job, .j_joblist .e')){
      const title=txt(scope.querySelector('.jname, .j_job_title'));
      if(!title)continue;
      let meta={};try{meta=JSON.parse(scope.getAttribute('sensorsdata')||'{}')||{};}catch{}
      const anchor=[...scope.querySelectorAll('a[href]')].find(a=>isDetailUrl(absUrl(a.getAttribute('href'),pageUrl),'51job'));
      const id=String(meta.jobId||'');
      const url=anchor?absUrl(anchor.getAttribute('href'),pageUrl):links.get(id)||'';
      if(!url||seen.has(url))continue;seen.add(url);
      jobs.push(mkJob({title:cut(title,100),company:cut(txt(scope.querySelector('.cname,.cname a')),100),
        city:cut(txt(scope.querySelector('.area,.d.at span:first-child')),60),salary:cut(txt(scope.querySelector('.sal,.sal span')),40),
        education:cut(meta.jobDegree,30),experience:cut(meta.jobYear,30),
        description:cut([...scope.querySelectorAll('.tag')].map(txt).join(' '),20000),
        url,source:'51job',sourceUrl:pageUrl}));
    }
    return jobs;
  }

  function public51jobLinks(){
    // 只读当前岗位组件的 joblist；仅返回公开职位编号与详情链接，不返回 HR/账号字段。
    const out=[],seen=new Set();
    for(const card of document.querySelectorAll('.joblist-item-job')){
      let node=card;
      for(let depth=0;node&&depth<6;depth++,node=node.parentElement){
        let list;try{list=node.__vue__?.$props?.joblist;}catch{continue;}
        if(!Array.isArray(list)||seen.has(list))continue;seen.add(list);
        for(const job of list.slice(0,50)){
          if(typeof job?.jobId==='string'&&job.jobId.length<=15&&typeof job?.jobHref==='string'&&job.jobHref.length<=2048)out.push({id:job.jobId,url:job.jobHref});
        }
        if(out.length>=50)return out.slice(0,50);
      }
    }
    return out;
  }

  function extractGuopin(doc,pageUrl,publicLinks){
    const jobs=[],seen=new Set(),cards=[...doc.querySelectorAll('.job-card')];
    for(const link of Array.isArray(publicLinks)?publicLinks:[]){
      if(!Number.isInteger(link.index)||link.index<0||!isDetailUrl(link.url,'guopin')||seen.has(link.url))continue;
      const card=cards[link.index];if(!card)continue;
      const title=readable(card.querySelector('.job-name'));if(!title||title!==link.title)continue;
      seen.add(link.url);
      const tags=[...card.querySelectorAll('.job-info .tag-item')].map(readable);
      jobs.push(mkJob({title:cut(title,100),company:cut(readable(card.querySelector('.company-name')),100),
        city:cut(readable(card.querySelector('.job-district')).replace(/[「」]/g,''),60),salary:cut(readable(card.querySelector('.job-salary')),40),
        education:tags.find(t=>/^(?:学历不限|高中|中专|大专|本科|硕士|博士)$/.test(t))||'',
        experience:tags.find(t=>/^(?:经验不限|应届生|在校生|\d+(?:-\d+)?年(?:以上|以内)?)$/.test(t))||'',
        description:cut(tags.join(' ')+' '+readable(card.querySelector('.job-tag')),20000),url:link.url,source:'guopin',sourceUrl:pageUrl}));
    }return jobs;
  }

  // 鱼泡公开搜索卡片；只收录页面给出的真实详情链接。
  function extractYupao(doc,pageUrl){
    const jobs=[],seen=new Set();
    for(const anchor of doc.querySelectorAll('a[href*="/zhaogong/"]')){
      const url=absUrl(anchor.getAttribute('href'),pageUrl);
      if(!isDetailUrl(url,'yupao')||seen.has(url))continue;
      const scope=anchor.closest('.accca');
      if(!scope)continue;
      const title=readable(anchor.querySelector('.acccc'));
      if(!title)continue;
      seen.add(url);
      const tags=[...anchor.querySelectorAll('.accci > span')].map(readable).filter(Boolean);
      const salaryEl=anchor.querySelector('.accch'),salary=readable(salaryEl);
      jobs.push(mkJob({title:cut(title,100),company:cut(readable(scope.querySelector('a[href*="/qiye/"]')),100),
        city:cut(readable(scope.querySelector('.accdi')),60),salary:cut(salary,40),
        education:tags.find(t=>/^(?:学历不限|初中及以下|高中|中专\/中技|大专|本科|硕士|博士)$/.test(t))||'',
        experience:tags.find(t=>/^(?:经验不限|在校\/应届|\d+(?:-\d+)?年(?:以上|以下|以内)?)$/.test(t))||'',
        description:cut(tags.join(' '),20000),url,source:'yupao',sourceUrl:pageUrl,
        availability:txt(salaryEl)&&!salary?'薪资使用特殊字体，请在详情页确认':''}));
    }
    return jobs;
  }

  // ---------------- 拉勾（兼容适配，登录后真实页面待验证） ----------------
  function extractLagou(doc,pageUrl){
    const jobs=[],seen=new Set();
    for(const anchor of doc.querySelectorAll('a[href*="/jobs/"]')){
      const url=absUrl(anchor.getAttribute('href'),pageUrl);
      if(!isDetailUrl(url,'lagou')||seen.has(url))continue;
      const scope=anchor.closest('.con_list_item,.position_list_item,[class*="item__"]')||anchor;
      const title=txt(anchor.querySelector('h3,[class*="p-name"],.position-name'))||txt(anchor);
      if(!title||title.length>100)continue;seen.add(url);
      jobs.push(mkJob({title,company:cut(txt(scope.querySelector('.company_name a,[class*="company-name"]')),100),
        salary:cut(txt(scope.querySelector('.money,[class*="money"]')),40),
        city:cut(txt(scope.querySelector('.add em,[class*="position-add"]')),60),
        description:cut(txt(scope.querySelector('.li_b_l,.list_item_bot,[class*="ir___"]')),20000),
        url,source:'lagou',sourceUrl:pageUrl}));
    }
    return jobs;
  }

  // ---------------- 实习僧 ----------------
  const PRIVATE_GLYPH=/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;
  function readable(el){const value=txt(el);return PRIVATE_GLYPH.test(value)?'':value;}
  function extractShixiseng(doc,pageUrl){
    const jobs=[],seen=new Set();
    for(const anchor of doc.querySelectorAll('a[href*="/intern/inn_"]')){
      const url=absUrl(anchor.getAttribute('href'),pageUrl);
      if(!isDetailUrl(url,'shixiseng')||seen.has(url))continue;
      const scope=anchor.closest('.intern-wrap')||anchor;
      const title=readable(anchor);if(!title)continue;seen.add(url);
      const salaryEl=scope.querySelector('.day'),salary=readable(salaryEl);
      jobs.push(mkJob({title:cut(title,100),company:cut(readable(scope.querySelector('.intern-detail__company .title')),100),
        city:cut(readable(scope.querySelector('.intern-detail__job .city')),60),salary:cut(salary,40),
        description:cut([...scope.querySelectorAll('.intern-label,.company-label')].map(readable).filter(Boolean).join(' '),20000),
        availability:txt(salaryEl)&&!salary?'薪资使用特殊字体，请在详情页确认':'',
        url,source:'shixiseng',sourceUrl:pageUrl}));
    }
    return jobs;
  }

  // ---------------- 公司官网 JobPosting JSON-LD ----------------
  function extractJobPosting(json, pageUrl, out) {
    if (Array.isArray(json)) { json.forEach(x => extractJobPosting(x, pageUrl, out)); return; }
    if (!json || typeof json !== 'object') return;
    if (Array.isArray(json['@graph'])) { json['@graph'].forEach(x => extractJobPosting(x, pageUrl, out)); return; }
    if (json['@type'] !== 'JobPosting' && !(Array.isArray(json['@type'])&&json['@type'].includes('JobPosting'))) return;
    const title = cut(json.title || json.name, 100);
    if (!title) return;
    const org = json.hiringOrganization || {};
    const company = cut(org.name, 100);
    const loc = json.jobLocation || {};
    const addr = loc.address || (Array.isArray(loc) && loc[0] && loc[0].address) || {};
    const city = cut(addr.addressLocality || addr.addressRegion || '', 60);
    let salary = '';
    const bs = Array.isArray(json.baseSalary) ? json.baseSalary[0] : json.baseSalary;
    if (bs) {
      const val = bs.value || bs;
      const min = val.minValue, max = val.maxValue;
      const unit = String(val.unitText || '').toUpperCase();
      if (min != null || max != null) salary = [min, max].filter(v => v != null).join('-') + (unit === 'MONTH' ? '元/月' : unit === 'YEAR' ? '元/年' : unit === 'HOUR' ? '元/时' : '');
      else if (val.value != null) salary = val.value + (unit === 'MONTH' ? '元/月' : unit === 'YEAR' ? '元/年' : '');
      const currency=String(bs.currency||'').toUpperCase();
      if(salary&&!['CNY','RMB'].includes(currency))salary=currency?salary.replace(/元/g,currency):salary.replace(/元/g,'')+'（币种未标）';
    }
    const vt = json.validThrough ? new Date(json.validThrough) : null;
    const expired = !!(vt && !isNaN(vt) && vt.getTime() < Date.now());
    out.push(mkJob({
      title, company, city, salary,
      url: absUrl(json.url || json.mainEntityOfPage?.['@id'] || pageUrl,pageUrl), source: 'company', sourceUrl: pageUrl,
      description: cut(typeof json.description === 'string' ? json.description.replace(/<[^>]+>/g, ' ') : '', 20000),
      postedAt: json.datePosted || '', validThrough: json.validThrough || '', expired
    }));
  }
  function extractCompany(doc, pageUrl) {
    const jobs = [];
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { extractJobPosting(JSON.parse(txt(s)), pageUrl, jobs); } catch { /* 非 JSON 忽略 */ }
    }
    if (jobs.length) return jobs;
    // 兜底：页面上的真实职位相关链接（排除登录/资讯/产品/首页/搜索）
    const anchors = doc.querySelectorAll('a[href]');
    const seen = new Set();
    for (const a of anchors) {
      const href = absUrl(a.getAttribute('href'), pageUrl);
      if (!href || seen.has(href)) continue;
      if (!/^https:/i.test(href)) continue;
      const title = txt(a);
      if (!title || title.length > 80) continue;
      if (/^(招聘|职位|岗位|社会招聘|校园招聘|人才招聘|加入我们|联系我们|职位搜索|查看全部职位|Careers|Jobs|Search Jobs|Join us)$/i.test(title)) continue;
      let target;try{target=new URL(href);}catch{continue;}
      const hasDetailPath=/\/(?:jobs?|positions?|careers?|recruit(?:ment)?|vacanc(?:y|ies))\/[^/]+/i.test(target.pathname);
      const hasDetailId=[...target.searchParams].some(([key,value])=>/^(?:id|jobid|positionid|postid|requisitionid)$/i.test(key)&&value);
      if(!hasDetailPath&&!hasDetailId)continue;
      if (NOISE_RE.test(href) && !/job|career|recruit|hiring|position| vacancy/i.test(href)) continue;
      if (!/job|career|recruit|hiring|position|岗位|招聘|职位/i.test(href + ' ' + title)) continue;
      if (/登录|注册|首页|新闻|产品|资讯|更多/.test(title) && !/job|career|招聘/i.test(href)) continue;
      seen.add(href);
      jobs.push(mkJob({ title: cut(title, 100), company: '', city: '', url: href, source: 'company', sourceUrl: pageUrl, availability: '链接级候选，字段未解析' }));
    }
    return jobs.slice(0, 50);
  }

  // ---------------- 公司发现（Bing 列表）----------------
  function extractDiscovery(doc, pageUrl) {
    const candidates = [];
    const seen = new Set();
    for (const a of doc.querySelectorAll('.b_algo h2 a[href], li h2 a[href], a[href^="http"]')) {
      let url = absUrl(a.getAttribute('href'), pageUrl);
      const title = txt(a);
      try{const link=new URL(url);if(/(^|\.)bing\.com$/.test(link.hostname)&&link.pathname==='/ck/a'){const encoded=link.searchParams.get('u');if(encoded?.startsWith('a1'))url=atob(encoded.slice(2).replace(/-/g,'+').replace(/_/g,'/'));}}catch{}
      if (!url || !title || !/^https:/i.test(url) || seen.has(url)) continue;
      if (/bing\.com|microsoft\.com|go\.microsoft/i.test(url)) continue;
      seen.add(url);
      candidates.push({ url: cut(url, 2048), title: cut(title, 150) });
      if (candidates.length >= 20) break;
    }
    return { jobs: [], candidates };
  }

  function mkJob(o) { return Object.assign({ education: '', experience: '', description: '', collectedAt: nowISO(), availability: '' }, o); }

  // 登录/验证码检测（仅当无岗位时）
  function detectGate(doc) {
    const body = txt(doc.body).slice(0, 4000);
    if (doc.querySelector('.captcha, [class*="captcha"], [class*="verify-wrap"], #captcha') ||
      /安全验证|滑动验证|拖动滑块|人机验证|访问验证|请按住滑块|verify the captcha/i.test(body)) return 'verification';
    if (doc.querySelector('.qrcode-login, [class*="login-"], .login-page, form[action*="login"], [ka*="login"]') ||
      /请登录|扫码登录|登录后查看|微信扫码|qq登录|sign in to continue/i.test(body)) return 'need-login';
    return '';
  }

  function extractNcss(doc,pageUrl){
    const jobs=[],seen=new Set();
    for(const card of doc.querySelectorAll('.jobList')){
      const a=card.querySelector('.first-ul h5 a[href]'),url=absUrl(a?.getAttribute('href'),pageUrl),title=readable(a);
      if(!title||!isDetailUrl(url,'ncss')||seen.has(url))continue;
      // 公告包含多个岗位，不能冒充一个具体职位。
      if(card.getAttribute('data-type')==='01'||/招聘.*公告|招聘公告$/.test(title))continue;
      seen.add(url);const info=[...card.querySelectorAll('.first-ul>li')].map(readable);
      jobs.push(mkJob({title:cut(title,100),company:cut(readable(card.querySelector('.company-name')),100),city:cut((info[1]||'').split('|')[0],60),education:cut((info[0]||'').split('|')[0],30),salary:cut(readable(card.querySelector('.salary-money')),40),experience:'',description:cut(info.join('；'),4000),availability:'列表地区可能仅到省；毕业届次、专业和完整要求请查看详情',url,source:'ncss',sourceUrl:pageUrl}));
    }return jobs;
  }
  function extractYingjiesheng(doc,pageUrl){
    // 首页推荐不能替代关键词搜索结果。
    try{if(new URL(pageUrl).hostname==='www.yingjiesheng.com'&&new URL(pageUrl).pathname==='/')return [];}catch{return [];}
    const jobs=[],seen=new Set();
    for(const card of doc.querySelectorAll('a.job-list-item[href]')){
      const url=absUrl(card.getAttribute('href'),pageUrl),title=readable(card.querySelector('.job-list-item-title-t'));
      if(!title||!isDetailUrl(url,'yingjiesheng')||seen.has(url))continue;seen.add(url);
      const tags=[...card.querySelectorAll('.job-list-item-tagbox>span')].map(readable);
      jobs.push(mkJob({title:cut(title,100),company:cut(readable(card.querySelector('.coname')),100),city:cut(readable(card.querySelector('.job-list-item-com-area')),60),salary:cut(readable(card.querySelector('.job-list-item-title-m')),40),education:tags.find(t=>/^(?:初中及以下|中技\/中专|高中|大专|本科|硕士|博士|学历不限)$/.test(t))||'',experience:tags.find(t=>/^(?:无需经验|经验不限|在校生\/应届生|\d+(?:-\d+)?年(?:及以上|以上)?)$/.test(t))||'',description:tags.join('；'),url,source:'yingjiesheng',sourceUrl:pageUrl}));
    }return jobs;
  }

  const SOURCES = { ncss:extractNcss,yingjiesheng:extractYingjiesheng, guopin:extractGuopin, yupao:extractYupao, boss: extractBoss, liepin: extractLiepin, zhilian: extractZhilian, '51job':extract51job, lagou:extractLagou, shixiseng:extractShixiseng };
  const SOURCE_NAMES = new Set([...Object.keys(SOURCES), 'company', 'discovery']);

  function extract(doc, source, url, publicLinks) {
    if (!SOURCE_NAMES.has(source)) throw new Error('未知来源: ' + source);
    if (!doc || !doc.querySelectorAll) throw new Error('需要 DOM document');
    url = String(url || '');

    if (source === 'discovery') {
      const r = extractDiscovery(doc, url);
      return result('ok', '发现候选公司链接 ' + r.candidates.length + ' 条（仅 candidates，不产生 jobs）', { candidates: r.candidates });
    }

    const jobs = source === 'company' ? extractCompany(doc, url) : SOURCES[source](doc, url, publicLinks);
    if (jobs.length) return result('ok', '提取到 ' + jobs.length + ' 个岗位', { jobs });
    if(/暂无相关|没有找到|未找到.*职位|暂无.*岗位/.test(txt(doc.body)))return result('empty','当前页面没有匹配岗位');
    if(/加载中|请稍候|正在加载/.test(txt(doc.body)))return result('timeout','页面仍在加载，可打开来源核对后继续读取');
    // 无岗位时才判 gate
    const gate = detectGate(doc);
    if (gate) return result(gate, gate === 'need-login' ? '页面要求登录，未发现岗位，未造数据' : '页面要求安全验证，未发现岗位，未造数据');
    return result('empty', '页面未发现岗位详情或岗位卡片', { jobs: [] });
  }

  // ---------------- buildScript：固定本地提取逻辑（注入 BrowserWindow executeJavaScript 用） ----------------
  function buildScript(source, publicLinks) {
    if (!SOURCE_NAMES.has(source)) throw new Error('未知来源: ' + source);
    const links=source==='guopin'&&Array.isArray(publicLinks)?publicLinks.slice(0,10).filter(j=>j&&Number.isInteger(j.index)&&isDetailUrl(j.url,'guopin')).map(j=>({index:j.index,url:j.url,title:String(j.title||'').slice(0,100)})):source==='51job'&&Array.isArray(publicLinks)?publicLinks.slice(0,50).filter(valid51jobLink).map(j=>({id:j.id,url:j.url})):[];
    // 序列化本文件提取逻辑，注入端用真实 document 调用 MatchExtractors.extract
    return '('+extractorFactory.toString()+')().extract(document,'+JSON.stringify(source)+',location.href,'+JSON.stringify(links)+')';
  }

  return { extract, buildScript, build51jobLinksScript:()=> '('+public51jobLinks.toString()+')()', mkJob, isDetailUrl, absUrl };
});
