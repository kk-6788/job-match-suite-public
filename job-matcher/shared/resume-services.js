(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ResumeServices=api;})(typeof window!=='undefined'?window:globalThis,function(root){
'use strict';
const labels={summary:'个人简介',edu:'教育经历',work:'工作经历',proj:'项目经历',skills:'专业技能',certs:'证书荣誉'};
function filename(value){return String(value||'简历').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function readDocx(file){
 if(!root.mammoth)throw new Error('Word 读取组件未加载');
 const arrayBuffer=await file.arrayBuffer(),raw=(await root.mammoth.extractRawText({arrayBuffer})).value;
 // Plain paragraphs keep Mammoth's order. Floating text boxes need their visual order.
 try{return await positionedDocxText(arrayBuffer,raw)||raw;}catch{return raw;}
}
async function docxDocumentXML(arrayBuffer){
 const bytes=new Uint8Array(arrayBuffer),view=new DataView(arrayBuffer),decoder=new root.TextDecoder();
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)return null;
 let at=view.getUint32(end+16,true);const count=view.getUint16(end+10,true);
 for(let i=0;i<count;i++){
  if(view.getUint32(at,true)!==0x02014b50)return null;
  const method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),plainSize=view.getUint32(at+24,true),nameSize=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true);
  const name=decoder.decode(bytes.subarray(at+46,at+46+nameSize));
  if(name==='word/document.xml'){
   if(plainSize>8*1024*1024||view.getUint32(offset,true)!==0x04034b50)return null;
   const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true),compressed=bytes.subarray(start,start+size);
   if(method===0)return decoder.decode(compressed);
   if(method!==8||!root.DecompressionStream||!root.Response)return null;
   const reader=new root.Response(compressed).body.pipeThrough(new root.DecompressionStream('deflate-raw')).getReader();
   let total=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>8*1024*1024){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
   const output=new Uint8Array(total);let pos=0;for(const c of chunks){output.set(c,pos);pos+=c.length;}
   return decoder.decode(output);
  }
  at+=46+nameSize+extra+comment;
 }
 return null;
}
async function positionedDocxText(arrayBuffer,raw){
 if(!root.DOMParser||!root.TextDecoder)return null;
 const xml=await docxDocumentXML(arrayBuffer);if(!xml)return null;
 const doc=new root.DOMParser().parseFromString(xml,'application/xml');
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
 const elements=(node,ns,name)=>Array.from(node.getElementsByTagNameNS(ns,name));
 if(!elements(doc,W,'txbxContent').length)return null;
 // AlternateContent holds two representations of the same text: use only one.
 for(const alt of Array.from(doc.getElementsByTagNameNS('*','AlternateContent'))){const choice=Array.from(alt.children).find(x=>x.localName==='Choice'&&elements(x,W,'txbxContent').length);if(choice){for(const sibling of Array.from(alt.children))if(sibling!==choice)sibling.remove();}}
 function paragraphs(node){return elements(node,W,'p').map(p=>{let s='';const walk=n=>{for(const c of n.children){if(c.namespaceURI===W&&c.localName==='t')s+=c.textContent;else if(c.namespaceURI===W&&['tab','br','cr'].includes(c.localName))s+=c.localName==='tab'?'\t':'';else walk(c);}};walk(p);return s.trim();}).filter(Boolean).join('\n');}
 const body=elements(doc,W,'body')[0];if(!body)return null;
 const result=[];let reordered=false;
 for(const block of Array.from(body.children)){
  const boxes=[];
  for(const anchor of elements(block,WP,'anchor')){
   const contents=elements(anchor,W,'txbxContent');if(!contents.length)continue;
   const text=contents.map(paragraphs).filter(Boolean).join('\n');if(!text)continue;
   const h=elements(anchor,WP,'positionH')[0],v=elements(anchor,WP,'positionV')[0],extent=elements(anchor,WP,'extent')[0];
   const xText=h&&elements(h,WP,'posOffset')[0]?.textContent,yText=v&&elements(v,WP,'posOffset')[0]?.textContent;
   if(xText===undefined||yText===undefined||!extent)return null;
   boxes.push({x:Number(xText),y:Number(yText),width:Number(extent.getAttribute('cx')),text});
  }
  if(!boxes.length){result.push(paragraphs({getElementsByTagNameNS:(ns,name)=>block.localName===name?[block]:block.getElementsByTagNameNS(ns,name)}));continue;}
  // Group similarly aligned left edges, then read each column from top to bottom.
  // Keep each body block independent so anchors on later pages are never interleaved.
  const columns=[];
  for(const box of boxes.sort((a,b)=>a.x-b.x)){
   let column=columns.find(c=>Math.abs(c.x-box.x)<72*12700);
   if(!column){column={x:box.x,boxes:[]};columns.push(column);}column.boxes.push(box);
  }
  const plain=block.cloneNode(true);for(const n of [...elements(plain,W,'drawing'),...elements(plain,W,'pict')])n.remove();
  const normal=block.localName==='p'?Array.from(plain.getElementsByTagNameNS(W,'t')).map(n=>n.textContent).join(''):paragraphs(plain);
  if(normal.trim())result.push(normal.trim());
  for(const c of columns)result.push(...c.boxes.sort((a,b)=>a.y-b.y).map(b=>b.text));
  reordered=true;
 }
 const candidate=result.filter(Boolean).join('\n\n');
 // Do not silently lose text from unsupported shapes, headers or table structures.
 const signature=s=>Array.from(s.replace(/\s/g,'')).sort().join('');
 return reordered&&signature(candidate)===signature(raw)?candidate:null;
}
// Recover missing PDF line breaks without reordering text across columns.
function pdfPageText(items){
 let text='',previous=null;
 for(const item of items){
  if(typeof item.str!=='string')continue;
  if(previous&&!text.endsWith('\n')){
   const a=previous.transform,b=item.transform;
   const newRow=a&&b&&Math.abs(a[5]-b[5])>Math.max(2,Math.min(previous.height||10,item.height||10)*0.45);
   const gap=a&&b?b[4]-(a[4]+(previous.width||0)):null;
   const space=gap===null||gap>Math.max(1,(item.height||10)*0.15);
   text+=newRow?'\n':space?' ':'';
  }
  text+=item.str;if(item.hasEOL)text+='\n';previous=item;
 }
 return text.trim();
}
async function readPDF(file){if(!root.pdfjsLib)throw new Error('PDF 读取组件未加载');root.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';const pdf=await root.pdfjsLib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;try{const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(pdfPageText(content.items));}return pages.join('\n\n');}finally{await pdf.destroy();}}
function orderedSections(record){const layout=record.layout||{};const hidden=new Set(layout.hidden||[]);return [...new Set([...(layout.order||Object.keys(labels)),...Object.keys(labels)])].filter(k=>labels[k]&&!hidden.has(k));}
function sectionLines(data,key){if(key==='summary')return String(data.summary||'').split('\n').filter(Boolean);return (data[key]||[]).flatMap(item=>{if(key==='edu')return [[item.school,item.major,item.degree,[item.start,item.end].filter(Boolean).join(' — ')].filter(Boolean).join(' · '),item.gpa&&'GPA：'+item.gpa,item.courses&&'主修课程：'+item.courses,item.honors].filter(Boolean);if(key==='work'||key==='proj')return [[item.company||item.name,item.position||item.role,[item.start,item.end].filter(Boolean).join(' — ')].filter(Boolean).join(' · '),...String(item.desc||'').split('\n')].filter(Boolean);return [[item.name,key==='skills'?(['了解','基础','熟练','精通','专家'][Number(item.level)-1]):item.date].filter(Boolean).join(' · ')].filter(Boolean);});}
async function createDocx(record,library){const d=library||root.docx;if(!d)throw new Error('Word 导出组件未加载');const data=record.data||{},basic=data.basic||{},layout=record.layout||{};const size=Math.max(10,Number(layout.fontSize)||11)*2;const color=/^#[0-9a-f]{6}$/i.test(layout.color)?layout.color.slice(1):'315C79';const font=layout.template==='editorial'?'宋体':'微软雅黑';const para=(text,opts={})=>new d.Paragraph({spacing:{after:Math.round((Number(layout.gap)||8)*10),line:Math.round((Number(layout.lineHeight)||1.5)*240)},children:[new d.TextRun({text:String(text),font,size,...opts})]});const children=[para(basic.name||'个人简历',{bold:true,size:36,color}),para([basic.job,basic.phone,basic.email,basic.city].filter(Boolean).join('  |  '))];const details=[['性别',basic.gender],['年龄',basic.age],['籍贯',basic.hometown],['政治面貌',basic.political],['期望薪资',basic.salary],['到岗时间',basic.onboard],['意向城市',basic.targetCity]].filter(x=>x[1]).map(x=>x.join('：'));if(details.length)children.push(para(details.join('  |  ')));
if(/^data:image\/(png|jpe?g);base64,/i.test(basic.photo||'')){const match=basic.photo.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);const bytes=typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(match[2],'base64')):Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));children.push(new d.Paragraph({children:[new d.ImageRun({data:bytes,type:match[1].toLowerCase()==='png'?'png':'jpg',transformation:{width:90,height:120}})]}));}
for(const key of orderedSections(record)){const lines=sectionLines(data,key);if(!lines.length)continue;children.push(new d.Paragraph({keepNext:true,spacing:{before:180,after:100},border:{bottom:{color,size:6,style:d.BorderStyle.SINGLE}},children:[new d.TextRun({text:labels[key],bold:true,color,font,size:size+2})]}));for(const line of lines)children.push(para(line));}
return new d.Document({creator:'简历工作台',title:record.title||'个人简历',styles:{default:{document:{run:{font,size}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:680,right:680,bottom:680,left:680}}},children}]});}
async function exportDocx(record){const doc=await createDocx(record);download(await root.docx.Packer.toBlob(doc),filename(record.title||record.data?.basic?.name)+'.docx');}
async function exportPNG(element,name,watermark){if(!root.html2canvas)throw new Error('图片导出组件未加载');const canvas=await root.html2canvas(element,{scale:2,backgroundColor:'#ffffff',useCORS:false,onclone:doc=>{for(const wrapper of doc.querySelectorAll('.paper-scale')){wrapper.style.transform='none';wrapper.style.height='auto';}const sheet=doc.getElementById(element.id);if(sheet){sheet.style.transform='none';sheet.style.height='auto';sheet.style.overflow='visible';}}});if(watermark&&String(watermark).trim()){const ctx=canvas.getContext('2d');ctx.save();ctx.fillStyle='rgba(90,100,115,0.16)';ctx.font='30px sans-serif';ctx.textAlign='center';for(let y=100;y<canvas.height+200;y+=240)for(let x=80;x<canvas.width+200;x+=420){ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI/7);ctx.fillText(String(watermark).slice(0,100),0,0);ctx.restore();}ctx.restore();}const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('生成图片失败');download(blob,filename(name).replace(/\.png$/i,'')+'.png');}
async function exportPDF(element,name){if(root.resumeDesktop?.printPDF){let css='';for(const sheet of document.styleSheets){try{css+=Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n');}catch{}}return root.resumeDesktop.printPDF({html:element.outerHTML,css,filename:filename(name).replace(/\.pdf$/i,'')+'.pdf'});}root.print();}
return{readDocx,readPDF,exportDocx,exportPNG,exportPDF,createDocx,orderedSections,sectionLines,filename};
});




