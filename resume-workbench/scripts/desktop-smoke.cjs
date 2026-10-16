'use strict';
// Run with an unmodified Electron runtime: work/electron-smoke-runtime/electron.exe scripts/desktop-smoke.cjs
const {app,BrowserWindow,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs');
app.disableHardwareAcceleration();
const root=path.resolve(__dirname,'..'),out=path.join(root,'work','desktop-smoke-2.1');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile'));
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(out,'smoke.pdf')});
const timeout=setTimeout(()=>{console.error('SMOKE TIMEOUT');app.exit(2);},45000);
require(path.join(root,'outputs','简历工作台-2.1-Windows','resources','app','desktop','main.cjs'));
app.whenReady().then(async()=>{try{const win=BrowserWindow.getAllWindows()[0];win.hide();if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));const result=await win.webContents.executeJavaScript(`(async()=>{const record=ResumeCore.createRecord('导出测试',{basic:{name:'导出验证',job:'项目专员',phone:'13800000000',email:'test@example.com',city:'上海'},summary:'测试文档，仅用于验证导出，不包含真实个人资料。',work:[{company:'测试公司',position:'项目专员',start:'2023.01',end:'至今',desc:'协调项目记录并整理交付文档。'}],edu:[{school:'测试大学',major:'管理学',degree:'本科',start:'2019.09',end:'2023.06'}],skills:[{name:'Excel',level:3}]});const sheet=document.getElementById('resume-sheet');ResumeRender.render(record,sheet);const bridge={chat:typeof resumeDesktop.chat,models:typeof resumeDesktop.listModels,pdf:typeof resumeDesktop.printPDF,node:typeof require};const pdf=await ResumeServices.exportPDF(sheet,'smoke');return {bridge,pdf,sheetWidth:sheet.offsetWidth};})()`);const stat=fs.statSync(path.join(out,'smoke.pdf'));if(stat.size<3000)throw Error('PDF unexpectedly small');fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...result,pdfBytes:stat.size},null,2));console.log(JSON.stringify({...result,pdfBytes:stat.size}));clearTimeout(timeout);app.exit(0);}catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}});


