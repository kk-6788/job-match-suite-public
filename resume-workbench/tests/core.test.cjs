const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/core.js');
test('history keeps five versions and restore preserves current draft',()=>{
 let r=C.createRecord('客户');
 for(let i=0;i<8;i++){C.checkpoint(r,'修改 '+i);r.data.basic.name='名字'+i;}
 assert.equal(r.history.length,5);
 const lastName=r.data.basic.name, version=r.history[2].id;
 C.restoreVersion(r,version);
 assert.equal(r.history.length,5);
 assert.equal(r.history[0].snapshot.data.basic.name,lastName);
});
test('backup excludes credentials and rejects malformed records before modifying store',()=>{
 const r=C.createRecord('客户');r.key='secret';
 const exported=C.makeBackup([r]);assert.ok(!exported.includes('secret'));
 assert.throws(()=>C.parseBackup('{"format":"resume-studio","version":2,"records":[null]}'));
 const recovered=C.parseBackup(exported);assert.equal(recovered[0].title,'客户');
});
test('empty, unreviewed or unconfirmed resume cannot reach delivery',()=>{
 const r=C.createRecord();const q=C.score(r,{pages:1,fontSize:11,overflow:false});
 assert.equal(q.total,null);assert.equal(q.ready,false);assert.ok(q.blockers.length>=3);
});
test('fresh complete review earns fixed sum but a blocker still prevents delivery',()=>{
 const r=C.createRecord();r.data.basic={name:'林明',phone:'13800000000',email:'lin@example.com',job:'前端开发'};
 r.data.edu=[{school:'某大学',major:'计算机',degree:'本科',start:'2018.09',end:'2022.06'}];
 r.data.work=[{company:'某公司',position:'工程师',start:'2022.07',end:'至今',desc:'负责订单页面开发，修复重复提交问题，完成上线验收。'}];
 r.factsConfirmed=true;r.jd='负责前端页面开发';
 r.review={fingerprint:C.fingerprint(r),checks:C.RUBRIC.map(x=>({id:x.id,status:'pass',evidence:r.data.work[0].desc,reason:'有依据',suggestion:''})),issues:[]};
 let q=C.score(r,{pages:1,fontSize:11,overflow:false});assert.equal(q.total,100);assert.equal(q.ready,true);
 r.review.issues.push({severity:'blocker',reason:'业绩来源待确认',path:'work.0.desc'});
 q=C.score(r,{pages:1,fontSize:11,overflow:false});assert.equal(q.total,100);assert.equal(q.ready,false);
 r.data.work[0].desc+='修改';assert.equal(C.score(r,{pages:1,fontSize:11}).total,null);
});
test('missing JD cannot certify tailored delivery even with full checks',()=>{
 const r=C.createRecord();r.factsConfirmed=true;r.review={fingerprint:C.fingerprint(r),checks:C.RUBRIC.map(x=>({id:x.id,status:'pass'})),issues:[]};
 assert.equal(C.score(r,{pages:1,fontSize:11}).ready,false);
});
test('reverse dates and placeholders are blockers, regex does not reject all metrics',()=>{
 const r=C.createRecord();r.data.work=[{company:'公司',position:'岗位',start:'2025.09',end:'2024.01',desc:'负责 100 份材料归档'}];
 const q=C.score(r,{pages:1,fontSize:11});assert.ok(q.blockers.some(x=>x.reason.includes('开始')));
 assert.ok(!q.blockers.some(x=>x.reason.includes('数字')));
});
test('normalization drops untrusted properties and rejects remote photo URLs',()=>{
 const d=C.normalizeData({basic:{name:'<script>',photo:'https://evil.test/x'},work:[null],evil:'x'});
 assert.equal(d.basic.photo,'');assert.equal(d.evil,undefined);assert.equal(d.basic.name,'<script>');
});
test('restore backup gives fresh ids and never includes prototype properties',()=>{
 const r=C.createRecord();const imported=C.parseBackup(C.makeBackup([r]));assert.notEqual(imported[0].id,r.id);
 assert.throws(()=>C.parseBackup('{"format":"resume-studio","version":200,"records":[]}'));
});
test('module order is part of review freshness because it affects content priority',()=>{
 const r=C.createRecord(),before=C.fingerprint(r);r.layout.order.reverse();assert.notEqual(C.fingerprint(r),before);
});
test('offline parser preserves education, experience and summary instead of discarding old PDF capability',()=>{
 const text='姓名：陈林\n求职意向：行政助理\n电话：13800000000\n教育经历\n海滨大学 | 行政管理 | 本科\n2019.09 - 2023.06\n工作经历\n青禾公司 | 行政助理 | 2023.07 - 至今\n负责会议记录和办公用品登记。\n整理档案并建立分类目录。\n项目经历\n档案电子化 | 项目成员 | 2024.01 - 2024.03\n扫描历史档案，建立检索目录。\n专业技能\nExcel：熟练\n自我评价\n熟悉办公室日常协作与档案管理。';
 const result=C.parseText(text);assert.equal(result.data.edu[0].school,'海滨大学');assert.equal(result.data.edu[0].start,'2019.09');assert.equal(result.data.work[0].company,'青禾公司');assert.equal(result.data.work[0].end,'至今');assert.match(result.data.work[0].desc,/分类目录/);assert.equal(result.data.proj[0].name,'档案电子化');assert.equal(result.data.skills[0].name,'Excel');assert.match(result.data.summary,/档案管理/);assert.equal(result.sourceText,text);
});
test('unconfirmed skill level is not inferred and source stays intact within import limit',()=>{
 const d=C.normalizeData({skills:[{name:'Excel'}]});assert.equal(d.skills[0].level,0);
 const r=C.createRecord();r.sourceText='材料'.repeat(22000);assert.equal(C.parseBackup(C.makeBackup([r]))[0].sourceText.length,44000);
});
test('tiny secondary text blocks delivery even when body size is readable',()=>{
 const q=C.score(C.createRecord(),{fontSize:11,minFontSize:8,pages:1});assert.ok(q.blockers.some(x=>x.reason.includes('字号')));
});
test('malformed backup collections reject the whole import, not silently erase entries',()=>{
 const r=C.createRecord();r.data.work='damaged';assert.throws(()=>C.parseBackup(JSON.stringify({format:'resume-studio',version:2,records:[C.createRecord(),r]})),/格式损坏/);
});
