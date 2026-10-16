'use strict';
// ai-rerank 测试：全部用 mock fetch，不触网
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const AI = require(path.join(__dirname, '..', 'job-matcher', 'ai-rerank.cjs'));

const LOCAL_CFG = { baseUrl: 'http://127.0.0.1:1234/v1', model: 'test-model' };
const CLOUD_CFG = { baseUrl: 'https://api.example.com/v1', model: 'test-model', apiKey: 'sk-test-placeholder' };

function okResponse(obj) {
  const body = {
    choices: [{ message: { role: 'assistant', content: JSON.stringify(obj) } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// 组装合法的模型输出（evidence 缺省 = 空数组，会自动补 unknowns 提示）
function modelOk(payload, items) {
  const list = items || payload.jobs.map(j => ({
    id: j.id, score: 50, summary: 'ok', strengths: ['a'], gaps: [], unknowns: [], evidence: [],
  }));
  return { items: list };
}

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  fn.calls = calls;
  return fn;
}

const sampleResume = {
  basic: { name: '张三', phone: '13800000000', email: 'candidate@example.test', job: '前端开发' },
  work: [{ company: 'A公司', position: '前端', start: '2022.7', end: '2024.6', desc: '负责页面开发，邮箱 candidate@example.test 电话13800000000' }],
  proj: [{ name: '后台系统', role: '负责人', desc: '用 React 重构' }],
  summary: '两年前端经验，身份证见附件',
};

const sampleProfile = { targetRole: '前端', skills: ['React'] };

test('精排保留教育专业和毕业日期，教育附加隐私字段不发送',()=>{
  const payload=AI.preparePayload({resume:{edu:[{school:'测试学校',major:'市场营销',degree:'本科',start:'2018.09',end:'2022.06',phone:'13800000000'}]}});
  assert.deepStrictEqual(payload.resume.edu,[{major:'市场营销',degree:'本科',start:'2018.09',end:'2022.06'}]);
  assert.ok(!JSON.stringify(payload).includes('测试学校'));
  assert.ok(!JSON.stringify(payload).includes('13800000000'));
});

test('DeepSeek 官方接口关闭默认思考，其他兼容服务不增加专用参数', async () => {
  const payload=AI.preparePayload({jobs:[]});
  for(const baseUrl of ['https://api.deepseek.com','https://api.deepseek.com/v1','https://api.deepseek.com.example.org/v1','http://127.0.0.1:1234/v1']){
    const fetchImpl=mockFetch((_url,init)=>{const body=JSON.parse(init.body);assert.deepStrictEqual(body.thinking,new URL(baseUrl).hostname==='api.deepseek.com'?{type:'disabled'}:undefined);return okResponse({items:[]})});
    await AI.analyze({config:{baseUrl,model:'deepseek-flash',apiKey:'test-placeholder'},payload},fetchImpl);
  }
});

test('输出截断即使碰巧包含合法 JSON 也不接受且不自动重试',async()=>{
  const fetchImpl=mockFetch(()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"items":[]}'}}]})));
  await assert.rejects(()=>AI.analyze({config:LOCAL_CFG,payload:AI.preparePayload({jobs:[]})},fetchImpl),/输出达到上限/);
  assert.strictEqual(fetchImpl.calls.length,1);
});

// ---------- validateConfig ----------

test('validateConfig 接受本地回环 http 且无需密钥', () => {
  const r = AI.validateConfig(LOCAL_CFG);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.isLocal, true);
});

test('validateConfig 接受 https + 密钥', () => {
  const r = AI.validateConfig(CLOUD_CFG);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.isLocal, false);
});

test('validateConfig 拒绝明文 http 非回环', () => {
  const r = AI.validateConfig({ baseUrl: 'http://api.example.com/v1', model: 'm' });
  assert.strictEqual(r.ok, false);
});

test('validateConfig 拒绝云端缺密钥', () => {
  const r = AI.validateConfig({ baseUrl: 'https://api.example.com/v1', model: 'm' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('apiKey')));
});

test('validateConfig 拒绝带凭据/查询参数/hash 的 URL', () => {
  for (const baseUrl of [
    'https://user:pass@api.example.com/v1',
    'https://api.example.com/v1?key=1',
    'https://api.example.com/v1#frag',
  ]) {
    const r = AI.validateConfig({ baseUrl, model: 'm', apiKey: 'sk-test-placeholder' });
    assert.strictEqual(r.ok, false, baseUrl);
  }
});

test('validateConfig 拒绝超长 model 与空 model', () => {
  assert.strictEqual(AI.validateConfig({ baseUrl: 'https://a.com/v1', model: 'x'.repeat(151), apiKey: 'sk-test-placeholder' }).ok, false);
  assert.strictEqual(AI.validateConfig({ baseUrl: 'https://a.com/v1', model: '', apiKey: 'sk-test-placeholder' }).ok, false);
});

// ---------- preparePayload ----------

test('preparePayload 白名单化：剔除姓名/电话/邮箱等非专业字段', () => {
  const p = AI.preparePayload({
    profile: { targetRole: '前端开发', city: '上海', experienceYears: 2 },
    resume: sampleResume,
    jobs: [{ title: '前端工程师', company: 'B公司', description: '写页面' }],
  });
  const s = JSON.stringify(p);
  assert.ok(!s.includes('张三'));
  assert.ok(!s.includes('13800000000'));
  assert.ok(!s.includes('candidate@example.test'));
  assert.ok(!('name' in p.profile));
  assert.ok(!('phone' in p.profile));
  assert.ok(!('basic' in p.resume));
});

test('preparePayload 自由文本中的联系方式被脱敏', () => {
  const p = AI.preparePayload({ profile: {}, resume: sampleResume, jobs: [] });
  assert.ok(p.resume.work[0].desc.includes('[联系方式]'));
  assert.ok(!p.resume.work[0].desc.includes('13800000000'));
  assert.ok(!p.resume.work[0].desc.includes('candidate@example.test'));
});

test('preparePayload profile 覆盖简历提取结果，jobs 上限 10 且 id 规范', () => {
  const jobs = Array.from({ length: 12 }, (_, i) => ({ title: '岗位' + i, description: 'x'.repeat(5000) }));
  const p = AI.preparePayload({ profile: { targetRole: '新目标' }, resume: sampleResume, jobs });
  assert.strictEqual(p.profile.targetRole, '新目标');
  assert.strictEqual(p.jobs.length, 10);
  p.jobs.forEach((j, i) => {
    assert.strictEqual(j.id, 'job-' + i);
    assert.ok(j.description.length <= 4000);
    assert.ok(!('url' in j));
    assert.ok(!('sourceUrl' in j));
  });
  assert.deepStrictEqual(Object.keys(p).sort(), ['jobs', 'profile', 'resume']);
});

test('preparePayload 年限：null/undefined/空串保持 null，不是 0', () => {
  assert.strictEqual(AI.preparePayload({ profile: { experienceYears: null }, resume: {}, jobs: [] }).profile.experienceYears, null);
  assert.strictEqual(AI.preparePayload({ profile: {}, resume: {}, jobs: [] }).profile.experienceYears, null);
  assert.strictEqual(AI.preparePayload({ profile: { experienceYears: '' }, resume: {}, jobs: [] }).profile.experienceYears, null);
  assert.strictEqual(AI.preparePayload({ profile: { experienceYears: '  ' }, resume: {}, jobs: [] }).profile.experienceYears, null);
  assert.strictEqual(AI.preparePayload({ profile: { experienceYears: 3 }, resume: {}, jobs: [] }).profile.experienceYears, 3);
  assert.strictEqual(AI.preparePayload({ profile: { experienceYears: '3' }, resume: {}, jobs: [] }).profile.experienceYears, 3);
});

test('preparePayload 限额：work/proj ≤8、desc ≤1500、skills ≤20，超限截断并标记 truncated', () => {
  const resume = {
    work: Array.from({ length: 10 }, (_, i) => ({ company: 'C' + i, desc: 'd'.repeat(2000) })),
    proj: Array.from({ length: 10 }, (_, i) => ({ name: 'P' + i, desc: 'p'.repeat(2000) })),
    summary: 's'.repeat(5000),
  };
  const p = AI.preparePayload({ profile: { skills: Array.from({ length: 25 }, (_, i) => '技能' + i) }, resume, jobs: [] });
  assert.ok(p.resume.work.length <= 8);
  assert.ok(p.resume.proj.length <= 8);
  p.resume.work.forEach(w => assert.ok(w.desc.length <= 1500));
  p.resume.proj.forEach(w => assert.ok(w.desc.length <= 1500));
  assert.ok(p.profile.skills.length <= 20);
  assert.strictEqual(p.resume.truncated, true);
});

test('preparePayload 无超限输入时 truncated=false', () => {
  const p = AI.preparePayload({ profile: {}, resume: sampleResume, jobs: [] });
  assert.strictEqual(p.resume.truncated, false);
});

test('preparePayload jobs 标记 descriptionTruncated / descriptionLimited', () => {
  const p = AI.preparePayload({
    profile: {},
    resume: {},
    jobs: [{ title: 'a', description: 'x'.repeat(5000) }, { title: 'b', description: '短' }, { title: 'c' }],
  });
  assert.strictEqual(p.jobs[0].descriptionTruncated, true);
  assert.strictEqual(p.jobs[0].descriptionLimited, false);
  assert.strictEqual(p.jobs[1].descriptionTruncated, false);
  assert.strictEqual(p.jobs[1].descriptionLimited, true);
  assert.strictEqual(p.jobs[2].descriptionTruncated, false);
  assert.strictEqual(p.jobs[2].descriptionLimited, true);
});

test('preparePayload 超大简历被压缩到 60000 字符以内且 truncated=true', () => {
  const resume = {
    work: Array.from({ length: 8 }, (_, i) => ({ company: 'C' + i, desc: '工作描述'.repeat(400) })),
    proj: Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, desc: '项目描述'.repeat(400) })),
    summary: '总结'.repeat(2000),
  };
  const p = AI.preparePayload({ profile: { skills: Array.from({ length: 20 }, (_, i) => '技能' + i) }, resume, jobs: [] });
  assert.ok(JSON.stringify(p).length < 60000);
  assert.strictEqual(p.resume.truncated, true);
});

// ---------- endpointOf（间接通过 analyze 验证） ----------

test('analyze baseUrl 末尾 /v1 与完整 /v1/chat/completions 均正确规范化，不重复追加', async () => {
  const payload = AI.preparePayload({ profile: {}, resume: {}, jobs: [] });
  for (const base of ['http://127.0.0.1:1234/v1', 'http://127.0.0.1:1234/v1/', 'http://127.0.0.1:1234/v1/chat/completions']) {
    const fetchImpl = mockFetch(() => okResponse(modelOk(payload)));
    await AI.analyze({ config: { baseUrl: base, model: 'm' }, payload }, fetchImpl);
    assert.strictEqual(fetchImpl.calls[0].url, 'http://127.0.0.1:1234/v1/chat/completions', base);
  }
});

// ---------- analyze：成功路径 ----------

test('analyze 成功：返回 items + usage，请求体为标准 chat/completions', async () => {
  const fetchImpl = mockFetch(() => okResponse(modelOk({ jobs: [{ id: 'job-0' }] })));
  const payload = AI.preparePayload({
    profile: sampleProfile, resume: sampleResume, jobs: [{ title: '前端', company: 'B', description: '负责页面开发' }],
  });
  const r = await AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl);
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(r.items[0].id, 'job-0');
  assert.strictEqual(r.usage.total_tokens, 150);
  assert.deepStrictEqual(r.items[0].evidence, []);
  assert.ok(r.items[0].unknowns.includes('未提供可核对的原文依据'));

  const { url, init } = fetchImpl.calls[0];
  assert.ok(url.endsWith('/chat/completions'));
  assert.strictEqual(init.method, 'POST');
  assert.strictEqual(init.redirect, 'error');
  const body = JSON.parse(init.body);
  assert.strictEqual(body.model, 'test-model');
  assert.strictEqual(body.temperature, 0.2);
  assert.strictEqual(body.max_tokens, 4000);
  assert.ok(!('tools' in body));
  assert.strictEqual(body.messages.length, 2);
  assert.ok(body.messages[0].content.includes('不可信数据'));
});

test('analyze 云端请求带 Bearer 头', async () => {
  const fetchImpl = mockFetch(() => okResponse(modelOk({ jobs: [] })));
  await AI.analyze({ config: CLOUD_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl);
  assert.strictEqual(fetchImpl.calls[0].init.headers.Authorization, 'Bearer sk-test-placeholder');
});

test('analyze 容忍围栏 JSON（```json 包裹）', async () => {
  const fenced = {
    choices: [{ message: { content: '```json\n' + JSON.stringify(modelOk({ jobs: [{ id: 'job-0' }] })) + '\n```' } }],
  };
  const fetchImpl = mockFetch(() => new Response(JSON.stringify(fenced), { status: 200 }));
  const payload = AI.preparePayload({ profile: {}, resume: {}, jobs: [{ title: 'a' }] });
  const r = await AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl);
  assert.strictEqual(r.items[0].id, 'job-0');
  assert.strictEqual(r.usage, null);
});

// ---------- analyze：evidence 校验 ----------

test('analyze 接受逐字来自输入的 evidence 引用', async () => {
  const payload = AI.preparePayload({
    profile: sampleProfile,
    resume: sampleResume,
    jobs: [{ title: '前端工程师', company: 'B', description: '要求熟悉 React，负责页面开发' }],
  });
  const items = [{
    id: 'job-0', score: 70, summary: '技能匹配', strengths: ['React 经验'], gaps: [], unknowns: [],
    evidence: [{ requirement: '熟悉 React', resumeQuote: '用 React 重构', jobQuote: '要求熟悉 React' }],
  }];
  const fetchImpl = mockFetch(() => okResponse(modelOk(payload, items)));
  const r = await AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl);
  assert.strictEqual(r.items[0].evidence.length, 1);
  assert.strictEqual(r.items[0].evidence[0].resumeQuote, '用 React 重构');
  assert.ok(r.items[0].unknowns.some(s=>s.includes('描述较少')));
});

test('analyze 拒绝编造的 resumeQuote', async () => {
  const payload = AI.preparePayload({
    profile: sampleProfile, resume: sampleResume,
    jobs: [{ title: '前端', description: '写页面' }],
  });
  const items = [{ id: 'job-0', score: 50, summary: 's', strengths: [], gaps: [], unknowns: [], evidence: [{ requirement: 'r', resumeQuote: '我精通量子计算', jobQuote: '写页面' }] }];
  const fetchImpl = mockFetch(() => okResponse(modelOk(payload, items)));
  await assert.rejects(() => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl), /原文依据/);
});

test('analyze 拒绝跨岗位拼接的 jobQuote', async () => {
  const payload = AI.preparePayload({
    profile: sampleProfile, resume: sampleResume,
    jobs: [{ title: '前端', description: '写页面' }, { title: '后端', description: 'Java 微服务' }],
  });
  // resumeQuote 合法（来自简历），但 jobQuote 属于 job-0 不属于 job-1 → 拒绝
  // 必须同时返回 job-0，否则会先触发全有或全无的 ID 校验而非 evidence 校验
  const items = [
    { id: 'job-0', score: 50, summary: 's', strengths: [], gaps: [], unknowns: [], evidence: [] },
    { id: 'job-1', score: 50, summary: 's', strengths: [], gaps: [], unknowns: [], evidence: [{ requirement: 'r', resumeQuote: '负责页面开发', jobQuote: '写页面' }] },
  ];
  const fetchImpl = mockFetch(() => okResponse(modelOk(payload, items)));
  await assert.rejects(() => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl), /原文依据/);
});

test('analyze evidence 超过 4 条拒绝', async () => {
  const payload = AI.preparePayload({
    profile: sampleProfile, resume: sampleResume,
    jobs: [{ title: '前端', description: 'a b c d e' }],
  });
  const ev = [];
  for (let i = 0; i < 5; i++) {
    ev.push({ requirement: 'a b c d e', resumeQuote: '两年前端经验', jobQuote: 'a b c d e' });
  }
  const items = [{ id: 'job-0', score: 50, summary: 's', strengths: [], gaps: [], unknowns: [], evidence: ev }];
  const fetchImpl = mockFetch(() => okResponse(modelOk(payload, items)));
  await assert.rejects(() => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl), /evidence/);
});

test('analyze evidence 缺失/非数组拒绝', async () => {
  const payload = AI.preparePayload({ profile: {}, resume: {}, jobs: [{ title: 'a' }] });
  const fetchImpl = mockFetch(() => okResponse({ items: [{ id: 'job-0', score: 50, summary: 's', strengths: [], gaps: [], unknowns: [] }] }));
  await assert.rejects(() => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl), /evidence/);
});

// ---------- analyze：模型输出校验 ----------

test('analyze 拒绝非法 JSON 内容', async () => {
  const fetchImpl = mockFetch(() => new Response(JSON.stringify({
    choices: [{ message: { content: '这不是 JSON' } }],
  }), { status: 200 }));
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
    /JSON/,
  );
});

test('analyze 全有或全无：缺 ID / 重复 ID / 外来 ID 均整体拒绝', async () => {
  const payload = AI.preparePayload({ profile: {}, resume: {}, jobs: [{ title: 'a' }, { title: 'b' }] });
  const base = modelOk(payload).items;
  const cases = [
    base.slice(0, 1), // 缺 job-1
    [...base, base[0]], // job-0 重复
    [{ id: 'job-X', score: 1, summary: '', strengths: [], gaps: [], unknowns: [], evidence: [] },
     base[1]], // 外来 ID
    base.map(x => ({ ...x, id: undefined })), // ID 缺失
    [{ id: 0, score: 1, summary: '', strengths: [], gaps: [], unknowns: [], evidence: [] }, base[1]], // 非字符串 ID
  ];
  for (const items of cases) {
    const fetchImpl = mockFetch(() => okResponse({ items }));
    await assert.rejects(
      () => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl),
      /ID|岗位/,
    );
  }
});

test('analyze 拒绝非法分数：非数字/超界/null/布尔/数字字符串', async () => {
  const payload = AI.preparePayload({ profile: {}, resume: {}, jobs: [{ title: 'a' }] });
  const mk = score => [{ id: 'job-0', score, summary: 's', strengths: [], gaps: [], unknowns: [], evidence: [] }];
  for (const score of ['high', 150, -1, Number('nan'), null, true, false, '50']) {
    const fetchImpl = mockFetch(() => okResponse({ items: mk(score) }));
    await assert.rejects(() => AI.analyze({ config: LOCAL_CFG, payload }, fetchImpl), /分数/);
  }
});

// ---------- analyze：HTTP 与传输层 ----------

test('analyze 非 2xx 返回通用错误，不泄露响应体', async () => {
  for (const [status, word] of [[401, '鉴权失败'], [429, '频繁'], [500, '服务端错误'], [403, '鉴权失败']]) {
    const fetchImpl = mockFetch(() => new Response('{"error":"leak attempt with secret"}', { status }));
    await assert.rejects(
      () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
      err => { assert.ok(err.message.includes('HTTP ' + status)); assert.ok(!err.message.includes('leak')); assert.ok(!err.message.includes('secret')); return true; },
    );
    void word;
  }
});

test('analyze 响应体超过 200KB 拒绝', async () => {
  const big = new Response('x'.repeat(210 * 1024), { status: 200 });
  const fetchImpl = mockFetch(() => big);
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
    /200KB/,
  );
});

test('analyze 已取消的 signal 不发起任何网络请求', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = mockFetch(() => { throw new Error('should not be called'); });
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }), signal: controller.signal }, fetchImpl),
    /取消/,
  );
  assert.strictEqual(fetchImpl.calls.length, 0);
});

test('analyze 支持 AbortSignal 外部取消（请求途中）', async () => {
  const controller = new AbortController();
  const fetchImpl = mockFetch(async (url, init) => {
    init.signal.addEventListener('abort', () => controller.abort());
    await new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    throw new Error('unreachable');
  });
  controller.abort();
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }), signal: controller.signal }, fetchImpl),
    /取消/,
  );
});

test('analyze 读体阶段异常只给通用信息，不透出底层异常内容', async () => {
  const evil = new Response(new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('{"choices":[{"message":{"content":"partial'));
      // 读到一半抛出携带敏感信息的异常
      queueMicrotask(() => {
        try { c.error(new Error('boom Authorization: Bearer sk-test-placeholder')); } catch { /* already errored */ }
      });
    },
  }), { status: 200 });
  const fetchImpl = mockFetch(() => evil);
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
    err => {
      assert.ok(!err.message.includes('sk-test-placeholder'), err.message);
      assert.ok(!err.message.includes('boom'), err.message);
      return true;
    },
  );
});

test('analyze 网络错误抛出', async () => {
  const fetchImpl = mockFetch(async () => { throw new Error('ECONNREFUSED'); });
  await assert.rejects(
    () => AI.analyze({ config: LOCAL_CFG, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
    /请求失败/,
  );
});

test('analyze 无效配置直接拒绝，不发起请求', async () => {
  const fetchImpl = mockFetch(() => { throw new Error('should not be called'); });
  await assert.rejects(
    () => AI.analyze({ config: { baseUrl: 'http://8.8.8.8/v1', model: 'm' }, payload: AI.preparePayload({ profile: {}, resume: {}, jobs: [] }) }, fetchImpl),
    /配置无效/,
  );
});
