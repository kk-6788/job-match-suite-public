'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '../job-matcher');
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const fixture = {
  basic: { job: '数据分析师', city: '上海' },
  edu: [{ degree: '本科' }],
  work: [{ position: '数据分析师', start: '2022.01', end: '2025.01' }],
  skills: [{ name: 'SQL' }]
};
const sampleJob = (extra = {}) => ({
  title: '数据分析师', company: '虚构测试公司', city: '上海',
  salary: '12-18K', education: '本科', experience: '1-3年',
  description: 'SQL', source: 'boss',
  url: 'https://www.zhipin.com/job_detail/ui_state_example.html', ...extra
});
const sourceResult = (requestId, extra = {}) => ({
  requestId, key: 'boss', source: 'boss', label: 'BOSS 直聘',
  status: 'ok', jobs: [sampleJob()], ...extra
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(t, options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'file:///virtual/job-matcher/index.html', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const w = dom.window, doc = w.document;
  for (const input of doc.querySelectorAll('.source-picks input')) input.checked = input.value === 'boss';
  const observed = { searches: [], collects: [], opens: [], cancels: 0, exports: [] };
  let emit = () => {};
  w.jobDesktop = {
    initial: options.initial || (async () => fixture),
    onProgress: fn => { emit = fn; return () => {}; },
    cancel: async () => { observed.cancels++; return true; },
    search: async args => {
      observed.searches.push(args);
      if (options.search) return options.search(args);
      if (!args.sources.length && !args.companyUrls.length) throw Error('请选择至少一个来源或填写公司招聘页');
      return { results: [sourceResult(args.requestId, options.initialResult)] };
    },
    collect: async args => {
      observed.collects.push(args);
      return options.collect ? options.collect(args) : sourceResult(args.requestId);
    },
    openSource: async key => { observed.opens.push(key); return true; },
    openExternal: async () => true
  };
  w.Blob = class {
    constructor(parts) { this.text = parts.join(''); }
  };
  w.URL.createObjectURL = blob => { observed.exports.push(blob.text); return 'blob:ui-state-test'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  for (const file of ['shared/resume-core.js', 'shared/resume-services.js', 'core.js', 'app.js']) {
    w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  return {
    w, doc, observed,
    emit: value => emit(value),
    selectFile: file => {
      const input = doc.querySelector('#resume-file');
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new w.Event('change'));
    },
    sourceButtons: () => [...doc.querySelectorAll('.source-actions button')],
    sourceButton: label => [...doc.querySelectorAll('.source-actions button')].find(button => button.textContent.includes(label)),
    start: async () => { await tick(); doc.querySelector('#search').click(); await tick(); }
  };
}

function assertReady(ui) {
  assert.equal(ui.doc.querySelector('#search').disabled, false, '搜索按钮应恢复');
  assert.equal(ui.doc.querySelector('#cancel').hidden, true, '结束后隐藏停止按钮');
  assert.equal(ui.sourceButtons().length, 2);
  assert.ok(ui.sourceButtons().every(button => !button.disabled), '来源操作应恢复可点击');
}

test('继续读取成功后，来源操作恢复并允许再次读取', async t => {
  const ui = setup(t, { initialResult: { status: 'need-login', jobs: [], message: '请先登录' } });
  await ui.start();
  ui.sourceButton('继续读取').click();
  await tick();
  assert.equal(ui.doc.querySelectorAll('.job').length, 1);
  assertReady(ui);
  ui.sourceButton('继续读取').click();
  await tick();
  assert.equal(ui.observed.collects.length, 2);
});

test('继续读取失败后显示错误并恢复来源操作', async t => {
  const pending = deferred();
  const ui = setup(t, { collect: () => pending.promise });
  await ui.start();
  ui.sourceButton('继续读取').click();
  await tick();
  ui.emit(sourceResult(ui.observed.collects[0].requestId, { status: 'loading', jobs: [], message: '正在读取页面' }));
  pending.reject(Error('测试来源暂时不可用'));
  await tick();
  assert.match(ui.doc.querySelector('#search-message').textContent, /测试来源暂时不可用/);
  assertReady(ui);
});

test('来源读取中立即禁用操作，重复点击不会发起并发读取', async t => {
  const pending = deferred();
  const ui = setup(t, { collect: () => pending.promise });
  await ui.start();
  ui.sourceButton('继续读取').click();
  try {
    assert.ok(ui.sourceButtons().every(button => button.disabled), '收到进度事件前也必须禁用来源操作');
    ui.sourceButton('继续读取').click();
    ui.sourceButton('打开来源').click();
    await tick();
    assert.equal(ui.observed.collects.length, 1);
    assert.equal(ui.observed.opens.length, 0);
  } finally {
    pending.resolve(sourceResult(ui.observed.collects[0].requestId));
    await tick();
  }
});

test('停止继续读取后保留已有岗位，并忽略旧进度和旧返回值', async t => {
  const pending = deferred();
  const ui = setup(t, { collect: () => pending.promise });
  await ui.start();
  ui.sourceButton('继续读取').click();
  await tick();
  const oldId = ui.observed.collects[0].requestId;
  ui.doc.querySelector('#cancel').click();
  const stale = sourceResult(oldId, { jobs: [sampleJob({ title: '迟到的旧岗位', url: 'https://www.zhipin.com/job_detail/stale.html' })] });
  ui.emit(stale);
  pending.resolve(stale);
  await tick();
  assert.equal(ui.observed.cancels, 1);
  assert.match(ui.doc.querySelector('#search-message').textContent, /停止/);
  assert.equal(ui.doc.querySelectorAll('.job').length, 1);
  assert.doesNotMatch(ui.doc.querySelector('#jobs').textContent, /迟到的旧岗位/);
  assertReady(ui);
});

test('未选择任何来源时保留旧结果，并在发送请求前提示', async t => {
  const ui = setup(t);
  await ui.start();
  for (const input of ui.doc.querySelectorAll('.source-picks input')) input.checked = false;
  ui.doc.querySelector('#discovery').checked = false;
  ui.doc.querySelector('#company-urls').value = '';
  ui.doc.querySelector('#search').click();
  await tick();
  assert.equal(ui.observed.searches.length, 1, '无来源时不应调用原生搜索或清空旧结果');
  assert.equal(ui.doc.querySelectorAll('.job').length, 1);
  assert.match(ui.doc.querySelector('#search-message').textContent, /至少.*来源|选择.*来源/);
  assertReady(ui);
});

test('导出条件不符岗位时明确标识，并保留每一项具体冲突', async t => {
  const ui = setup(t, { initialResult: { jobs: [sampleJob({ city: '北京', experience: '5年以上' })] } });
  await ui.start();
  assert.equal(ui.doc.querySelectorAll('.job').length, 0);
  ui.doc.querySelector('#show-conflicts').checked = true;
  ui.doc.querySelector('#show-conflicts').dispatchEvent(new ui.w.Event('change'));
  assert.equal(ui.doc.querySelectorAll('.job').length, 1);
  const visibleConflicts = [...ui.doc.querySelectorAll('.job .conflict')].map(node => node.textContent);
  assert.ok(visibleConflicts.some(value => value.includes('城市不匹配')));
  assert.ok(visibleConflicts.some(value => value.includes('经验要求高于')));
  ui.doc.querySelector('#export').click();
  assert.equal(ui.observed.exports.length, 1);
  const exported = ui.observed.exports[0];
  assert.match(exported, /不符合条件|条件不符/);
  for (const conflict of visibleConflicts) assert.ok(exported.includes(conflict), '导出缺少冲突：' + conflict);
  assert.ok(exported.includes('https://www.zhipin.com/job_detail/ui_state_example.html'));
});

test('读取过程中修改求职条件会停止任务并恢复来源操作', async t => {
  const pending = deferred();
  const ui = setup(t, { collect: () => pending.promise });
  await ui.start();
  ui.sourceButton('继续读取').click();
  await tick();
  const oldId = ui.observed.collects[0].requestId;
  ui.emit(sourceResult(oldId, { status: 'loading', jobs: [], message: '正在读取页面' }));
  ui.doc.querySelector('#city').value = '北京';
  ui.doc.querySelector('#city').dispatchEvent(new ui.w.Event('input'));
  pending.resolve(sourceResult(oldId));
  await tick();
  assert.equal(ui.observed.cancels, 1);
  assertReady(ui);
  assert.match(ui.doc.querySelector('#search-message').textContent, /条件已修改/);
});

test('来源状态明确区分等待、读取、登录与验证，停止后不残留读取中', async t => {
  const pending = deferred();
  const ui = setup(t, { search: () => pending.promise });
  await ui.start();
  assert.equal(ui.doc.querySelector('.status-badge').textContent, '等待读取');
  const requestId = ui.observed.searches[0].requestId;
  for (const [status, label] of [['loading', '读取中'], ['need-login', '需要登录'], ['verification', '需要验证']]) {
    ui.emit(sourceResult(requestId, { status, jobs: [], message: label }));
    assert.equal(ui.doc.querySelector('.status-badge').textContent, label);
  }
  ui.emit(sourceResult(requestId, { status: 'loading', jobs: [] }));
  ui.doc.querySelector('#cancel').click();
  assert.equal(ui.doc.querySelector('.status-badge').textContent, '已停止');
  assert.equal(ui.doc.querySelector('#jobs').getAttribute('aria-busy'), 'false');
  pending.resolve({ results: [] });
  await tick();
  assertReady(ui);
});

for (const outcome of ['旧成功结果', '旧读取错误']) {
  test('连续选取简历时，' + outcome + '不会覆盖新简历或提示', async t => {
    const pending = deferred();
    const ui = setup(t);
    await tick();
    ui.selectFile({ name: '旧简历.json', size: 100, text: () => pending.promise });
    ui.selectFile({ name: '新简历.json', size: 100, text: async () => JSON.stringify({ basic: { job: '产品经理', city: '杭州' } }) });
    await tick();
    const newMessage = ui.doc.querySelector('#import-message').textContent;
    assert.equal(ui.doc.querySelector('#role').value, '产品经理');
    assert.equal(ui.doc.querySelector('#city').value, '杭州');
    if (outcome === '旧成功结果') pending.resolve(JSON.stringify({ basic: { job: '迟到的旧职位', city: '北京' } }));
    else pending.reject(Error('旧文件读取失败'));
    await tick();
    assert.equal(ui.doc.querySelector('#role').value, '产品经理');
    assert.equal(ui.doc.querySelector('#city').value, '杭州');
    assert.equal(ui.doc.querySelector('#import-message').textContent, newMessage);
    assert.equal(ui.doc.querySelector('#import-message').dataset.tone, 'success');
  });
}

test('迟到的工作台初始数据不会覆盖用户已选择的新简历', async t => {
  const pending = deferred();
  const ui = setup(t, { initial: () => pending.promise });
  ui.selectFile({ name: '新选择.json', size: 100, text: async () => JSON.stringify({ basic: { job: '产品经理', city: '杭州' } }) });
  await tick();
  pending.resolve(fixture);
  await tick();
  assert.equal(ui.doc.querySelector('#role').value, '产品经理');
  assert.equal(ui.doc.querySelector('#city').value, '杭州');
});

test('跳到岗位结果只移动焦点，不改变原生桥接使用的页面网址', async t => {
  const ui = setup(t);
  await tick();
  const initialURL = ui.w.location.href;
  ui.w.HTMLElement.prototype.scrollIntoView = () => {};
  ui.doc.querySelector('.skip-link').dispatchEvent(new ui.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(ui.w.location.href, initialURL, '修改 hash 会让原生端拒绝当前页面的 IPC 调用');
  assert.equal(ui.doc.activeElement, ui.doc.querySelector('#results-title'));
});

test('中央设置区支持收拢与重开，开始查找后只保留职业摘要', async t => {
  const ui=setup(t);await tick();
  const toggle=ui.doc.querySelector('#edit-settings'),body=ui.doc.querySelector('#workspace-body');
  assert.equal(toggle.getAttribute('aria-expanded'),'true');toggle.click();
  assert.equal(body.inert,true);assert.ok(body.classList.contains('is-collapsed'));
  toggle.click();assert.equal(body.inert,false);
  await ui.start();assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.match(ui.doc.querySelector('#profile-summary').textContent,/数据分析师.*上海/);
  toggle.click();assert.equal(body.inert,false);assert.equal(ui.doc.querySelector('#role').value,'数据分析师');
});
test('相同岗位进度刷新保留卡片节点，不重播结果入场', async t => {
  const ui=setup(t,{initialResult:{jobs:[sampleJob({collectedAt:'2026-10-15T00:00:00Z'})]}});await ui.start();
  const card=ui.doc.querySelector('.job');assert.ok(card.classList.contains('enter-0'));
  const request=ui.observed.searches[0];
  const value=sourceResult(request.requestId,{jobs:[sampleJob({collectedAt:'2026-10-15T00:00:00Z'})]});
  ui.emit(value);const stable=ui.doc.querySelector('.job');
  ui.emit(value);assert.equal(ui.doc.querySelector('.job'),stable);
});
