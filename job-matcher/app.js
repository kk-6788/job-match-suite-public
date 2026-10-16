(function () {
  'use strict';
  const C = MatchCore, S = ResumeServices, D = window.jobDesktop, $ = s => document.querySelector(s);
  let profile = C.fromResumeData({}), generation = 0, busy = false, results = new Map(), lastQuery = '', reading = 0;
  let resumeData={}, aiVersion=0, aiBusy=false, aiDraft=null, aiResults=new Map();
  const descriptions=Object.create(null);
  const initialEmpty = $('#jobs').firstElementChild.cloneNode(true);
  const seenJobs = new Set();
  let entranceCount = 0;
  let lastJobsSignature = '';
  function workspaceExpanded(expanded) {
    const body = $('#workspace-body');
    if (!expanded && body.contains(document.activeElement)) $('#edit-settings').focus();
    body.classList.toggle('is-collapsed', !expanded);
    body.inert = !expanded;
    $('#edit-settings').setAttribute('aria-expanded', String(expanded));
    $('#edit-settings').textContent = expanded ? '收起设置 −' : '调整求职档案 +';
  }
  function profileSummary() {
    $('#profile-summary').textContent = [$('#role').value || '目标岗位待填写', $('#city').value || '不限城市', $('#education').value, $('#skills').value ? '已填写技能' : ''].filter(Boolean).join(' · ');
  }
  const names = {boss:'BOSS 直聘',liepin:'猎聘',zhilian:'智联招聘','51job':'前程无忧',lagou:'拉勾（试读）',ncss:'国家大学生就业服务平台',yingjiesheng:'应届生求职网（试读）',guopin:'国聘',yupao:'鱼泡直聘',shixiseng:'实习僧',company:'公司官网',discovery:'官网发现'};
  const states = {queued:'等待读取',loading:'读取中',ok:'已读取','need-login':'需要登录',verification:'需要验证',empty:'暂无岗位',error:'读取失败',timeout:'读取超时',stopped:'已停止'};
  const unknownNames = {city:'工作城市',salary:'薪资',experience:'经验要求',education:'学历要求',title:'岗位名称'};

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = String(content);
    if (className) node.className = className;
    return node;
  }
  function button(label, fn) {
    const node = element('button', label);
    node.addEventListener('click', () => {
      try {Promise.resolve(fn()).catch(error => message(error.message, 'error'));}
      catch (error) {message(error.message, 'error');}
    });
    return node;
  }
  function message(value, tone = 'idle') {
    $('#search-message').textContent = value;
    $('#search-status').dataset.tone = tone;
  }
  function importMessage(value, tone = 'success') {
    $('#import-message').textContent = value;
    $('#import-message').dataset.tone = tone;
  }
  function prefs() { return C.normalizePreferences({targetRole:$('#role').value,city:$('#city').value,salaryMin:$('#salary').value}); }
  function currentProfile() {
    return {...profile,targetRole:$('#role').value,city:$('#city').value,salaryText:$('#salary').value?'最低月薪 '+$('#salary').value+' 元':'不限薪资',education:$('#education').value,experienceYears:$('#experience').value === '' ? null : Number($('#experience').value),skills:$('#skills').value.split(/[,，、\n]+/).map(s => s.trim()).filter(Boolean)};
  }
  function fill(data) {
    resumeData=C.professionalData(data);
    profile = C.fromResumeData(data);
    $('#role').value = profile.targetRole || profile.candidateRoles[0] || '';
    $('#city').value = profile.city || '';
    $('#salary').value = profile.salary.unknown || profile.salary.negotiable ? '' : Math.round(profile.salary.min / (profile.salary.period === 'year' ? 12 : 1));
    $('#education').value = profile.education.includes('本科') ? '本科' : profile.education.includes('专科') ? '大专' : profile.education;
    $('#experience').value = profile.experienceYears ?? '';
    $('#skills').value = profile.skills.join('，');
    $('#roles').replaceChildren(...profile.candidateRoles.map(role => {const option = element('option'); option.value = role; return option;}));
    importMessage(profile.targetRole ? '已读取职业信息，请核对后开始查找。' : '已读取职业信息，目标岗位来自已有任职方向；请核对，不明确的字段可留空。');
    changed();
  }
  function setBusy(value) {
    busy = value;
    updateAIControls();
    $('.launch-bar').dataset.busy = String(value);
    $('#search').disabled = value || !D;
    $('#search-label').textContent = value ? '正在读取岗位…' : '查找匹配岗位';
    $('#cancel').hidden = !value;
    $('#jobs').setAttribute('aria-busy', String(value));
    renderSources();
  }
  function stopPending() {
    for (const [key, value] of results) if (['loading','queued'].includes(value.status)) {
      results.set(key, {...value,status:'stopped',message:'本次读取已停止，可重新查找。'});
    }
  }
  function changed() {
    invalidateAI();
    profileSummary();
    if (busy) {
      generation++;
      D?.cancel().catch(() => {});
      stopPending();
      setBusy(false);
    }
    if (results.size) message('条件已修改，结果已重新排序；点击查找获取新条件下的岗位。');
    renderJobs();
  }
  function ranked() {
    const jobs=C.rankJobs(C.dedupeJobs([...results.values()].flatMap(r=>r.jobs||[])),currentProfile(),prefs());
    if(!$('#ai-enabled').checked||!aiResults.size)return jobs;
    return jobs.map(j=>({...j,ai:!j.excluded?aiResults.get(j.url):undefined})).sort((a,b)=>Number(!!a.excluded)-Number(!!b.excluded)||Number(!!b.ai)-Number(!!a.ai)||(a.ai&&b.ai?b.ai.score-a.ai.score:b.score-a.score));
  }
  function renderJobs() {
    const all = ranked(), shown = $('#show-conflicts').checked ? all : all.filter(j => !j.excluded);
    updateAIControls();
    $('#ranking-label').textContent=aiResults.size?'AI 已分析 '+aiResults.size+' 个候选优先，其余按本地规则':'按本地规则排序';
    $('#count').textContent = shown.length + ' / ' + all.length;
    $('#count').setAttribute('aria-label', '显示 ' + shown.length + ' 个，共读取 ' + all.length + ' 个岗位');
    $('#filter-summary').textContent = all.length ? '已隐藏 ' + (all.length - shown.length) + ' 个条件不符岗位' : '信息以岗位详情页为准';
    $('#export').disabled = !shown.length;
    const signature = shown.length ? JSON.stringify(shown) : '';
    if (signature && signature === lastJobsSignature) return;
    lastJobsSignature = signature;
    const holder = $('#jobs'), activeURL = holder.contains(document.activeElement) ? document.activeElement.dataset.jobUrl : null;
    holder.replaceChildren();
    if (!shown.length) {
      if (!generation && !results.size) {holder.append(initialEmpty.cloneNode(true)); return;}
      const empty = element('div', undefined, 'empty');
      empty.append(element('span', busy ? '…' : '↗', 'empty-symbol'), element('strong', busy ? '正在汇总岗位' : all.length ? '试着放宽一点条件' : '暂时没有读到岗位'), element('p', busy ? '来源会逐个读取，读到的岗位会实时出现在这里。需要登录或验证的来源会单独提示。' : all.length ? '可调整城市、薪资，或勾选查看条件不符的岗位，了解具体差异。' : '可打开来源核对页面，完成登录或验证后继续读取；也可以调整关键词重新查找。'));
      holder.append(empty); return;
    }
    for (const job of shown) {
      const card = element('div', undefined, 'job'), top = element('div', undefined, 'job-top'), heading = element('div');
      card.dataset.source = job.source;
      if (!seenJobs.has(job.url) && entranceCount < 4) card.classList.add('enter-' + entranceCount++);
      seenJobs.add(job.url);
      heading.append(element('h3', job.title), element('p', job.company || '公司名称待核对', 'company'));
      top.append(heading, element('div', job.salary || '薪资待核对', 'salary')); card.append(top);
      const facts = element('div', undefined, 'facts');
      for (const value of [job.city || '城市待核对', job.education || '学历待核对', job.experience || '经验待核对', names[job.source] || job.source]) facts.append(element('span', value));
      card.append(facts);
      const evidence = element('div', undefined, 'evidence');
      for (const reason of job.reasons) evidence.append(element('div', reason, 'reason'));
      for (const conflict of job.conflicts) evidence.append(element('div', conflict, 'conflict'));
      if (job.unknown.length) evidence.append(element('div', '待确认：' + job.unknown.map(x => unknownNames[x] || x).join('、'), 'muted'));
      if (job.availability) evidence.append(element('div', job.availability, 'muted'));
      card.append(evidence);
      if($('#ai-enabled').checked){
        if(job.ai){const box=element('section',undefined,'ai-analysis');box.append(element('strong','AI 匹配分 '+job.ai.score+' · 非录用概率'),element('p',job.ai.summary));for(const [key,label]of [['strengths','匹配点'],['gaps','差距'],['unknowns','待确认']])if(job.ai[key]?.length)box.append(element('p',label+'：'+job.ai[key].join('；')));for(const proof of job.ai.evidence||[]){box.append(element('p','原文对照 · '+proof.requirement),element('p','简历：'+proof.resumeQuote),element('p','岗位：'+proof.jobQuote));}card.append(box);}
        else card.append(element('p','尚未 AI 分析 · 当前使用规则分','field-note'));
        const details=element('details',undefined,'job-jd'),summary=element('summary','核对 / 补充岗位要求'),label=element('label','AI 将使用以下文字；列表摘要可能不完整，可粘贴详情页要求。'),area=element('textarea');area.rows=3;area.maxLength=12000;area.value=descriptions[job.url]??job.description;area.setAttribute('aria-label',job.title+'的岗位要求');
        area.addEventListener('input',()=>{descriptions[job.url]=area.value;invalidateAI();});
        area.addEventListener('change',renderJobs);label.append(area);details.append(summary,label);card.append(details);
      }
      const footer = element('div', undefined, 'job-footer'), score = element('div', undefined, 'job-score');
      if (job.excluded) score.append(element('span', '条件不符', 'excluded'));
      score.append(element('strong', job.score), element('span', '排序分'), element('span', '· ' + new Date(job.collectedAt).toLocaleDateString('zh-CN')));
      const link = button('查看岗位 / 投递', () => open(job.url)); link.dataset.jobUrl = job.url;
      footer.append(score, link); card.append(footer); holder.append(card);
      if (activeURL && job.url === activeURL) link.focus({preventScroll:true});
    }
  }
  function open(url) {
    if (!/^https:\/\//i.test(url)) throw Error('岗位链接无效');
    return D ? D.openExternal(url) : window.open(url, '_blank', 'noopener');
  }
  function receive(value) {
    if (!value || value.requestId !== generation) return;
    invalidateAI();
    const previous = results.get(value.key);
    results.set(value.key, {...value,attempted:true,...(value.status === 'loading' ? {jobs:previous?.jobs || []} : {})});
    renderSources(); renderJobs();
  }
  async function collect(key) {
    if (busy) return;
    invalidateAI();
    const ticket = generation;
    setBusy(true); message('正在继续读取 ' + (results.get(key)?.label || names[results.get(key)?.source] || '来源') + '…', 'busy');
    try {
      const value = await D.collect({key, requestId:ticket});
      if (ticket !== generation) return;
      if (value) receive(value);
      message('本次读取结束，请核对来源状态和岗位详情。', 'success');
    } catch (error) {
      if (ticket === generation) {
        const old = results.get(key);
        results.set(key, {...old,status:'error',message:error.message});
        message(error.message, 'error');
      }
    } finally { if (ticket === generation) {setBusy(false); renderJobs();} }
  }
  function renderSources() {
    const holder = $('#sources'), focusKey = holder.contains(document.activeElement) ? document.activeElement.dataset.control : null;
    holder.replaceChildren(); $('#source-section').hidden = !results.size;
    const finished = [...results.values()].filter(r => !['loading','queued'].includes(r.status)).length;
    $('#source-summary').textContent = finished + ' / ' + results.size + ' 个来源已有状态';
    for (const [key, r] of results) {
      const row = element('div', undefined, 'source-row'), info = element('div'), top = element('div', undefined, 'source-row-top');
      row.dataset.source = r.source;
      row.dataset.status = r.status || 'error';
      top.append(element('strong', r.label || names[r.source]), element('span', states[r.status] || '待核对', 'status-badge'));
      info.append(top, element('p', r.status === 'ok' ? '已读取 ' + (r.jobs?.length || 0) + ' 个岗位' + (r.candidates?.length ? '，发现 ' + r.candidates.length + ' 个候选页面' : '') : r.message || states[r.status] || '请打开来源核对'));
      const controls = element('div', undefined, 'source-actions');
      controls.append(button('打开来源', () => D.openSource(key)), button('继续读取', () => collect(key)));
      [...controls.children].forEach((b, i) => {b.disabled = busy || !D || r.status === 'queued' || (r.status === 'stopped' && !r.attempted); b.dataset.control = key + ':' + i; b.setAttribute('aria-label', (r.label || names[r.source]) + '：' + b.textContent);});
      row.append(info, controls); holder.append(row);
    }
    if (focusKey) [...holder.querySelectorAll('button')].find(b => b.dataset.control === focusKey && !b.disabled)?.focus({preventScroll:true});
    const candidates = [...results.values()].flatMap(r => r.candidates || []);
    $('#candidates').hidden = !candidates.length; $('#candidate-list').replaceChildren();
    for (const candidate of candidates) {
      const row = element('div');
      row.append(element('span', candidate.title), button('选择招聘页', () => {
        const urls = companyURLs();
        if (!urls.includes(candidate.url)) {if (urls.length >= 3) throw Error('最多填写三个公司招聘页'); urls.push(candidate.url);}
        $('#company-urls').value = urls.join('\n'); $('.company-details').open = true;
        changed(); message('已加入公司招聘页。再次查找会读取该页面的具体岗位。');
      })); $('#candidate-list').append(row);
    }
  }
  function companyURLs() { return $('#company-urls').value.split(/\n/).map(s => s.trim()).filter(Boolean); }
  async function search() {
    if (busy) return;
    if (!D) throw Error('联网读取请打开 Windows 版');
    const p = prefs();
    if (!p.targetRole) {workspaceExpanded(true); $('#role').focus(); throw Error('请填写或核对目标岗位');}
    const companyUrls = companyURLs();
    if (companyUrls.length > 3) throw Error('最多填写三个公司招聘页');
    if (companyUrls.some(url => {try {const u = new URL(url); return u.protocol !== 'https:' || !!u.username || !!u.password;} catch {return true;}})) throw Error('公司招聘页必须是公开 HTTPS 网址');
    const sources = [...document.querySelectorAll('.source-picks input:checked')].map(el => el.value);
    $('#source-count').textContent = '已选 ' + sources.length + ' 个';
    if ($('#discovery').checked) sources.push('discovery');
    if (!sources.length && !companyUrls.length) throw Error('请选择至少一个来源或填写公司招聘页');
    invalidateAI();
    for(const key of Object.keys(descriptions))delete descriptions[key];
    const ticket = ++generation;
    seenJobs.clear(); entranceCount = 0;
    profileSummary(); workspaceExpanded(false);
    results.clear(); lastQuery = p.targetRole + ' · ' + (p.city || '不限城市');
    for (const source of sources) results.set(source, {key:source,source,label:names[source],status:'queued',jobs:[]});
    companyUrls.forEach((url, i) => results.set('company-' + i, {key:'company-' + i,source:'company',label:'公司官网 ' + (i + 1),status:'queued',jobs:[]}));
    setBusy(true); renderJobs(); message('正在查找：' + lastQuery, 'busy');
    try {
      const response = await D.search({requestId:ticket,prefs:p,sources,companyUrls});
      if (ticket !== generation) return;
      for (const result of response.results || []) receive(result);
      message(response.canceled ? '本次查找已停止' : '查找结束：' + lastQuery + '。可打开岗位详情核对后投递。', response.canceled ? 'idle' : 'success');
    } catch (error) {if (ticket === generation) message(error.message, 'error');}
    finally {if (ticket === generation) {stopPending(); setBusy(false); renderJobs();}}
  }
  async function readFile(file, ticket) {
    if (file.size > 10 * 1024 * 1024) throw Error('简历文件超过 10 MB');
    let value; const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') value = await S.readPDF(file);
    else if (ext === 'docx') value = await S.readDocx(file);
    else if (ext === 'txt') value = await file.text();
    else if (ext === 'json') {
      const data = JSON.parse(await file.text());
      if (ticket !== reading) return;
      if (!data || typeof data !== 'object') throw Error('JSON 中没有可读取的简历');
      if (Array.isArray(data.records) && data.records.length !== 1) throw Error('请导出并选择一份简历，避免导入错误客户');
      return data.records?.[0]?.data || data.data || data;
    } else throw Error('请使用 PDF、DOCX、TXT 或工作台 JSON');
    if (ticket !== reading) return;
    if (!value.trim()) throw Error('没有读到文字。扫描 PDF 请先做 OCR 再导入');
    if (value.length > 200000) throw Error('简历文字过长');
    return C.fromText(value, ResumeCore).data;
  }
  $('#resume-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const ticket = ++reading; event.target.value = '';
    importMessage('正在本机读取：' + file.name, 'busy');
    try {const data = await readFile(file, ticket); if (ticket === reading && data) fill(data);}
    catch (error) {if (ticket === reading) importMessage(error.message, 'error');}
  });
  $('#parse-text').addEventListener('click', () => {
    reading++;
    try {
      const value = $('#resume-text').value;
      if (!value.trim()) throw Error('请先粘贴简历文字');
      if (value.length > 200000) throw Error('文字超过 20 万字符');
      fill(C.fromText(value, ResumeCore).data);
    } catch (error) {importMessage(error.message, 'error');}
  });
  for (const id of ['role','city','salary','education','experience','skills','company-urls']) $('#' + id).addEventListener('input', changed);
  for (const input of document.querySelectorAll('.source-picks input, #discovery')) input.addEventListener('change', () => {
    $('#source-count').textContent = '已选 ' + document.querySelectorAll('.source-picks input:checked').length + ' 个'; changed();
  });
  $('#show-conflicts').addEventListener('change', renderJobs);
  $('#edit-settings').addEventListener('click', () => workspaceExpanded($('#edit-settings').getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('motion-paused', document.hidden));
  if (window.IntersectionObserver) new IntersectionObserver(entries => {
    $('.launch-bar').classList.toggle('is-offscreen', !entries[0].isIntersecting);
  }).observe($('.launch-bar'));
  $('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('#results-title').focus();
    $('#results-title').scrollIntoView?.({block:'nearest'});
  });
  $('#search').addEventListener('click', () => search().catch(error => message(error.message, 'error')));
  $('#cancel').addEventListener('click', () => {
    generation++; D.cancel().catch(error => message(error.message, 'error'));
    stopPending(); setBusy(false); renderJobs(); message('已停止查找，已读到的岗位保留。'); $('#search').focus();
  });
  $('#export').addEventListener('click', () => {
    const jobs = ranked().filter(j => $('#show-conflicts').checked || !j.excluded);
    const lines = ['岗位清单','原始查询：' + lastQuery,'当前筛选：' + $('#role').value + ' · ' + ($('#city').value || '不限城市') + ' · 最低月薪 ' + ($('#salary').value || '不限'),'导出时间：' + new Date().toLocaleString('zh-CN'),'规则分和 AI 匹配分分别展示，均不代表录用概率；未分析岗位保持规则排序。',''];
    for (const j of jobs) lines.push(j.title + ' | ' + (j.company || '公司待核对'),[j.city,j.salary,j.education,j.experience].filter(Boolean).join(' · '),'筛选状态：' + (j.excluded ? '不符合条件' : '未发现硬性条件冲突'),'排序分：' + j.score,'匹配依据：' + (j.reasons.join('；') || '暂无'),'条件冲突：' + (j.conflicts.join('；') || '暂无'),'待核对：' + (j.unknown.map(x => unknownNames[x] || x).join('、') || '详情及招聘状态'),j.ai?'AI 匹配分：'+j.ai.score+'；'+j.ai.summary+'\n匹配点：'+j.ai.strengths.join('；')+'\n差距：'+j.ai.gaps.join('；')+'\n待确认：'+j.ai.unknowns.join('；')+'\n原文对照：'+(j.ai.evidence||[]).map(e=>e.requirement+'｜简历：'+e.resumeQuote+'｜岗位：'+e.jobQuote).join('；'):'未进行 AI 分析',j.availability || '',j.url,'');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], {type:'text/plain;charset=utf-8'})), a = element('a');
    a.href = url; a.download = '匹配岗位清单.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  function updateAIControls(){
    $('#ai-prepare').disabled=!D?.aiPreview||!$('#ai-enabled').checked||busy||aiBusy||![...results.values()].some(r=>r.jobs?.length);
    $('#ai-stop').hidden=!aiBusy;
    $('#ai-run').disabled=aiBusy||!aiDraft;
  }
  function invalidateAI(){
    const hadAI=aiResults.size||aiDraft||aiBusy;
    aiVersion++;aiDraft=null;aiResults.clear();
    D?.aiCancel?.().catch(()=>{});aiBusy=false;$('#ai-preview').hidden=true;$('#ai-payload').textContent='';
    $('#ai-status').textContent=$('#ai-enabled').checked?'AI 已开启 · 尚未分析，当前按本地规则排序':'AI 未开启 · 本地规则排序';
    $('#ranking-label').textContent='按本地规则排序';if(hadAI)lastJobsSignature='';updateAIControls();
  }
  $('#ai-enabled').addEventListener('change',()=>{$('#ai-settings').hidden=!$('#ai-enabled').checked;invalidateAI();lastJobsSignature='';renderJobs();});
  for(const id of ['ai-url','ai-model','ai-key'])$('#'+id).addEventListener('input',()=>{invalidateAI();renderJobs();});
  $('#ai-dismiss').addEventListener('click',()=>{invalidateAI();renderJobs();});
  $('#ai-stop').addEventListener('click',()=>{invalidateAI();$('#ai-status').textContent='已停止精排，使用本地规则排序';renderJobs();});
  $('#ai-prepare').addEventListener('click',async()=>{
    invalidateAI();const ticket=aiVersion;aiBusy=true;updateAIControls();
    try{
      if(!$('#ai-url').value.trim()||!$('#ai-model').value.trim())throw Error('请填写服务地址和模型名称');
      const draft=await D.aiPreview({profile:currentProfile(),resume:resumeData,prefs:prefs(),descriptions});
      if(ticket!==aiVersion)return;
      aiDraft=draft;$('#ai-payload').textContent=JSON.stringify(draft.payload,null,2);$('#ai-destination').textContent='发送至：'+$('#ai-url').value.trim()+' · 模型：'+$('#ai-model').value.trim();$('#ai-preview').hidden=false;
      $('#ai-status').textContent='已准备 '+draft.payload.jobs.length+' 个候选。核对上方发送内容后开始精排。';
    }catch(error){if(ticket===aiVersion)$('#ai-status').textContent=error.message;}
    finally{if(ticket===aiVersion){aiBusy=false;updateAIControls();}}
  });
  $('#ai-run').addEventListener('click',async()=>{
    if(!aiDraft||aiBusy||busy||!$('#ai-enabled').checked)return;
    const ticket=aiVersion,draft=aiDraft;aiDraft=null;aiBusy=true;updateAIControls();$('#ai-preview').hidden=true;
    $('#ai-status').textContent='AI 正在分析职业经历与岗位要求…';
    try{
      const value=await D.aiAnalyze({ticket:draft.ticket,config:{baseUrl:$('#ai-url').value.trim(),model:$('#ai-model').value.trim(),apiKey:$('#ai-key').value.trim()}});
      if(ticket!==aiVersion)return;
      aiResults=new Map(value.items.map(item=>[item.url,item]));
      $('#ai-status').textContent='已精排 '+aiResults.size+' 个候选；其他岗位保留规则排序。'+(value.usage?.total_tokens?'本次用量 '+value.usage.total_tokens+' tokens。':'服务未返回用量。');
      renderJobs();
    }catch(error){if(ticket===aiVersion){aiResults.clear();$('#ai-status').textContent='AI 未完成：'+error.message+'；已保留本地规则排序。';renderJobs();}}
    finally{if(ticket===aiVersion){aiBusy=false;$('#ai-payload').textContent='';updateAIControls();}}
  });
  $('#ai-local-service').addEventListener('click',async()=>{
    if(busy||aiBusy)return;
    try{const service=await D?.aiLocalService();if(!service)throw Error('请使用 Windows 版');invalidateAI();$('#ai-url').value=service.baseUrl;$('#ai-model').value=service.model;$('#ai-key').value='';$('#ai-key').placeholder='已连接本机 DeepSeek，可留空';$('#ai-status').textContent='已读取本机 DeepSeek 配置；预览后发送，密钥仅由主进程保管。';}
    catch(error){$('#ai-status').textContent=error.message;}
  });
  if (D) {
    D.onProgress(receive);
    const initialReading = reading;
    D.initial().then(data => {if (initialReading === reading && (data?.basic?.job || data?.work?.length || data?.skills?.length)) fill(data);}).catch(error => message(error.message, 'error'));
  } else {$('#mode').textContent = '本地简历读取 · 联网查找请用 Windows 版'; $('#search').disabled = true;}
})();
