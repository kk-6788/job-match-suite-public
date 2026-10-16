const test=require('node:test'),assert=require('node:assert/strict'),L=require('../job-matcher/local-ai.cjs');
test('本机配置优先于旧环境变量，兼容引号与注释，不读取其他密钥',()=>{
 assert.equal(L.readKey(()=> 'OTHER_KEY=other\nDEEPSEEK_API_KEY="local-test" # comment',{DEEPSEEK_API_KEY:'old-test'}),'local-test');
 assert.equal(L.readKey(()=> 'DEEPSEEK_API_KEY=local-test # comment',{}),'local-test');
 assert.equal(L.readKey(()=>{throw Error('missing')},{DEEPSEEK_API_KEY:'env-test'}),'env-test');
 assert.throws(()=>L.readKey(()=> 'OTHER_KEY=other',{}),/未找到/);
});
test('本机密钥只用于明确允许的官方地址，用户填写密钥优先',()=>{
 for(const baseUrl of ['https://api.deepseek.com','https://api.deepseek.com/v1','https://api.deepseek.com/chat/completions'])assert.equal(L.resolve({baseUrl},'local-test').apiKey,'local-test');
 for(const baseUrl of ['https://api.deepseek.com.evil.test','http://api.deepseek.com','https://api.deepseek.com/other','https://api.deepseek.com/?x=1','https://user@api.deepseek.com','https://api.deepseek.com:8443','http://127.0.0.1:9000'])assert.equal(L.resolve({baseUrl},'local-test').apiKey,undefined);
 assert.equal(L.resolve({baseUrl:'https://api.deepseek.com',apiKey:'manual-test'},'local-test').apiKey,'manual-test');
});
