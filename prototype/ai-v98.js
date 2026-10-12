'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaAI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
function context(items){if(!Array.isArray(items)||!items.length||items.length>20)throw new RangeError('Invalid context');return items.map(x=>{if(!x||!['user','reika'].includes(x.role)||typeof x.text!=='string'||!x.text.trim()||x.text.length>500)throw new TypeError('Invalid message');return {role:x.role,text:x.text.trim()};});}
async function ask(items,request=fetch){const messages=context(items);if(messages.at(-1).role!=='user')throw new Error('Latest message must be from user');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),24000);
 try{const response=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:controller.signal});
 if(!response.ok)throw new Error('AI unavailable');const data=await response.json();if(typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>2000)throw new Error('Invalid AI response');return {answer:data.answer,mode:'ai'};}finally{clearTimeout(timer);}}
return {context,ask};
});
