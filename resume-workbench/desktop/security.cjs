'use strict';
function allowedURL(value){try{const u=new URL(value);return !u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)));}catch{return false;}}
function validateRequest(args,route,method){if(!args||!allowedURL(args.url))throw new Error('接口地址仅允许 HTTPS 或本机 HTTP');const url=new URL(args.url);const expected=route==='chat'?'POST':route==='models'?'GET':null;const suffix=route==='chat'?'/chat/completions':'/models';if(!expected||method!==expected||!url.pathname.endsWith(suffix)||url.search||url.hash)throw new Error('不允许的接口路径或请求方式');if(typeof args.key!=='string'||!args.key.trim()||args.key.length>8192)throw new Error('无效 API Key');return url.href;}
function safeFilename(value){return String(value||'简历.pdf').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120);}
module.exports={allowedURL,safeFilename,validateRequest};
