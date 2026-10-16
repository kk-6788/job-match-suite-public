'use strict';
const {app,BrowserWindow,ipcMain,shell}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const C=require('./core.js'),E=require('./extractors.js'),S=require('./security.cjs');
const AI=require('./ai-rerank.cjs');
const LocalAI=require('./local-ai.cjs');
const windows=new Map();
const SOURCE_NAMES={boss:'BOSS 直聘',liepin:'猎聘',zhilian:'智联招聘','51job':'前程无忧',lagou:'拉勾（试读）',ncss:'国家大学生就业服务平台',yingjiesheng:'应届生求职网（试读）',guopin:'国聘',yupao:'鱼泡直聘',shixiseng:'实习僧',company:'公司官网',discovery:'查找公司招聘页'};
const localURL=pathToFileURL(path.join(__dirname,'index.html')).href;
let registered=false;
function owner(event){const state=windows.get(event.sender.id);if(!state||event.sender!==state.win.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==localURL)throw Error('无效调用来源');return state;}
function checkSize(value,max=250000){let json;try{json=JSON.stringify(value);}catch{throw Error('无效输入');}if(!json||json.length>max)throw Error('输入过大或为空');}
function progress(state,data){if(!state.win.isDestroyed())state.win.webContents.send('jobmatch:progress',data);}
function requestId(value){if(!Number.isSafeInteger(value)||value<1)throw Error('无效任务标识');return value;}
function sourceWindow(state,key,source,url){
  if(!SOURCE_NAMES[source]||!S.safePublicURL(url))throw Error('只支持公开 HTTPS 招聘页面');
  const old=state.sources.get(key);if(old&&!old.win.isDestroyed()){old.initialURL=url;old.loading=old.win.loadURL(url).then(()=>null,error=>error.message);return old;}
  const win=new BrowserWindow({show:false,width:1280,height:900,title:SOURCE_NAMES[source],autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'persist:jobmatch-'+source}});
  const item={key,source,initialURL:url,win,loading:win.loadURL(url).then(()=>null,error=>error.message)};
  state.sources.set(key,item);
  const allowed=url=>S.allowedSourceURL(url,source,item.initialURL);
  win.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
  win.webContents.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
  win.webContents.setWindowOpenHandler(({url})=>{if(item.linkCapture){const capture=item.linkCapture;item.linkCapture=null;capture(allowed(url)&&E.isDetailUrl(url,'guopin')?url:'');return{action:'deny'};}if(allowed(url))item.loading=win.loadURL(url).then(()=>null,error=>error.message);return{action:'deny'};});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,done)=>done(false));
  win.webContents.session.on('will-download',(_event,download)=>download.cancel());
  win.on('closed',()=>{if(state.sources.get(key)===item)state.sources.delete(key);});
  return item;
}
function safeResult(value,item){
  if(!value||typeof value!=='object')return{status:'error',message:'页面未返回可读取的内容',jobs:[]};
  const actualURL=item.win.webContents.getURL();
  if(!S.allowedSourceURL(actualURL,item.source,item.initialURL))return{status:'error',message:'页面离开了当前招聘来源',jobs:[]};
  const jobs=(Array.isArray(value.jobs)?value.jobs:[]).slice(0,50).filter(j=>j&&typeof j.title==='string'&&S.safePublicURL(j.url)&&(item.source==='company'||E.isDetailUrl(j.url,item.source))).map(j=>C.normalizeJob({...j,source:item.source,sourceUrl:actualURL,collectedAt:new Date().toISOString()}));
  const candidates=(Array.isArray(value.candidates)?value.candidates:[]).slice(0,20).filter(c=>c&&S.safePublicURL(c.url)).map(c=>({url:c.url.slice(0,2048),title:String(c.title||'招聘页').slice(0,150)}));
  const status=jobs.length?'ok':['need-login','verification','empty','timeout','error','ok'].includes(value.status)?value.status:'error';
  return{jobs,candidates,status,message:String(value.message||'').slice(0,500)};
}
// 国聘卡片通过标题点击打开详情：只捕获真实 URL，不执行申请/收藏，不加载新页面。
async function collectGuopinLinks(item){
  const links=[],names=await item.win.webContents.executeJavaScript("[...document.querySelectorAll('.job-card .job-name')].slice(0,10).map(e=>e.textContent.trim())");
  for(let index=0;index<names.length;index++){
    if(item.win.isDestroyed())break;
    let timer;
    const opened=new Promise(resolve=>{item.linkCapture=resolve;timer=setTimeout(()=>resolve(''),700);});
    try{
      await item.win.webContents.executeJavaScript("document.querySelectorAll('.job-card .job-name')["+index+"]?.click()");
      const url=await opened;if(!url)break;links.push({index,title:names[index],url});
    }finally{clearTimeout(timer);item.linkCapture=null;}
  }return links;
}
async function extract(item){
  if(item.source==='yingjiesheng'&&!item.queryDone)return{jobs:[],status:'need-login',message:'请登录应届生求职网，再点击继续读取完成关键词搜索。'};
  // 51job 不为卡片渲染锚点。只读公开岗位组件的 ID/原始 jobHref，再在隔离世界提取 DOM。
  const links=item.source==='guopin'?await collectGuopinLinks(item):item.source==='51job'?await item.win.webContents.executeJavaScript(E.build51jobLinksScript()):[];
  const data=await item.win.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:E.buildScript(item.source,links)}]);return safeResult(data,item);
}
// 通过已核对的页面搜索控件提交关键词；不调用投递或收藏。
async function searchCampus(item){
  const query=JSON.stringify(String(item.query||'').slice(0,100));
  if(item.source==='ncss'){
    const result=await item.win.webContents.executeJavaScript(`new Promise(resolve=>{
      const input=document.querySelector('.searchKeywords'),button=document.querySelector('#jobSearch'),list=document.querySelector('#jobLIST');
      if(!input||!button||!list){resolve(false);return;}
      let timer;const observer=new MutationObserver(()=>{if(!list.querySelector('.loading-box')&&(list.querySelector('.jobList')||list.querySelector('.checklistnone'))){clearTimeout(timer);observer.disconnect();resolve(true);}});
      observer.observe(list,{childList:true,subtree:true});timer=setTimeout(()=>{observer.disconnect();resolve(false)},12000);
      input.value=${query};input.dispatchEvent(new Event('input',{bubbles:true}));button.click();
    })`);
    if(!result)throw Error('关键词搜索未完成，请打开来源核对后继续读取');item.queryDone=true;
  }else{
    if(/\/login/.test(item.win.webContents.getURL()))return;
    const started=await item.win.webContents.executeJavaScript(`(()=>{const input=document.querySelector('#keywordInput'),button=document.querySelector('.search-button');if(!input||!button)return false;input.value=${query};input.dispatchEvent(new Event('input',{bubbles:true}));button.click();return true})()`);
    if(!started)throw Error('未找到关键词搜索控件，请在来源页完成搜索后继续读取');
    await new Promise(resolve=>setTimeout(resolve,2500));
    if(item.win.isDestroyed())return;
    const url=new URL(item.win.webContents.getURL());item.queryDone=!/\/login/.test(url.pathname)&&url.pathname!=='/';
  }
}
async function readSource(state,item,generation,id){
  const base={requestId:id,key:item.key,source:item.source,label:SOURCE_NAMES[item.source],url:item.initialURL};
  const active=()=>generation===state.generation&&!state.win.isDestroyed()&&!item.win.isDestroyed();
  progress(state,{...base,status:'loading',message:'正在读取页面…',jobs:[]});
  let data={status:'empty',message:'页面未读到具体岗位。可打开页面核对后继续读取。',jobs:[]};
  try{
    const loading=await Promise.race([item.loading,new Promise(resolve=>setTimeout(()=>resolve('页面加载超时'),14000))]);
    if(!active())return null;
    if(loading)throw Error(loading);
    if(['ncss','yingjiesheng'].includes(item.source)&&!item.queryDone){await searchCampus(item);if(!active())return null;}
    for(let i=0;i<6&&active();i++){
      if(item.win.webContents.isLoadingMainFrame()){await new Promise(resolve=>setTimeout(resolve,1800));continue;}
      data=await Promise.race([extract(item),new Promise((_,reject)=>setTimeout(()=>reject(Error('页面读取超时')),item.source==='guopin'?12000:4000))]);
      if(data.jobs.length||data.candidates?.length||['need-login','verification'].includes(data.status))break;
      await new Promise(resolve=>setTimeout(resolve,1800));
    }
  }catch(error){data={status:'error',message:error.message,jobs:[]};}
  if(!active())return null;
  const result={...base,...data};state.results.set(item.key,result);progress(state,result);return result;
}
function register(){
  if(registered)return;registered=true;
  ipcMain.handle('jobmatch:ai-local-service',event=>{const state=owner(event);state.aiLocalKey=LocalAI.readKey();return{baseUrl:'https://api.deepseek.com',model:'deepseek-flash'};});
  ipcMain.handle('jobmatch:ai-cancel',event=>{const state=owner(event);state.aiController?.abort();state.aiDraft=null;return true;});
  ipcMain.handle('jobmatch:ai-preview',(event,args)=>{
    const state=owner(event);checkSize(args,300000);state.aiController?.abort();
    const jobs=C.rankJobs(C.dedupeJobs([...state.results.values()].flatMap(r=>r.jobs||[])),args.profile,args.prefs).filter(j=>!j.excluded).slice(0,10);
    if(!jobs.length)throw Error('请先查找岗位');
    for(const job of jobs){const extra=args.descriptions?.[job.url];if(typeof extra==='string')job.description=extra.slice(0,12000);}
    const payload=AI.preparePayload({profile:args.profile,resume:args.resume,jobs});
    const ticket=(state.aiTicket||0)+1;state.aiTicket=ticket;state.aiDraft={ticket,payload,urls:jobs.map(j=>j.url)};
    return{ticket,payload};
  });
  ipcMain.handle('jobmatch:ai-analyze',async(event,args)=>{
    const state=owner(event);checkSize(args,10000);const draft=state.aiDraft;
    if(!draft||args.ticket!==draft.ticket)throw Error('分析内容已变化，请重新预览');
    if(state.aiController)throw Error('已有精排正在执行');
    const controller=new AbortController();state.aiController=controller;state.aiDraft=null;
    try{const result=await AI.analyze({config:LocalAI.resolve(args.config,state.aiLocalKey),payload:draft.payload,signal:controller.signal});return{...result,items:result.items.map(item=>({...item,url:draft.urls[Number(item.id.slice(4))]}))};}
    finally{if(state.aiController===controller)state.aiController=null;}
  });
  ipcMain.handle('jobmatch:initial',event=>owner(event).initial);
  ipcMain.handle('jobmatch:cancel',event=>{owner(event).generation++;return true;});
  ipcMain.handle('jobmatch:open-source',(event,key)=>{const state=owner(event),item=state.sources.get(String(key));if(!item||item.win.isDestroyed())throw Error('请先开始查找岗位');item.win.show();item.win.focus();return true;});
  ipcMain.handle('jobmatch:external',async(event,url)=>{owner(event);if(!S.safeExternalURL(url))throw Error('只支持公开 HTTPS 页面');await shell.openExternal(url);return true;});
  ipcMain.handle('jobmatch:collect',async(event,args)=>{const state=owner(event);checkSize(args,2000);const id=requestId(args.requestId),item=state.sources.get(String(args.key));if(!item)throw Error('来源窗口已关闭，请重新开始查找');const generation=++state.generation;return readSource(state,item,generation,id);});
  ipcMain.handle('jobmatch:search',async(event,args)=>{
    const state=owner(event);checkSize(args);const id=requestId(args.requestId),prefs=C.normalizePreferences(args.prefs);if(!prefs.targetRole)throw Error('请先核对目标岗位');
    const sources=(Array.isArray(args.sources)?args.sources:[]).filter(s=>['boss','liepin','zhilian','51job','lagou','shixiseng','yupao','guopin','ncss','yingjiesheng','discovery'].includes(s));
    const companyUrls=(Array.isArray(args.companyUrls)?args.companyUrls:[]).slice(0,3);if(companyUrls.some(url=>!S.safePublicURL(url)))throw Error('公司招聘页必须是公开 HTTPS 网址');
    if(!sources.length&&!companyUrls.length)throw Error('请选择至少一个来源或填写公司招聘页');
    const generation=++state.generation;state.results.clear();const plan=[...new Set(sources)].map(source=>({key:source,source,url:S.sourceURL(source,prefs)}));
    companyUrls.forEach((url,index)=>plan.push({key:'company-'+index,source:'company',url}));
    for(const job of plan){if(generation!==state.generation||state.win.isDestroyed())break;const item=sourceWindow(state,job.key,job.source,job.url);item.query=prefs.targetRole;item.queryDone=false;await readSource(state,item,generation,id);}
    return{requestId:id,canceled:generation!==state.generation,results:[...state.results.values()]};
  });
}
function createMatcherWindow(initialData){
  checkSize(initialData||{});register();
  const win=new BrowserWindow({show:true,width:1440,height:960,minWidth:820,minHeight:600,title:'岗位匹配工作台',backgroundColor:'#f2f5f7',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,partition:'persist:jobmatch-ui'}});
  const ownerId=win.webContents.id;
  const state={win,initial:C.professionalData(initialData||{}),sources:new Map(),results:new Map(),generation:0};windows.set(ownerId,state);
  win.webContents.on('will-navigate',event=>event.preventDefault());win.webContents.on('will-attach-webview',event=>event.preventDefault());win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.session.setPermissionRequestHandler((_wc,_p,done)=>done(false));
  win.on('closed',()=>{state.aiController?.abort();state.aiDraft=null;state.generation++;windows.delete(ownerId);for(const item of state.sources.values())if(!item.win.isDestroyed())item.win.destroy();state.sources.clear();});
  win.loadFile(path.join(__dirname,'index.html'));return win;
}
function startStandalone(){const owns=app.requestSingleInstanceLock();if(!owns){app.quit();return;}app.on('second-instance',()=>{for(const state of windows.values()){state.win.show();state.win.focus();break;}});app.whenReady().then(()=>createMatcherWindow({}));app.on('window-all-closed',()=>app.quit());}
if(require.main===module)startStandalone();
module.exports={createMatcherWindow,startStandalone};
