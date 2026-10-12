'use strict';
/** Local same-origin AI proxy. Requires OPENAI_API_KEY; never sends the key to a browser. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../prototype');
const SYSTEM='Ты Рэйка Куроноцуки, доброжелательная девятихвостая кицунэ. Отвечай по-русски, лаконично и естественно. Не утверждай, что ты человек. Не выдумывай личную память вне текущей беседы. При отсутствии сведений признавай неопределённость.';
const LIMIT=16_384;
function messages(history){
 if(!Array.isArray(history)||history.length<1||history.length>20)throw new Error('Invalid context');
 return history.map(x=>{if(!x||!['user','reika'].includes(x.role)||typeof x.text!=='string'||!x.text.trim()||x.text.length>500)throw new Error('Invalid message');return {role:x.role==='reika'?'assistant':'user',content:x.text.trim()};});
}
function remotePayload(history){return {model:process.env.REIKA_AI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:SYSTEM},...messages(history)],max_tokens:350,temperature:.7};}
async function complete(history,fetcher=fetch){if(!process.env.OPENAI_API_KEY)throw new Error('NOT_CONFIGURED');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetcher('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:JSON.stringify(remotePayload(history)),signal:controller.signal});
 if(!response.ok)throw new Error('UPSTREAM_UNAVAILABLE');
 const data=await response.json();const answer=data?.choices?.[0]?.message?.content;if(typeof answer!=='string'||!answer.trim())throw new Error('EMPTY_REPLY');return answer.trim().slice(0,2000);
 }finally{clearTimeout(timer);}
}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
function createServer(){return http.createServer(async(req,res)=>{
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' blob: data: 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:;","Referrer-Policy":"no-referrer"};
 const reply=(code,data)=>{res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 if(req.url==='/api/chat'){if(req.method!=='POST'){reply(405,{error:'METHOD_NOT_ALLOWED'});return;}
 if(!String(req.headers['content-type']||'').startsWith('application/json')){reply(415,{error:'JSON_REQUIRED'});return;}
 if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+server.address().port&&req.headers.origin!=='http://localhost:'+server.address().port){reply(403,{error:'BAD_ORIGIN'});return;}
 let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>LIMIT)throw new Error('TOO_LARGE');}
 const payload=JSON.parse(raw);const history=payload?.messages;messages(history);if(history.at(-1).role!=='user')throw new Error('LAST_MESSAGE_MUST_BE_USER');
 const answer=await complete(history);reply(200,{answer,mode:'ai'});
 }catch(err){const client=['TOO_LARGE','Invalid context','Invalid message','LAST_MESSAGE_MUST_BE_USER'].includes(err.message)||err instanceof SyntaxError;reply(client?400:err.message==='NOT_CONFIGURED'?503:502,{error:client?'INVALID_REQUEST':err.message==='NOT_CONFIGURED'?'AI_NOT_CONFIGURED':'AI_UNAVAILABLE'});}return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){reply(405,{error:'METHOD_NOT_ALLOWED'});return;}
 let url;try{url=new URL(req.url,'http://localhost');}catch{reply(400,{error:'BAD_PATH'});return;}
 let relative;try{relative=decodeURIComponent(url.pathname);}catch{reply(400,{error:'BAD_PATH'});return;}
 if(relative==='/' )relative='/index.html';
 const target=path.resolve(ROOT,'.'+relative);if(!target.startsWith(ROOT+path.sep)){reply(403,{error:'FORBIDDEN'});return;}
 try{const stat=await fs.promises.stat(target);if(!stat.isFile()||!TYPES[path.extname(target)])throw new Error('NOT_FOUND');res.writeHead(200,{...headers,'Content-Type':TYPES[path.extname(target)]});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(target).pipe(res);}catch{reply(404,{error:'NOT_FOUND'});}
 });}
const server=createServer();
if(require.main===module){const port=Number(process.env.PORT||8787);server.listen(port,'127.0.0.1',()=>console.log('Reika: http://127.0.0.1:'+port));}
module.exports={SYSTEM,messages,remotePayload,complete,createServer,server};
