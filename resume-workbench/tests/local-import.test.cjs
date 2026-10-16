const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/core.js');

const resume=`姓名：陈林
电话：13800000000
求职意向：行政助理
【教育背景】
2018.09 - 2022.06 示例大学 行政管理 本科
主修课程：管理学、统计学
GPA：3.7/4.0
工作经历
2022.07 - 2024.06 示例科技有限公司 行政专员
负责会议安排与档案管理。
使用 Excel | Word 整理月报。
2024.07 - 至今 远山服务有限公司 行政助理
协调采购并维护台账。
项目经验
档案数字化项目
项目角色：负责人
2023.01 - 2023.06
整理并迁移历史档案。
技能：办公软件：熟练使用 Excel 数据透视表、Word 排版
荣誉证书
2022.05 大学英语四级
自我评价：做事细致，能够独立完成资料归档。`;

test('local import recognizes ordinary headings, space-separated entries and full descriptions',()=>{
 const r=C.parseText(resume),d=r.data;
 assert.equal(d.edu.length,1);assert.equal(d.edu[0].school,'示例大学');assert.equal(d.edu[0].major,'行政管理');assert.equal(d.edu[0].degree,'本科');assert.equal(d.edu[0].gpa,'3.7/4.0');
 assert.equal(d.work.length,2);assert.equal(d.work[0].company,'示例科技有限公司');assert.equal(d.work[0].position,'行政专员');assert.equal(d.work[1].start,'2024.07');assert.equal(d.work[1].end,'至今');
 assert.match(d.work[0].desc,/Excel \| Word/);assert.equal(d.proj[0].name,'档案数字化项目');assert.equal(d.proj[0].role,'负责人');assert.equal(d.proj[0].start,'2023.01');assert.match(d.proj[0].desc,/迁移历史档案/);
 assert.match(d.skills[0].name,/数据透视表、Word 排版/);assert.equal(d.skills[0].level,3);assert.equal(d.certs[0].date,'2022.05');assert.match(d.summary,/做事细致/);assert.equal(r.sourceText,resume);
});
test('local import groups separate dates, units and roles without merging employers',()=>{
 const d=C.parseText('工作经验\n2020年3月—2022年6月\n示例有限公司\n行政专员\n负责文件管理。\n2022/07 - present\n另一家公司\n职位：运营助理\n维护订单台账。\n教育经历\n2016.09—2020.06\n示例大学\n专业：行政管理\n学历：本科').data;
 assert.equal(d.work.length,2);assert.equal(d.work[0].start,'2020.03');assert.equal(d.work[0].position,'行政专员');assert.equal(d.work[1].company,'另一家公司');assert.equal(d.work[1].end,'至今');assert.match(d.work[1].desc,/订单台账/);assert.equal(d.edu[0].major,'行政管理');assert.equal(d.edu[0].degree,'本科');
});
test('unstructured and unknown sections remain visible as review items; no invented skill ratings',()=>{
 const text='姓名：陈林\n技能特长\n'+ '熟悉表格整理，'.repeat(30)+'\n其他信息\n可接受出差';
 const r=C.parseText(text);assert.equal(r.data.skills.length,1);assert.ok(r.data.skills[0].name.length>160);assert.equal(r.data.skills[0].level,0);assert.ok(r.uncertainties.some(x=>/可接受出差/.test(x.reason)));assert.equal(r.sourceText,text);
});
test('exported plain text can be imported locally with separate entries',()=>{
 const r=C.createRecord('演示',{basic:{name:'陈林',job:'行政'},edu:[{school:'示例大学',major:'行政管理',degree:'本科',start:'2018.09',end:'2022.06'}],work:[{company:'甲公司',position:'助理',start:'2022.07',end:'2023.06',desc:'负责档案整理'},{company:'乙公司',position:'专员',start:'2023.07',end:'至今',desc:'负责采购'}],skills:[{name:'Excel',level:3}]});
 const d=C.parseText(C.plainText(r)).data;assert.equal(d.basic.name,'陈林');assert.equal(d.edu[0].major,'行政管理');assert.equal(d.work.length,2);assert.equal(d.work[1].company,'乙公司');assert.equal(d.skills[0].level,3);
});
test('PDF extraction reconstructs rows when hasEOL flags are absent',async()=>{
 const S=require('../app/services.js');let destroyed=false;
 const item=(str,x,y)=>({str,width:str.length*10,height:12,transform:[12,0,0,12,x,y],hasEOL:false});
 global.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[item('工作经历',20,700),item('2022.07 - 至今',20,680),item('示例公司',180,680),item('行政助理',280,680),item('负责会议安排',20,660)]})}),destroy:async()=>{destroyed=true;}})})};
 try{const text=await S.readPDF({arrayBuffer:async()=>new ArrayBuffer(0)});assert.match(text,/工作经历\n/);const d=C.parseText(text).data;assert.equal(d.work[0].company,'示例公司');assert.match(d.work[0].desc,/会议安排/);assert.equal(destroyed,true);}finally{delete global.pdfjsLib;}
});

test('dates inside responsibilities are preserved and do not overwrite employment dates',()=>{
 const d=C.parseText('工作经历\n示例公司 | 行政助理 | 2020.01 - 至今\n负责 2022.01 - 2022.06 的档案迁移。').data;
 assert.equal(d.work[0].start,'2020.01');assert.equal(d.work[0].end,'至今');assert.match(d.work[0].desc,/2022.01 - 2022.06/);
});
test('mixed skills/certificates and parenthesized dates from the demo PDF retain correct fields',()=>{
 const d=C.parseText('姓名：李明\n联系电话：138 0000 0000\n教育经历\n示例学院 · 行政管理专业（2023.09 - 2026.06）\n实习经历\n示例公司 · 行政实习生（2025.07 - 2025.12）\n协助整理文件。\n技能证书\n办公软件：熟练使用 Word / Excel / PPT；\n证书：计算机一级、普通话二级甲等。').data;
 assert.equal(d.basic.phone,'13800000000');assert.equal(d.work[0].position,'行政实习生');assert.equal(d.edu[0].major,'行政管理专业');assert.equal(d.skills.length,1);assert.equal(d.certs.length,1);assert.doesNotMatch(d.work[0].desc,/办公软件/);
});
test('consecutive project titles with following dates become separate entries',()=>{
 const d=C.parseText('项目经历\n档案系统\n2020.01 - 2020.06\n负责整理资料。\n采购系统\n2021.01 - 2021.06\n负责订单登记。').data;
 assert.equal(d.proj.length,2);assert.equal(d.proj[1].name,'采购系统');assert.match(d.proj[0].desc,/整理资料/);
});
test('real DOCX bytes are extracted by the bundled browser reader then locally structured',async()=>{
 const fs=require('node:fs'),{JSDOM}=require('jsdom'),docx=require('docx');
 const buffer=await docx.Packer.toBuffer(new docx.Document({sections:[{children:resume.split('\n').map(text=>new docx.Paragraph(text))}]}));
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;
 try{w.eval(fs.readFileSync('vendor/mammoth.js','utf8'));w.eval(fs.readFileSync('app/services.js','utf8'));const bytes=new w.Uint8Array(buffer);const source=await w.ResumeServices.readDocx({arrayBuffer:async()=>bytes.buffer});const d=C.parseText(source).data;assert.equal(d.work.length,2);assert.equal(d.edu[0].degree,'本科');assert.match(d.skills[0].name,/数据透视表/);}finally{w.close();}
});
