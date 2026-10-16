'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.join(__dirname,'../job-matcher'),tick=()=>new Promise(r=>setTimeout(r,25));
const jobs=[0,1].map(i=>({title:'运营'+i,company:'测试公司',city:'上海',education:'硕士',experience:'5年以上',source:'boss',description:'内容策划',url:'https://www.zhipin.com/job_detail/test'+i+'.html'}));
function setup(t,analyze){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document,seen={preview:[],calls:0,exports:[]};
 w.jobDesktop={initial:async()=>({basic:{job:'运营',city:'上海'},edu:[{degree:'本科'}],skills:[{name:'内容策划'}]}),cancel:async()=>true,onProgress:()=>{},search:async a=>({results:[{requestId:a.requestId,key:'boss',source:'boss',status:'ok',jobs}]}),aiCancel:async()=>true,aiPreview:async a=>{seen.preview.push(a);return{ticket:1,payload:{profile:a.profile,jobs:[{id:'job-0'},{id:'job-1'}]}}},aiAnalyze:async a=>{seen.calls++;return analyze?analyze(a):{items:jobs.map((j,i)=>({id:'job-'+i,url:j.url,score:i?90:70,summary:'虚构测试分析',strengths:['内容策划'],gaps:['学历差一级'],unknowns:['详情待核对'],evidence:[]})),usage:{total_tokens:100}}},openExternal:async()=>true};
 w.Blob=class{constructor(parts){this.text=parts.join('')}};w.URL.createObjectURL=b=>{seen.exports.push(b.text);return'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 for(const f of ['shared/resume-core.js','shared/resume-services.js','core.js','app.js'])w.eval(fs.readFileSync(path.join(root,f),'utf8'));
 return{w,d,seen,async start(){await tick();d.querySelector('#experience').value='3';d.querySelector('#search').click();await tick();},async prepare(){d.querySelector('#ai-enabled').click();d.querySelector('#ai-url').value='http://127.0.0.1:1234/v1';d.querySelector('#ai-model').value='test';d.querySelector('#ai-prepare').click();await tick();}};
}
test('不接AI正常搜索，轻微差距保留；开启后预览无外发，点击发送才调用并能导出',async t=>{
 const ui=setup(t);await ui.start();assert.equal(ui.d.querySelectorAll('.job').length,2);assert.equal(ui.seen.calls,0);assert.match(ui.d.querySelector('#jobs').textContent,/可尝试/);
 await ui.prepare();assert.equal(ui.seen.calls,0);assert.equal(ui.d.querySelector('#ai-preview').hidden,false);
 ui.d.querySelector('#ai-run').click();await tick();assert.equal(ui.seen.calls,1);assert.match(ui.d.querySelector('.job h3').textContent,/运营1/);assert.match(ui.d.querySelector('#ai-status').textContent,/100 tokens/);
 ui.d.querySelector('#export').click();assert.match(ui.seen.exports[0],/AI 匹配分：90/);
 ui.d.querySelector('#ai-enabled').click();assert.doesNotMatch(ui.d.querySelector('#jobs').textContent,/虚构测试分析/);assert.match(ui.d.querySelector('.job h3').textContent,/运营0/);
});
test('AI失败不丢岗位，显示规则回退；服务错误不替换原链接',async t=>{
 const ui=setup(t,()=>Promise.reject(Error('测试服务不可用')));await ui.start();await ui.prepare();ui.d.querySelector('#ai-run').click();await tick();assert.equal(ui.d.querySelectorAll('.job').length,2);assert.match(ui.d.querySelector('#ai-status').textContent,/保留本地规则/);assert.equal(ui.d.querySelector('[data-job-url]').dataset.jobUrl,jobs[0].url);
});
for(const event of ['关闭','修改条件','停止'])test(event+'后忽略迟到AI响应',async t=>{
 let resolve;const ui=setup(t,()=>new Promise(r=>resolve=r));await ui.start();await ui.prepare();ui.d.querySelector('#ai-run').click();await tick();
 if(event==='关闭')ui.d.querySelector('#ai-enabled').click();else if(event==='停止')ui.d.querySelector('#ai-stop').click();else{ui.d.querySelector('#skills').value='SQL';ui.d.querySelector('#skills').dispatchEvent(new ui.w.Event('input'));}
 resolve({items:[{url:jobs[0].url,score:99,summary:'迟到旧结果',strengths:[],gaps:[],unknowns:[]}]});await tick();assert.doesNotMatch(ui.d.querySelector('#jobs').textContent,/迟到旧结果/);assert.equal(ui.d.querySelector('#ai-stop').hidden,true);
});
test('修改岗位要求使预览失效，下次预览携带补充文本',async t=>{
 const ui=setup(t);await ui.start();await ui.prepare();const area=ui.d.querySelector('.job-jd textarea');area.value='SQL 分析运营转化，完整要求测试';area.dispatchEvent(new ui.w.Event('input'));assert.equal(ui.d.querySelector('#ai-preview').hidden,true);ui.d.querySelector('#ai-prepare').click();await tick();assert.equal(ui.seen.preview.at(-1).descriptions[jobs[0].url],area.value);
});
