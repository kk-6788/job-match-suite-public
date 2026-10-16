const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../app/core.js');

test('plain text follows visible section and entry order without exposing source notes',()=>{
 const r=C.createRecord('示例',{basic:{name:'陈林',phone:'13800000000',job:'行政'},summary:'隐藏的简介',work:[{company:'近期公司',position:'助理',start:'2024.01',end:'至今',desc:'整理资料\n维护清单'},{company:'此前公司',desc:'归档文件'}],skills:[{name:'Excel',level:0},{name:'Word',level:3}],edu:[{school:'示例大学',major:'管理',degree:'本科',gpa:'3.5',courses:'管理学',honors:'优秀毕业生'}]});
 r.sourceText='不导出的原文';r.notes='不导出的私密备注';r.jd='不导出的岗位描述';r.layout.hidden=['summary'];r.layout.order=['skills','work','edu','summary','proj','certs'];
 const text=C.plainText(r);
 assert.ok(text.indexOf('专业技能')<text.indexOf('工作 / 实习经历'));
 assert.ok(text.indexOf('近期公司')<text.indexOf('此前公司'));
 assert.match(text,/整理资料\n维护清单/);assert.match(text,/Excel\nWord · 熟练/);assert.match(text,/管理学/);assert.match(text,/优秀毕业生/);
 assert.doesNotMatch(text,/隐藏的简介|不导出的|undefined|data:image/);
});

test('targeted copy preserves material but resets job, review and history independently',()=>{
 const r=C.createRecord('主简历',{basic:{name:'陈林',job:'旧岗位'},work:[{company:'原公司',desc:'真实经历'}]});
 r.jd='旧 JD';r.notes='本人补充';r.sourceText='原材料';r.factsConfirmed=true;r.review={total:100};C.checkpoint(r);
 const before=JSON.stringify(r),copy=C.createTargetedCopy(r,'项目助理','跟进项目文档');
 assert.notEqual(copy.id,r.id);assert.equal(copy.data.basic.job,'项目助理');assert.equal(copy.jd,'跟进项目文档');assert.match(copy.title,/项目助理/);
 assert.equal(copy.review,null);assert.equal(copy.factsConfirmed,false);assert.deepEqual(copy.history,[]);assert.equal(copy.notes,r.notes);assert.equal(copy.sourceText,r.sourceText);
 copy.data.work[0].desc='只改副本';assert.equal(JSON.stringify(r),before);
 assert.throws(()=>C.createTargetedCopy(r,'  ',''),/岗位/);
});
