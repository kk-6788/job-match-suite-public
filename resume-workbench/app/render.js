(function(root){'use strict';
const C=root.ResumeCore;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=s=>esc(s).replace(/\n/g,'<br>');
function blocks(record){const d=C.visibleData(record),list=[];
 for(const key of record.layout.order){if(record.layout.hidden.includes(key))continue;let html='';
  if(key==='summary'&&d.summary.trim())html='<p>'+lines(d.summary)+'</p>';
  if(key==='skills')html=d.skills.filter(s=>s.name).map(s=>'<span class="skill" data-level="'+(s.level||0)+'" style="--lv:'+(s.level||0)+'">'+esc(s.name)+(s.level?'<small>'+['了解','基础','熟练','精通','专家'][s.level-1]+'</small>':'')+'</span>').join('');
  if(key==='certs')html=d.certs.filter(s=>s.name).map(s=>'<p class="cert">'+esc(s.name)+'<time>'+esc(s.date)+'</time></p>').join('');
  if(['edu','work','proj'].includes(key))html=d[key].filter(e=>Object.values(e).some(Boolean)).map(e=>{
   const title=key==='edu'?e.school:key==='work'?e.company:e.name,role=key==='edu'?[e.major,e.degree].filter(Boolean).join(' · '):key==='work'?e.position:e.role;
   const desc=key==='edu'?[e.gpa?'GPA / 成绩：'+e.gpa:'',e.courses?'主修课程：'+e.courses:'',e.honors?'在校荣誉：'+e.honors:''].filter(Boolean).join('\n'):e.desc;
   return '<article class="resume-entry"><div class="entry-title"><strong>'+esc(title)+'</strong><time>'+esc([e.start,e.end].filter(Boolean).join(' — '))+'</time></div>'+(role?'<div class="entry-role">'+esc(role)+'</div>':'')+(desc?'<p>'+lines(desc)+'</p>':'')+'</article>';
  }).join('');
  if(html)list.push({key,html:'<section class="resume-section" data-section="'+key+'"><h2>'+esc(C.LABELS[key])+'</h2><div>'+html+'</div></section>'});
 }return list;
}
function render(record,element){const d=C.visibleData(record),b=d.basic,l=C.normalizeLayout(record.layout);record.layout=l;
 element.className='resume-sheet template-'+l.template;element.style.setProperty('--accent',l.color);element.style.setProperty('--accent-tint','rgba('+[1,3,5].map(i=>parseInt(l.color.slice(i,i+2),16)).join(',')+',0.08)');element.style.setProperty('--resume-font',l.fontSize+'pt');element.style.setProperty('--resume-line',l.lineHeight);element.style.setProperty('--section-gap',l.gap+'px');
 const contact=[b.phone,b.email,b.city,b.targetCity&&b.targetCity!==b.city?'意向城市：'+b.targetCity:'',b.gender,b.age,b.hometown?'籍贯：'+b.hometown:'',b.political].filter(Boolean);
 const extras=[b.salary?'期望薪资：'+b.salary:'',b.onboard?'到岗：'+b.onboard:''].filter(Boolean);
 const bl=blocks(record);let body;
 if(l.template==='twocol'){const L=['edu','skills','certs'],R=['summary','work','proj'];
  const left=bl.filter(x=>L.includes(x.key)).map(x=>x.html).join(''),right=bl.filter(x=>R.includes(x.key)).map(x=>x.html).join(''),extra=bl.filter(x=>!L.includes(x.key)&&!R.includes(x.key)).map(x=>x.html).join('');
  body='<div class="resume-cols"><div class="col-left"><div class="twocol-head">'+(b.photo?'<img class="resume-photo" src="'+esc(b.photo)+'" alt="证件照">':'')+'<h1>'+esc(b.name||'你的姓名')+'</h1><div class="resume-job">'+esc(b.job||'填写目标岗位')+'</div><div class="resume-contact">'+contact.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+(extras.length?'<div class="resume-contact secondary">'+extras.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'')+'</div>'+left+'</div><div class="col-right">'+right+extra+'</div></div>';
 }else{body=bl.map(x=>x.html).join('');}
 element.innerHTML=(l.template==='twocol'?'':'<header class="resume-header"><div class="resume-identity"><h1>'+esc(b.name||'你的姓名')+'</h1><div class="resume-job">'+esc(b.job||'填写目标岗位')+'</div><div class="resume-contact">'+contact.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+(extras.length?'<div class="resume-contact secondary">'+extras.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'')+'</div>'+(b.photo?'<img class="resume-photo" src="'+esc(b.photo)+'" alt="证件照">':'')+'</header>')+'<div class="resume-body">'+(body||'<div class="resume-empty"><b>从一段真实经历开始。</b><p>在左侧填写信息，或导入已有简历。<br>这里会实时呈现你的排版结果。</p></div>')+'</div>';
 return measure(element,l);
}
function measure(el,layout){
 let size=layout.fontSize,line=layout.lineHeight,gap=layout.gap;el.style.setProperty('--resume-font',size+'pt');el.style.setProperty('--resume-line',line);el.style.setProperty('--section-gap',gap+'px');
 const contentHeight=()=>{const body=el.querySelector('.resume-body');return body?body.offsetTop+body.offsetHeight+45:el.scrollHeight;};
 if(layout.fitOnePage){while(contentHeight()>1122&&(gap>6||line>1.3||size>10)){if(gap>6)gap--;else if(line>1.3)line=Math.max(1.3,line-.05);else size=Math.max(10,size-.25);el.style.setProperty('--resume-font',size+'pt');el.style.setProperty('--resume-line',line.toFixed(2));el.style.setProperty('--section-gap',gap+'px');}}
 el.querySelectorAll('.resume-entry').forEach(entry=>entry.classList.toggle('long-entry',entry.offsetHeight>650));
 const height=contentHeight(),overflow=el.scrollWidth>el.clientWidth+2;const fontSizes=Array.from(el.querySelectorAll('*')).filter(n=>Array.from(n.childNodes).some(c=>c.nodeType===3&&c.textContent.trim())).map(n=>parseFloat(root.getComputedStyle(n).fontSize)*.75).filter(Number.isFinite);const minFontSize=fontSizes.length?Math.min(...fontSizes):size;return {minFontSize,pages:Math.max(1,Math.ceil((height-1)/1123)),height,fontSize:size,lineHeight:line,gap,overflow,compressed:size<layout.fontSize||gap<layout.gap||line<layout.lineHeight};
}
function renderSamples(nodes,color){
 const sample=C.createRecord('版式示意',{basic:{name:'林知远',job:'行政 / 项目协调',phone:'13800000000',email:'demo@example.com',city:'杭州'},summary:'熟悉会议组织、资料归档与跨部门协作，能够清晰梳理任务并推进落实。',work:[{company:'青禾项目团队（演示）',position:'项目协调',start:'2023.07',end:'至今',desc:'统筹团队周会，整理任务清单并跟踪交付进度。\n建立文件分类目录，协助同事查找历史项目资料。'},{company:'远山服务团队（演示）',position:'行政实习',start:'2022.06',end:'2023.06',desc:'协助整理活动资料，维护文件目录。'}],edu:[{school:'示例大学',major:'行政管理',degree:'本科',start:'2019.09',end:'2023.06',courses:'管理学、组织行为学'}],skills:[{name:'文档整理',level:0},{name:'会议协调',level:0}],certs:[{name:'示例证书',date:'2023.06'}]});
 for(const node of nodes){const r=C.clone(sample);r.layout.template=node.dataset.sample;r.layout.color=color;render(r,node);node.classList.add('template-sample');}
}
root.ResumeRender={render,measure,blocks,esc,renderSamples};
})(window);
