'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaDialog=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
const MAX=40,LIMIT=500;
function clean(value){return String(value??'').trim().slice(0,LIMIT);}
function validate(items){if(!Array.isArray(items)||items.length>MAX)throw new RangeError('Invalid history length');return items.map(item=>{if(!item||!['user','reika'].includes(item.role)||typeof item.text!=='string'||!item.text.trim()||item.text.length>LIMIT)throw new TypeError('Invalid message');return {role:item.role,text:clean(item.text)};});}
function exportHistory(entries){return JSON.stringify({version:84,status:'OFFLINE_SESSION_HISTORY',messages:validate(entries)},null,2);}
function importHistory(input){if(typeof input!=='string'||input.length>30000)throw new RangeError('History file too large');const obj=JSON.parse(input);if(!obj||obj.version!==84||obj.status!=='OFFLINE_SESSION_HISTORY')throw new RangeError('Unsupported history');return validate(obj.messages);}
function summary(entries){const a=validate(entries);return {total:a.length,user:a.filter(x=>x.role==='user').length,reika:a.filter(x=>x.role==='reika').length};}
function search(entries,query){const q=clean(query).toLocaleLowerCase('ru');return validate(entries).filter(item=>!q||item.text.toLocaleLowerCase('ru').includes(q));}
function lastReply(entries){return validate(entries).filter(x=>x.role==='reika').at(-1)?.text||'';}
function createHistory(){let entries=[];return {get all(){return validate(entries);},add(role,text){const value=clean(text);if(!value)return false;entries=validate([...entries,{role,text:value}].slice(-MAX));return true;},clear(){entries=[];},replace(items){entries=validate(items);},get stats(){return summary(entries);}};}
return {MAX,LIMIT,clean,validate,exportHistory,importHistory,summary,search,lastReply,createHistory};
});
