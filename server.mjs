import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'};
http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return}if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}if(p===root)p+='/index.html';fs.readFile(p,(e,b)=>{if(e){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(b)})}).listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173'));
