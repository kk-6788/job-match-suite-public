'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const C=require('../job-matcher/core.js'),E=require('../job-matcher/extractors.js'),S=require('../job-matcher/security.cjs');
test('学历一级/经验两年内保留，超过边界才隐藏；未知不误判',()=>{
 const rank=(education,years,req,exp)=>C.rankJobs([{title:'运营',education:req,experience:exp}],{targetRole:'运营',education,experienceYears:years},{})[0];
 for(const [mine,req]of [['大专','本科'],['本科','硕士']]){const j=rank(mine,3,req,'5年以上');assert.ok(!j.excluded);assert.equal(j.conflicts.length,2);assert.match(j.conflicts.join(''),/可尝试/);}
 assert.equal(rank('大专',3,'硕士','3年以上').excluded,true);
 assert.equal(rank('本科',2.9,'本科','5年以上').excluded,true);
 assert.ok(!rank('',null,'硕士','10年以上').excluded);
 assert.equal(rank('本科',3,'本科','3年以上').conflicts.length,0);
});
test('国家大学生平台只读取具体岗位，过滤公告和公司链接，保留未知经验',()=>{
 const dom=new JSDOM(`<div class="jobList" data-type="00"><ul class="first-ul"><h5><a href="/student/jobs/ABCdef123/detail.html">运营</a></h5><li>本科及以上 | <span class="salary-money">5-8K/月</span></li><li>湖北 | 理工科</li></ul><a class="company-name">公开公司</a></div><div class="jobList" data-type="01"><ul class="first-ul"><h5><a href="/student/jobs/ABCdef456/detail.html">校园招聘公告</a></h5></ul></div>`);
 const jobs=E.extract(dom.window.document,'ncss',S.sourceURL('ncss',{})).jobs;assert.equal(jobs.length,1);assert.equal(jobs[0].education,'本科及以上');assert.equal(jobs[0].city,'湖北');assert.equal(jobs[0].experience,'');assert.equal(jobs[0].salary,'5-8K/月');dom.window.close();
});
test('应届生首页推荐不充当搜索；搜索卡片仅接受官方详情链接',()=>{
 const html='<a class="job-list-item" href="https://q.yingjiesheng.com/jobdetail/123.html"><span class="job-list-item-title-t">运营</span><span class="job-list-item-title-m">6-8千</span><p class="job-list-item-tagbox"><span>1年及以上</span><span>本科</span></p><em class="coname">公司</em><span class="job-list-item-com-area">上海</span></a>';
 const dom=new JSDOM(html);assert.equal(E.extract(dom.window.document,'yingjiesheng','https://www.yingjiesheng.com/').jobs.length,0);
 const jobs=E.extract(dom.window.document,'yingjiesheng','https://q.yingjiesheng.com/fixture-search').jobs;assert.equal(jobs.length,1);assert.equal(jobs[0].experience,'1年及以上');
 assert.equal(E.isDetailUrl('https://evil.example/jobdetail/123.html','yingjiesheng'),false);assert.equal(E.isDetailUrl('https://www.ncss.cn/student/jobs/ABCdef123/corp.html','ncss'),false);dom.window.close();
});
