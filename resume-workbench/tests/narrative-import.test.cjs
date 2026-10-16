const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../app/core.js');
test('bare introductory name with a dated employment sentence is recognized conservatively',()=>{
 assert.equal(C.parseText('张三，2024年4月至2025年3月任产品助理，负责资料整理。').data.basic.name,'张三');
 assert.equal(C.parseText('产品助理，2024年4月至2025年3月任产品助理。').data.basic.name,'');
});
test('screenshot paragraph extracts address, dated position and duties without inventing missing facts',()=>{
 const text='林同学，2024 年 4 月至 2025 年 3 月任产品助理，负责资料整理、竞品汇总和活动执行；未提供业绩数字。可用来测试输入、预览和导出；业绩留空。';
 const r=C.parseText(text),d=r.data;assert.equal(d.basic.name,'林同学');assert.equal(d.work.length,1);assert.equal(d.work[0].position,'产品助理');assert.equal(d.work[0].start,'2024.04');assert.equal(d.work[0].end,'2025.03');assert.equal(d.work[0].company,'');assert.equal(d.work[0].desc,'负责资料整理、竞品汇总和活动执行');assert.equal(d.basic.job,'');assert.equal(d.basic.phone,'');assert.equal(r.sourceText,text);assert.ok(r.uncertainties.some(u=>u.field==='basic.name'&&/称呼/.test(u.reason)));
});
test('natural self introduction separates historical jobs from explicitly desired position',()=>{
 const d=C.parseText('我叫张三，电话13800000000，邮箱zhang@example.com。我在2022年7月至2023年12月在星河科技有限公司担任运营专员，负责客户资料维护。2024年1月至今在远山公司任产品助理，负责项目排期。希望应聘产品经理。').data;
 assert.equal(d.basic.name,'张三');assert.equal(d.basic.job,'产品经理');assert.equal(d.work.length,2);assert.equal(d.work[0].company,'星河科技有限公司');assert.equal(d.work[1].company,'远山公司');assert.equal(d.work[1].end,'至今');assert.doesNotMatch(d.work[1].desc,/希望应聘/);
});
test('prose without dates retains explicit employment and does not invent dates',()=>{
 const d=C.parseText('姓名：李明，曾在星河公司担任行政助理，负责整理档案。').data;assert.equal(d.basic.name,'李明');assert.equal(d.work[0].company,'星河公司');assert.equal(d.work[0].position,'行政助理');assert.equal(d.work[0].start,'');
});
test('plans, negated employment and unnamed prose are not converted to past jobs or names',()=>{
 for(const text of ['计划2024年4月至2025年3月任产品助理，负责资料整理。','我没有在星河公司担任行政助理。','负责整理资料，能够使用办公软件。']){const d=C.parseText(text).data;assert.equal(d.work.length,0);assert.equal(d.basic.name,'');}
});
