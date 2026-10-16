// Local development server: expose only the app's public files, never customer documents.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),port=Number(process.env.RESUME_DEV_PORT)||18970;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer((req,res)=>{let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';}catch{res.writeHead(400).end();return;}
if(!['GET','HEAD'].includes(req.method)||!(rel==='index.html'||/^(app|vendor)\/[\w.-]+\.(js|css)$/.test(rel))){res.writeHead(404).end('Not found');return;}
const file=path.join(base,rel);fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(port,'127.0.0.1',()=>console.log('Resume dev server: http://127.0.0.1:'+port));
