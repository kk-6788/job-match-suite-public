'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const desktopPath = path.join(__dirname, '../job-matcher/desktop.cjs');

function desktopHarness(options = {}) {
  const windows = [], handlers = new Map();
  let nextId = 1;
  class BrowserWindow extends EventEmitter {
    constructor(config) {
      super();
      this.config = config;
      this.destroyed = false;
      this.destroyCount = 0;
      this.currentURL = '';
      this.sent = [];
      const session = new EventEmitter();
      session.setPermissionRequestHandler = () => {};
      this.contents = Object.assign(new EventEmitter(), {
        id: nextId++, mainFrame: { url: '' }, session,
        setWindowOpenHandler: () => {},
        send: (...args) => { this.sent.push(args); },
        getURL: () => this.currentURL,
        isLoadingMainFrame: () => false,
        executeJavaScriptInIsolatedWorld: async () => options.extracted || ({ status: 'need-login', message: '虚构测试登录页', jobs: [] })
      });
      windows.push(this);
    }
    get webContents() {
      // 对应真实 Electron closed 触发时，本地 BrowserWindow 对象已销毁的边界。
      if (this.destroyed) throw Error('Object has been destroyed');
      return this.contents;
    }
    loadFile(file) {
      this.currentURL = pathToFileURL(file).href;
      this.contents.mainFrame.url = this.currentURL;
      return Promise.resolve();
    }
    loadURL(url) {
      this.currentURL = url;
      this.contents.mainFrame.url = url;
      return options.sourceLoading || Promise.resolve();
    }
    isDestroyed() { return this.destroyed; }
    show() {}
    focus() {}
    destroy() {
      if (this.destroyed) return;
      this.destroyCount++;
      this.destroyed = true;
      this.emit('closed');
    }
  }
  const electron = {
    app: new EventEmitter(), BrowserWindow,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    shell: { openExternal: async () => {} }
  };
  const localRequire = createRequire(desktopPath);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(desktopPath, 'utf8'), {
    module, exports: module.exports, __dirname: path.dirname(desktopPath),
    require: request => request === 'electron' ? electron : localRequire(request),
    // 只测试成功/主动关闭路径，故不触发超时；避免真实 14 秒计时器延迟测试结束。
    setTimeout: () => 0, AbortController
  }, { filename: desktopPath });
  const eventFor = win => ({ sender: win.contents, senderFrame: win.contents.mainFrame });
  return { windows, handlers, eventFor, create: module.exports.createMatcherWindow };
}

test('主窗口 closed 时 webContents 已销毁，仍清理来源窗口并移除 IPC owner', async () => {
  const harness = desktopHarness();
  const main = harness.create({ basic: { job: '数据分析师' } });
  const event = harness.eventFor(main);
  assert.equal(harness.handlers.get('jobmatch:initial')(event).basic.job, '数据分析师');
  const response = await harness.handlers.get('jobmatch:search')(event, {
    requestId: 1, prefs: { targetRole: '数据分析师' }, sources: ['boss', 'liepin'], companyUrls: []
  });
  assert.equal(response.results.length, 2);
  const sources = harness.windows.slice(1);
  assert.equal(sources.length, 2);
  assert.ok(sources.every(win => !win.isDestroyed()));
  assert.doesNotThrow(() => main.destroy());
  assert.throws(() => main.webContents, /Object has been destroyed/);
  assert.ok(sources.every(win => win.isDestroyed() && win.destroyCount === 1));
  assert.throws(() => harness.handlers.get('jobmatch:initial')(event), /无效调用来源/);
});

test('AI桥接只接受本地主窗口；候选来自已读取结果、硬冲突不送AI，取消后票据失效',async()=>{
 const jobs=[{title:'运营',url:'https://www.zhipin.com/job_detail/a.html',city:'上海',education:'硕士',experience:'5年以上'},{title:'运营',url:'https://www.zhipin.com/job_detail/b.html',city:'北京'}];
 const h=desktopHarness({extracted:{status:'ok',jobs}}),main=h.create({}),event=h.eventFor(main);
 await h.handlers.get('jobmatch:search')(event,{requestId:1,prefs:{targetRole:'运营'},sources:['boss'],companyUrls:[]});
 const args={profile:{targetRole:'运营',education:'本科',experienceYears:3},prefs:{city:'上海'},resume:{basic:{name:'私密姓名',phone:'13800000000'},work:[{desc:'内容策划'}]}};
 assert.throws(()=>h.handlers.get('jobmatch:ai-preview')(h.eventFor(h.windows[1]),args),/无效调用来源/);
 assert.throws(()=>h.handlers.get('jobmatch:ai-local-service')(h.eventFor(h.windows[1])),/无效调用来源/);
 const draft=h.handlers.get('jobmatch:ai-preview')(event,args);assert.equal(draft.payload.jobs.length,1);assert.equal(draft.payload.jobs[0].id,'job-0');assert.ok(!JSON.stringify(draft).includes('私密姓名'));assert.ok(!JSON.stringify(draft).includes('13800000000'));
 h.handlers.get('jobmatch:ai-cancel')(event);await assert.rejects(()=>h.handlers.get('jobmatch:ai-analyze')(event,{ticket:draft.ticket,config:{}}),/重新预览/);
 main.destroy();assert.throws(()=>h.handlers.get('jobmatch:ai-preview')(event,args),/无效调用来源/);
});

test('关闭主窗口会中止尚未完成的来源读取，延迟加载返回不会再访问已销毁窗口', async () => {
  let finishLoad;
  const sourceLoading = new Promise(resolve => { finishLoad = resolve; });
  const harness = desktopHarness({ sourceLoading });
  const main = harness.create({ basic: { job: '数据分析师' } });
  const event = harness.eventFor(main);
  const pending = harness.handlers.get('jobmatch:search')(event, {
    requestId: 1, prefs: { targetRole: '数据分析师' }, sources: ['boss', 'liepin'], companyUrls: []
  });
  assert.equal(harness.windows.length, 2, '只应开始第一个来源');
  const progressCount = main.sent.length;
  assert.doesNotThrow(() => main.destroy());
  finishLoad();
  const response = await pending;
  assert.equal(response.canceled, true);
  assert.equal(response.results.length, 0);
  assert.equal(harness.windows.length, 2, '关闭后不得新建后续来源');
  assert.equal(main.sent.length, progressCount, '关闭后不得向已销毁窗口发送进度');
  assert.equal(harness.windows[1].isDestroyed(), true);
  assert.throws(() => harness.handlers.get('jobmatch:initial')(event), /无效调用来源/);
});
