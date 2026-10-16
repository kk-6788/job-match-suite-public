'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),AI=require('../job-matcher/ai-rerank.cjs');
const config={baseUrl:'http://127.0.0.1:1234/v1',model:'fixture'};
const payload=()=>AI.preparePayload({profile:{experienceYears:null,skills:['SQL']},resume:{work:[{desc:'内容策划\n数据分析'}]},jobs:[{title:'运营',description:'内容策划\n运营分析'}]});
const response=proof=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({items:[{id:'job-0',score:70,summary:'测试',strengths:[],gaps:[],unknowns:[],evidence:[proof]}]})}}]}));
test('JSON字段名不能冒充原文依据',async()=>{await assert.rejects(()=>AI.analyze({config,payload:payload()},async()=>response({requirement:'伪证据',resumeQuote:'experienceYears',jobQuote:'description'})),/依据/)});
test('合法跨行原文证据不因JSON转义误拒绝',async()=>{const r=await AI.analyze({config,payload:payload()},async()=>response({requirement:'内容工作',resumeQuote:'内容策划\n数据分析',jobQuote:'内容策划\n运营分析'}));assert.equal(r.items[0].evidence.length,1);assert.ok(r.items[0].unknowns.some(s=>s.includes('描述较少')))});
test('超长引文不能先截短再放行',async()=>{await assert.rejects(()=>AI.analyze({config,payload:payload()},async()=>response({requirement:'测试',resumeQuote:'SQL'+' '.repeat(350),jobQuote:'运营'})),/依据/)});
test('响应体底层错误含200KB字样也不得回显私密内容',async()=>{const body=new ReadableStream({start(c){c.error(Error('200KB secret-test-key'))}});await assert.rejects(()=>AI.analyze({config,payload:payload()},async()=>new Response(body)),e=>e.message==='读取接口响应失败')});

test('BOSS康熙部首兼容字符按等价汉字核对，内容替换仍拒绝',async()=>{
 const p=AI.preparePayload({resume:{work:[{desc:'沟通执行力强'}]},jobs:[{title:'运营',description:'沟通执⾏力强'}]});
 const proof={requirement:'沟通执行',resumeQuote:'沟通执行力强',jobQuote:'沟通执⾏⼒强'};
 const r=await AI.analyze({config,payload:p},async()=>response(proof));assert.equal(r.items[0].evidence.length,1);
 await assert.rejects(()=>AI.analyze({config,payload:p},async()=>response({...proof,jobQuote:'沟通执行能力强'})),/依据/);
});
