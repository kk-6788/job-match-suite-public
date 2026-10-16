'use strict';
// Integration test for this app only. Uses synthetic data and an isolated Electron profile.
const {app,BrowserWindow,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'work','render-verification-2.1');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile-'+Date.now()));app.disableHardwareAcceleration();
let pdfName='preview.pdf';dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(out,pdfName)});
const timer=setTimeout(()=>{console.error('verification timeout');app.exit(2);},90000);
require(path.join(root,'outputs','简历工作台-2.1-Windows','resources','app','desktop','main.cjs'));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];win.hide();
 if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
 const run=async code=>{const result=await win.webContents.executeJavaScript('(async()=>{try{return await ('+code+');}catch(e){return {__testError:e.stack||e.message};}})()');if(result?.__testError)throw Error(result.__testError);return result;};
 const errors=[];win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
 await run(String.raw`new Promise(resolve=>{const wait=()=>document.querySelector('[data-field="basic.name"]')?resolve():setTimeout(wait,20);wait();})`);
 await run(String.raw`(()=>{const set=(s,v)=>{const el=document.querySelector(s);el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};set('[data-field="basic.name"]','林知远');set('[data-field="basic.job"]','行政 / 项目协调');set('[data-field="basic.phone"]','13800000000');set('[data-field="basic.email"]','demo@example.com');set('[data-field="basic.city"]','杭州');document.querySelector('[data-action="add-entry"][data-section="work"]').click();set('[data-field="work.0.company"]','青禾项目团队（演示）');set('[data-field="work.0.position"]','项目协调');set('[data-field="work.0.start"]','2023.07');set('[data-field="work.0.end"]','至今');set('[data-field="work.0.desc"]','统筹团队周会，整理任务清单并跟踪交付进度。\n建立文件分类目录，协助同事查找历史项目资料。\n所有信息仅用于界面与导出验证，并非真实求职材料。');set('[data-field="summary"]','熟悉会议组织、资料归档与跨部门协作，能够清晰梳理任务并推进落实。');document.querySelector('.editor-content').scrollTop=0;})()`);
 await new Promise(r=>setTimeout(r,180));
 const workbenchPNG=await run(String.raw`html2canvas(document.querySelector('#app'),{scale:1}).then(c=>c.toDataURL('image/png'))`);fs.writeFileSync(path.join(out,'workbench-dom.png'),Buffer.from(workbenchPNG.split(',')[1],'base64'));
 const templates=await run(String.raw`Object.keys(ResumeCore.TEMPLATES)`),results=[];
 await run(String.raw`(()=>{document.querySelector('[data-tab="layout"]').click();})()`);
 const gallery=await run(String.raw`({count:document.querySelectorAll('[data-sample].resume-sheet').length,selected:document.querySelector('[data-template][aria-pressed="true"]').dataset.template,overflow:document.querySelector('.editor-content').scrollWidth>document.querySelector('.editor-content').clientWidth+2})`);
 assert.equal(gallery.count,7);assert.ok(!gallery.overflow,'template gallery overflows editor');
 const galleryPNG=await run(String.raw`html2canvas(document.querySelector('#app'),{scale:1}).then(c=>c.toDataURL('image/png'))`);fs.writeFileSync(path.join(out,'template-gallery.png'),Buffer.from(galleryPNG.split(',')[1],'base64'));
 for(const template of templates){const measured=await run(String.raw`(()=>{document.querySelector('[data-tab="layout"]').click();document.querySelector('[data-template="${template}"]').click();const el=document.querySelector('#resume-sheet');return {template:'${template}',text:el.textContent,minFont:Math.min(...Array.from(el.querySelectorAll('*')).filter(x=>Array.from(x.childNodes).some(c=>c.nodeType===3&&c.textContent.trim())).map(x=>parseFloat(getComputedStyle(x).fontSize)*.75)),width:el.offsetWidth,overflow:el.scrollWidth>el.clientWidth+2};})()`);assert.ok(measured.minFont>=9.99,template+' has tiny font '+measured.minFont);assert.ok(!measured.overflow,template+' overflow');assert.match(measured.text,/所有信息仅用于/);pdfName=template+'.pdf';await run(String.raw`ResumeServices.exportPDF(document.querySelector('#resume-sheet'),'${template}')`);results.push({...measured,text:undefined,pdfBytes:fs.statSync(path.join(out,pdfName)).size});}
 const pdfBytes=Array.from(fs.readFileSync(path.join(out,'classic.pdf')));
 const pdfText=await run(`ResumeServices.readPDF(new File([new Uint8Array(${JSON.stringify(pdfBytes)})],'roundtrip.pdf',{type:'application/pdf'}))`);
 assert.match(pdfText,/林知远/,'PDF import should retain the name');
 const docxText=await run(String.raw`(async()=>{const r=ResumeCore.createRecord('Word测试',{basic:{name:'Word回读测试',job:'行政'},work:[{company:'演示团队',position:'协调',desc:'整理资料并交付归档目录。'}]});const doc=await ResumeServices.createDocx(r);const file=new File([await docx.Packer.toBlob(doc)],'roundtrip.docx');return ResumeServices.readDocx(file);})()`);
 assert.match(docxText,/归档目录/,'DOCX import should retain experience');
 // Capture PNG at natural paper size even though UI preview is scaled.
 const download=new Promise((resolve,reject)=>{win.webContents.session.once('will-download',(_e,item)=>{item.setSavePath(path.join(out,'watermark.png'));item.once('done',(_e,state)=>state==='completed'?resolve():reject(Error('PNG download '+state)));});});
 await run(String.raw`ResumeServices.exportPNG(document.querySelector('#resume-sheet'),'watermark','演示预览 · 仅供确认')`);await download;
 // Long content must never be clipped and should paginate without sub-10pt text.
 await run(String.raw`(()=>{document.querySelector('[data-tab="content"]').click();const e=document.querySelector('[data-field="work.0.desc"]');e.value=Array.from({length:65},(_,i)=>'第'+(i+1)+'项：这是用于验证分页的真实布局测试文字，检查每行能否完整导出。').join('\n')+'\n最终行完整保留。';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const long=await run(String.raw`({caption:document.querySelector('#preview-caption').textContent,height:document.querySelector('#resume-sheet').offsetHeight,hasLast:document.querySelector('#resume-sheet').textContent.includes('最终行完整保留。')})`);assert.ok(long.hasLast&&long.height>1123);pdfName='long.pdf';await run(String.raw`ResumeServices.exportPDF(document.querySelector('#resume-sheet'),'long')`);
 // Mobile layout must keep app controls within viewport; paper can scroll within its panel.
 win.setMinimumSize(360,500);win.setContentSize(390,844);await new Promise(r=>setTimeout(r,150));
 const mobile=await run(String.raw`({width:innerWidth,documentWidth:document.documentElement.scrollWidth})`);assert.ok(mobile.documentWidth<=mobile.width+2,'mobile document horizontally overflows');
 await run(String.raw`(()=>{document.querySelector('[data-tab="layout"]').click();})()`);
 const mobileGallery=await run(String.raw`({width:innerWidth,documentWidth:document.documentElement.scrollWidth})`);assert.ok(mobileGallery.documentWidth<=mobileGallery.width+2,'mobile gallery overflows');
 const mobilePNG=await run(String.raw`html2canvas(document.querySelector('#app'),{scale:1,height:844}).then(c=>c.toDataURL('image/png'))`);fs.writeFileSync(path.join(out,'mobile-dom.png'),Buffer.from(mobilePNG.split(',')[1],'base64'));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({templates:results,gallery,long,mobile,mobileGallery,pdfImport:true,docxImport:true,errors},null,2));assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({templates:results.length,long,mobile,pngBytes:fs.statSync(path.join(out,'watermark.png')).size,errors}));clearTimeout(timer);app.exit(0);
}catch(e){console.error(e.stack||e);clearTimeout(timer);app.exit(1);}});
