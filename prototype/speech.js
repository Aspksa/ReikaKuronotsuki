'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaSpeech=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const LIMIT=500;
function normalizeText(s){return String(s??'').trim().slice(0,LIMIT);}
function chooseVoice(voices,preferred=''){if(!Array.isArray(voices))return null;return voices.find(v=>v.voiceURI===preferred)||voices.find(v=>/^ru(?:-|$)/i.test(v.lang||''))||null;}
function mouthPath(open){return open?'M390 331 Q400 357 410 331 Q401 326 390 331 Z':null;}
function createController(){let active=false,open=false;return {start(){active=true;open=true;},boundary(){if(active)open=!open;},stop(){active=false;open=false;},get active(){return active;},get open(){return active&&open;}};}
function mount(){
 const panel=document.querySelector('.panel');if(!panel)return;
 const section=document.createElement('section');section.className='speech-tools';
 section.innerHTML='<h3>Голос Рэйки</h3><label for="speechText">Текст для озвучивания</label><textarea id="speechText" rows="3" maxlength="500" placeholder="Привет! Я Рэйка."></textarea><div class="speech-actions"><button id="speechPlay" type="button">Произнести</button><button id="speechStop" type="button">Остановить речь</button></div><label for="speechRate">Темп (0.7–1.4)</label><input id="speechRate" type="range" min="0.7" max="1.4" step="0.1" value="1"><label for="speechPitch">Высота (0.7–1.3)</label><input id="speechPitch" type="range" min="0.7" max="1.3" step="0.1" value="1"><label for="speechVoice">Голос браузера</label><select id="speechVoice"><option value="">Автоматически (предпочтительно русский)</option></select><button id="speechVoiceRefresh" type="button">Обновить голоса</button><p id="speechStatus" role="status" aria-live="polite">Локальная озвучка браузера.</p>';
 panel.append(section);
 const synth=window.speechSynthesis,Supported=!!synth&&typeof window.SpeechSynthesisUtterance==='function';
 const start=section.querySelector('#speechPlay'),stop=section.querySelector('#speechStop'),status=section.querySelector('#speechStatus'),field=section.querySelector('#speechText');
 const controller=createController();let token=0;const voiceSelect=section.querySelector('#speechVoice');
 function refreshVoices(){const previous=voiceSelect.value;voiceSelect.replaceChildren();const automatic=document.createElement('option');automatic.value='';automatic.textContent='Автоматически (предпочтительно русский)';voiceSelect.append(automatic);if(!Supported||typeof synth.getVoices!=='function')return;for(const voice of synth.getVoices()){const item=document.createElement('option');item.value=voice.voiceURI;item.textContent=voice.name+' ('+voice.lang+')';voiceSelect.append(item);}if(Array.from(voiceSelect.options).some(v=>v.value===previous))voiceSelect.value=previous;}
 section.querySelector('#speechVoiceRefresh').addEventListener('click',refreshVoices);if(Supported){refreshVoices();synth.addEventListener?.('voiceschanged',refreshVoices);}
 if(!Supported){start.disabled=true;stop.disabled=true;status.textContent='Озвучивание не поддерживается этим браузером.';}
 start.addEventListener('click',()=>{
  const text=normalizeText(field.value);if(!text||!Supported){status.textContent='Введите текст для озвучивания.';return;}
  token++;const mine=token;synth.cancel();controller.stop();
  const utterance=new window.SpeechSynthesisUtterance(text);utterance.lang='ru-RU';utterance.rate=Number(section.querySelector('#speechRate').value);utterance.pitch=Number(section.querySelector('#speechPitch').value);const chosen=chooseVoice(typeof synth.getVoices==='function'?synth.getVoices():[],voiceSelect.value);if(chosen){utterance.voice=chosen;utterance.lang=chosen.lang||'ru-RU';}
  utterance.onstart=()=>{if(mine!==token)return;controller.start();status.textContent='Рэйка говорит…';};
  utterance.onboundary=()=>{if(mine===token)controller.boundary();};
  utterance.onend=()=>{if(mine===token){controller.stop();status.textContent='Речь завершена.';}};
  utterance.onerror=()=>{if(mine===token){controller.stop();status.textContent='Ошибка синтеза речи.';}};
  try{synth.speak(utterance);}catch(_){controller.stop();status.textContent='Не удалось запустить озвучивание.';}
 });
 stop.addEventListener('click',()=>{token++;controller.stop();if(Supported)synth.cancel();status.textContent='Речь остановлена.';});
 window.addEventListener('pagehide',()=>{token++;controller.stop();if(Supported)synth.cancel();},{once:true});
 return controller;
}
return {LIMIT,normalizeText,chooseVoice,mouthPath,createController,mount};
});
if(typeof window!=='undefined'){const speech=window.ReikaSpeech;if(speech)window.ReikaSpeechController=speech.mount();}
