'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaBehavior=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const MOODS=['neutral','happy','thinking','magic','serious'];
const PROFILES={neutral:{tail:'calm',amplitude:4,frequency:.45,ear:0,blink:1},happy:{tail:'lively',amplitude:13,frequency:1.2,ear:3,blink:.85},thinking:{tail:'calm',amplitude:2.5,frequency:.35,ear:-2,blink:1.25},magic:{tail:'lively',amplitude:11,frequency:.85,ear:4,blink:.9},serious:{tail:'still',amplitude:1,frequency:.2,ear:-3,blink:1.3}};
function normalizeMood(m){return MOODS.includes(m)?m:'neutral';}
function profile(mood){return {...PROFILES[normalizeMood(mood)]};}
function classifyReply(text){const q=String(text??'').slice(0,2000).toLowerCase();if(/тревог|опасн|сожале|страш|груст|проблем|осторожн/.test(q))return 'serious';if(/магия|волшеб|заклинан|лисий|хвост/.test(q))return 'magic';if(/рассмотрим|подума|возможно|почему|объясн|вопрос/.test(q))return 'thinking';if(/рада|привет|здорово|отлично|поздрав|спасибо|ура/.test(q))return 'happy';return 'neutral';}
function blend(a,b,f){if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(f)||f<0||f>1)throw new RangeError('Invalid blend');return a+(b-a)*f;}
function create(){let current='neutral',target='neutral',progress=1;return {set(mood){target=normalizeMood(mood);progress=target===current?1:0;},step(dt){if(!Number.isFinite(dt)||dt<0||dt>1)throw new RangeError('Invalid time step');progress=Math.min(1,progress+dt*3);if(progress===1)current=target;return {mood:target,progress,amplitude:blend(profile(current).amplitude,profile(target).amplitude,progress),frequency:blend(profile(current).frequency,profile(target).frequency,progress)};},reset(){current='neutral';target='neutral';progress=1;},get mood(){return target;}};}
return {MOODS,profile,classifyReply,blend,create,normalizeMood};
});
