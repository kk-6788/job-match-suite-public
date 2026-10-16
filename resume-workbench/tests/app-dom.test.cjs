const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),C=require('../app/core.js');
const tick=()=>new Promise(r=>setTimeout(r,25));
test('screenshot prose fills the import form locally and shows readable review labels',async()=>{
 const t=await setup(C.createRecord());try{t.click('[data-action="import"]');t.input('#import-text','林同学，2024 年 4 月至 2025 年 3 月任产品助理，负责资料整理、竞品汇总和活动执行；未提供业绩数字。可用来测试输入、预览和导出；业绩留空。');t.click('[data-action="extract"]');await tick();
  assert.equal(t.doc.querySelector('[data-review][data-field="basic.name"]').value,'林同学');assert.equal(t.doc.querySelector('[data-review][data-field="work.0.position"]').value,'产品助理');assert.equal(t.doc.querySelector('[data-review][data-field="work.0.start"]').value,'2024.04');assert.equal(t.doc.querySelector('[data-review][data-field="basic.job"]').value,'');
  assert.doesNotMatch(t.doc.querySelector('.review-fields').textContent,/basic\.name|sourceText/);assert.match(t.doc.querySelector('.review-fields').textContent,/称呼/);
 }finally{t.dom.window.close();}
});
test('existing management menu still deletes the selected record',async()=>{
 const r=C.createRecord('保留原稿'),t=await setup(r);try{
  t.click('[data-action="record-menu"]');t.click('[data-action="duplicate"]');await tick();
  t.click('[data-action="record-menu"]');t.click('[data-action="delete-record"]');t.click('[data-action="confirm-delete"]');await tick();
  assert.equal(t.saved().records.length,1);assert.equal(t.saved().active,r.id);assert.equal(t.saved().records[0].title,'保留原稿');
 }finally{t.dom.window.close();}
});
test('each sidebar record can be deleted without switching or deleting the active record',async()=>{
 const original=C.createRecord('旧简历'),t=await setup(original);
 try{t.click('[data-action="record-menu"]');t.click('[data-action="duplicate"]');await tick();const selected=t.saved().active;
  assert.equal(t.doc.querySelectorAll('#resume-list [data-action="delete-record"]').length,2);
  const remove='#resume-list [data-action="delete-record"][data-id="'+original.id+'"]';
  t.click(remove);assert.equal(t.saved().active,selected);assert.match(t.doc.querySelector('.modal-body').textContent,/旧简历/);
  t.click('[data-action="close-modal"]');assert.equal(t.saved().records.length,2);
  t.click(remove);t.click('[data-action="confirm-delete"]');await tick();
  assert.equal(t.saved().records.length,1);assert.equal(t.saved().records[0].id,selected);assert.equal(t.saved().active,selected);
 }finally{t.dom.window.close();}
});
test('deleting the final sidebar resume requires confirmation and creates a fresh blank record',async()=>{
 const r=C.createRecord('唯一简历'),t=await setup(r);try{
  t.click('#resume-list [data-action="delete-record"]');assert.match(t.doc.querySelector('.modal-body').textContent,/空白简历/);assert.equal(t.saved().records[0].id,r.id);
  t.click('[data-action="confirm-delete"]');await tick();assert.equal(t.saved().records.length,1);assert.notEqual(t.saved().records[0].id,r.id);assert.equal(t.saved().records[0].data.basic.name,'');
 }finally{t.dom.window.close();}
});
test('local file import fills experience review and saved preview without calling AI',async()=>{
 const r=C.createRecord('原有简历'),t=await setup(r,true);
 try{
  t.w.ResumeAI.extract=async()=>{throw Error('本地模式不应调用 AI');};
  t.w.ResumeServices.readDocx=async()=> '姓名：陈林\n教育背景\n2018.09 - 2022.06 示例大学 行政管理 本科\n工作经历\n2022.07 - 至今 示例公司 行政助理\n负责会议安排。\n项目经历\n档案整理项目\n角色：负责人\n完成归档。\n专业技能\nExcel：熟练使用数据透视表';
  t.click('[data-action="import"]');assert.equal(t.doc.querySelector('#import-ai').checked,false);
  Object.defineProperty(t.doc.querySelector('#import-file'),'files',{value:[new t.w.File(['fixture'],'测试简历.docx')]});
  t.click('[data-action="extract"]');await tick();
  assert.equal(t.doc.querySelector('[data-field="work.0.company"]').value,'示例公司');
  assert.match(t.doc.querySelector('[data-field="work.0.desc"]').value,/会议安排/);
  assert.equal(t.saved().records.length,1);t.click('#import-confirm');t.click('[data-action="apply-import"]');await tick();
  assert.equal(t.saved().records.length,2);assert.equal(t.saved().records[0].data.proj[0].role,'负责人');
  assert.match(t.doc.querySelector('#resume-sheet').textContent,/数据透视表/);assert.ok(t.saved().records[0].sourceText.includes('教育背景'));
 }finally{t.dom.window.close();}
});
test('moving an experience updates preview, resets review and can restore original order',async()=>{
 const r=C.createRecord();r.data.work=[{company:'甲公司',desc:'甲经历'},{company:'乙公司',desc:'乙经历'}];r.factsConfirmed=true;
 const t=await setup(r);try{const move='[data-action="move-entry"][data-section="work"][data-index="0"][data-step="1"]';t.click(move);await tick();assert.equal(t.saved().records[0].data.work[0].company,'乙公司');assert.equal(t.saved().records[0].factsConfirmed,false);assert.ok(t.doc.querySelector('#resume-sheet').textContent.indexOf('乙公司')<t.doc.querySelector('#resume-sheet').textContent.indexOf('甲公司'));t.click('[data-action="history"]');t.click('[data-action="restore-version"]');await tick();assert.equal(t.saved().records[0].data.work[0].company,'甲公司');}finally{t.dom.window.close();}
});
test('targeted job copy is created only on submit and keeps original JD',async()=>{
 const r=C.createRecord('原简历');r.jd='原 JD';const t=await setup(r);try{t.click('[data-action="record-menu"]');t.click('[data-action="target-copy"]');t.input('#target-job','项目助理');t.input('#target-jd','维护项目文档');assert.equal(t.saved().records.length,1);t.click('[data-action="create-target-copy"]');await tick();assert.equal(t.saved().records.length,2);assert.equal(t.saved().records[0].jd,'维护项目文档');assert.equal(t.saved().records.find(x=>x.id===r.id).jd,'原 JD');assert.equal(t.doc.querySelector('[data-field="basic.job"]').value,'项目助理');}finally{t.dom.window.close();}
});
test('plain text view escapes markup and excludes hidden material',async()=>{
 const r=C.createRecord();r.data.summary='<img src=x onerror=alert(1)>真实内容';r.notes='私密备注';const t=await setup(r);try{t.click('[data-action="export"]');t.click('[data-action="text-preview"]');assert.equal(t.doc.querySelector('#plain-resume img'),null);assert.match(t.doc.querySelector('#plain-resume').textContent,/<img src=x/);assert.doesNotMatch(t.doc.querySelector('#plain-resume').textContent,/私密备注/);}finally{t.dom.window.close();}
});
test('TXT download contains current visible resume with safe filename and Unicode text',async()=>{
 const r=C.createRecord('客户/简历:新版');r.data.basic.name='陈林';r.data.summary='不导出的隐藏内容';r.layout.hidden=['summary'];r.notes='私密备注';const t=await setup(r);
 try{let blob,filename;t.w.URL.createObjectURL=b=>{blob=b;return 'blob:test-download';};t.w.URL.revokeObjectURL=()=>{};t.w.HTMLAnchorElement.prototype.click=function(){filename=this.download;};t.click('[data-action="export"]');t.click('[data-action="text-preview"]');t.click('[data-action="export-text"]');assert.equal(filename,'客户-简历-新版.txt');const text=await new Promise((resolve,reject)=>{const reader=new t.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);});assert.match(text,/陈林/);assert.doesNotMatch(text,/私密备注|隐藏内容/);}finally{t.dom.window.close();}
});
async function setup(seed,ai=false,database=null){const html=fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');const dom=new JSDOM(html,{url:'https://resume.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;if(database)w.indexedDB=database;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};/* DOM tests have no layout engine; real font sizes are checked by verify-render. */w.getComputedStyle=()=>({fontSize:'14.666667px'});if(ai)w.localStorage.setItem('resumeStudioAI',JSON.stringify({provider:'custom',baseUrl:'https://example.test/v1',model:'mock',key:'test-only-key'}));if(seed)w.localStorage.setItem('resumeStudioV2',JSON.stringify({records:[seed],active:seed.id}));for(const name of ['core','jobs','render','ai'])w.eval(fs.readFileSync('app/'+name+'.js','utf8'));w.ResumeServices={};w.eval(fs.readFileSync('app/app.js','utf8'));await tick();return {dom,w,doc:w.document,click:s=>w.document.querySelector(s).click(),input:(s,v)=>{const el=w.document.querySelector(s);el.focus();el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));},saved:()=>JSON.parse(w.localStorage.getItem('resumeStudioV2'))};}
test('editing a confirmed resume visibly unchecks facts and persists the edit',async()=>{const r=C.createRecord();r.factsConfirmed=true;const t=await setup(r);try{assert.equal(t.doc.querySelector('[data-record="factsConfirmed"]').checked,true);t.input('[data-field="basic.name"]','界面测试');await tick();assert.equal(t.doc.querySelector('[data-record="factsConfirmed"]').checked,false);assert.equal(t.saved().records[0].data.basic.name,'界面测试');assert.equal(t.saved().records[0].factsConfirmed,false);}finally{t.dom.window.close();}});
test('text import waits for human review then creates a separate record',async()=>{const r=C.createRecord('原有客户');r.data.basic.name='原姓名';const t=await setup(r);try{t.click('[data-action="import"]');t.input('#import-text','姓名：陈林\n求职意向：行政助理\n电话：13800000000');t.click('[data-action="extract"]');await tick();assert.match(t.doc.querySelector('#modal-title').textContent,/核对/);assert.equal(t.saved().records.length,1);t.click('[data-action="apply-import"]');await tick();assert.equal(t.saved().records.length,1);t.click('#import-confirm');t.click('[data-action="apply-import"]');await tick();assert.equal(t.saved().records.length,2);assert.equal(t.saved().records.find(x=>x.id===r.id).data.basic.name,'原姓名');assert.match(t.doc.querySelector('#resume-sheet').textContent,/陈林/);}finally{t.dom.window.close();}});
test('stale second-window save cannot overwrite a newer library revision',async()=>{const t=await setup(C.createRecord('第一个窗口'));try{const updated=t.saved();updated.revision=(updated.revision||0)+1;updated.records[0].data.basic.name='另一个窗口的新内容';t.w.localStorage.setItem('resumeStudioV2',JSON.stringify(updated));t.input('[data-field="basic.name"]','旧窗口编辑');await tick();assert.equal(t.saved().records[0].data.basic.name,'另一个窗口的新内容');assert.match(t.doc.querySelector('#save-status').textContent,/失败|冲突|备份/);}finally{t.dom.window.close();}});
test('history restoration and registered layout selectors work through UI',async()=>{const t=await setup(C.createRecord());try{t.input('[data-field="basic.name"]','原版');t.input('[data-field="basic.job"]','行政');t.input('[data-field="basic.name"]','新版');await tick();t.click('[data-action="history"]');assert.ok(t.doc.querySelectorAll('[data-action="restore-version"]').length<=5);t.click('[data-action="restore-version"]');await tick();assert.match(t.doc.querySelector('#resume-sheet').textContent,/原版/);t.click('[data-tab="layout"]');assert.equal(t.doc.querySelectorAll('[data-template]').length,Object.keys(C.TEMPLATES).length);t.click('[data-template="editorial"]');assert.ok(t.doc.querySelector('#resume-sheet').classList.contains('template-editorial'));await tick();}finally{t.dom.window.close();}});
test('AI proposal requires fact confirmation and preserves undo history',async()=>{
 const r=C.createRecord();r.data.work=[{company:'演示公司',position:'协调员',start:'2023.01',end:'至今',desc:'负责会议记录'}];const t=await setup(r,true);
 try{t.w.ResumeAI.polish=async()=>({changes:[{path:'work.0.desc',before:'负责会议记录',after:'整理会议记录',reason:'表达更具体'}],warnings:[]});t.click('[data-action="polish"]');await tick();assert.equal(t.saved().records[0].data.work[0].desc,'负责会议记录');t.click('[data-action="apply-changes"]');await tick();assert.equal(t.saved().records[0].data.work[0].desc,'负责会议记录');t.click('#confirm-changes');t.click('[data-action="apply-changes"]');await tick();assert.equal(t.saved().records[0].data.work[0].desc,'整理会议记录');assert.equal(t.saved().records[0].history[0].snapshot.data.work[0].desc,'负责会议记录');}finally{t.dom.window.close();}
});
test('complete mock review gets fixed score and content edits immediately invalidate it',async()=>{
 const r=C.createRecord();r.data.basic={...r.data.basic,name:'演示用户',phone:'13800000000',job:'行政助理'};r.data.edu=[{school:'演示大学',degree:'本科',start:'2019.09',end:'2023.06'}];r.data.work=[{company:'演示公司',position:'助理',start:'2023.07',end:'至今',desc:'整理项目档案'}];r.jd='负责文件归档';r.factsConfirmed=true;const t=await setup(r,true);
 try{t.w.ResumeAI.review=async(_config,payload,rubric)=>{assert.equal(payload.history,undefined);assert.equal(payload.data.basic.photo,'');return {checks:rubric.map(c=>({id:c.id,status:'pass',path:'work.0.desc',evidence:'整理项目档案',reason:'具备对应证据',suggestion:''})),issues:[]};};t.click('[data-tab="quality"]');t.click('[data-action="review"]');await tick();assert.match(t.doc.querySelector('#quality-strip').textContent,/100/);assert.match(t.doc.querySelector('#quality-strip').textContent,/已达到交付标准/);t.click('[data-tab="content"]');t.input('[data-field="work.0.desc"]','修改了原文');await tick();assert.match(t.doc.querySelector('#quality-strip').textContent,/等待内容质量审查/);}finally{t.dom.window.close();}
});
test('IndexedDB transaction revision prevents lost updates between two windows',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),database=new IDBFactory(),one=await setup(null,false,database),two=await setup(null,false,database);
 try{two.input('[data-field="basic.name"]','最近保存的内容');await tick();one.input('[data-field="basic.name"]','过期窗口');await tick();const saved=await new Promise((resolve,reject)=>{const req=database.open('ResumeStudio',1);req.onsuccess=()=>{const db=req.result,get=db.transaction('workspace').objectStore('workspace').get('library');get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=reject;};req.onerror=reject;});assert.equal(saved.records[0].data.basic.name,'最近保存的内容');assert.match(one.doc.querySelector('#save-status').textContent,/失败/);}finally{one.dom.window.close();two.dom.window.close();}
});
