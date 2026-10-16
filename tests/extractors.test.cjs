'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { JSDOM } = require('jsdom');
const Extractors = require(path.join(__dirname, '..', 'job-matcher', 'extractors.js'));

function dom(html) { return new JSDOM(html).window.document; }

test('真实猎聘结构：jobDetailBox / jobTitleBox / companyName（2026-10-15 观察）', () => {
  const doc = dom(`<!doctype html><html><body>
    <div class="jobDetailBox">
      <div class="jobTitleBox">
        <span title="招聘新媒体运营担当">新媒体运营担当</span>
        <span>上海-静安区</span>
      </div>
      <span class="job-sal">12-16k·13薪</span>
      <span>1-3年</span>
      <span>统招本科</span>
      <div class="companyName">某某传媒有限公司</div>
      <div class="job-detail-text">岗位职责……</div>
    </div></body></html>`);
  const r = Extractors.extract(doc, 'liepin', 'https://www.liepin.com/job/1986041399.shtml?tracking=xyz');
  assert.strictEqual(r.status, 'ok');
  assert.ok(r.jobs.length >= 1, '实际=' + r.jobs.length);
  const j = r.jobs[0];
  assert.strictEqual(j.title, '新媒体运营担当');
  assert.strictEqual(j.company, '某某传媒有限公司');
  assert.strictEqual(j.city, '上海-静安区');
  assert.strictEqual(j.salary, '12-16k·13薪');
  assert.strictEqual(j.source, 'liepin');
  assert.strictEqual(j.url, 'https://www.liepin.com/job/1986041399.shtml?tracking=xyz');
  assert.ok(j.collectedAt);
  assert.ok(j.availability !== undefined);
});

test('猎聘列表页 a[data-nick="job-detail-job-info"] 为详情入口；搜索入口不算岗位', () => {
  const doc = dom(`<!doctype html><html><body>
    <a data-nick="job-detail-job-info" href="https://www.liepin.com/job/111.shtml?tracking=1">
      <div class="jobDetailBox">
        <div class="jobTitleBox"><span title="运营经理">运营经理</span><span>北京-朝阳区</span></div>
        <span>15-25k</span><span>3-5年</span>
        <div class="companyName">猎头推荐公司</div>
      </div>
    </a>
    <a href="/search/?key=运营">搜索入口</a>
    <a href="https://www.liepin.com">首页</a>
  </body></html>`);
  const r = Extractors.extract(doc, 'liepin', 'https://www.liepin.com/zhaopin/');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  assert.strictEqual(r.jobs[0].title, '运营经理');
  assert.strictEqual(r.jobs[0].sourceUrl, 'https://www.liepin.com/zhaopin/');
});

test('BOSS 直聘：a[href*="/job_detail/"] 最近 .job-card-wrapper', () => {
  const doc = dom(`<!doctype html><html><body>
    <a href="https://www.zhipin.com/job_detail/abc123.html">
      <div class="job-card-wrapper">
        <span class="job-name">社群运营</span>
        <span class="salary">8-12K</span>
        <span class="company-name">某某网络科技</span>
        <span class="job-area">杭州·滨江区</span>
      </div>
    </a>
    <a href="https://www.zhipin.com/web/geek/recommend?ka=header-home">导航推荐</a>
  </body></html>`);
  const r = Extractors.extract(doc, 'boss', 'https://www.zhipin.com/hangzhou/');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  const j = r.jobs[0];
  assert.strictEqual(j.title, '社群运营');
  assert.strictEqual(j.salary, '8-12K');
  assert.strictEqual(j.company, '某某网络科技');
  assert.strictEqual(j.city, '杭州·滨江区');
});

test('智联招聘：a[href*="jobs.zhaopin.com/"] + .joblist-box__item', () => {
  const doc = dom(`<!doctype html><html><body>
    <div class="joblist-box">
      <div class="joblist-box__item">
        <a href="https://jobs.zhaopin.com/SH123456789.htm">
          <span class="iteminfo__line1__jobname">电商运营</span>
          <span class="iteminfo__line1__salary">10-15千</span>
        </a>
        <div class="iteminfo__line2">上海某某电商有限公司</div>
      </div>
    </div></body></html>`);
  const r = Extractors.extract(doc, 'zhilian', 'https://sou.zhaopin.com/?jl=538&kw=运营');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  assert.strictEqual(r.jobs[0].title, '电商运营');
  assert.strictEqual(r.jobs[0].company, '上海某某电商有限公司');
});

test('公司官网 JobPosting JSON-LD（@graph/数组/baseSalary/validThrough 过期）', () => {
  const doc = dom(`<!doctype html><html><head><script type="application/ld+json">
  {"@graph":[{"@type":"Organization","name":"未来科技"},{"@type":"JobPosting",
    "title":"产品经理","hiringOrganization":{"name":"未来科技有限公司"},
    "jobLocation":{"address":{"addressLocality":"深圳","addressRegion":"广东"}},
    "baseSalary":{"value":{"minValue":20000,"maxValue":30000,"unitText":"MONTH"}},
    "description":"负责产品规划","datePosted":"2026-10-01"}]}</script></head><body></body></html>`);
  const r = Extractors.extract(doc, 'company', 'https://careers.example.com/jobs');
  assert.strictEqual(r.status, 'ok');
  assert.ok(r.jobs.length >= 1);
  const j = r.jobs[0];
  assert.strictEqual(j.title, '产品经理');
  assert.strictEqual(j.company, '未来科技有限公司');
  assert.strictEqual(j.city, '深圳');
  assert.ok(j.salary.includes('20000') && j.salary.includes('30000'), j.salary);
  assert.ok(!j.expired);
});

test('JobPosting validThrough 过期标记', () => {
  const doc = dom(`<!doctype html><html><head><script type="application/ld+json">
  [{"@type":"JobPosting","title":"旧岗位","hiringOrganization":{"name":"X"},
    "datePosted":"2026-08-01","validThrough":"2026-09-30"}]</script></head><body></body></html>`);
  const r = Extractors.extract(doc, 'company', 'https://x.com/careers');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  assert.strictEqual(r.jobs[0].expired, true);
});

test('登录/验证码页（无岗位）→ need-login / verification，不造岗位', () => {
  const login = Extractors.extract(dom('<div class="login-page"><div>请登录后查看</div><div class="qrcode-login"></div></div>'), 'boss', 'https://www.zhipin.com/');
  assert.strictEqual(login.status, 'need-login');
  assert.strictEqual(login.jobs.length, 0);
  const verif = Extractors.extract(dom('<div class="captcha">安全验证</div>'), 'boss', 'https://www.zhipin.com/');
  assert.strictEqual(verif.status, 'verification');
});

test('导航有「登录」但页面有岗位 → 正常提取，不误判 need-login', () => {
  const doc = dom(`<!doctype html><body>
    <header><a href="/login">登录</a> <a href="/register">注册</a></header>
    <a href="https://www.zhipin.com/job_detail/xx1.html">
      <div class="job-card-wrapper"><span class="job-name">视频剪辑</span>
      <span class="salary">7-10K</span><span class="company-name">某某文化</span></div></a>
  </body></html>`);
  const r = Extractors.extract(doc, 'boss', 'https://www.zhipin.com/shanghai/');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  assert.strictEqual(r.jobs[0].title, '视频剪辑');
});

test('空结果不造岗位：无详情锚点返回 empty', () => {
  const r = Extractors.extract(dom('<div>随便什么内容但没有岗位卡片</div>'), 'boss', 'https://www.zhipin.com/hangzhou/');
  assert.strictEqual(r.status, 'empty');
  assert.strictEqual(r.jobs.length, 0);
  assert.ok(r.message);
});

test('discovery 从 Bing 列表只返回 candidates 不产生 jobs', () => {
  const doc = dom(`<!doctype html><body>
    <li class="b_algo"><h2><a href="https://www.example.com/careers">example 招聘页面</a></h2></li>
    <li class="b_algo"><h2><a href="https://www.example2.com/hiring">example2 在招职位</a></h2></li>
  </body></html>`);
  const r = Extractors.extract(doc, 'discovery', 'https://www.bing.com/search?q=example+招聘');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 0);
  assert.ok(Array.isArray(r.candidates) && r.candidates.length >= 1);
  assert.ok(r.candidates.every(c => c.url && c.title));
});

test('通用公司页过滤资讯/首页等非职位链接，保留职位锚点', () => {
  const doc = dom(`<!doctype html><body>
    <a href="https://www.x.com/news/1">公司新闻</a>
    <a href="https://www.x.com/products">产品介绍</a>
    <a href="https://www.x.com/home">首页</a>
    <a href="https://www.x.com/job/123.html">高级运营经理</a>
  </body></html>`);
  const r = Extractors.extract(doc, 'company', 'https://www.x.com/careers');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.jobs.length, 1);
  assert.strictEqual(r.jobs[0].title, '高级运营经理');
});

test('buildScript 返回固定本地提取逻辑字符串，不含 eval/new Function', () => {
  const s = Extractors.buildScript('boss');
  assert.strictEqual(typeof s, 'string');
  assert.ok(s.length > 100);
  assert.ok(!/eval|new Function|fetch\(|XMLHttpRequest/.test(s), '不得包含动态执行或网络请求');
  const s2 = Extractors.buildScript('liepin');
  assert.ok(s2.includes('liepin') || s2.includes('LIEPIN'));
});

test('未知来源 extract 抛错', () => {
  assert.throws(() => Extractors.extract(dom('<div></div>'), 'weibo', 'https://x.com'));
});
