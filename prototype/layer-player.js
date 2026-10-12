'use strict';
(function(){
const validation=window.ReikaLayerValidation;const layout=window.ReikaLayerLayout;const parts=validation.PARTS;
const section=document.createElement('section');section.className='layer-player';section.innerHTML='<h2>Живая Рэйка · PNG-слои</h2><label for="playerFiles">Загрузить экспортированные слои PNG</label><input id="playerFiles" type="file" accept="image/png" multiple><div class="layer-player-controls"><button id="playerStart" type="button">Пуск / пауза</button><button id="playerClear" type="button">Очистить слои</button><label><input id="playerPivots" type="checkbox"> Точки крепления</label></div><p id="playerStatus" role="status">Добавьте PNG, названные reika_tail_1.png…reika_tail_9.png, reika_face.png и т. д.</p><div class="layer-player-stage"><div id="playerSurface"></div></div>';
document.querySelector('.layer-editor')?.after(section);
const input=section.querySelector('#playerFiles'),surface=section.querySelector('#playerSurface'),status=section.querySelector('#playerStatus');
const rig=window.ReikaRig,physics=window.ReikaPhysics,secondary=window.ReikaSecondaryMotion;const secondaryState=secondary.create();const tailPhysics=physics.create(rig.sample(0,rig.DEFAULTS).tails);
const images=new Map();const pivots=section.querySelector('#playerPivots');let uploadGeneration=0;let urls=[],playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,elapsed=0,last=null,frameId=0;
function showPivots(){surface.querySelectorAll('.player-pivot').forEach(el=>el.remove());if(!pivots.checked)return;for(const name of images.keys()){const point=layout.get(name).origin;const mark=document.createElement('span');mark.className='player-pivot';mark.dataset.part=name;mark.title=name;mark.style.cssText='position:absolute;left:'+point[0]+'%;top:'+point[1]+'%;width:9px;height:9px;border-radius:50%;background:#f8c646;border:1px solid #24182b;pointer-events:none;z-index:100;transform:translate(-50%,-50%)';surface.append(mark);}}
pivots.addEventListener('change',showPivots);
function announce(){status.textContent=images.size+' / '+parts.length+' слоёв. Хвостов: '+Array.from({length:9},(_,i)=>images.has('tail_'+(i+1))).filter(Boolean).length+' / 9';}
function clear(){physics.reset(tailPhysics,rig.sample(0,rig.DEFAULTS).tails);elapsed=0;Object.assign(secondaryState,secondary.create());uploadGeneration++;for(const url of urls)URL.revokeObjectURL(url);urls=[];images.clear();surface.replaceChildren();input.value='';announce();showPivots();}
function chooseName(filename){return validation.match(filename);}
function addImage(file){
return new Promise(resolve=>{
const name=chooseName(file.name);if(!name||file.type!=='image/png'||file.size>20*1024*1024){resolve(false);return;}
const generation=uploadGeneration;const url=URL.createObjectURL(file),probe=new Image();
probe.onload=()=>{if(generation!==uploadGeneration){URL.revokeObjectURL(url);resolve(false);return;}if(!validation.validate(file,{width:probe.naturalWidth,height:probe.naturalHeight}).ok){URL.revokeObjectURL(url);resolve(false);return;}const first=images.values().next().value;if(first&&first.width&&(first.width!==probe.naturalWidth||first.height!==probe.naturalHeight)){URL.revokeObjectURL(url);resolve(false);return;}if(images.has(name)){const prior=images.get(name);URL.revokeObjectURL(prior.url);prior.element.remove();urls=urls.filter(x=>x!==prior.url);}
const element=document.createElement('img');element.src=url;element.alt=name;element.dataset.layer=name;element.draggable=false;const cfg=layout.get(name);element.style.zIndex=String(cfg.z);element.style.transformOrigin=cfg.origin[0]+'% '+cfg.origin[1]+'%';surface.append(element);images.set(name,{element,url,width:probe.naturalWidth,height:probe.naturalHeight});urls.push(url);showPivots();resolve(true);};
probe.onerror=()=>{URL.revokeObjectURL(url);resolve(false);};probe.src=url;
});}
input.addEventListener('change',async()=>{uploadGeneration++;const list=Array.from(input.files||[]);let ok=0;for(const file of list)if(await addImage(file))ok++;announce();if(ok!==list.length)status.textContent+=' · Пропущено файлов: '+(list.length-ok);});
section.querySelector('#playerClear').onclick=clear;
section.querySelector('#playerStart').onclick=()=>{playing=!playing;last=null;section.querySelector('#playerStart').textContent=playing?'Пауза':'Пуск';};
function tick(ts){
if(last===null)last=ts;const dt=Math.min((ts-last)/1000,.05);last=ts;
if(playing){elapsed+=dt;const motion=Number(document.getElementById('motion')?.value??50);const speed=Number(document.getElementById('speed')?.value??100);const mood=document.getElementById('mood')?.value||'neutral';const state=rig.sample(elapsed*speed/100,{...rig.DEFAULTS,mood,motion,ears:Number(document.getElementById('earsControl')?.value??50),hair:Number(document.getElementById('hairControl')?.value??50),eyes:Number(document.getElementById('eyesControl')?.value??100)});
physics.step(tailPhysics,state.tails,dt,{enabled:motion>0});for(let i=0;i<9;i++){const layer=images.get('tail_'+(i+1));if(layer)layer.element.style.transform='rotate('+layout.tailRotation(i,tailPhysics.angles[i])+'deg)';}
const soft=secondary.step(secondaryState,{leftEar:state.leftEar,rightEar:state.rightEar,hairX:state.hairX,headY:state.headY,breath:secondary.sample(elapsed,state).breath},dt,{enabled:motion>0});for(const [part,rotation] of [['ear_left',soft.leftEar],['ear_right',soft.rightEar]]){const layer=images.get(part);if(layer)layer.element.style.transform='rotate('+rotation+'deg)';}
for(const part of ['hair_back','hair_front']){const layer=images.get(part);if(layer)layer.element.style.transform='translateX('+soft.hairX+'px)';}
const body=images.get('body');if(body)body.element.style.transform='scaleY('+soft.breath+')';const eyeOpen=Math.max(.08,state.eyeOpen);for(const part of ['eye_left','eye_right']){const layer=images.get(part);if(layer)layer.element.style.transform='scaleY('+eyeOpen+')';}
}
frameId=requestAnimationFrame(tick);
}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);clear();},{once:true});
announce();frameId=requestAnimationFrame(tick);
})();