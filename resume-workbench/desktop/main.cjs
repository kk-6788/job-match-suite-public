'use strict';
const {app,BrowserWindow,ipcMain,dialog,safeStorage,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const {allowedURL,safeFilename,validateRequest}=require('./security.cjs');
let main;
const ownsInstance=app.requestSingleInstanceLock();
if(!ownsInstance)app.quit();
app.on('second-instance',()=>{if(main){if(main.isMinimized())main.restore();main.show();main.focus();}});
function assertSender(event){if(!main||event.sender!==main.webContents||event.senderFrame!==main.webContents.mainFrame)throw new Error('无效调用来源');}
function lockWindow(win){win.webContents.setWindowOpenHandler(({url})=>{if(allowedURL(url)&&new URL(url).protocol==='https:')shell.openExternal(url);return{action:'deny'};});win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.on('will-attach-webview',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));}
if(ownsInstance)app.whenReady().then(()=>{
main=new BrowserWindow({width:1480,height:980,minWidth:1000,minHeight:720,title:'简历工作台',autoHideMenuBar:true,backgroundColor:'#f0f4f6',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});lockWindow(main);main.loadFile(path.join(__dirname,'../index.html'));
async function apiRequest(args,route,method){const url=validateRequest(args,route,method);let body;if(method==='POST'){body=JSON.stringify(args.body);if(!body||body.length>4000000)throw new Error('请求过大或为空');}const response=await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+args.key},...(body?{body}:{}),redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('接口请求失败 HTTP '+response.status);const text=await response.text();if(text.length>8000000)throw new Error('响应过大');try{return JSON.parse(text);}catch{throw new Error('接口未返回 JSON');}}
ipcMain.handle('resume:open-matcher',async(event,profile)=>{assertSender(event);const json=JSON.stringify(profile);if(!json||json.length>250000)throw Error('职业信息过大');const data=require('../../job-matcher/core.js').professionalData(profile);require('../../job-matcher/desktop.cjs').createMatcherWindow(data);return true;});
ipcMain.handle('resume:chat',async(event,args)=>{assertSender(event);return apiRequest(args,'chat','POST');});
ipcMain.handle('resume:models',async(event,args)=>{assertSender(event);return apiRequest(args,'models','GET');});
ipcMain.handle('resume:save-config',async(event,config)=>{assertSender(event);if(!safeStorage.isEncryptionAvailable())throw new Error('系统密钥加密不可用，请使用本次会话配置');const json=JSON.stringify(config);if(json.length>64000)throw new Error('配置过大');await fs.writeFile(path.join(app.getPath('userData'),'provider-config.bin'),safeStorage.encryptString(json));return true;});
ipcMain.handle('resume:load-config',async(event)=>{assertSender(event);try{return JSON.parse(safeStorage.decryptString(await fs.readFile(path.join(app.getPath('userData'),'provider-config.bin'))));}catch(error){if(error.code==='ENOENT')return null;throw new Error('无法读取加密配置，请重新填写');}});
ipcMain.handle('resume:print-pdf',async(event,args)=>{assertSender(event);if(!args||typeof args.html!=='string'||typeof args.css!=='string'||args.html.length+args.css.length>16000000)throw new Error('无效导出内容');const result=await dialog.showSaveDialog(main,{title:'导出 PDF',defaultPath:safeFilename(args.filename),filters:[{name:'PDF 文档',extensions:['pdf']}]});if(result.canceled)return{canceled:true};const print=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,javascript:false}});lockWindow(print);try{const csp="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";const doc=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${args.css}</style><style>html,body{margin:0!important;padding:0!important;background:white!important}body>#resume-sheet{display:block!important;position:static!important;transform:none!important;margin:0!important;box-shadow:none!important;overflow:visible!important}@page{size:A4;margin:12mm}</style></head><body>${args.html}</body></html>`;await print.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(doc));const pdf=await print.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true});await fs.writeFile(result.filePath,pdf);return{saved:true};}finally{print.destroy();}});
});
app.on('window-all-closed',()=>app.quit());


