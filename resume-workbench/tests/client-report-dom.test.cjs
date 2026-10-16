// 客户交付 tab 的 DOM 集成测试。测试使用合成 stub 模块（window.ResumeClientReport），
// 因为 app-dom.test.cjs 的 setup 不加载新模块；真实模块由另一分支提供（UMD，全局 ResumeClientReport）。
// 所有调用在本地完成，不联网。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),C=require('../app/core.js');
const tick=()=>new Promise(r=>setTimeout(r,25));
// 合成 stub：实现 contract §2 的固定 API（captureBaseline/build/toHTML/toText），供 DOM 检查。
function stubModule(){const C=require('../app/core.js');return {
 captureBaseline(r){return {data:C.clone(C.visibleData(r)),layout:C.clone(C.normalizeLayout(r.layout)),capturedAt:'2026-10-13T00:00:00.000Z',label:'对照原稿'};},
 build(r){const q=C.score(r,{});return {kind:'resume-client-report',version:1,title:'简历诊断与改稿说明',job:r.data.basic.job,generatedAt:'2026-10-13T00:00:00.000Z',status:q.ready?'ready':'pending',score:{total:q.total,localTotal:q.localTotal,fresh:q.fresh,ready:q.ready},issues:q.issues.map(i=>({severity:i.severity,label:i.reason,evidence:i.evidence||'',reason:i.reason,suggestion:i.suggestion||''})),comparison:{available:!!r.clientBaseline,capturedAt:r.clientBaseline?.capturedAt||null,label:r.clientBaseline?.label||'',changes:[]},note:r.clientNote&&C.fingerprint(r)===r.clientNote.fingerprint?r.clientNote.text:'',noteStale:!!(r.clientNote&&C.fingerprint(r)!==r.clientNote.fingerprint),limitations:['诊断基于本地检查，不代表面试结果。']};},
 toHTML(m){return '<!doctype html><html><head><meta charset="utf-8"><title>'+m.title+'</title></head><body><h1>'+m.title+'</h1></body></html>';},
 toText(m){return m.title+'\n岗位：'+(m.job||'未填写');}
};}
async function setup(seed,opts={}){const html=fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');const dom=new JSDOM(html,{url:'https://resume.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.getComputedStyle=()=>({fontSize:'14.666667px'});
 if(seed)w.localStorage.setItem('resumeStudioV2',JSON.stringify({records:[seed],active:seed.id}));
 for(const name of ['core','jobs','render','ai'])w.eval(fs.readFileSync('app/'+name+'.js','utf8'));
 w.ResumeServices={};if(opts.module!==false){w.ResumeClientReport=stubModule();const originalBuild=w.ResumeClientReport.build;w.ResumeClientReport.build=(record,metrics)=>{w.__record=record;return originalBuild(record,metrics);};}
 w.eval(fs.readFileSync('app/app.js','utf8'));await tick();
 return {dom,w,doc:w.document,click:s=>w.document.querySelector(s).click(),input:(s,v)=>{const el=w.document.querySelector(s);el.focus();el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));},saved:()=>JSON.parse(w.localStorage.getItem('resumeStudioV2'))};}

test('client tab shows flow and status and disables gracefully without the module',async()=>{
 const t=await setup(C.createRecord('测试稿'),{module:false});
 try{t.click('[data-tab="client"]');await tick();
  assert.match(t.doc.querySelector('#editor-content').textContent,/客户交付|对照原稿/);
  assert.match(t.doc.querySelector('#editor-content').textContent,/client-report\.js/);
  assert.ok(!t.doc.querySelector('[data-action="client-report-preview"]'),'模块缺失时不应出现预览按钮');
  assert.match(t.doc.querySelector('#editor-content').textContent,/原有功能不受影响/);
 }finally{t.dom.window.close();}
});
test('saving a baseline stores the captured model without clearing score or facts',async()=>{
 const r=C.createRecord('对照测试');r.data.basic.name='演示用户';r.data.basic.phone='13800000000';r.data.basic.job='行政助理';r.data.work=[{company:'演示公司',position:'助理',start:'2023.07',end:'至今',desc:'整理项目档案'}];r.factsConfirmed=true;
 const t=await setup(r);
 try{t.click('[data-tab="client"]');t.click('[data-action="client-baseline"]');await tick();
  const saved=t.saved().records[0];
  assert.ok(saved.clientBaseline&&saved.clientBaseline.data,'clientBaseline 已按固定模型保存');
  assert.equal(saved.clientBaseline.data.basic.name,'演示用户');
  assert.equal(saved.factsConfirmed,true,'保存原稿不清除事实确认');
  assert.match(t.doc.querySelector('#editor-content').textContent,/已保存/);
 }finally{t.dom.window.close();}
});
test('replacing an existing baseline asks for confirmation and checkpoints first',async()=>{
 const r=C.createRecord('替换测试');r.data.basic.job='原岗位';const t=await setup(r);
 try{t.click('[data-tab="client"]');t.click('[data-action="client-baseline"]');await tick();assert.ok(t.saved().records[0].clientBaseline);
  let asked=false;t.w.confirm=()=>{asked=true;return false;};
  r.data.basic.job='新岗位';t.click('[data-tab="content"]');t.input('[data-field="basic.job"]','新岗位');t.click('[data-tab="client"]');await tick();
  t.click('[data-action="client-baseline"]');await tick();
  assert.ok(asked,'已有原稿时必须先确认');assert.equal(t.saved().records[0].clientBaseline.data.basic.job,'原岗位','取消后不覆盖');
  t.w.confirm=()=>true;t.click('[data-action="client-baseline"]');await tick();
  assert.equal(t.saved().records[0].clientBaseline.data.basic.job,'新岗位');
  assert.ok(t.saved().records[0].history.some(h=>h.snapshot.data.basic.job==='原岗位'),'替换前保留历史快照');
 }finally{t.dom.window.close();}
});
test('client note saves with fingerprint and flags stale note after content changes',async()=>{
 const r=C.createRecord('说明测试');const t=await setup(r);
 try{t.click('[data-tab="client"]');t.input('#client-note','本次只调整了简介的表达。');t.click('[data-action="client-save-note"]');await tick();
  const saved=t.saved().records[0];assert.equal(saved.clientNote.text,'本次只调整了简介的表达。');assert.ok(saved.clientNote.fingerprint);
  assert.doesNotMatch(t.doc.querySelector('#editor-content').textContent,/已过期/);
  t.click('[data-tab="content"]');t.input('[data-field="basic.job"]','产品助理');t.click('[data-tab="client"]');await tick();
  assert.match(t.doc.querySelector('#editor-content').textContent,/已过期/,'稿件变化后说明应提示过期');
  const after=t.saved().records[0];assert.equal(after.clientNote.text,'本次只调整了简介的表达。','过期说明保留原值等待重新核对');
 }finally{t.dom.window.close();}
});
test('preview renders toHTML in a sandbox iframe and export guards stale fingerprints',async()=>{
 const r=C.createRecord('预览测试');r.data.basic.name='演示用户';r.data.basic.phone='13800000000';r.data.basic.job='行政助理';r.data.work=[{company:'演示公司',position:'助理',start:'2023.07',end:'至今',desc:'整理项目档案'}];
 const t=await setup(r);
 try{let html='';
  t.click('[data-tab="client"]');t.click('[data-action="client-report-preview"]');await tick();
  const frame=t.doc.querySelector('#modal-root iframe');
  assert.ok(frame,'预览在 modal 内以 iframe 展示');assert.equal(frame.getAttribute('sandbox'),'','iframe 必须 sandbox');
  html=frame.getAttribute('srcdoc');assert.match(html,/简历诊断与改稿说明/);
  // 未勾选核对不允许导出
  t.click('[data-action="client-export-html"]');await tick();assert.match(t.doc.querySelector('#toast').textContent,/勾选/);
  // 勾选后导出
  let blob,filename;t.w.URL.createObjectURL=b=>{blob=b;return 'blob:test-download';};t.w.URL.revokeObjectURL=()=>{};t.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
  t.click('#client-report-ack');t.click('[data-action="client-export-html"]');
  assert.equal(filename,'简历诊断与改稿说明.html');
  // 稿件变化后导出被阻止并重新预览
  filename=undefined;t.w.__record.data.basic.name='新名字';await tick();
  t.click('#client-report-ack');t.click('[data-action="client-export-html"]');await tick();
  const frame2=t.doc.querySelector('#modal-root iframe');assert.ok(frame2,'稿件已变化时应重新预览而不是导出旧报告');
  assert.equal(frame2.getAttribute('sandbox'),'');assert.equal(filename,undefined,'过期预览不能下载');
 }finally{t.dom.window.close();}
});
test('text export uses fixed Chinese filename with BOM and note fingerprint guard',async()=>{
 const r=C.createRecord('文字导出');r.data.basic.name='演示用户';r.data.basic.phone='13800000000';r.data.basic.job='行政助理';
 const t=await setup(r);
 try{let blob,filename;t.w.URL.createObjectURL=b=>{blob=b;return 'blob:test-download';};t.w.URL.revokeObjectURL=()=>{};t.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
  t.click('[data-tab="client"]');t.click('[data-action="client-report-preview"]');await tick();
  t.input('#client-note','改动说明');await tick();
  t.click('[data-action="client-export-text"]');await tick();
  const frame=t.doc.querySelector('#modal-root iframe');assert.ok(frame,'未保存说明不应移除预览');
  t.click('#client-report-ack');t.click('[data-action="client-export-text"]');
  assert.equal(filename,'简历诊断与改稿说明.txt');
  const text=await new Promise((resolve,reject)=>{const reader=new t.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);});
  assert.match(text,/简历诊断与改稿说明/);
 }finally{t.dom.window.close();}
});
