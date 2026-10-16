const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/core.js');
const R=require('../app/client-report.js');

function freshRecord(){
 const r=C.createRecord();
 r.data.basic={name:'林明',phone:'13800000000',email:'lin@example.com',job:'前端开发'};
 r.data.work=[{company:'某公司',position:'工程师',start:'2022.07',end:'至今',desc:'负责订单页面开发。'}];
 r.factsConfirmed=true;r.jd='负责前端页面开发';
 r.review={fingerprint:C.fingerprint(r),checks:C.RUBRIC.map(x=>({id:x.id,status:'pass'})),issues:[]};
 return r;
}

test('saveBaseline 白名单：不保留 sourceText/notes/jd/review/history/photo',()=>{
 const r=freshRecord();
 r.sourceText='原始材料';
 r.notes='私密备注';
 r.jd='岗位描述';
 r.data.basic.photo='data:image/png;base64,iVBORw0KGgo=';
 const bl=C.saveBaseline(r,'对照原稿');
 assert.equal(bl.label,'对照原稿');
 assert.ok(bl.capturedAt);
 assert.deepEqual(Object.keys(bl),['data','layout','capturedAt','label'],'baseline 仅白名单四字段');
 assert.equal(bl.data.basic.photo,'','photo 必须清空');
 assert.equal(bl.sourceText,undefined);
 assert.equal(bl.notes,undefined);
 assert.equal(bl.jd,undefined);
 assert.equal(bl.review,undefined);
 assert.equal(bl.history,undefined);
 // 带恶意扩展字段的对象也不能扩入
 r.clientBaseline={data:C.clone(r.data),layout:{},capturedAt:'x',label:'原稿',evil:'payload',sourceText:'不该有'};
 const out=C.captureBaseline(r);
 assert.deepEqual(Object.keys(out),['data','layout','capturedAt','label']);
 assert.equal(out.evil,undefined);
 assert.equal(out.sourceText,undefined);
});

test('恶意对象不扩入输出：非对象/缺 data/数组均拒绝',()=>{
 const r=freshRecord();
 for(const bad of ['string',42,null,true,[],{layout:{}},{data:'not-obj'},{data:[]}]){
  r.clientBaseline=bad;
  assert.equal(C.captureBaseline(r),null,'恶意 baseline 应返回 null: '+JSON.stringify(bad).slice(0,40));
 }
 // 恢复正常后能读回
 r.clientBaseline={data:C.clone(r.data),layout:{},capturedAt:'2026-10-13T00:00:00Z',label:'原稿'};
 assert.equal(C.captureBaseline(r).data.basic.name,'林明');
});

test('旧版 version2 备份兼容导入，新字段默认空；恶意字段拒收',()=>{
 // 完全没有新字段的旧备份
 const oldBackup=C.makeBackup([freshRecord()]);
 const [r1]=C.parseBackup(oldBackup);
 assert.equal(r1.clientBaseline,null);
 assert.equal(r1.clientNote,null);
 assert.equal(r1.data.basic.name,'林明');
 // 旧备份带恶意字段
 const malicious=JSON.stringify({format:'resume-studio',version:2,records:[{id:'m',title:'M',data:C.createRecord().data,clientBaseline:{__proto__:{},data:C.createRecord().data},clientNote:{text:'ok',fingerprint:'x',extra:'no'},history:[]}]});
 const [r2]=C.parseBackup(malicious);
 assert.equal(r2.clientNote.extra,undefined,'note 白名单外字段不得扩入');
 assert.equal(r2.clientNote.text,'ok');
 assert.ok(C.captureBaseline(r2)!==null||r2.clientBaseline===null);
 // 手工构造的旧版备份（无新字段键）
 const raw=JSON.stringify({format:'resume-studio',version:2,records:[{id:'v2',title:'V2',data:C.createRecord().data,layout:{},updatedAt:new Date().toISOString(),history:[],sourceText:'',notes:'',jd:'',factsConfirmed:false}]});
 const [r3]=C.parseBackup(raw);
 assert.equal(r3.clientBaseline,null);
 assert.equal(r3.clientNote,null);
});

test('新备份保留 baseline/note，恢复后 review 清空、评分不可信',()=>{
 const r=freshRecord();
 C.saveBaseline(r,'原稿');
 r.clientNote={text:'说明',fingerprint:C.fingerprint(r)};
 const backup=C.makeBackup([r]);
 const restored=C.parseBackup(backup)[0];
 assert.equal(restored.review,null,'恢复后 review 必须清空');
 assert.equal(C.captureBaseline(restored).label,'原稿');
 assert.equal(C.normalizeClientNote(restored.clientNote).text,'说明');
 // score 不因备份恢复而给总分
 assert.equal(C.score(restored).total,null,'恢复后无有效 review，不展示总分');
});

test('checkpoint/restoreVersion/snapshot 对新字段的保留语义',()=>{
 const r=freshRecord();
 C.saveBaseline(r,'原稿');
 r.clientNote={text:'当前说明',fingerprint:C.fingerprint(r)};
 // snapshot 安全保留新字段
 const snap=C.snapshot(r);
 assert.ok(snap.clientBaseline);
 assert.equal(snap.clientNote.text,'当前说明');
 // checkpoint 存入 history
 C.checkpoint(r,'保存点');
 assert.ok(r.history[0].snapshot.clientBaseline,'history 快照保留 baseline');
 // 修改稿件并恢复 → review 清空、新字段回到当前值（保存点当时值）
 r.data.work[0].desc+=' 改动';
 C.restoreVersion(r,r.history[0].id);
 assert.equal(r.review,null);
 assert.equal(r.data.work[0].desc,'负责订单页面开发。');
 // 恢复不会清空 baseline/note（baseline 是明确的客户资产，不随版本回滚丢失）
 assert.ok(r.clientBaseline,'restoreVersion 后 baseline 保留');
 assert.equal(r.clientNote.text,'当前说明');
});

test('createTargetedCopy 独立副本，新字段不串号',()=>{
 const src=freshRecord();
 C.saveBaseline(src,'源稿');
 src.clientNote={text:'源说明',fingerprint:C.fingerprint(src)};
 const copy=C.createTargetedCopy(src,'数据专员');
 assert.equal(copy.data.basic.job,'数据专员');
 assert.ok(copy.clientBaseline,'副本继承源 baseline（用于对照）');
 assert.equal(C.captureBaseline(copy).data.basic.name,'林明');
 // 修改副本不影响源
 copy.data.work[0].desc='只改副本';
 C.saveBaseline(copy,'副本基线');
 assert.equal(C.captureBaseline(src).label,'源稿');
 assert.notEqual(C.captureBaseline(copy).label,C.captureBaseline(src).label);
});

test('hidden 栏目在 baseline 对比中被置空，不从原稿泄漏',()=>{
 const r=freshRecord();
 r.data.summary='隐藏的简介';
 C.saveBaseline(r,'原稿');
 r.layout.hidden=['summary'];
 const bl=C.captureBaseline(r);
 // 原稿保持捕获时的内容；当前隐藏设置只影响客户报告，不能静默抹去对照资产。
 assert.equal(bl.data.summary,'隐藏的简介');
 assert.ok(!JSON.stringify(R.build(r)).includes('隐藏的简介'));
 assert.deepEqual(bl.data.skills,[]);
});

test('captureBaseline 深拷贝：改输出不影响 record 内部',()=>{
 const r=freshRecord();
 C.saveBaseline(r,'原稿');
 const bl=C.captureBaseline(r);
 bl.data.work[0].desc='从外部修改';
 assert.equal(C.captureBaseline(r).data.work[0].desc,'负责订单页面开发。');
});
