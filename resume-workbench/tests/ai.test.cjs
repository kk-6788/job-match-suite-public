const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../app/ai.js');
const originalFetch = global.fetch;
const config = { provider: 'custom', baseUrl: 'https://example.test/v1/', model: 'test', key: 'mock-test-key' };
function response(value, status = 200) { return { ok: status < 400, status, json: async () => value }; }
function mockResult(result) { global.fetch = async () => response({ choices: [{ message: { content: typeof result === 'string' ? result : JSON.stringify(result) } }] }); }
const data = { basic: { name: '张三' }, summary: '负责客户运营', work: [{ company: '示例公司', desc: '负责客户运营，服务10名客户' }], proj: [], edu: [], skills: [], certs: [] };
afterEach(() => { global.fetch = originalFetch; delete global.resumeDesktop; });

test('chat sends nonstream authenticated request, returns content', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://example.test/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer mock-test-key');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).max_tokens, 12);
    return response({ choices: [{ message: { content: 'hello' } }] });
  };
  assert.equal(await AI.chat(config, [{ role: 'user', content: 'hi' }], { maxTokens: 12 }), 'hello');
});
test('rejects insecure remote endpoints before transmission', async () => {
  global.fetch = () => assert.fail('must not transmit');
  for (const baseUrl of ['http://remote.example/v1', 'https://name:pass@example.test', 'https://example.test?key=secret', 'file:///example']) {
    await assert.rejects(AI.chat({ ...config, baseUrl }, [{ role: 'user', content: 'hi' }]));
  }
});
test('localhost HTTP is supported', async () => {
  mockResult('hello');
  assert.equal(await AI.chat({ ...config, baseUrl: 'http://127.0.0.1:3000/v1' }, [{}]), 'hello');
});
test('HTTP and network errors never expose backend response or secret', async () => {
  global.fetch = async () => response({ error: { message: config.key } }, 401);
  await assert.rejects(AI.chat(config, [{}]), /Key 无效/);
  global.fetch = async () => { throw new Error(config.key); };
  await assert.rejects(AI.chat(config, [{}]), e => !e.message.includes(config.key));
});
test('timeout aborts fetch and returns safe error', async () => {
  let signal;
  global.fetch = async (_, options) => { signal = options.signal; return new Promise(() => {}); };
  await assert.rejects(AI.chat({ ...config, timeoutMs: 5 }, [{}]), /超时/);
  assert.equal(signal.aborted, true);
});
test('caller abort and already aborted signal are respected', async () => {
  global.fetch = async () => new Promise(() => {});
  const controller = new AbortController();
  const pending = AI.chat(config, [{}], { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  global.fetch = () => assert.fail('must not transmit');
  await assert.rejects(AI.chat(config, [{}], { signal: controller.signal }), { name: 'AbortError' });
});
test('desktop bridge chat uses supplied request contract', async () => {
  global.fetch = () => assert.fail('desktop chat must use bridge');
  global.resumeDesktop = { chat: async request => { assert.equal(request.url, 'https://example.test/v1/chat/completions'); return { choices: [{ message: { content: 'desktop' } }] }; } };
  assert.equal(await AI.chat(config, [{}]), 'desktop');
});
test('truncated or malformed chat output is rejected', async () => {
  global.fetch = async () => response({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] });
  await assert.rejects(AI.chat(config, [{}]), /截断/);
  global.fetch = async () => response({});
  await assert.rejects(AI.chat(config, [{}]), /空内容/);
});
test('model discovery validates and deduplicates ids', async () => {
  global.fetch = async () => response({ data: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] });
  assert.deepEqual(await AI.listModels({ ...config, model: '' }), [{ id: 'a' }, { id: 'b' }]);
  global.fetch = async () => response({ data: [{}] });
  await assert.rejects(AI.listModels(config), /模型列表格式/);
});
test('JSON parsing only accepts JSON or single enclosing code fence', () => {
  assert.deepEqual(AI.parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => AI.parseJSON('Explanation {"a":1}'), /有效 JSON/);
});
test('extract preserves supplied source and clears unsupported facts', async () => {
  const text = '张三\n示例公司\n负责客户运营，服务10名客户';
  mockResult({ data: { ...data, basic: { name: '张三', age: '30' } }, uncertainties: [], sourceText: 'model cannot override source' });
  const result = await AI.extract(config, { text });
  assert.equal(result.sourceText, text);
  assert.equal(result.data.basic.age, '');
  assert.equal(result.data.work[0].desc, data.work[0].desc);
  assert.ok(result.uncertainties.some(v => v.field === 'basic.age'));
});
test('image extraction sends vision model and requires transcription review', async () => {
  const imageDataUrl = 'data:image/png;base64,YQ==';
  global.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'vision-test');
    assert.equal(body.messages[1].content[1].image_url.url, imageDataUrl);
    assert.match(body.messages[0].content, /不可信数据/);
    return response({ choices: [{ message: { content: JSON.stringify({ data, sourceText: '张三 负责客户运营 示例公司 负责客户运营，服务10名客户', uncertainties: [] }) } }] });
  };
  const result = await AI.extract({ ...config, visionModel: 'vision-test' }, { imageDataUrl });
  assert.ok(result.uncertainties.some(v => v.field === 'sourceText'));
});
test('change validation prevents new numbers, unauthorized paths, and stale before text', () => {
  const change = { path: 'work.0.desc', before: data.work[0].desc, after: '服务10名客户，负责客户运营', reason: '调整语序' };
  const result = { changes: [change], warnings: [] };
  assert.equal(AI.validateChanges(result, { data }).changes.length, 1);
  assert.throws(() => AI.validateChanges({ ...result, changes: [{ ...change, after: '服务100名客户' }] }, { data }), /数字/);
  assert.throws(() => AI.validateChanges({ ...result, changes: [{ ...change, path: 'basic.name' }] }, { data }), /未经允许/);
  assert.throws(() => AI.validateChanges({ ...result, changes: [{ ...change, before: '过期文字' }] }, { data }), /原文/);
  assert.throws(() => AI.validateChanges(result, { data }, 'summary'), /未经允许/);
});
test('polish generates a proposal and never mutates source', async () => {
  const record = { data: structuredClone(data) };
  mockResult({ changes: [{ path: 'summary', before: data.summary, after: '客户运营工作负责人', reason: '调整表述' }], warnings: ['请核实表述'] });
  const result = await AI.polish(config, record, 'summary');
  assert.equal(result.changes.length, 1);
  assert.equal(record.data.summary, data.summary);
});
test('questions are limited to five well formed items', async () => {
  mockResult(Array(6).fill({ question: '做了什么？', field: 'summary', reason: '缺细节' }));
  await assert.rejects(AI.questions(config, { data }), /超过5项/);
});
test('review validates every fixed rubric id and quote evidence', async () => {
  const rubric = [{ id: 'expression', label: '表达' }];
  const check = { id: 'expression', status: 'partial', evidence: '负责客户运营', reason: '职责明确但细节不足', suggestion: '补充真实案例', path: 'summary' };
  mockResult({ checks: [check], issues: [], total: 100 });
  const result = await AI.review(config, { data }, rubric);
  assert.equal(result.total, undefined);
  mockResult({ checks: [{ ...check, evidence: '编造的证据' }], issues: [] });
  await assert.rejects(AI.review(config, { data }, rubric), /原文定位/);
  mockResult({ checks: [], issues: [] });
  await assert.rejects(AI.review(config, { data }, rubric), /缺少评分项/);
  mockResult({ checks: [{ ...check, id: 'invented' }], issues: [] });
  await assert.rejects(AI.review(config, { data }, rubric), /ID/);
});
test('review permits empty evidence only for missing field failures', async () => {
  const check = { id: 'contact', status: 'fail', evidence: '', reason: '缺少电话', suggestion: '补充电话', path: 'basic.phone' };
  mockResult({ checks: [check], issues: [{ severity: 'blocker', path: 'basic.phone', reason: '缺少电话', suggestion: '补充', evidence: '' }] });
  assert.equal((await AI.review(config, { data }, [{ id: 'contact' }])).checks[0].status, 'fail');
  mockResult({ checks: [{ ...check, status: 'pass' }], issues: [] });
  await assert.rejects(AI.review(config, { data }, [{ id: 'contact' }]), /证据/);
  mockResult({ checks: [{ ...check, path: '__proto__.name' }], issues: [] });
  await assert.rejects(AI.review(config, { data }, [{ id: 'contact' }]), /路径/);
});
test('image extraction resolves provider model defaults', async () => {
  global.fetch = async (_, options) => {
    assert.equal(JSON.parse(options.body).model, AI.presets[0].visionModel);
    return response({ choices: [{ message: { content: JSON.stringify({ data, sourceText: '张三 负责客户运营 示例公司 负责客户运营，服务10名客户', uncertainties: [] }) } }] });
  };
  await AI.extract({ provider: 'deepseek', key: 'mock-test-key' }, { imageDataUrl: 'data:image/png;base64,YQ==' });
});
test('numeric skill level is accepted only beside explicit corresponding source skill', async () => {
  const candidate = { ...data, skills: [{ name: 'Excel', level: 3 }, { name: 'Photoshop', level: 4 }] };
  mockResult({ data: candidate, uncertainties: [] });
  const result = await AI.extract(config, { text: '张三\nExcel：熟练\nPhotoshop\n工作4年' });
  assert.equal(result.data.skills[0].level, 3);
  assert.equal(result.data.skills[1].level, 0);
  assert.ok(result.uncertainties.some(u => u.field === 'skills.1.level'));
});
test('skill levels support explicit labels and numeric scales without inventing default proficiency', async () => {
  mockResult({ data: { ...data, skills: [{ name: 'Excel', level: '基础' }, { name: 'SQL', level: 4 }, { name: 'Python', level: '' }] }, uncertainties: [] });
  const result = await AI.extract(config, { text: '张三\nExcel（基础）\nSQL：熟练度4/5\nPython' });
  assert.deepEqual(result.data.skills.map(s => s.level), [2, 4, 0]);
});
