'use strict';
// 核心匹配逻辑测试：TDD 先失败再实现
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Core = require(path.join(__dirname, '..', 'job-matcher', 'core.js'));

const resumeData = {
  basic: { name: '张三', phone: '13800000000', email: 'candidate@example.test', photo: 'data:image/png;base64,xxx',
    job: '新媒体运营', city: '上海', targetCity: '上海', salary: '10-15K' },
  edu: [{ school: '某大学', major: '市场营销', degree: '本科', start: '2018.9', end: '2022.6' }],
  work: [
    { company: 'A公司', position: '新媒体运营专员', start: '2022.7', end: '2024.6' },
    { company: 'B公司', position: '内容运营', start: '2024.8', end: '2026.6' }
  ],
  proj: [{ name: 'P1', role: '负责人', start: '2023.1', end: '2023.6', desc: 'x' }],
  skills: [{ name: '文案撰写', level: '熟练' }, { name: '数据分析', level: '一般' }],
  certs: [{ name: '新媒体运营师', date: '2023' }],
  summary: '四年新媒体内容经验',
  privateNotes: '性格内向，勿外传', sourceText: 'RAW', history: [], client: {}
};

test('professionalData 排除姓名电话邮箱照片与私有笔记/原始文本/历史/客户字段', () => {
  const p = Core.professionalData(resumeData);
  assert.strictEqual(p.basic.name, undefined);
  assert.strictEqual(p.basic.phone, undefined);
  assert.strictEqual(p.basic.email, undefined);
  assert.strictEqual(p.basic.photo, undefined);
  assert.strictEqual(p.privateNotes, undefined);
  assert.strictEqual(p.sourceText, undefined);
  assert.strictEqual(p.history, undefined);
  assert.strictEqual(p.client, undefined);
  assert.strictEqual(p.basic.job, '新媒体运营');
  assert.strictEqual(p.work.length, 2);
  assert.ok(!JSON.stringify(p).includes('13800000000'));
  assert.ok(!JSON.stringify(p).includes('base64'));
  assert.ok(!JSON.stringify(p).includes('勿外传'));
});

test('fromResumeData 汇总目标岗位/城市/学历/经验年限(区间并集)', () => {
  const pr = Core.MatchCore.fromResumeData(resumeData);
  assert.strictEqual(pr.targetRole, '新媒体运营');
  assert.strictEqual(pr.city, '上海');
  assert.strictEqual(pr.education, '本科');
  // 含首尾月口径：2022.7-2024.6 = 24个月; 2024.8-2026.6 = 23个月；不重叠并集 = 47个月
  assert.ok(Math.abs(pr.experienceYears - 47 / 12) < 0.01, 'experienceYears=' + pr.experienceYears);
  assert.ok(pr.skills.includes('文案撰写'));
  assert.ok(pr.candidateRoles.includes('新媒体运营专员'));
});

test('parseSalary 月薪K/万/年薪/面议/未知归一化', () => {
  assert.deepStrictEqual(Core.parseSalary('12-16k·13薪'),
    { min: 12000, max: 16000, months: 13, period: 'month', raw: '12-16k·13薪' });
  const y = Core.parseSalary('20-30万/年');
  assert.strictEqual(y.period, 'year');
  assert.strictEqual(y.min, 200000); assert.strictEqual(y.max, 300000);
  const y2 = Core.parseSalary('年薪30万');
  assert.strictEqual(y2.period, 'year'); assert.strictEqual(y2.min, 300000);
  const m = Core.parseSalary('8千-1.2万/月');
  assert.strictEqual(m.period, 'month'); assert.strictEqual(m.min, 8000); assert.strictEqual(m.max, 12000);
  assert.strictEqual(Core.parseSalary('面议').negotiable, true);
  const u = Core.parseSalary('随便写的没有数字');
  assert.strictEqual(u.unknown, true);
});

test('parseExperience 要求区间，不限与未知区分', () => {
  assert.deepStrictEqual(Core.parseExperience('1-3年'), { min: 1, max: 3 });
  assert.deepStrictEqual(Core.parseExperience('3年以上'), { min: 3, max: null });
  assert.strictEqual(Core.parseExperience('经验不限').unlimited, true);
  assert.strictEqual(Core.parseExperience('').unknown, true);
});

test('rankJobs 有证据才加分，未知不当满足，硬冲突标 excluded', () => {
  const profile = Core.MatchCore.fromResumeData(resumeData);
  const prefs = Core.normalizePreferences({ targetRole: '新媒体运营', city: '上海' });
  const jobs = [
    { title: '新媒体运营', company: 'X', city: '上海', salary: '12-16k', experience: '1-3年', education: '统招本科' },
    { title: '算法工程师', company: 'Y', city: '北京', salary: '40-60k', experience: '5-10年', education: '硕士' },
    { title: '内容运营', company: 'Z', city: '', salary: '', experience: '', education: '' }
  ];
  const ranked = Core.rankJobs(jobs, profile, prefs);
  const good = ranked.find(j => j.title === '新媒体运营');
  const bad = ranked.find(j => j.title === '算法工程师');
  const partial = ranked.find(j => j.title === '内容运营');
  assert.ok(good.score > 0, '匹配岗应有得分');
  assert.ok(good.reasons.length > 0);
  assert.ok(bad.conflicts.length >= 2, '岗位+城市应记冲突');
  assert.strictEqual(bad.excluded, true, '城市冲突仍然排除');
  assert.ok(bad.score <= 0 || bad.excluded, '不匹配不得高分');
  assert.ok(partial.unknown.includes('city') && partial.unknown.includes('salary'),
    '缺失字段进 unknown 不当满足: ' + JSON.stringify(partial.unknown));
  assert.ok(!/概率|percent/.test(JSON.stringify(ranked)), '不得输出录用概率');
  // 排序：匹配 > 部分
  assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
});

test('rankJobs 学历冲突：要求硕士而候选本科 → 保留并提示差距；未知学历不误判', () => {
  const profile = Core.MatchCore.fromResumeData(resumeData);
  const prefs = Core.normalizePreferences({});
  const r1 = Core.rankJobs([{ title: '新媒体运营', company: 'A', city: '上海', education: '硕士' }], profile, prefs);
  assert.strictEqual(r1[0].excluded, undefined);
  const r2 = Core.rankJobs([{ title: '新媒体运营', company: 'A', city: '上海', education: '' }], profile, prefs);
  assert.strictEqual(r2[0].excluded, undefined);
});

test('经验冲突：岗位要求高于已知年限 → conflict；岗位未知不判', () => {
  const profile = Core.MatchCore.fromResumeData(resumeData); // 约3.83年
  const prefs = Core.normalizePreferences({});
  const r1 = Core.rankJobs([{ title: '新媒体运营', company: 'A', city: '上海', experience: '10年以上' }], profile, prefs);
  assert.ok(r1[0].conflicts.some(c => /经验/.test(c)));
  const r2 = Core.rankJobs([{ title: '新媒体运营', company: 'A', city: '上海' }], profile, prefs);
  assert.ok(r2[0].unknown.includes('experience'));
});

test('dedupeJobs URL去跟踪参数；title+company+city辅助合并；缺失不误合并', () => {
  const a = { title: '新媒体运营', company: 'X公司', city: '上海', url: 'https://www.liepin.com/job/1.shtml?tracking=abc&utm_source=x&from=menu' };
  const b = { title: '新媒体运营', company: 'X公司', city: '上海', url: 'https://www.liepin.com/job/1.shtml' };
  const c = { title: '新媒体运营', company: 'X公司', city: '上海', url: '' };
  const d = { title: '新媒体运营', company: 'X公司', url: '' }; // 缺城市，不得与 c 合并
  const out = Core.dedupeJobs([a, b, c, d]);
  assert.strictEqual(out.length, 2, '实际=' + out.length);
  assert.strictEqual(out[0].url, a.url, '去重键去跟踪，但投递链接保留来源原始地址');
  const e = { title: '新媒体运营', company: 'Y公司', city: '上海', url: '' };
  assert.strictEqual(Core.dedupeJobs([c, e]).length, 2, '公司不同不合并');
});

test('normalizeJob 补齐字段不造值', () => {
  const j = Core.normalizeJob({ title: '运营专员', url: 'https://x.com/a' });
  assert.strictEqual(j.title, '运营专员');
  assert.strictEqual(j.company, '');
  assert.strictEqual(j.source, '');
  assert.ok(j.collectedAt);
});

test('fromText 复用 parseText；目标不明给候选岗位不自动设为目标', () => {
  const text = ['张三', '求职意向：新媒体运营', '上海', '教育经历', '某大学 市场营销 本科 2018.9-2022.6',
    '工作经历', 'A公司 新媒体运营专员 2022.7-2024.6', '负责公众号内容', '专业技能', '文案撰写 熟练'].join('\n');
  const r = Core.fromText(text, require(path.join(__dirname, '..', 'job-matcher', 'shared', 'resume-core.js')));
  assert.ok(r.data && r.data.basic, '应返回 {data,...}');
  assert.ok(r.profile, '应有 profile');
  if (!r.profile.targetRole) {
    assert.ok(r.candidateRoles.length > 0, '无目标时必须给候选岗位');
  }
  const r2 = Core.fromText('完全没有结构的一段话，没有任何小标题', require(path.join(__dirname, '..', 'job-matcher', 'shared', 'resume-core.js')));
  assert.ok(r2.profile);
  assert.ok(!r2.profile.targetRole || r2.profile.targetRole.length < 30);
});
