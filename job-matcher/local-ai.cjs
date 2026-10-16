'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Only invoked by the explicit local-service button. Never return the key to the renderer.
function readKey(read=()=>fs.readFileSync(path.join(os.homedir(),'.hermes','.env'),'utf8'),env=process.env){
  let text='';try{text=read();}catch{}
  const line=text.split(/\r?\n/).find(s=>/^\s*(?:export\s+)?DEEPSEEK_API_KEY\s*=/.test(s));
  let key=line?line.slice(line.indexOf('=')+1).trim():'';
  if(key.startsWith('"')||key.startsWith("'")){const quote=key[0],end=key.indexOf(quote,1);key=end>0?key.slice(1,end):'';}else key=key.replace(/\s+#.*$/,'').trim();
  key=key||env.DEEPSEEK_API_KEY||'';
  if(typeof key!=='string'||!key.trim()||key.length>1024||/[\r\n]/.test(key))throw Error('未找到本机 DeepSeek 密钥，请手动填写服务配置');
  return key.trim();
}
function resolve(config,key){
  const result={...config};
  if(!result.apiKey&&key){let u;try{u=new URL(result.baseUrl);}catch{return result;}
    if(u.protocol==='https:'&&u.hostname==='api.deepseek.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&['/','/v1','/v1/','/chat/completions','/v1/chat/completions'].includes(u.pathname))result.apiKey=key;
  }
  return result;
}
module.exports={readKey,resolve};
