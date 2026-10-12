'use strict';
const rig=window.ReikaRig,physics=window.ReikaPhysics,secondary=window.ReikaSecondaryMotion;
const svgNS='http://www.w3.org/2000/svg',root=document.getElementById('tails');
const $=id=>document.getElementById(id);
const mood=$('mood'),motion=$('motion'),speed=$('speed'),toggle=$('toggle'),status=$('status'),earsControl=$('earsControl'),hairControl=$('hairControl'),eyesControl=$('eyesControl'),tailIndex=$('tailIndex'),tailOffset=$('tailOffset');
const tails=[];
for(let i=0;i<rig.COUNT;i++){const g=document.createElementNS(svgNS,'g'),p=document.createElementNS(svgNS,'path');p.setAttribute('d','M400 493 C350 440 305 350 347 244 C380 172 425 143 435 98 C467 197 450 297 430 366 C414 420 411 461 400 493Z');p.setAttribute('fill','url(#fur)');p.setAttribute('stroke','#c5b7a7');p.setAttribute('stroke-width','3');g.appendChild(p);root.appendChild(g);tails.push(g);}
const left=document.querySelector('.ear.left'),right=document.querySelector('.ear.right'),head=$('head'),hair=$('hairFront'),eyes=document.querySelector('.eyes');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches,time=0,last=null,blinkUntil=0,blinkRequested=false;
let settings=rig.normalize(rig.DEFAULTS);const tailPhysics=physics.create(rig.sample(0,settings).tails),secondaryState=secondary.create();
try{const saved=JSON.parse(localStorage.getItem('reika-rig-v2')||'null');if(saved&&typeof saved==='object')settings=rig.normalize({...rig.DEFAULTS,...saved});}catch(_){}
function syncControls(){mood.value=settings.mood;motion.value=settings.motion;speed.value=settings.speed;earsControl.value=settings.ears;hairControl.value=settings.hair;eyesControl.value=settings.eyes;tailOffset.value=settings.tailOffsets[Number(tailIndex.value)];renderLabels();}
function renderLabels(){$('motionValue').textContent=motion.value+'%';$('speedValue').textContent=speed.value+'%';status.textContent='9 хвостов · режим: '+mood.options[mood.selectedIndex].text;toggle.textContent=paused?'Запустить анимацию':'Остановить анимацию';toggle.setAttribute('aria-pressed',String(paused));}
function current(){settings=rig.normalize({...settings,mood:mood.value,motion:motion.value,speed:speed.value,ears:earsControl.value,hair:hairControl.value,eyes:eyesControl.value});return settings;}
function paint(dt=0){const p=rig.sample(time,settings);physics.step(tailPhysics,p.tails,dt,{enabled:!paused&&settings.motion>0});tails.forEach((g,i)=>{g.setAttribute('transform','rotate('+tailPhysics.angles[i]+' 400 493)');g.style.opacity=settings.mood==='magic'?String(.94+Math.sin(time*2+i)*.06):'1';});const soft=secondary.step(secondaryState,{leftEar:p.leftEar,rightEar:p.rightEar,hairX:p.hairX,headY:p.headY,breath:secondary.sample(time,settings).breath},dt,{enabled:!paused&&settings.motion>0});left.style.transform='rotate('+soft.leftEar+'deg)';right.style.transform='rotate('+soft.rightEar+'deg)';hair.setAttribute('transform','translate('+soft.hairX+' 0)');head.setAttribute('transform','translate(0 '+soft.headY+')');$('body').setAttribute('transform','translate(0 455) scale(1 '+soft.breath+') translate(0 -455)');eyes.style.transform='scaleY('+(time < blinkUntil ? 0.08 : Math.max(0.08,p.eyeOpen))+')';}
function frame(ts){if(last===null)last=ts;const dt=Math.min((ts-last)/1000,.05);last=ts;if(!paused){time+=dt*settings.speed/100;if(blinkRequested){blinkUntil=time+.17;blinkRequested=false;}else if(Math.floor(time/4.1)!==Math.floor((time-dt*settings.speed/100)/4.1))blinkUntil=time+.17;}paint(paused?0:dt);requestAnimationFrame(frame);}
[mood,motion,speed,earsControl,hairControl,eyesControl].forEach(e=>e.addEventListener('input',()=>{current();renderLabels();paint();}));
tailIndex.addEventListener('change',()=>{tailOffset.value=settings.tailOffsets[Number(tailIndex.value)];});
tailOffset.addEventListener('input',()=>{const offsets=[...settings.tailOffsets];offsets[Number(tailIndex.value)]=Number(tailOffset.value);settings=rig.normalize({...settings,tailOffsets:offsets});paint();});
toggle.addEventListener('click',()=>{paused=!paused;last=null;renderLabels();});
$('blink').addEventListener('click',()=>{blinkRequested=true;if(paused){paused=false;last=null;}renderLabels();});
$('reset').addEventListener('click',()=>{settings=rig.normalize(rig.DEFAULTS);paused=reduced.matches;time=0;last=null;blinkUntil=0;blinkRequested=false;physics.reset(tailPhysics,rig.sample(0,settings).tails);Object.assign(secondaryState,secondary.create());try{localStorage.removeItem('reika-rig-v2');}catch(_){}syncControls();paint();});
$('save').addEventListener('click',()=>{try{localStorage.setItem('reika-rig-v2',JSON.stringify(settings));status.textContent='Настройки сохранены локально';}catch(_){status.textContent='Сохранение недоступно в этом браузере';}});
reduced.addEventListener?.('change',e=>{paused=e.matches;renderLabels();});
syncControls();paint();requestAnimationFrame(frame);
