'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Sec = require(path.join(__dirname, '..', 'job-matcher', 'security.cjs'));

test('safePublicURL 拒绝非 https / 凭据 / 本机 / 私网 / localhost / 超长', () => {
  assert.strictEqual(Sec.safePublicURL('http://example.com/a'), false, '非 https');
  assert.strictEqual(Sec.safePublicURL('https://user:pass@example.com/a'), false, '凭据');
  assert.strictEqual(Sec.safePublicURL('https://localhost/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://127.0.0.1/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://[::1]/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://192.168.1.1/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://10.0.0.2/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://172.16.0.1/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://[fd00::1]/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://[fe80::1]/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://host.local/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://host.internal/a'), false);
  assert.strictEqual(Sec.safePublicURL('https://169.254.1.1/a'), false, '链路本地');
  assert.strictEqual(Sec.safePublicURL(''), false);
  assert.strictEqual(Sec.safePublicURL('javascript:alert(1)'), false);
  assert.strictEqual(Sec.safePublicURL('https://example.com/' + 'a'.repeat(3000)), false, '超长');
  assert.strictEqual(Sec.safePublicURL('https://example.com/a'), true);
  assert.strictEqual(Sec.safePublicURL('https://www.liepin.com/job/1.shtml?tracking=x'), true);
  assert.strictEqual(Sec.safePublicURL('https://169.254.169.254/latest/meta-data/'), false, '云元数据端点');
});

test('allowedSourceURL 保持来源域内 HTTPS；平台登录子域可；跨域拒绝', () => {
  const initial = 'https://www.liepin.com/zhaopin/';
  assert.strictEqual(Sec.allowedSourceURL('https://www.liepin.com/job/1.shtml', 'liepin', initial), true);
  assert.strictEqual(Sec.allowedSourceURL('https://login.liepin.com/account', 'liepin', initial), true, '登录子域');
  assert.strictEqual(Sec.allowedSourceURL('https://evil.example.com/job', 'liepin', initial), false, '跨域');
  assert.strictEqual(Sec.allowedSourceURL('http://www.liepin.com/job', 'liepin', initial), false, '降级 http');
  assert.strictEqual(Sec.allowedSourceURL('https://www.zhipin.com/x', 'liepin', initial), false, '其他平台');
  assert.strictEqual(Sec.allowedSourceURL('not a url', 'liepin', initial), false);
  assert.strictEqual(Sec.allowedSourceURL('https://jobs.zhaopin.com/a.htm', 'zhilian', 'https://sou.zhaopin.com/?kw=x'), true);
  // 二级主域一致性：e.hire.liepin.com 仍在 liepin.com 内
  assert.strictEqual(Sec.allowedSourceURL('https://e.hire.liepin.com/x', 'liepin', initial), true);
});

test('sourceURL 构造 BOSS 已知城市代码；未知城市不假造', () => {
  const u1 = Sec.sourceURL('boss', { city: '福州' });
  assert.ok(u1.includes('101230100'), u1);
  assert.ok(u1.startsWith('https://'));
  for (const [city, code] of [['北京', '101010100'], ['上海', '101020100'], ['广州', '101280100'], ['深圳', '101280600'], ['杭州', '101210100'], ['成都', '101270100']]) {
    assert.ok(Sec.sourceURL('boss', { city }).includes(code), city);
  }
  const u2 = Sec.sourceURL('boss', { city: '三亚' });
  assert.ok(!/101\d{7}/.test(u2), '未知城市不得假造城市代码: ' + u2);
  assert.ok(u2.startsWith('https://'));
  // 长度受限，不携带全文
  const u3 = Sec.sourceURL('boss', { city: '上海', keyword: '长'.repeat(500) });
  assert.ok(u3.length < 600, '长度=' + u3.length);
});

test('safeExternalURL 只放行 HTTPS 公共页面', () => {
  assert.strictEqual(Sec.safeExternalURL('https://www.zhipin.com/job_detail/x.html'), true);
  assert.strictEqual(Sec.safeExternalURL('file:///C:/x.html'), false);
  assert.strictEqual(Sec.safeExternalURL('https://192.168.0.1/'), false);
});

test('professionalData 不任意保留对象（深冻结/白名单输出）', () => {
  const Core = require(path.join(__dirname, '..', 'job-matcher', 'core.js'));
  const p = Core.professionalData({ basic: { name: '李四', phone: '1', job: '运营' }, privateNotes: 'x', foo: { bar: 1 } });
  const keys = Object.keys(p);
  assert.ok(!keys.includes('foo'), '未知顶层字段不保留');
  assert.ok(!keys.includes('privateNotes'));
});
