(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ResumeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const FIELDS={basic:['name','phone','email','city','job','photo','gender','age','hometown','political','salary','onboard','targetCity'],edu:['school','major','degree','start','end','gpa','courses','honors'],work:['company','position','start','end','desc'],proj:['name','role','start','end','desc'],skills:['name','level'],certs:['name','date']};
const LABELS={summary:'个人简介',edu:'教育经历',work:'工作 / 实习经历',proj:'项目经历',skills:'专业技能',certs:'证书 / 荣誉'};
const TEMPLATES={classic:'经典商务',minimal:'极简现代',card:'清晰卡片',sidebar:'色带侧栏',banner:'通栏色块',editorial:'书卷 · 新增',timeline:'时间线 · 新增',twocol:'双栏商务 · 新增',table:'表格经典 · 新增',whitespace:'高级留白 · 新增',magazine:'现代杂志 · 新增',fresh:'清新多彩 · 新增',skillbar:'技能仪表 · 新增'};
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const str=x=>typeof x==='string'?x.slice(0,60000):typeof x==='number'?String(x):'';
function normalizeData(d){
 d=d&&typeof d==='object'?d:{};const out={basic:{},summary:str(d.summary)};
 for(const [section,keys] of Object.entries(FIELDS)){
  const norm=o=>Object.fromEntries(keys.map(k=>[k,section==='skills'&&k==='level'?Math.max(0,Math.min(5,Math.trunc(Number(o?.[k])||0))):str(o?.[k])]));
  out[section]=section==='basic'?norm(d.basic):(Array.isArray(d[section])?d[section].filter(x=>x&&typeof x==='object').slice(0,100).map(norm):[]);
 }
 const photo=d.basic?.photo;
 out.basic.photo=typeof photo==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(photo)&&photo.length<1500000?photo:'';
 return out;
}
function normalizeLayout(l={}){
 const keys=Object.keys(LABELS),order=Array.isArray(l.order)?[...new Set(l.order.filter(k=>keys.includes(k)))]:[];
 return {template:TEMPLATES[l.template]?l.template:'classic',color:/^#[\da-f]{6}$/i.test(l.color||'')?l.color:'#315c79',fontSize:Math.min(14,Math.max(10,Number(l.fontSize)||11)),lineHeight:Math.min(1.9,Math.max(1.25,Number(l.lineHeight)||1.5)),gap:Math.min(24,Math.max(6,Number(l.gap)||12)),fitOnePage:l.fitOnePage!==false,order:[...order,...keys.filter(k=>!order.includes(k))],hidden:Array.isArray(l.hidden)?l.hidden.filter(k=>keys.includes(k)):[]};
}
function createRecord(title='未命名简历',data){return {id:uid(),title:str(title)||'未命名简历',updatedAt:new Date().toISOString(),data:normalizeData(data),layout:normalizeLayout(),history:[],sourceText:'',notes:'',jd:'',review:null,factsConfirmed:false,clientBaseline:null,clientNote:null,clientAnnotations:null,clientDeliveries:[]};}
function isIsoUtc(s){if(typeof s!=='string')return false;try{return new Date(s).toISOString()===s;}catch(e){return false;}}
function normalizeClientDeliveries(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw))throw Error('客户交付留档数据格式错误，已拒绝');
 if(raw.length>5)throw Error('客户交付留档最多保留 5 份，数据已损坏');
 const out=[];let total=0;
 for(const it of raw){
  if(!it||typeof it!=='object'||Array.isArray(it))throw Error('留档条目格式损坏，已拒绝整个留档');
  const id=it.id,label=it.label,savedAt=it.savedAt,fingerprint=it.fingerprint,text=it.text,supplement=it.supplement;
  if(typeof id!=='string'||id.length<1||id.length>120)throw Error('留档编号格式损坏，已拒绝整个留档');
  if(typeof label!=='string'||label.trim().length<1||label.trim().length>60||/[\n\r]/.test(label))throw Error('留档标签格式损坏，已拒绝整个留档');
  if(!isIsoUtc(savedAt))throw Error('留档时间格式损坏，已拒绝整个留档');
  if(typeof fingerprint!=='string'||fingerprint.length<1||fingerprint.length>200)throw Error('留档指纹格式损坏，已拒绝整个留档');
  if(typeof text!=='string'||!text.trim()||text.length>400000)throw Error('留档正文格式损坏，已拒绝整个留档');
  if(typeof supplement!=='string'||supplement.length>400000)throw Error('留档待补清单格式损坏，已拒绝整个留档');
  total+=text.length+supplement.length;
  if(total>1000000)throw Error('留档文本总量超过上限，已拒绝整个留档');
  if(out.some(e=>e.id===id))throw Error('留档编号重复，已拒绝整个留档');
  out.push({id,label:label.trim(),savedAt,fingerprint,text,supplement});
 }
 return out;
}
function addClientDelivery(r,preview,label){
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('缺少简历对象');
 if(!preview||typeof preview!=='object'||Array.isArray(preview))throw Error('缺少客户预览数据，保存失败');
 const fingerprint=preview.fingerprint,text=preview.text,supplement=preview.supplement;
 if(typeof fingerprint!=='string'||fingerprint.length<1||fingerprint.length>200)throw Error('客户报告指纹无效，保存失败');
 if(typeof text!=='string'||!text.trim()||text.length>400000)throw Error('客户报告正文为空或超出长度限制，保存失败');
 if(typeof supplement!=='string'||supplement.length>400000)throw Error('待补清单超出长度限制，保存失败');
 if(typeof label!=='string'||label.trim().length<1||label.trim().length>60||/[\n\r]/.test(label))throw Error('留档标签需为 1-60 字且不能包含换行');
 const old=normalizeClientDeliveries(r.clientDeliveries);
 if(old.length>=5)throw Error('每份简历最多保留 5 份留档，请先手动删除后再保存');
 if(old.some(e=>e.text===text&&e.supplement===supplement))throw Error('相同内容的留档已存在，无需重复保存');
 if(old.reduce((s,e)=>s+e.text.length+e.supplement.length,0)+text.length+supplement.length>1000000)throw Error('留档文本总量超过上限，保存失败');
 const entry={id:uid(),label:label.trim(),savedAt:new Date().toISOString(),fingerprint,text,supplement};
 r.clientDeliveries=normalizeClientDeliveries([entry,...old]);
 return clone(entry);
}
function removeClientDelivery(r,id){
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('缺少简历对象');
 if(typeof id!=='string'||!id)throw Error('缺少留档编号');
 const old=normalizeClientDeliveries(r.clientDeliveries);
 const idx=old.findIndex(e=>e.id===id);
 if(idx<0)throw Error('未找到该留档，可能已被删除');
 const removed=old[idx];
 r.clientDeliveries=old.filter(e=>e.id!==id);
 return clone(removed);
}
function snapshot(r){return {data:normalizeData(r.data),layout:normalizeLayout(r.layout),title:str(r.title),sourceText:str(r.sourceText),notes:str(r.notes),jd:str(r.jd),factsConfirmed:r.factsConfirmed===true,clientBaseline:captureBaseline(r),clientNote:normalizeClientNote(r.clientNote),clientAnnotations:normalizeClientAnnotations(r.clientAnnotations)};}
function captureBaseline(r){
 const raw=r?.clientBaseline;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))return null;
 const layout=normalizeLayout(raw.layout),data=normalizeData(raw.data);
 for(const k of layout.hidden)data[k]=k==='summary'?'':[];
 data.basic.photo='';
 return {data,layout,capturedAt:clampText(raw.capturedAt,40),label:clampText(raw.label,60)};
}
function saveBaseline(r,label='原稿'){
 if(!r||typeof r!=='object')throw Error('缺少简历对象');
 const layout=normalizeLayout(r.layout),data=normalizeData(r.data);
 for(const k of layout.hidden)data[k]=k==='summary'?'':[];
 data.basic.photo='';
 r.clientBaseline={data,layout,capturedAt:new Date().toISOString(),label:str(label).slice(0,60)||'原稿'};
 return clone(r.clientBaseline);
}
function checkpoint(r,label='自动保存'){
 const snap=snapshot(r),prev=r.history?.[0];r.history=Array.isArray(r.history)?r.history:[];
 if(prev&&JSON.stringify(prev.snapshot)===JSON.stringify(snap))return;
 r.history.unshift({id:uid(),at:new Date().toISOString(),label:str(label),snapshot:snap});r.history=r.history.slice(0,5);
}
function restoreVersion(r,id){const v=r.history.find(h=>h.id===id);if(!v)throw Error('这个历史版本已不存在');const target=clone(v.snapshot);checkpoint(r,'恢复前的版本');Object.assign(r,target,{review:null,updatedAt:new Date().toISOString()});}
function fingerprint(r){const l=normalizeLayout(r.layout);const text=JSON.stringify({data:normalizeData(r.data),jd:str(r.jd),notes:str(r.notes),sourceText:str(r.sourceText),factsConfirmed:!!r.factsConfirmed,hidden:l.hidden,order:l.order});let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16)+':'+text.length;}
function cleanRecord(raw,newId=false){
 if(!raw||typeof raw!=='object'||!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))throw Error('备份包含损坏的简历，未导入任何内容');
 if(raw.data.basic!==undefined&&(!raw.data.basic||typeof raw.data.basic!=='object'||Array.isArray(raw.data.basic)))throw Error('备份基本信息格式损坏，未导入任何内容');
 for(const k of Object.keys(FIELDS).filter(k=>k!=='basic'))if(raw.data[k]!==undefined&&(!Array.isArray(raw.data[k])||raw.data[k].length>100||raw.data[k].some(x=>!x||typeof x!=='object'||Array.isArray(x))))throw Error('备份经历或技能格式损坏，未导入任何内容');
 const r=createRecord(raw.title,raw.data);Object.assign(r,snapshot({...r,...raw}));
 if(!newId&&typeof raw.id==='string')r.id=raw.id;
 r.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:r.updatedAt;
 if(raw.clientBaseline!==undefined)r.clientBaseline=captureBaseline(raw);
 if(raw.clientNote!==undefined)r.clientNote=normalizeClientNote(raw.clientNote);
 r.clientDeliveries=normalizeClientDeliveries(raw.clientDeliveries);
 r.history=Array.isArray(raw.history)?raw.history.slice(0,5).filter(h=>h&&h.snapshot&&h.snapshot.data).map(h=>({id:uid(),at:str(h.at),label:str(h.label),snapshot:snapshot({...createRecord(),...h.snapshot})})):[];
 // AI 审查只在当前会话产生；恢复/迁移后重新检查，避免信任备份中的伪造分数。
 return r;
}
function makeBackup(records){return JSON.stringify({format:'resume-studio',version:2,exportedAt:new Date().toISOString(),records:records.map(r=>({id:r.id,...snapshot(r),clientDeliveries:normalizeClientDeliveries(r.clientDeliveries),updatedAt:r.updatedAt,history:(r.history||[]).slice(0,5).map(h=>({id:h.id,at:h.at,label:h.label,snapshot:snapshot(h.snapshot)}))}))},null,2);}
function parseBackup(text){if(text.length>30*1024*1024)throw Error('备份超过 30 MB，请拆分后导入');let b;try{b=JSON.parse(text);}catch{throw Error('这不是有效的 JSON 备份');}if(b.format!=='resume-studio'||b.version!==2||!Array.isArray(b.records)||b.records.length>300)throw Error('备份格式或版本不受支持');return b.records.map(r=>cleanRecord(r,true));}
const clampText=(x,max)=>typeof x==='string'?x.slice(0,max):'';
function normalizeClientNote(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const text=clampText(raw.text,6000);
 if(!text.trim())return null;
 return {text,fingerprint:clampText(raw.fingerprint,200)};
}
const ANNOTATION_SECTIONS=['basic','summary','edu','work','proj','skills','certs'];
const ANNOTATION_BASES=['original','supplement','jd','pending'];
const ANNOTATION_STATUSES=['pending','confirmed','rework'];
function normalizeClientAnnotations(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const list=Array.isArray(raw.items)?raw.items:[];
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
 if(!out.length)return null;
 return {fingerprint:typeof raw.fingerprint==='string'?raw.fingerprint.slice(0,200):'',comparisonSignature:typeof raw.comparisonSignature==='string'?raw.comparisonSignature.slice(0,200):'',items:out};
}
const RUBRIC=[
 ['match_core','match','核心要求覆盖','目标岗位最重要的工作要求有真实经历对应，而非仅列关键词。'],
 ['match_evidence','match','匹配证据','相关技能有实际工作、项目或学习事例支撑。'],
 ['match_priority','match','内容取舍','最相关经验突出，次要内容没有挤占主要内容。'],
 ['match_level','match','岗位与资历','职责深度和求职方向相符，不虚构高级职责。'],
 ['match_specific','match','针对性','表达针对给定 JD；无 JD 时仅按意向岗位评估通用相关性，不能宣称定制达标。'],
 ['experience_context','experience','任务背景','读者能理解任务和要解决的问题。'],
 ['experience_action','experience','具体行动','说明具体做法、方法或工具，不只列岗位职责。'],
 ['experience_ownership','experience','个人贡献','区分个人完成与团队成果。'],
 ['experience_result','experience','结果与价值','说明可验证结果、交付物或改进，不强求数字。'],
 ['experience_support','experience','事实支撑','没有超出原始材料或本人补充的技能、职位和业绩。'],
 ['expression_clear','expression','清晰简洁','句子清楚，行动直接，易于扫描。'],
 ['expression_concrete','expression','减少空话','避免口号、夸大形容、机械套话和重复。'],
 ['expression_consistent','expression','语言准确','用词、术语、标点一致，无错字与语义矛盾。']
].map(([id,dimension,label,rule])=>({id,dimension,label,rule,max:5}));
function month(s){const m=String(s||'').match(/^(\d{4})[.\-/年](\d{1,2})月?$/);return m&&+m[2]>=1&&+m[2]<=12?+m[1]*12+(+m[2]):null;}
function visibleData(r){const d=normalizeData(r.data);for(const k of normalizeLayout(r.layout).hidden)d[k]=k==='summary'?'':[];return d;}
function createTargetedCopy(source,job,jd=''){
 const target=str(job).trim();if(!target)throw Error('请填写新岗位名称');
 const r=createRecord();Object.assign(r,snapshot(source));
 r.title=(r.data.basic.name||source.title)+' · '+target;r.data.basic.job=target;r.jd=str(jd).trim();r.factsConfirmed=false;
 return r;
}
function plainText(record){
 const d=visibleData(record),b=d.basic,join=xs=>xs.filter(Boolean).join(' · ');
 const contactLabels={phone:'电话',email:'邮箱',city:'所在城市',targetCity:'意向城市',gender:'性别',age:'年龄',hometown:'籍贯',political:'政治面貌',salary:'期望薪资',onboard:'到岗时间'};
 const parts=[[b.name,b.job,...Object.entries(contactLabels).filter(([k])=>b[k]).map(([k,label])=>label+'：'+b[k])].filter(Boolean).join('\n')];
 for(const key of normalizeLayout(record.layout).order){
  let text='';
  if(key==='summary')text=d.summary;
  else if(key==='skills')text=d.skills.map(e=>join([e.name,['','了解','基础','熟练','精通','专家'][e.level]])).filter(Boolean).join('\n');
  else if(key==='certs')text=d.certs.map(e=>join([e.name,e.date])).filter(Boolean).join('\n');
  else text=d[key].map(e=>{
   const title=key==='edu'?join([e.school,e.major,e.degree]):key==='work'?join([e.company,e.position]):join([e.name,e.role]);
   const desc=key==='edu'?[e.gpa?'GPA / 成绩：'+e.gpa:'',e.courses?'主修课程：'+e.courses:'',e.honors?'在校荣誉：'+e.honors:''].filter(Boolean).join('\n'):e.desc;
   return [title,[e.start,e.end].filter(Boolean).join(' — '),desc].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
  if(text.trim())parts.push(LABELS[key]+'\n'+text.trim());
 }
 return parts.filter(Boolean).join('\n\n');
}
function score(r,metrics={}){
 const d=visibleData(r),issues=[];let info=20,layout=15;
 const add=(path,reason,suggestion,severity='warning',points=0,dimension='info',evidence='')=>{issues.push({path,reason,suggestion,severity,points,dimension,evidence});if(dimension==='info')info-=points;else if(dimension==='layout')layout-=points;};
 if(!d.basic.name.trim())add('basic.name','缺少姓名','填写真实姓名','blocker',4);
 if(!d.basic.phone.trim()&&!d.basic.email.trim())add('basic.phone','缺少有效联系方式','至少填写电话或邮箱','blocker',4);
 if(d.basic.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.basic.email))add('basic.email','邮箱格式不正确','检查邮箱地址','blocker',2);
 if(d.basic.phone&&!/^\+?[\d ()-]{6,25}$/.test(d.basic.phone))add('basic.phone','电话格式可能不正确','检查国家区号和号码','blocker',2);
 if(!d.basic.job.trim())add('basic.job','缺少目标岗位','填写意向岗位','blocker',3);
 if(!d.edu.some(e=>e.school&&e.degree))add('edu','教育信息不完整','补充学校和学历，或确认是否适合省略','warning',3);
 if(![...d.work,...d.proj].some(e=>e.desc.trim()))add('work','缺少具体经历','添加工作、实习或项目的具体行动与结果','blocker',4);
 for(const k of ['edu','work','proj'])d[k].forEach((e,i)=>{
  const start=month(e.start),end=month(e.end);
  if(!e.start||!e.end)add(k+'.'+i+'.start','经历缺少起止时间','填写 YYYY.MM，结束时间可填“至今”','warning',1);
  if(e.start&&start===null)add(k+'.'+i+'.start','开始日期格式不正确','使用 YYYY.MM，例如 2024.09','blocker',1);
  if(e.end&&end===null&&!/^(至今|现在|在读)$/.test(e.end))add(k+'.'+i+'.end','结束日期格式不正确','使用 YYYY.MM 或“至今”','blocker',1);
  if(start!==null&&end!==null&&start>end)add(k+'.'+i+'.start','开始日期晚于结束日期','核对经历的起止年月','blocker',2);
 });
 const visit=(o,p)=>{if(typeof o==='string'&&/待填写|待添加|你的名字|示例文字|XXX|\[待补|【待补|某某公司/i.test(o))add(p,'仍有占位或示例文字','替换成自己的真实信息','blocker',2,'info',o);else if(o&&typeof o==='object')Object.entries(o).filter(([k])=>k!=='photo').forEach(([k,v])=>visit(v,p?p+'.'+k:k));};visit(d,'');
 if(!r.factsConfirmed)add('factsConfirmed','真实性尚未确认','核对简历中的经历、技能和数字后确认','blocker');
 if(!r.jd?.trim())add('jd','未提供目标岗位描述','粘贴 JD 后才能认证岗位定制交付；仍可导出通用简历');
 if(metrics.overflow)add('layout','存在横向溢出或内容裁切','调整版式或缩短无法换行的内容','blocker',6,'layout');
 if((metrics.minFontSize??metrics.fontSize??r.layout.fontSize)<9.99)add('layout','字号小于 10pt','扩大字号，精简内容，避免勉强塞满一页','blocker',5,'layout');
 if((metrics.pages||1)>1)add('layout','内容超过一页','精简次要内容或隐藏不相关模块，完整内容仍会导出','warning',3,'layout');
 if(metrics.overlap)add('layout','存在元素重叠','调整字号或模板后重新检查','blocker',6,'layout');
 const fresh=r.review?.fingerprint===fingerprint(r)&&Array.isArray(r.review.checks)&&RUBRIC.every(x=>r.review.checks.some(c=>c.id===x.id&&['pass','partial','fail'].includes(c.status)));
 const dims={match:null,experience:null,info:Math.max(0,info),expression:null,layout:Math.max(0,layout)};
 if(fresh){dims.match=0;dims.experience=0;dims.expression=0;
  for(const rule of RUBRIC){const c=r.review.checks.find(x=>x.id===rule.id),earned=c.status==='pass'?5:c.status==='partial'?2.5:0;dims[rule.dimension]+=earned;if(earned<5)issues.push({path:c.path||'work',reason:rule.label+'：'+(c.reason||'证据不足'),suggestion:c.suggestion||'补充对应的真实事例',evidence:c.evidence||'',severity:'warning',points:5-earned,dimension:rule.dimension});}
  for(const issue of r.review.issues||[])issues.push({...issue,severity:issue.severity==='blocker'?'blocker':'warning'});
 }
 const total=fresh?Math.round(Object.values(dims).reduce((a,b)=>a+b,0)):null;
 const blockers=issues.filter(i=>i.severity==='blocker');
 return {dimensions:dims,total,localTotal:dims.info+dims.layout,ready:fresh&&total>=85&&blockers.length===0&&!!r.jd?.trim(),fresh,issues,blockers};
}
function setPath(obj,path,value){const parts=path.split('.');if(parts.some(x=>['__proto__','constructor','prototype'].includes(x)))throw Error('无效字段');let target=obj;for(const p of parts.slice(0,-1)){if(target[p]===undefined)throw Error('字段已变化');target=target[p];}target[parts.at(-1)]=value;}
function getPath(obj,path){return path.split('.').reduce((v,k)=>v?.[k],obj);}
function parseText(text){
 const d=normalizeData(),uncertainties=[],t=String(text||'');
 const lines=t.replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim());
 const headings={edu:['教育经历','教育背景','学历背景','教育信息','education'],work:['工作经历','工作经验','实习经历','工作/实习经历','工作与实习经历','实践经历','职业经历','work experience','experience'],proj:['项目经历','项目经验','校园经历','在校经历','项目实践','projects','project experience'],skills:['技能证书','技能与证书','专业技能','个人技能','技能特长','技能清单','技能','skills'],certs:['证书荣誉','证书/荣誉','荣誉证书','资格证书','证书','获奖经历','荣誉奖项','certifications'],summary:['自我评价','个人简介','个人总结','个人优势','summary','profile'],basic:['基本信息','个人信息','联系方式','求职意向'],other:['其他信息','补充信息','兴趣爱好','附件']};
 const canonical=x=>x.toLowerCase().replace(/[\s／]/g,m=>m==='／'?'/':'');
 function heading(line){
  const clean=line.replace(/^[#●•◆■\d、.\s]+/,'').replace(/^[【\[]/,'').replace(/[】\]]\s*[:：]?/,':');
  const colon=clean.search(/[:：]/),title=(colon<0?clean:clean.slice(0,colon)).replace(/([\u4e00-\u9fff])\s+[A-Za-z][A-Za-z /&-]*$/,'$1');
  const key=Object.keys(headings).find(k=>headings[k].some(h=>canonical(h)===canonical(title)));
  return key?{key,body:colon<0?'':clean.slice(colon+1).trim()}:null;
 }
 const chunks={},unassigned=[];let section='';
 for(const line of lines){const h=heading(line);if(h){section=h.key;chunks[section]??=[];if(h.body)chunks[section].push(h.body);}else if(section)(chunks[section]??=[]).push(line);else if(line)unassigned.push(line);}
 d.basic.phone=t.match(/(?:\+86[- ]?)?1[3-9](?:[ \t-]?\d){9}(?!\d)/)?.[0]?.replace(/[ \t-]/g,'')||'';d.basic.email=t.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]||'';
 d.basic.name=t.match(/姓\s*名\s*[:：]\s*([^\s|，,]{2,20})/)?.[1]||'';
 d.basic.job=t.match(/(?:求职意向|意向岗位|求职岗位|目标岗位)\s*[:：]\s*([^\n|｜]{2,50})/)?.[1]?.trim()||'';
 const first=unassigned.find(x=>!/^个人简历$|^简历$|^resume$/i.test(x));
 if(!d.basic.name&&first&&/^[\u4e00-\u9fff]{2,4}$/.test(first))d.basic.name=first;
 const introduction=t.match(/(?:^|[。；;\n])\s*我叫\s*([\u4e00-\u9fff]{2,4})(?=[，,。；;\s]|$)/);
 const address=first?.match(/^([\u4e00-\u9fff]{1,4}(?:同学|先生|女士))(?=[，,。\s]|$)/);
 if(!d.basic.name)d.basic.name=introduction?.[1]||address?.[1]||'';
 const leadingName=first?.match(/^([\u4e00-\u9fff]{2,4})[，,]\s*\d{4}\s*[年.\/-]/)?.[1];
 if(!d.basic.name&&leadingName&&!/负责|参与|工作|经历|岗位|经理|助理|专员|工程|主管|同事|个人/.test(leadingName))d.basic.name=leadingName;
 if(!d.basic.job)d.basic.job=t.match(/(?:^|[，,。；;\n])\s*(?:希望应聘|想应聘|求职意向是|目标岗位是)\s*([^，,。；;\n]{2,30})(?=[，,。；;\n]|$)/)?.[1]?.trim()||'';
 for(const [key,label] of Object.entries({city:'所在城市|现居地|现居城市',targetCity:'意向城市',gender:'性别',age:'年龄',hometown:'籍贯',political:'政治面貌',salary:'期望薪资',onboard:'到岗时间'}))d.basic[key]=t.match(new RegExp('(?:'+label+')\\s*[:：]\\s*([^\\n|｜，,]+)'))?.[1]?.trim()||'';
 for(const k of ['name','phone','email','job'])uncertainties.push({field:'basic.'+k,reason:d.basic[k]?'本地规则提取，请核对':'未识别，请补充'});
 if(address&&d.basic.name===address[1])uncertainties.find(u=>u.field==='basic.name').reason='原文提供的是称呼，已原样填入，请核对并补充真实姓名';
 const date='\\d{4}\\s*(?:[.\\-/年]\\s*\\d{1,2}\\s*月?)?';
 const timeRE=new RegExp('('+date+')\\s*(?:(?:[-—–~～至到]\\s*)+|(?=至今))('+date+'|至今|现在|在读|present|current)','i');
 const dateRE=new RegExp(date);
 const monthValue=value=>{const s=value.replace(/\s/g,'');if(/^(至今|现在|present|current)$/i.test(s))return '至今';const m=s.match(/^(\d{4})[.\-/年](\d{1,2})月?$/);return m?m[1]+'.'+m[2].padStart(2,'0'):s;};
 // Narrative fallback is limited to material outside explicit experience sections.
 // Require an employment verb; an intended job is never a past employment record.
 if(!chunks.work){
  const prose=[...unassigned,...(chunks.basic||[])].join('\n');
  const ranges=Array.from(prose.matchAll(new RegExp(timeRE.source,'gi')));
  const segments=ranges.length?ranges.map((m,i)=>({range:m,text:prose.slice(m.index+m[0].length,ranges[i+1]?.index??prose.length),before:prose.slice(0,m.index).split(/[。；;\n]/).at(-1)})):[{range:null,text:prose,before:''}];
  for(const segment of segments){
   const head=segment.text.split(/[。；;\n]/)[0];
   if(/没有|未曾|从未|并未|并非|不是|不曾|计划|打算|将要|希望|想要|拟任|尚未/.test(segment.before+' '+head))continue;
   const employment=head.match(/(?:在|于)\s*([^，,。；;\n]{2,60}?(?:公司|集团|事务所|工作室|中心|研究院))\s*(?:担任|任职为|任|从事)\s*([^，,。；;\n]{2,30})/);
   const position=employment?.[2]||segment.range&&head.match(/^\s*(?:担任|任职为|任|从事)\s*([^，,。；;\n]{2,30})/)?.[1];
   if(!position)continue;
   const sentences=segment.text.split(/[。；;\n]/).map(x=>x.trim()).filter(Boolean);
   const duties=[];
   for(const sentence of sentences){
    if(/^(?:未提供|没有提供|业绩留空|可用来测试|用于测试|希望应聘|想应聘|求职意向|目标岗位|请|不要)/.test(sentence))continue;
    const duty=sentence.match(/(?:^|[，,])\s*((?:负责|参与|协助|完成|维护|整理|组织|主导)[\s\S]*)/);
    if(duty)duties.push(duty[1]);
   }
   d.work.push({company:employment?.[1]?.trim()||'',position:position.trim(),start:segment.range?monthValue(segment.range[1]):'',end:segment.range?monthValue(segment.range[2]):'',desc:duties.join('\n')});
  }
 }
 const strip=s=>s.replace(/^[●•◆▪]\s*/,'').trim();
 const descriptive=s=>/^(?:\d+[、.)．]\s*)?(负责|参与|完成|协助|使用|主导|组织|维护|整理|承担|通过|为|在|从|我|积极|担任|项目描述|项目职责|工作内容|工作职责|主要职责|业绩|成果)/.test(s)||/[。；;，]/.test(s);
 for(const k of ['edu','work','proj']){
  let cur=null,blank=false;
  const create=()=>{cur=Object.fromEntries(FIELDS[k].map(f=>[f,'']));d[k].push(cur);return cur;};
  const primary=k==='edu'?'school':k==='work'?'company':'name';
  const append=line=>{const key=k==='edu'?'honors':'desc';cur[key]=[cur[key],strip(line)].filter(Boolean).join('\n');};
  const sectionLines=chunks[k]||[];
  for(const [lineIndex,original] of sectionLines.entries()){
   if(!original){blank=true;continue;}
   const line=strip(original),times=line.match(timeRE),rest=line.replace(timeRE,'').replace(/[（(]\s*[）)]/g,'').replace(/^[\s|｜·]+|[\s|｜·]+$/g,'');
   if(times&&descriptive(line)){if(!cur)create();append(line);blank=false;continue;}
   const label=line.match(/^(学校|毕业院校|专业|学历|学位|主修课程|主修|GPA(?:\s*\/\s*成绩)?|成绩|在校荣誉|公司名称|公司|单位|职位|岗位|项目名称|项目角色|担任角色|角色)\s*[:：]\s*(.+)$/i);
   if(label){const maps=k==='edu'?{'学校':'school','毕业院校':'school','专业':'major','学历':'degree','学位':'degree','主修课程':'courses','主修':'courses','成绩':'gpa','在校荣誉':'honors'}:k==='work'?{'公司名称':'company','公司':'company','单位':'company','职位':'position','岗位':'position'}:{'项目名称':'name','项目角色':'role','担任角色':'role','角色':'role'};
    const field=/^GPA/i.test(label[1])&&k==='edu'?'gpa':maps[label[1]];
    if(field){if(!cur||(field===primary&&cur[primary]))create();cur[field]=[cur[field],label[2]].filter(Boolean).join('\n');blank=false;continue;}
   }
   const parts=rest.split(/[|｜·\t]+|\s+/).map(x=>x.trim()).filter(Boolean);
   const titleLike=rest&&!descriptive(rest)&&rest.length<140;
   const school=k==='edu'&&titleLike?rest.match(/^(.+?(?:大学|学院|学校))(?=\s|[|｜·]|$)/):null;
   const company=k==='work'&&titleLike?rest.match(/^(.+?(?:有限公司|公司|集团|事务所|工作室|研究院|中心))(?=\s|[|｜·]|$)/):null;
   const separated=titleLike&&/[|｜·\t]/.test(rest)&&parts.length>=2;
   const nextLine=sectionLines.slice(lineIndex+1).find(x=>x.trim())||'';
   const followedByDate=timeRE.test(nextLine)&&!nextLine.replace(timeRE,'').trim();
   const header=!!(school||company||separated||times&&titleLike||!cur&&titleLike||(followedByDate||blank&&k==='proj')&&titleLike);
   // A date following a title belongs to it; a later range starts a new entry.
   if(times&&!rest){if(!cur||cur.start)create();cur.start=monthValue(times[1]);cur.end=monthValue(times[2]);blank=false;continue;}
   if(header){
    if(!cur||cur[primary])create();
    if(k==='edu'){
     cur.school=school?.[1]||parts[0]||rest;
     const tail=rest.slice(cur.school.length).replace(/^[\s|｜·]+/,'');
     const degree=tail.match(/(?:^|\s|[|｜·])(博士研究生|硕士研究生|本科|专科|大专|中专|硕士|博士|高中)(?=$|\s|[|｜·])/);
     cur.degree=degree?.[1]||'';cur.major=tail.replace(degree?.[0]||/^(?!)$/,'').replace(/^[\s|｜·]+|[\s|｜·]+$/g,'');
    }else{cur[primary]=company?.[1]||(parts.length>1?parts[0]:rest);cur[k==='work'?'position':'role']=rest.slice(cur[primary].length).replace(/^[\s|｜·]+/,'');}
   }else{
    if(!cur)create();
    const secondary=k==='work'?'position':k==='proj'?'role':null;
    if(!cur[primary]&&titleLike)cur[primary]=rest;
    else if(secondary&&!cur[secondary]&&!cur.desc&&titleLike&&parts.length===1&&rest.length<=24)cur[secondary]=rest;
    else if(k==='edu'&&/^(本科|专科|大专|中专|硕士|博士|高中)$/.test(rest))cur.degree=rest;
    else if(rest)append(rest);
   }
   if(times){cur.start=monthValue(times[1]);cur.end=monthValue(times[2]);}
   blank=false;
  }
  d[k].forEach((entry,i)=>uncertainties.push({field:k+'.'+i+'.'+primary,reason:'本地提取，请核对单位、岗位、日期和描述是否对应'+(!entry[primary]?'；未确定名称，已保留正文':'')}));
 }
 d.summary=(chunks.summary||[]).filter(Boolean).join('\n');
 // A sidebar often contains the degree while the education block contains dates.
 const basicLines=[...unassigned,...(chunks.basic||[])];
 const educationLabel=label=>basicLines.map(line=>line.match(new RegExp('^(?:'+label+')\\s*[:：]\\s*(.+)$'))?.[1]).find(Boolean)||'';
 const schoolHint=educationLabel('毕业院校|学校'),majorHint=educationLabel('专业'),degreeHint=educationLabel('学历|学位');
 if(schoolHint){let education=d.edu.find(e=>e.school===schoolHint);if(!education&&!d.edu.length){education=Object.fromEntries(FIELDS.edu.map(k=>[k,'']));education.school=schoolHint;d.edu.push(education);}if(education){education.major||=majorHint;education.degree||=degreeHint;}}
 const skillLines=[],credentialLines=[];
 for(const line of chunks.skills||[]){
  if(/^语言技能\s*[:：]/.test(line)){
   for(const part of line.replace(/^语言技能\s*[:：]\s*/,'').split(/[，,；;、]/).map(x=>x.trim()).filter(Boolean)){
    if(/证(?:书)?$|普通话.*(?:级|等)|资格/.test(part))credentialLines.push(part);else skillLines.push('语言技能：'+part);
   }
  }else skillLines.push(line);
 }
 d.skills=skillLines.filter(Boolean).map(line=>{const full=strip(line);const level=full.match(/(?:[:：|｜·]\s*)(专家|精通|熟练|基础|了解)(?:使用|掌握|操作|$|\s)/)?.[1];const name=full.replace(/\s*[:：|｜·]\s*(专家|精通|熟练|基础|了解)$/,'');return {name,level:Math.max(0,['','了解','基础','熟练','精通','专家'].indexOf(level))};});
 d.certs=[...(chunks.certs||[]),...credentialLines].filter(Boolean).map(line=>{const match=line.match(dateRE);return {name:strip(line.replace(dateRE,'').replace(/^[\s|｜·]+|[\s|｜·]+$/g,''))||line,date:match?monthValue(match[0]):''};});
 if(d.skills.length)uncertainties.push({field:'skills',reason:'技能原文已保留，请核对熟练度；未明确说明的等级留空'});
 const leftover=(chunks.other||[]).filter(Boolean);
 for(const line of [...unassigned,...(chunks.basic||[])])if(line&&line!==d.basic.name&&!/^个人简历$|^简历$|^resume$/i.test(line)&&!Object.values(d.basic).some(v=>v&&line.includes(v)))leftover.push(line);
 if(leftover.length)uncertainties.push({field:'sourceText',reason:'以下原文尚未归类，请核对并补充到对应栏目：\n'+leftover.join('\n')});
 if(/XX|×|待填写|说点什么|\uFFFD/i.test(t))uncertainties.push({field:'sourceText',reason:'原文包含占位词或疑似残留文字，已按原文保留；请核对后修改，未自动补造成真实经历。'});
 const unparsed=!d.edu.length&&!d.work.length&&!d.proj.length&&!d.skills.length&&!d.certs.length&&!d.summary;
 return {data:normalizeData(d),uncertainties,sourceText:t,unparsed};
}
return {FIELDS,LABELS,TEMPLATES,RUBRIC,clone,uid,normalizeData,normalizeLayout,createRecord,createTargetedCopy,plainText,cleanRecord,snapshot,checkpoint,restoreVersion,fingerprint,makeBackup,parseBackup,score,visibleData,setPath,getPath,parseText,captureBaseline,saveBaseline,normalizeClientNote,normalizeClientAnnotations,normalizeClientDeliveries,addClientDelivery,removeClientDelivery};
});
