const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/core.js');
const R=require('../app/client-report.js');

function freshRecord(){
 const r=C.createRecord();
 r.data.basic={name:'林明',phone:'13800000000',email:'lin@example.com',job:'前端开发'};
 r.data.edu=[{school:'某大学',major:'计算机',degree:'本科',start:'2018.09',end:'2022.06'}];
 r.data.work=[{company:'某公司',position:'工程师',start:'2022.07',end:'至今',desc:'负责订单页面开发，修复重复提交问题，完成上线验收。'}];
 r.factsConfirmed=true;r.jd='负责前端页面开发';
 r.review={fingerprint:C.fingerprint(r),checks:C.RUBRIC.map(x=>({id:x.id,status:'pass',evidence:'有依据',reason:'有依据',suggestion:''})),issues:[]};
 return r;
}

test('没有审查或审查过期时不展示总分，只列本地问题',()=>{
 // 无审查
 const a=C.createRecord();a.factsConfirmed=true;a.jd='测试';
 let m=R.build(a);
 assert.equal(m.score.total,null);
 assert.equal(m.score.fresh,false);
 assert.equal(m.status,'stale');
 assert.ok(m.issues.length>0,'无审查时仍应列出本地规则问题');
 // 审查过期（改稿后指纹不匹配）
 const b=freshRecord();
 b.data.work[0].desc+=' 补充一句';
 m=R.build(b);
 assert.equal(m.score.total,null);
 assert.equal(m.status,'stale');
 // 有效审查时才有总分
 const c=freshRecord();
 m=R.build(c);
 assert.equal(m.score.total,100);
 assert.equal(m.status,'fresh');
});

test('旧版备份（无新字段）兼容导入，新字段默认空',()=>{
 const backup=JSON.stringify({format:'resume-studio',version:2,exportedAt:new Date().toISOString(),records:[{id:'old-1',title:'旧备份',data:C.createRecord().data,layout:{},updatedAt:new Date().toISOString(),history:[],sourceText:'',notes:'',jd:'',factsConfirmed:false}]});
 const [r]=C.parseBackup(backup);
 assert.equal(r.title,'旧备份');
 assert.equal(r.clientBaseline,null);
 assert.equal(r.clientNote,null);
 // 字段存在但为恶意对象也不崩
 const backup2=JSON.stringify({format:'resume-studio',version:2,records:[{id:'old-2',title:'恶意备份',data:C.createRecord().data,clientBaseline:'not-an-object',clientNote:{evil:'payload'},history:[]}]});
 const [r2]=C.parseBackup(backup2);
 assert.equal(r2.clientBaseline,null,'非对象 clientBaseline 应拒绝');
 assert.equal(r2.clientNote,null,'无 text 的 clientNote 应拒绝');
});

test('新基线备份保留且 review 清空',()=>{
 const r=freshRecord();
 C.checkpoint(r,'初稿');
 r.clientBaseline={data:C.clone(r.data),layout:C.clone(r.layout),capturedAt:new Date().toISOString(),label:'原稿'};
 r.clientNote={text:'说明文字',fingerprint:C.fingerprint(r)};
 r.history.unshift({id:'h1',at:new Date().toISOString(),label:'历史',snapshot:C.snapshot(r)});
 const backup=C.makeBackup([r]);
 assert.ok(backup.includes('clientBaseline'),'备份应包含 clientBaseline');
 assert.ok(backup.includes('clientNote'),'备份应包含 clientNote');
 const restored=C.parseBackup(backup)[0];
 // review 清空（不信任备份评分）
 assert.equal(restored.review,null,'恢复后 review 必须清空');
 // 基线保留且可读
 const bl=C.captureBaseline(restored);
 assert.ok(bl);
 assert.equal(bl.data.basic.name,'林明');
 assert.equal(bl.label,'原稿');
 assert.equal(C.normalizeClientNote(restored.clientNote).text,'说明文字');
 assert.ok(restored.history.length>=1,'历史快照保留');
 // 历史快照内的 baseline/note 也能保留
 assert.ok(restored.history[0].snapshot.clientBaseline,'历史快照应包含 clientBaseline');
});

test('clone 后不共享引用',()=>{
 const r=freshRecord();
 assert.equal(C.captureBaseline(r),null);
 C.saveBaseline(r,'原稿');
 const bl=C.captureBaseline(r);
 // 直接构造带 baseline 的对象，clone 后改 clone 不影响原
 const snapshotObj=C.snapshot(r);
 snapshotObj.clientBaseline.data.basic.name='改过';
 assert.equal(C.captureBaseline(r).data.basic.name,'林明','snapshot 返回的 baseline 不应共享原 record 引用');
 // normalizeData 的 clone 行为
 const d1=C.normalizeData(r.data);d1.work[0].desc='换掉';
 assert.equal(r.data.work[0].desc,'负责订单页面开发，修复重复提交问题，完成上线验收。');
 // saveBaseline 返回快照（clone），改返回值不影响 record
 r.clientBaseline={data:C.clone(r.data),layout:C.clone(r.layout),capturedAt:'x',label:'原稿'};
 const saved=C.saveBaseline(r);
 saved.data.basic.name='通过返回值改';
 assert.equal(C.captureBaseline(r).data.basic.name,'林明','saveBaseline 返回 clone，不共享引用');
 // createRecord 每次独立
 const r2=C.createRecord();
 assert.notEqual(r2.clientBaseline,r.clientBaseline);
});

test('隐私排除：phone/email/photo/sourceText/notes/jd/history 不出现在报告',()=>{
 const r=freshRecord();
 r.data.basic.photo='data:image/png;base64,iVBORw0KGgo=';
 r.sourceText='原始材料内容应排除';
 r.notes='本人补充事实应排除';
 r.jd='完整岗位描述内容应排除';
 r.clientNote={text:'客户可见说明',fingerprint:C.fingerprint(r)};
 const m=R.build(r);
 const html=R.toHTML(m);
 const text=R.toText(m);
 for(const s of ['13800000000','lin@example.com','data:image','原始材料内容应排除','本人补充事实应排除','完整岗位描述内容应排除']){
  assert.ok(!html.includes(s),'HTML 不应泄漏 '+s);
  assert.ok(!text.includes(s),'Text 不应泄漏 '+s);
 }
 // 报告中不出现姓名（姓名属于隐私字段）
 assert.ok(!html.includes('林明'),'HTML 不应输出姓名');
 assert.ok(!text.includes('林明'),'Text 不应输出姓名');
 // 报告标题固定，不含内部 title
 assert.equal(m.title,'简历诊断与改稿说明');
});

test('隐藏栏目不泄漏到报告',()=>{
 const r=freshRecord();
 r.layout.hidden=['summary'];
 r.data.summary='这是隐藏的简介内容不应出现';
 const m=R.build(r);
 const html=R.toHTML(m);
 assert.ok(!html.includes('隐藏的简介内容不应出现'),'隐藏栏目内容不应泄漏');
 // visibleData 已把 summary 置空，comparison 对比也应看不到
 assert.ok(!JSON.stringify(m).includes('隐藏的简介内容不应出现'));
});

test('恶意 HTML 被转义，无 script/外链/远程资产',()=>{
 const r=freshRecord();
 r.data.work[0].desc='<script>alert("x")</script>负责开发<img src=x onerror=alert(1)><a href="http://evil.test">链接</a>';
 r.clientNote={text:'</div><script>alert(2)</script>',fingerprint:C.fingerprint(r)};
 const m=R.build(r);
 const html=R.toHTML(m);
 assert.ok(!html.includes('<script>'),'不得包含 script 标签');
 assert.ok(!html.includes('onerror'),'事件属性应被转义');
 assert.ok(!html.includes('http://'),'不得有外链');
 assert.ok(!html.includes('https://'),'不得有外链');
 assert.ok(html.includes('&lt;script&gt;'),'恶意文本应被转义而非删除');
 // clientNote 的恶意内容也转义
 assert.ok(html.includes('&lt;/div&gt;'));
});

test('clientNote 过期隔离：fingerprint 不匹配则 note 置空、noteStale=true',()=>{
 const r=freshRecord();
 // 无 note
 let m=R.build(r);
 assert.equal(m.note,'');
 assert.equal(m.noteStale,false,'未填写过说明不算过期');
 // 指纹匹配时展示
 r.clientNote={text:'这是人工说明',fingerprint:C.fingerprint(r)};
 m=R.build(r);
 assert.equal(m.note,'这是人工说明');
 assert.equal(m.noteStale,false);
 // 改稿后指纹不匹配 → 隔离
 r.data.work[0].desc+=' 修改后';
 m=R.build(r);
 assert.equal(m.note,'');
 assert.equal(m.noteStale,true);
 // HTML/Text 中也不展示过期 note
 const html=R.toHTML(m);
 assert.ok(!html.includes('这是人工说明'),'过期说明不应出现在 HTML');
 assert.ok(html.includes('已修改'),'应提示说明已过期');
});

test('改前改后栏目对照：完整前后文本，隐藏栏目不泄漏，无索引伪称新增删除',()=>{
 const r=freshRecord();
 C.saveBaseline(r,'原稿');
 // 修改工作经历和目标岗位
 r.data.work[0].desc='负责订单页面开发，修复重复提交问题，完成灰度发布。';
 r.data.basic.job='资深前端开发';
 r.data.summary='新增的简介';
 r.data.proj=[{name:'新项目',role:'负责人',start:'2024.01',end:'2024.06',desc:'完成上线'}];
 const m=R.build(r);
 assert.equal(m.comparison.available,true);
 assert.ok(m.comparison.capturedAt);
 assert.equal(m.comparison.label,'原稿');
 const labels=m.comparison.changes.map(c=>c.label);
 assert.ok(labels.includes('目标岗位'),'目标岗位变化应出现在基本信息对照');
 assert.ok(labels.includes('工作 / 实习经历'),'工作经历变化应出现在对照');
 assert.ok(labels.includes('个人简介'),'新增简介应作为整栏对照');
 assert.ok(labels.includes('项目经历'),'新增项目应作为整栏对照，不伪称第N条新增');
 const basic=m.comparison.changes.find(c=>c.label==='目标岗位');
 assert.ok(basic.before.includes('前端开发'));
 assert.ok(basic.after.includes('资深前端开发'));
 const work=m.comparison.changes.find(c=>c.label==='工作 / 实习经历');
 assert.ok(work.after.includes('灰度发布'));
 assert.ok(work.before.includes('上线验收'));
 // 隐藏栏目不参与对照
 const r2=C.createRecord();
 r2.data.summary='隐藏简介内容';
 r2.layout.hidden=['summary'];
 C.saveBaseline(r2,'原稿2');
 r2.data.summary='改过的隐藏简介';
 const m2=R.build(r2);
 assert.ok(!m2.comparison.changes.some(c=>c.label==='个人简介'&&c.before.includes('隐藏简介内容')),'隐藏栏目不应从原稿泄漏');
 assert.ok(!m2.comparison.changes.some(c=>c.label==='个人简介'&&c.after.includes('改过的隐藏简介')),'隐藏栏目改后也不展示');
});

test('空白报告不伪造结论：无审查+无基线时 comparison.available=false',()=>{
 const r=C.createRecord();
 r.factsConfirmed=true;r.jd='测试';
 const m=R.build(r);
 assert.equal(m.comparison.available,false);
 assert.deepEqual(m.comparison.changes,[]);
 assert.equal(m.score.total,null);
 const html=R.toHTML(m);
 assert.ok(html.includes('尚未保存原稿对照'));
 assert.ok(!/总分\s*\d/.test(html),'无审查不显示数值总分');
});
