'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaVoicePersona=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const LIMIT=500;const MODES=['gentle','playful','composed'];const MOODS=['neutral','happy','thinking','magic','serious'];
function clean(s){return String(s??'').trim().slice(0,LIMIT);}
function profile(name){if(!MODES.includes(name))throw new RangeError('Unknown voice style');return {style:name,rate:name==='playful'?1.15:name==='composed'?.85:1,pitch:name==='playful'?1.15:name==='composed'?.9:1};}
function normalize(value){if(!value||typeof value!=='object')throw new TypeError('Invalid voice config');const p=profile(value.style||'gentle');const rate=value.rate??p.rate,pitch=value.pitch??p.pitch;if(!Number.isFinite(rate)||rate<.7||rate>1.4||!Number.isFinite(pitch)||pitch<.7||pitch>1.3)throw new RangeError('Invalid voice parameters');return {style:p.style,rate,pitch};}
function express(mood){if(!MOODS.includes(mood))mood='neutral';return {neutral:'gentle',happy:'playful',thinking:'composed',magic:'playful',serious:'composed'}[mood];}
function sampleSpeech(text){const words=clean(text).split(/\s+/).filter(Boolean);return {characters:clean(text).length,words:words.length,estimatedSeconds:Math.round((words.length/2.6+0.5)*10)/10};}
function mount(){const section=document.querySelector('.speech-tools');if(!section)return;
const block=document.createElement('div');block.className='voice-persona';block.innerHTML='<h4>Голос и характер · v117–v134</h4><label for="voicePersonaStyle">Манера речи</label><select id="voicePersonaStyle"><option value="gentle">Мягкая</option><option value="playful">Игривaя</option><option value="composed">Сдержанная</option></select><label><input id="voicePersonaAuto" type="checkbox"> Подбирать манеру речи по эмоции</label><label><input id="voicePersonaPreview" type="checkbox" checked> Показывать оценку длительности</label><button id="voicePersonaReset" type="button">Сбросить голос</button><p id="voicePersonaStatus" role="status" aria-live="polite">Голос браузера; манера речи влияет только на скорость и высоту.</p>';section.append(block);
const style=block.querySelector('#voicePersonaStyle'),auto=block.querySelector('#voicePersonaAuto'),preview=block.querySelector('#voicePersonaPreview'),status=block.querySelector('#voicePersonaStatus');
const rate=section.querySelector('#speechRate'),pitch=section.querySelector('#speechPitch'),field=section.querySelector('#speechText');
function apply(name){const p=profile(name);rate.value=String(p.rate);pitch.value=String(p.pitch);style.value=name;status.textContent='Манера: '+name+'.';}
style.addEventListener('change',()=>apply(style.value));
block.querySelector('#voicePersonaReset').onclick=()=>{auto.checked=false;apply('gentle');};
window.addEventListener('reika:reply',()=>{if(auto.checked){const mood=window.ReikaInteractionController?.mood||'neutral';apply(express(mood));}});
field.addEventListener('input',()=>{if(preview.checked){const s=sampleSpeech(field.value);status.textContent='Оценка речи: '+s.words+' слов, ~'+s.estimatedSeconds+' сек.';}});
return {get config(){return normalize({style:style.value,rate:Number(rate.value),pitch:Number(pitch.value)});},get auto(){return auto.checked;}};}
return {LIMIT,MODES,clean,profile,normalize,express,sampleSpeech,mount};
});
if(typeof window!=='undefined')window.ReikaVoicePersonaController=window.ReikaVoicePersona.mount();
