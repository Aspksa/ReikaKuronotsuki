'use strict';
(function(){
const parts=['hair_back',...Array.from({length:9},(_,i)=>'tail_'+(i+1)),'body','ear_left','ear_right','face','eye_left','eye_right','hair_front'];
const section=document.createElement('section');section.className='layer-player';section.innerHTML='<h2>Живая Рэйка · PNG-слои</h2><label for="playerFiles">Загрузить экспортированные слои PNG</label><input id="playerFiles" type="file" accept="image/png" multiple><div class="layer-player-controls"><button id="playerStart" type="button">Пуск / пауза</button><button id="playerClear" type="button">Очистить слои</button></div><p id="playerStatus" role="status">Добавьте PNG, названные reika_tail_1.png…reika_tail_9.png, reika_face.png и т. д.</p><div class="layer-player-stage"><div id="playerSurface"></div></div>';
document.querySelector('.layer-editor')?.after(section);
const input=section.querySelector('#playerFiles'),surface=section.querySelector('#playerSurface'),status=section.querySelector('#playerStatus');
const rig=window.ReikaRig;
const images=new Map();let urls=[],playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,elapsed=0,last=null,frameId=0;
function announce(){status.textContent=images.size+' / '+parts.length+' слоёв. Хвостов: '+Array.from({length:9},(_,i)=>images.has('tail_'+(i+1))).filter(Boolean).length+' / 9';}
function clear(){for(const url of urls)URL.revokeObjectURL(url);urls=[];images.clear();surface.replaceChildren();input.value='';announce();}
function chooseName(filename){const name=filename.toLowerCase().replace(/\.png$/,'').replace(/^reika_/,'');return parts.includes(name)?name:null;}
function addImage(file){
return new Promise(resolve=>{
const name=chooseName(file.name);if(!name||file.type!=='image/png'||file.size>20*1024*1024){resolve(false);return;}
const url=URL.createObjectURL(file),probe=new Image();
probe.onload=()=>{if(images.has(name)){const prior=images.get(name);URL.revokeObjectURL(prior.url);prior.element.remove();urls=urls.filter(x=>x!==prior.url);}
const element=document.createElement('img');element.src=url;element.alt=name;element.dataset.layer=name;element.draggable=false;element.style.zIndex=String(parts.indexOf(name)+1);surface.append(element);images.set(name,{element,url});urls.push(url);resolve(true);};
probe.onerror=()=>{URL.revokeObjectURL(url);resolve(false);};probe.src=url;
});}
input.addEventListener('change',async()=>{const list=Array.from(input.files||[]);let ok=0;for(const file of list)if(await addImage(file))ok++;announce();if(ok!==list.length)status.textContent+=' · Пропущено файлов: '+(list.length-ok);});
section.querySelector('#playerClear').onclick=clear;
section.querySelector('#playerStart').onclick=()=>{playing=!playing;last=null;section.querySelector('#playerStart').textContent=playing?'Пауза':'Пуск';};
function tick(ts){
if(last===null)last=ts;const dt=Math.min((ts-last)/1000,.05);last=ts;
if(playing){elapsed+=dt;const motion=Number(document.getElementById('motion')?.value||50);const speed=Number(document.getElementById('speed')?.value||100);const mood=document.getElementById('mood')?.value||'neutral';const state=rig.sample(elapsed*speed/100,{...rig.DEFAULTS,mood,motion,ears:Number(document.getElementById('earsControl')?.value||50),hair:Number(document.getElementById('hairControl')?.value||50),eyes:Number(document.getElementById('eyesControl')?.value||100)});
for(let i=0;i<9;i++){const layer=images.get('tail_'+(i+1));if(layer)layer.element.style.transform='rotate('+(state.tails[i]-(-112+i*28))*.35+'deg)';}
for(const [part,rotation] of [['ear_left',state.leftEar],['ear_right',state.rightEar]]){const layer=images.get(part);if(layer)layer.element.style.transform='rotate('+rotation+'deg)';}
for(const part of ['hair_back','hair_front']){const layer=images.get(part);if(layer)layer.element.style.transform='translateX('+state.hairX+'px)';}
const eyeOpen=Math.max(.08,state.eyeOpen);for(const part of ['eye_left','eye_right']){const layer=images.get(part);if(layer)layer.element.style.transform='scaleY('+eyeOpen+')';}
}
frameId=requestAnimationFrame(tick);
}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);clear();},{once:true});
announce();frameId=requestAnimationFrame(tick);
})();