'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const E=require('../job-matcher/extractors.js'),S=require('../job-matcher/security.cjs');
const C=require('../job-matcher/core.js');
const doc=html=>new JSDOM(html).window.document;

test('前程无忧卡片编号与当前渲染列表的原始详情地址对应，条件来自当前卡片',()=>{
 const html=`<div class="joblist-item-job" sensorsdata='{"jobId":"123456789","jobYear":"1-3年","jobDegree":"本科","jobTitle":"过期的属性名称","jobSalary":"99万"}'>
 <span class="jname">数据分析师</span><span class="sal">8千-1.2万</span><div class="area">北京·昌平区</div>
 <span class="cname">样例公司（虚构）</span><div class="tags"><div class="tag">SQL</div></div></div>`;
 const url='https://jobs.51job.com/beijing-cpq/123456789.html?req=keep';
 const result=E.extract(doc(html),'51job','https://we.51job.com/pc/search?keyword=数据分析',[{id:'123456789',url}]);
 assert.equal(result.jobs.length,1);const job=result.jobs[0];
 assert.equal(job.title,'数据分析师');assert.equal(job.company,'样例公司（虚构）');assert.equal(job.city,'北京·昌平区');
 assert.equal(job.salary,'8千-1.2万');assert.equal(job.education,'本科');assert.equal(job.experience,'1-3年');
 assert.equal(job.url,url);assert.equal(E.isDetailUrl(job.url,'51job'),true);
 assert.match(job.description,/SQL/);
});

test('前程无忧不猜测缺失链接；固定脚本只读取岗位编号与 jobHref',()=>{
 const html='<main><div class="joblist-item-job" sensorsdata=\'{"jobId":"123"}\'><span class="jname">运营</span></div></main>';
 const dom=new JSDOM(html,{url:'https://we.51job.com/pc/search',runScripts:'outside-only'});
 const url='https://jobs.51job.com/beijing/123.html?req=keep';
 dom.window.document.querySelector('main').__vue__={$props:{joblist:[{jobId:'123',jobHref:url,hrName:'不读取',privateNotes:'不读取'}],accountToken:'不读取'}};
 const links=dom.window.eval(E.build51jobLinksScript());
 assert.deepEqual(JSON.parse(JSON.stringify(links)),[{id:'123',url}]);
 assert.equal(dom.window.eval(E.buildScript('51job',links)).jobs[0].url,url);
 assert.equal(E.extract(dom.window.document,'51job','https://we.51job.com/pc/search').jobs.length,0);
 assert.equal(dom.window.eval(E.buildScript('51job',[{id:'123',url:'https://evil.example/beijing/123.html'}])).jobs.length,0);
 assert.equal(dom.window.eval(E.buildScript('51job',[{id:'123',url:'https://jobs.51job.com/beijing/456.html'}])).jobs.length,0);
 dom.window.close();
});

test('前程无忧保留原始详情链接，拒绝导航、公司页、伪装域名和无效编号',()=>{
 const url='https://jobs.51job.com/beijing-cpq/123456789.html?required=abc';
 const result=E.extract(doc(`<div class="joblist-item-job"><a href="${url}"><span class="jname">运营</span></a></div>
 <a href="https://jobs.51job.com/beijing/co123.html">公司</a><div class="joblist-item-job" sensorsdata='{"jobId":"javascript:alert(1)"}'><span class="jname">无效岗位</span></div>`),'51job','https://we.51job.com/pc/search');
 assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].url,url);
 for(const invalid of ['https://jobs.51job.com/beijing/co123.html','https://evil.example/?url=https://jobs.51job.com/beijing/123.html','https://m.51job.com/search/jobdetail.php?jobid=abc','https://jobs.51job.com/hj123/'])assert.equal(E.isDetailUrl(invalid,'51job'),false,invalid);
});

test('实习僧按实际卡片提取，特殊字体金额留空，实习天数不当作工作年限',()=>{
 const html=`<div class="intern-wrap"><div class="intern-detail__job"><a class="title" href="/intern/inn_example?pcm=pc_SearchList">数据分析实习生</a>
 <span class="day font">&#xf83d;&#xe1eb;/天</span><p class="tip"><span class="city">北京</span><span>5天/周</span><span>3个月</span></p></div>
 <div class="intern-detail__company"><a class="title">样例科技（虚构）</a></div><span class="intern-label">SQL</span></div>`;
 const result=E.extract(doc(html),'shixiseng','https://www.shixiseng.com/interns?keyword=数据分析');
 assert.equal(result.jobs.length,1);const job=result.jobs[0];assert.equal(job.company,'样例科技（虚构）');assert.equal(job.city,'北京');
 assert.equal(job.salary,'');assert.equal(job.experience,'');assert.match(job.availability,/特殊字体/);assert.match(job.description,/SQL/);
 assert.equal(job.url,'https://www.shixiseng.com/intern/inn_example?pcm=pc_SearchList');
});

test('实习僧可读日薪保留单位，导航和缺失标题不造岗位',()=>{
 const result=E.extract(doc('<div class="intern-wrap"><div class="intern-detail__job"><a class="title" href="/intern/inn_sample">产品实习生</a><span class="day">150-200/天</span></div></div><a href="/interns?keyword=产品">查找</a><a href="/intern/inn_no_title"></a>'),'shixiseng','https://www.shixiseng.com/interns');
 assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].salary,'150-200/天');
 assert.equal(E.isDetailUrl('https://shixiseng.com.evil.example/intern/inn_sample','shixiseng'),false);
});

test('实习日薪不与月薪下限直接比较，也不自行按出勤天数折算',()=>{
 assert.equal(C.parseSalary('150-200/天').unknown,true);
 assert.equal(C.parseSalary('200元/日').unknown,true);
 const job=C.rankJobs([{title:'数据分析实习生',salary:'150-200/天'}],{},{targetRole:'数据分析',salaryMin:5000})[0];
 assert.equal(job.excluded,undefined);assert.ok(job.unknown.includes('salary'));
});

test('拉勾验证页准确提示，兼容适配器仅接受详情锚点',()=>{
 const blocked=E.extract(doc('<h1>访问验证</h1><p>请按住滑块，拖动到最右边</p>'),'lagou','https://www.lagou.com/wn/jobs?kd=运营');
 assert.equal(blocked.status,'verification');assert.equal(blocked.jobs.length,0);
 // 此兼容结构为合成样例，真实登录后的页面尚未验证。
 const result=E.extract(doc('<li class="con_list_item"><a class="position_link" href="https://www.lagou.com/jobs/123456.html?source=search"><h3>运营</h3></a><span class="money">10k-15k</span><div class="company_name"><a>样例公司（虚构）</a></div></li><a href="/wn/jobs?kd=运营">搜索</a>'),'lagou','https://www.lagou.com/wn/jobs');
 assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].title,'运营');assert.equal(result.jobs[0].company,'样例公司（虚构）');
 assert.equal(E.isDetailUrl('https://www.lagou.com/wn/jobs?kd=运营','lagou'),false);
});

test('新增平台搜索只携带岗位和城市，已核对的前程无忧城市代码正确',()=>{
 const prefs={targetRole:'数据分析',city:'北京',name:'不传姓名',resume:'不传全文'};
 const job51=new URL(S.sourceURL('51job',prefs));assert.equal(job51.hostname,'we.51job.com');assert.equal(job51.searchParams.get('keyword'),'数据分析');assert.equal(job51.searchParams.get('jobArea'),'010000');
 const shixi=new URL(S.sourceURL('shixiseng',prefs));assert.equal(shixi.searchParams.get('keyword'),'数据分析');assert.equal(shixi.searchParams.get('city'),'北京');
 assert.equal(new URL(S.sourceURL('lagou',prefs)).searchParams.get('kd'),'数据分析');
 for(const source of ['51job','lagou','shixiseng']){assert.ok(!S.sourceURL(source,prefs).includes('不传'));assert.doesNotThrow(()=>E.buildScript(source));}
 assert.equal(S.allowedSourceURL('https://login.51job.com/login','51job',job51.href),true);
 assert.equal(S.allowedSourceURL('https://51job.com.evil.example/login','51job',job51.href),false);
});
