(function(root,factory){const api=factory(typeof ResumeCore!=='undefined'?ResumeCore:(typeof require==='function'?require('./core.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.ResumeClientReport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(ResumeCore){
'use strict';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const REPORT_TITLE='简历诊断与改稿说明';
const SECTION_KEYS=['basic','summary','edu','work','proj','skills','certs'];
const SECTION_LABELS={basic:'目标岗位',summary:'个人简介',edu:'教育经历',work:'工作 / 实习经历',proj:'项目经历',skills:'专业技能',certs:'证书 / 荣誉'};
const BASIC_FIELD_LABELS={name:'姓名',phone:'电话',email:'邮箱',city:'城市',job:'目标岗位',photo:'照片',gender:'性别',age:'年龄',hometown:'家乡',political:'政治面貌',salary:'期望薪资',onboard:'到岗时间',targetCity:'意向城市'};
const FIELD_LABELS={
 edu:{school:'学校',major:'专业',degree:'学历',start:'开始年月',end:'结束年月',gpa:'GPA / 成绩',courses:'主修课程',honors:'在校荣誉'},
 work:{company:'公司',position:'职位',start:'开始年月',end:'结束年月',desc:'描述'},
 proj:{name:'项目名称',role:'担任角色',start:'开始年月',end:'结束年月',desc:'描述'},
 skills:{name:'技能名称',level:'熟练程度'},
 certs:{name:'证书名称',date:'获得时间'}
};
const TOP_FIXED_LABELS={summary:'个人简介',jd:'目标岗位描述',factsConfirmed:'真实性确认',sourceText:'原始材料',notes:'本人补充事实'};
function issueMeta(path){
 const fallback={location:'整份简历',owner:'operator'};
 if(typeof path!=='string')return fallback;
 const p=path.trim();
 if(!p||p.length>120||/[<>"'`\\{}$]/.test(p)||/javascript:|https?:|__proto__|constructor|prototype/i.test(p))return fallback;
 const parts=p.split('.');
 const head=parts[0];
 if(head==='layout'&&parts.length===1)return {location:'排版与可读性',owner:'operator'};
 if(parts.length===1&&Object.prototype.hasOwnProperty.call(TOP_FIXED_LABELS,head))return {location:TOP_FIXED_LABELS[head],owner:'client'};
 if(head==='basic'){
  if(parts.length===1)return {location:'基本信息',owner:'client'};
  if(parts.length===2&&Object.prototype.hasOwnProperty.call(BASIC_FIELD_LABELS,parts[1]))return {location:'基本信息 · '+BASIC_FIELD_LABELS[parts[1]],owner:'client'};
  return fallback;
 }
 if(Object.prototype.hasOwnProperty.call(FIELD_LABELS,head)){
  const secLabel=SECTION_LABELS[head]||head;
  if(parts.length===1)return {location:secLabel,owner:'client'};
  if(!/^\d+$/.test(parts[1]))return fallback;
  const idx=Number(parts[1]);
  if(idx>99)return fallback;
  const nth='第'+(idx+1)+'条';
  if(parts.length===2)return {location:secLabel+nth,owner:'client'};
  if(parts.length===3&&Object.prototype.hasOwnProperty.call(FIELD_LABELS[head],parts[2]))return {location:secLabel+nth+' · '+FIELD_LABELS[head][parts[2]],owner:'client'};
  return fallback;
 }
 return fallback;
}
function deliveryChecklist(model){
 const m=model&&typeof model==='object'?model:{};
 const score=m.score&&typeof m.score==='object'?m.score:{};
 const fresh=score.fresh===true&&typeof score.total==='number'&&isFinite(score.total);
 const quality=score.ready===true;
 const comp=m.comparison&&typeof m.comparison==='object'?m.comparison:{};
 const hasOriginal=comp.available===true;
 const changes=hasOriginal&&Array.isArray(comp.changes)?comp.changes:[];
 const ann=m.annotations&&typeof m.annotations==='object'?m.annotations:{stale:false,items:[]};
 const annStale=ann.stale===true;
 const hasChange=changes.length>0;
 const noteOk=typeof m.note==='string'&&!!m.note.trim();
 const annReasonsOk=changes.every(ch=>ch.annotation&&typeof ch.annotation.reason==='string'&&!!ch.annotation.reason.trim());
 const explanation=!m.noteStale&&!annStale&&(!hasChange||noteOk||annReasonsOk);
 const feedback=!annStale&&changes.every(ch=>{const a=ch.annotation;return !a||(a.status!=='pending'&&a.status!=='rework'&&a.basis!=='pending');});
 const checks=[
  {id:'review',label:'有效审查',ok:fresh,detail:fresh?'审查与当前稿件一致，总分 '+score.total+' 分（固定 85 分细则不变）。':'无有效审查，不展示总分，不猜测定制达标。'},
  {id:'quality',label:'内部质量门槛',ok:quality,detail:quality?'已达到原有内部质量门槛。':'存在待处理质量问题，需先处理。'},
  {id:'original',label:'已保存原稿',ok:hasOriginal,detail:hasOriginal?'已保存原稿，可对照说明修改。':'未保存原稿，无法对照修改。'},
  {id:'explanation',label:'改稿说明完整',ok:explanation,detail:explanation?'改稿说明已覆盖当前修改。':(m.noteStale||annStale?'已有说明已过期，需重新核对填写。':'仍有修改缺少改稿说明。')},
  {id:'feedback',label:'客户反馈已核对',ok:feedback,detail:feedback?'未记录待处理反馈，不代表客户验收。':'存在待处理或需返工的反馈，需先核对。'}
 ];
 const allOk=checks.every(c=>c.ok);
 const state=(!fresh||!hasOriginal)?'diagnosis':(allOk?'ready':'pending');
 const label=state==='diagnosis'?'需先完成诊断与审查':(state==='ready'?'内部条件满足，待人工交付核对':'有待处理事项，暂不具备交付条件');
 const items=[];
 if(!fresh)items.push({kind:'review',priority:'must',audience:'operator',location:'整份简历',reason:'当前没有与稿件一致的有效审查，无法评估质量。',suggestion:'重新运行审查并确认内容真实性后再生成交付材料。',evidence:''});
 const issues=Array.isArray(m.issues)?m.issues:[];
 let mustFromIssues=false;
 for(const x of issues){
  const it=x&&typeof x==='object'?x:{};
  const meta=issueMeta(typeof it.path==='string'?it.path:'');
  const priority=it.severity==='blocker'?'must':'optional';
  if(priority==='must')mustFromIssues=true;
  items.push({kind:'issue',priority,audience:it.owner==='client'?'client':it.owner==='operator'?'operator':meta.owner==='client'?'client':'operator',location:typeof it.location==='string'&&it.location?it.location:meta.location,reason:typeof it.reason==='string'?it.reason:'',suggestion:typeof it.suggestion==='string'?it.suggestion:'',evidence:typeof it.evidence==='string'?it.evidence:''});
 }
 if(!quality&&!mustFromIssues)items.push({kind:'quality',priority:'must',audience:'operator',location:'整份简历',reason:'尚未达到原有内部质量门槛。',suggestion:'先处理待办问题或确认无需处理，再生成交付材料。',evidence:''});
 if(!hasOriginal)items.push({kind:'original',priority:'must',audience:'operator',location:'整份简历',reason:'未保存原稿，无法对照说明修改内容。',suggestion:'保存原稿后再进入交付核对。',evidence:''});
 if(m.noteStale||annStale){
  items.push({kind:'explanation',priority:'must',audience:'operator',location:'整份简历',reason:'已有改稿说明或逐栏目说明与当前稿件不一致（已过期）。',suggestion:'重新核对当前修改并更新说明；过期说明内容不再导出。',evidence:''});
 }else if(!explanation){
  items.push({kind:'explanation',priority:'must',audience:'operator',location:'整份简历',reason:'仍有修改缺少改稿说明。',suggestion:'为每处修改补充说明，或填写整体改稿说明。',evidence:''});
 }
 if(!annStale){
  for(const ch of changes){
   const a=ch&&ch.annotation?ch.annotation:null;
   if(a&&(a.status==='pending'||a.status==='rework'||a.basis==='pending')){
    const fb=typeof a.feedback==='string'?a.feedback.trim():'';const feedbackState=a.status==='rework'?'需返工':a.status==='pending'?'待客户确认':'依据待核对';
    items.push({kind:'feedback',priority:'must',audience:'client',location:SECTION_LABELS[ch.section]||'整份简历',reason:feedbackState+'：'+(fb||'请核对该栏目的修改内容。'),suggestion:'请核对以上修改是否符合预期；如需调整请说明。',evidence:typeof a.reason==='string'?a.reason:''});
   }
  }
 }
 const footer=state==='ready'?'以上为内部交付核对状态，仅代表内部条件满足，不代表客户验收、事实认证或招聘结果；总分依据固定 85 分细则，审查完成不等于全部通过。请人工核对后再分享。':'以上为内部交付核对状态，不代表客户验收、事实认证或招聘结果；请先处理待办项。';
 return {state,label,canFinalize:state==='ready',checks,items,footer};
}

function toSupplementText(model){
 const r=deliveryChecklist(model);
 const lines=['客户待补信息与确认清单',''];
 const client=r.items.filter(x=>x.audience==='client');
 if(!client.length){
  lines.push(r.canFinalize?'当前检查未列出客户待补项。':'当前未列出客户待补项，但工作台仍有待处理事项，不能据此认定材料齐全。');
  lines.push('','本清单不保证面试或录用结果。');
  return lines.join('\n');
 }
 for(const x of client){
  lines.push((x.priority==='must'?'【需要补充】':'【建议补充】')+' · '+x.location);
  if(x.reason)lines.push('情况：'+x.reason);
  if(x.suggestion)lines.push((x.kind==='feedback'?'核对请求：':'改法：')+x.suggestion);
  if(x.evidence)lines.push('依据：'+x.evidence);
  lines.push('');
 }
 lines.push('请核对上述事项，并补充可确认的信息。清单只反映当前检查结果，不代表录用承诺。');
 return lines.join('\n');
}

function deliveryHTML(model){
 const r=deliveryChecklist(model);
 const h=[];
 h.push('<div id="client-delivery-check" data-delivery-state="'+r.state+'">');
 h.push('<h3>交付核对 · '+esc(r.label)+'</h3>');
 h.push('<ul>');
 for(const c of r.checks)h.push('<li>'+esc(c.label)+'：'+(c.ok?'已满足':'待处理')+(c.detail?' — '+esc(c.detail):'')+'</li>');
 h.push('</ul>');
 function itemList(list,title,tag){
  if(!list.length)return;
  h.push('<p>'+esc(title)+'</p><ul>');
  for(const x of list){
   h.push('<li><strong>'+esc(x.priority==='must'?'必须':'建议')+'</strong> · '+esc(x.location)+(x.reason?'：'+esc(x.reason):'')+(x.suggestion?'（'+esc(tag)+'：'+esc(x.suggestion)+'）':'')+(x.evidence?' [依据：'+esc(x.evidence)+']':'')+'</li>');
  }
  h.push('</ul>');
 }
 itemList(r.items.filter(x=>x.audience==='operator'),'内部处理','处理建议');
 itemList(r.items.filter(x=>x.audience==='client'),'客户补充','核对请求');
 h.push('<p>'+esc(r.footer)+'</p>');
 h.push('</div>');
 return h.join('\n');
}
function issueText(x){
 const label={blocker:'必须修改',warning:'建议改进'}[x?.severity]||'建议改进';
 const meta=issueMeta(x?.path);if(x?.reason==='经历缺少起止时间')meta.location=meta.location.replace(' · 开始年月',' · 起止年月');
 return {...meta,severity:x?.severity==='blocker'?'blocker':'warning',label,evidence:String(x?.evidence??''),reason:String(x?.reason??''),suggestion:String(x?.suggestion??'')};
}
function build(record,metrics={}){
 const d=ResumeCore.visibleData(record);
 const q=ResumeCore.score(record,metrics);
 const fresh=q.fresh===true;
 const noteRaw=record?.clientNote;
 const notePresent=!!(noteRaw&&typeof noteRaw==='object'&&typeof noteRaw.text==='string'&&noteRaw.text.trim());
 const noteStale=notePresent&&noteRaw.fingerprint!==ResumeCore.fingerprint(record);
 const note=notePresent&&!noteStale?noteRaw.text.slice(0,6000):'';
 const issues=[];
 for(const x of q.issues.filter(x=>!ResumeCore.normalizeLayout(record.layout).hidden.includes(String(x.path||'').split('.')[0]))){
  const it=issueText(x);
  const privacy=[record.data?.basic?.name,record.data?.basic?.phone,record.data?.basic?.email].filter(v=>typeof v==='string'&&v.length>1);
  for(const field of ['evidence','reason','suggestion'])for(const value of privacy)it[field]=it[field].split(value).join('[已隐藏个人信息]');
  if(it.severity==='blocker')issues.push(it);
 }
 for(const x of q.issues.filter(x=>!ResumeCore.normalizeLayout(record.layout).hidden.includes(String(x.path||'').split('.')[0]))){
  const it=issueText(x);
  const privacy=[record.data?.basic?.name,record.data?.basic?.phone,record.data?.basic?.email].filter(v=>typeof v==='string'&&v.length>1);
  for(const field of ['evidence','reason','suggestion'])for(const value of privacy)it[field]=it[field].split(value).join('[已隐藏个人信息]');
  if(it.severity!=='blocker')issues.push(it);
 }
 const limits=[
  '本地规则核对完整性、日期、占位词、事实确认与版式。有效的AI审查提供内容问题和原文依据。分数是内部质量标准，不代表面试成功率或 ATS 通过率。',
  fresh?'AI 审查结果与当前稿件一致，总分依据固定评分细则计算，审查完成不等于全部项目通过。':'当前无有效的 AI 审查（未审查、未确认真实性或稿件已修改），不展示总分，只列出本地规则发现的问题。',
  '报告由本人手动分享，发送前请先预览并核对内容。',
  '逐栏目说明与客户反馈由人工填写和记录，需本人核对，不代表系统核实了事实或招聘结果。'
 ];
 if(metrics.pages>1)limits.push('内容超过一页，线上投递前建议精简或隐藏次要栏目。');
 const b=ResumeCore.captureBaseline(record);

 function available(){if(!b)return {available:false,capturedAt:'',label:'',changes:[]};const changes=[];for(const key of SECTION_KEYS){if(ResumeCore.normalizeLayout(record.layout).hidden.includes(key))continue;const before=baselineText(key,b.data),after=currentText(key,d);if(before!==after)changes.push({section:key,label:SECTION_LABELS[key],before,after});}return {available:true,capturedAt:b.capturedAt||'',label:b.label||'原稿',changes};}
 function baselineText(key,data){if(key==='basic')return basicText(data.basic);if(key==='summary')return data.summary||'';const list=Array.isArray(data[key])?data[key]:[];return list.map(entryText[key]||(()=> '')).filter(Boolean).join('\n\n');}
 function currentText(key,data){if(key==='basic')return basicText(data.basic);if(key==='summary')return data.summary||'';const list=Array.isArray(data[key])?data[key]:[];return list.map(entryText[key]||(()=> '')).filter(Boolean).join('\n\n');}
 const entryText={
  edu:e=>[e.school,e.major,e.degree].filter(Boolean).join(' · ')+'\n'+[e.start&&e.end?e.start+' — '+e.end:e.start||e.end,e.gpa?'GPA / 成绩：'+e.gpa:'',e.courses?'主修课程：'+e.courses:'',e.honors?'在校荣誉：'+e.honors:''].filter(Boolean).join('\n'),
  work:e=>[e.company,e.position].filter(Boolean).join(' · ')+'\n'+[e.start&&e.end?e.start+' — '+e.end:e.start||e.end,e.desc].filter(Boolean).join('\n'),
  proj:e=>[e.name,e.role].filter(Boolean).join(' · ')+'\n'+[e.start&&e.end?e.start+' — '+e.end:e.start||e.end,e.desc].filter(Boolean).join('\n'),
  skills:e=>e.name+[['',' · 了解',' · 基础',' · 熟练',' · 精通',' · 专家'][e.level]||''].join(''),
  certs:e=>[e.name,e.date].filter(Boolean).join(' · ')
 };
 const comparison=available();
 const annotations={stale:false,items:[]};
 const changedSections=new Set();
 if(b){
  for(const key of SECTION_KEYS){
   if(ResumeCore.normalizeLayout(record.layout).hidden.includes(key))continue;
   if(baselineText(key,b.data)!==currentText(key,d))changedSections.add(key);
  }
 }
 const changedKeys=SECTION_KEYS.filter(k=>changedSections.has(k));
 comparison.changes.forEach((ch,i)=>{ch.section=changedKeys[i]||'';});
 const annotationRaw=record&&typeof record==='object'?record.clientAnnotations:null;
 if(annotationRaw&&typeof annotationRaw==='object'&&Array.isArray(annotationRaw.items)&&annotationRaw.items.length){
  const sig=annotationSignature(record);
  if(!sig||annotationRaw.fingerprint!==ResumeCore.fingerprint(record)||annotationRaw.comparisonSignature!==sig){
   annotations.stale=true;
  }else{
   annotations.items=normalizeAnnotationItems(annotationRaw.items).filter(it=>changedSections.has(it.section));
  }
 }
 for(const ch of comparison.changes){
  const it=annotations.items.find(x=>x.section===ch.section);
  if(it)ch.annotation=it;
 }
 const model={
  kind:'resume-client-report',version:1,
  title:REPORT_TITLE,
  job:d.basic.job||'',
  generatedAt:new Date().toISOString(),
  status:fresh?'fresh':'stale',
  score:{total:q.total,localTotal:q.localTotal,fresh,ready:q.ready===true},
  issues,
  comparison,annotations,
  note,noteStale,
  limitations:limits
 };
 model.delivery=deliveryChecklist(model);
 return model;
}
const ANNOTATION_SECTIONS=['basic','summary','edu','work','proj','skills','certs'];
const ANNOTATION_BASES=['original','supplement','jd','pending'];
const ANNOTATION_STATUSES=['pending','confirmed','rework'];
const ANNOTATION_BASE_LABELS={original:'原稿',supplement:'本人补充',jd:'岗位要求',pending:'待确认'};
const ANNOTATION_STATUS_LABELS={pending:'待客户确认',confirmed:'人工记录客户已确认',rework:'需返工'};
function annotationSignature(record){
 const b=ResumeCore.captureBaseline(record);
 if(!b)return '';
 const d=ResumeCore.visibleData(record);
 const l=ResumeCore.normalizeLayout(record.layout);
 const payload=JSON.stringify({baseline:{data:b.data,layout:b.layout,capturedAt:b.capturedAt||'',label:b.label||''},current:d,layout:l});
 let h=2166136261;
 for(let i=0;i<payload.length;i++){h^=payload.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(16)+':'+payload.length;
}
function normalizeAnnotationItems(rawItems){
 const list=Array.isArray(rawItems)?rawItems:[];
 const out=[];
 const seen=new Set();
 for(const it of list){
  if(!it||typeof it!=='object'||Array.isArray(it))continue;
  const section=typeof it.section==='string'?it.section:'';
  if(!ANNOTATION_SECTIONS.includes(section)||seen.has(section))continue;
  const reason=typeof it.reason==='string'?it.reason.slice(0,1500):'';
  const feedback=typeof it.feedback==='string'?it.feedback.slice(0,1500):'';
  const basis=ANNOTATION_BASES.includes(it.basis)?it.basis:'pending';
  const status=ANNOTATION_STATUSES.includes(it.status)?it.status:'pending';
  if(!reason.trim()&&!feedback.trim()&&status==='pending')continue;
  seen.add(section);
  out.push({section,reason,basis,status,feedback});
 }
 return out;
}
function saveAnnotations(record,items){
 if(!record||typeof record!=='object')throw Error('缺少简历对象，无法保存逐栏目说明');
 const rawList=Array.isArray(items)?items:[];
 if(!rawList.length){record.clientAnnotations=null;return null;}
 if(!ResumeCore.captureBaseline(record))throw Error('尚未保存对照原稿：请先在客户交付第 1 步保存原稿，再填写逐栏目说明');
 const comparison=build(record,{}).comparison;
 if(!comparison||!Array.isArray(comparison.changes)||!comparison.changes.length)throw Error('当前对照原稿与稿件没有可见差异，没有可保存的逐栏目说明');
 const changed=new Set(comparison.changes.map(ch=>ch.section));
 const normalized=normalizeAnnotationItems(rawList.filter(it=>it&&typeof it==='object'&&changed.has(String(it.section||''))));
 if(!normalized.length){record.clientAnnotations=null;return null;}
 record.clientAnnotations={fingerprint:ResumeCore.fingerprint(record),comparisonSignature:annotationSignature(record),items:normalized};
 return ResumeCore.clone(record.clientAnnotations);
}
function annotationHTML(c){
 const a=c&&c.annotation;
 if(!a||typeof a!=='object')return '';
 const rows=[];
 if(a.reason)rows.push('<p class="annotation-line"><strong>改稿理由（人工填写）：</strong>'+esc(a.reason)+'</p>');
 rows.push('<p class="annotation-line"><strong>依据：</strong>'+esc(ANNOTATION_BASE_LABELS[a.basis]||'待确认')+'</p>');
 rows.push('<p class="annotation-line"><strong>客户反馈状态（人工记录）：</strong>'+esc(ANNOTATION_STATUS_LABELS[a.status]||'待客户确认')+'</p>');
 if(a.feedback)rows.push('<p class="annotation-line"><strong>客户反馈原文：</strong>'+esc(a.feedback)+'</p>');
 return '<div class="annotation-block">'+rows.join('')+'</div>';
}
function annotationText(c){
 const a=c&&c.annotation;
 if(!a||typeof a!=='object')return '';
 const lines=[];
 if(a.reason)lines.push('改稿理由：'+a.reason);
 lines.push('依据：'+(ANNOTATION_BASE_LABELS[a.basis]||'待确认'));
 lines.push('客户反馈状态：'+(ANNOTATION_STATUS_LABELS[a.status]||'待客户确认'));
 if(a.feedback)lines.push('客户反馈原文：'+a.feedback);
 return lines.join('\n');
}
function basicText(b){return b?.job?'目标岗位：'+b.job:'';}
function captureBaseline(record){
 const data=ResumeCore.visibleData(record);data.basic=ResumeCore.normalizeData({basic:{job:data.basic.job}}).basic;
 return {data,layout:ResumeCore.normalizeLayout(record.layout),capturedAt:new Date().toISOString(),label:'对照原稿'};
}
function toHTML(model){
 const m=model||build(null);
 const title=esc(m.title||REPORT_TITLE);
 const parts=[];
 parts.push('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
 parts.push('<title>'+title+'</title>');
 parts.push('<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Microsoft YaHei",sans-serif;color:#1f2933;background:#fff;font-size:14px;line-height:1.7;padding:40px 48px;max-width:820px;margin:0 auto}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e4e7eb}.sub{color:#616e7c;font-size:13px}.badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;margin-left:8px;vertical-align:middle}.badge.blocker{background:#fdecea;color:#b3261e}.badge.warning{background:#fff4e0;color:#8a5a00}.score{display:inline-block;padding:2px 10px;background:#eef2f6;border-radius:6px;margin-right:8px}.issue{padding:10px 14px;border:1px solid #e4e7eb;border-left:4px solid #d5dbe1;border-radius:4px;margin-bottom:10px}.issue.blocker{border-left-color:#d93025}.issue.warning{border-left-color:#e8a013}.issue .reason{font-weight:bold}.issue .evidence{background:#f5f7fa;padding:6px 10px;border-radius:4px;margin:6px 0;white-space:pre-wrap;word-break:break-all}.issue .suggestion{color:#616e7c}.row{margin-bottom:14px;padding:10px 14px;background:#fafbfc;border:1px solid #e4e7eb;border-radius:4px}.col{margin-top:6px;white-space:pre-wrap;word-break:break-word}.cap{font-size:12px;color:#616e7c}.before{border-left:3px solid #d5dbe1;padding-left:10px}.after{border-left:3px solid #1a73e8;padding-left:10px}.note{padding:10px 14px;background:#f0f7ff;border-left:4px solid #1a73e8;border-radius:4px;white-space:pre-wrap;word-break:break-word}#client-delivery-check{overflow-wrap:anywhere;padding:12px 14px;background:#f5f8fb;border:1px solid #e4e7eb;border-radius:6px;margin:20px 0}#client-delivery-check h3{font-size:16px;margin-bottom:8px}#client-delivery-check ul{padding-left:20px;margin:8px 0}.annotation-block{margin-top:10px;padding:10px 12px;border-left:3px solid #315c79;background:#f0f7ff}.annotation-line{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}.limits{color:#616e7c;font-size:13px}.limits li{margin-bottom:4px}.empty{color:#616e7c;font-style:italic}@media(max-width:600px){body{padding:24px 18px}}@media print{body{padding:0;max-width:none}h2{page-break-after:avoid}.issue,.row{page-break-inside:avoid}}</style></head><body>');
 parts.push('<h1>'+title+'</h1>');
 parts.push('<p class="sub">生成时间：'+esc(fmtTime(m.generatedAt))+(m.job?'　·　目标岗位：'+esc(m.job):'')+'</p>');
 parts.push(deliveryHTML(m));
 parts.push('<h2>评分</h2>');
 if(m.score&&m.score.total!==null&&m.score.total!==undefined)parts.push('<p><span class="score">总分 '+esc(m.score.total)+'</span><span class="score">本地检查 '+esc(m.score.localTotal)+'</span><span class="sub">'+(m.score.ready?'质量门槛满足':'暂不交付')+'</span></p>');
 else parts.push('<p class="empty">暂无有效审查，不展示总分；以下为本地规则检查结果。</p>');
 parts.push('<h2>问题清单</h2>');
 if(m.issues&&m.issues.length)for(const x of m.issues)parts.push('<div class="issue '+esc(x.severity)+'"><span class="badge '+esc(x.severity)+'">'+esc(x.label)+'</span><p class="sub">位置：'+esc(x.location||'整份简历')+'</p><p class="reason">'+esc(x.reason)+'</p>'+(x.evidence?'<p class="evidence">'+esc(x.evidence)+'</p>':'')+(x.suggestion?'<p class="suggestion">建议：'+esc(x.suggestion)+'</p>':'')+'</div>');
 else parts.push('<p class="empty">本地规则未发现问题。</p>');
 parts.push('<h2>改前改后对照</h2>');
 if(m.comparison&&m.comparison.available){
  parts.push('<p class="sub">原稿保存时间：'+esc(fmtTime(m.comparison.capturedAt))+(m.comparison.label?'　·　'+esc(m.comparison.label):'')+'</p>');
  if(m.comparison.changes.length)for(const c of m.comparison.changes)parts.push('<div class="row"><strong>'+esc(c.label)+'</strong><div class="col before"><span class="cap">改前：</span>'+esc(c.before)+'</div><div class="col after"><span class="cap">改后：</span>'+esc(c.after)+'</div>'+annotationHTML(c)+'</div>');
  else parts.push('<p class="empty">与原稿一致。</p>');
 }else parts.push('<p class="empty">尚未保存原稿对照。确认内容后请先在编辑页点击“保存当前内容为对照原稿”，再生成报告。</p>');
 if(m.annotations?.stale)parts.push('<p class="empty">逐栏目说明与反馈已过期，请在工作台重新核对保存；旧记录未展示。</p>');
 parts.push('<h2>人工改稿说明</h2>');
 if(m.note)parts.push('<div class="note">'+esc(m.note)+'</div>');
 else parts.push('<p class="empty">'+(m.noteStale?'原改稿说明对应的稿件已修改，已隔离不展示；请重新填写。':'暂无人工改稿说明。')+'</p>');
 parts.push('<h2>边界说明</h2>');
 parts.push('<ul class="limits">'+(m.limitations||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>');
 parts.push('</body></html>');
 return parts.join('');
 function fmtTime(s){const t=new Date(s);return isNaN(t)?'':t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')+' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');}
}
function toText(model){
 const m=model||build(null);
 const out=[];
 out.push(m.title||REPORT_TITLE);
 out.push('生成时间：'+fmtTime(m.generatedAt)+(m.job?'　·　目标岗位：'+m.job:''));
 out.push('');
 const handoff=deliveryChecklist(m);out.push('== 交付前核对 ==',handoff.label,...handoff.checks.map(c=>(c.ok?'已满足':'待处理')+' · '+c.label+'：'+c.detail),handoff.footer,'');
 out.push('== 评分 ==');
 if(m.score&&m.score.total!==null&&m.score.total!==undefined)out.push('总分：'+m.score.total+'（本地检查 '+m.score.localTotal+'）'+(m.score.ready?'，质量门槛满足':'，暂不交付'));
 else out.push('暂无有效审查，不展示总分；以下为本地规则检查结果。');
 out.push('');
 out.push('== 问题清单 ==');
 if(m.issues&&m.issues.length)for(const x of m.issues)out.push('【'+x.label+'】'+(x.location?'位置：'+x.location+' · ':'')+x.reason+(x.evidence?'\n证据：'+x.evidence:'')+(x.suggestion?'\n建议：'+x.suggestion:'')+'\n');
 else out.push('本地规则未发现问题。');
 out.push('== 改前改后对照 ==');
 if(m.comparison&&m.comparison.available){
  out.push('原稿保存时间：'+fmtTime(m.comparison.capturedAt)+(m.comparison.label?'　·　'+m.comparison.label:''));
  if(m.comparison.changes.length)for(const c of m.comparison.changes)out.push('◆ '+c.label+'\n改前：\n'+c.before+'\n改后：\n'+c.after+'\n'+annotationText(c));
  else out.push('与原稿一致。');
 }else out.push('尚未保存原稿对照。');
 if(m.annotations?.stale)out.push('逐栏目说明与反馈已过期，请重新核对保存；旧记录未展示。');
 out.push('== 人工改稿说明 ==');
 out.push(m.note?m.note:(m.noteStale?'原改稿说明对应的稿件已修改，已隔离不展示；请重新填写。':'暂无人工改稿说明。'));
 out.push('');
 out.push('== 边界说明 ==');
 for(const x of m.limitations||[])out.push('- '+x);
 return out.join('\n');
 function fmtTime(s){const t=new Date(s);return isNaN(t)?'':t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')+' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');}
}
return {build,toHTML,toText,captureBaseline,saveBaseline:ResumeCore.saveBaseline,annotationSignature,saveAnnotations,issueMeta,deliveryChecklist,toSupplementText,deliveryHTML};
});