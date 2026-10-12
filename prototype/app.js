'use strict';
const svg=document.getElementById('reika'), tailsRoot=document.getElementById('tails');
const mood=document.getElementById('mood'),motion=document.getElementById('motion'),speed=document.getElementById('speed'),toggle=document.getElementById('toggle'),status=document.getElementById('status');
const svgNS='http://www.w3.org/2000/svg';
const tails=[];
for(let i=0;i<9;i++){const g=document.createElementNS(svgNS,'g');const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M400 493 C350 440 305 350 347 244 C380 172 425 143 435 98 C467 197 450 297 430 366 C414 420 411 461 400 493Z');path.setAttribute('fill','url(#fur)');path.setAttribute('stroke','#c5b7a7');path.setAttribute('stroke-width','3');g.appendChild(path);g.setAttribute('transform',`rotate(${-112+i*28} 400 493) scale(.98)`);tailsRoot.appendChild(g);tails.push(g);}
const left=document.querySelector('.ear.left'),right=document.querySelector('.ear.right'),head=document.getElementById('head'),hair=document.getElementById('hairFront'),eyes=document.querySelector('.eyes');
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=prefersReduced.matches,elapsed=0,last=0,blinkUntil=0,blinkRequested=false;
function updateLabels(){document.getElementById('motionValue').textContent=motion.value+'%';document.getElementById('speedValue').textContent=speed.value+'%';const label=mood.options[mood.selectedIndex].text;status.textContent='9 хвостов · режим: '+label;toggle.textContent=paused?'Запустить анимацию':'Остановить анимацию';toggle.setAttribute('aria-pressed',String(paused));}
function frame(ts){if(!last)last=ts;const dt=Math.min((ts-last)/1000,.05);last=ts;if(!paused){elapsed+=dt*Number(speed.value)/100;const intensity=Number(motion.value)/100;const m=mood.value;const boost=m==='happy'?1.3:m==='magic'?1.6:m==='serious'?.45:1;const amp=intensity*boost;tails.forEach((g,i)=>{const offset=Math.sin(elapsed*(.9+i*.08)+i*.83)*6*amp;const baseline=-112+i*28;g.setAttribute('transform',`rotate(${baseline+offset} 400 493)`);g.style.opacity=m==='magic'?String(.92+Math.sin(elapsed*2+i)*.08):'1'});left.style.transform=`rotate(${Math.sin(elapsed*1.6)*4*amp}deg)`;right.style.transform=`rotate(${Math.sin(elapsed*1.35+1)*4*amp}deg)`;hair.setAttribute('transform',`translate(${Math.sin(elapsed*1.3)*2.5*amp} 0)`);head.setAttribute('transform',`translate(0 ${Math.sin(elapsed*1.8)*1.8*amp})`);if(blinkRequested){blinkUntil=elapsed+.17;blinkRequested=false;}else if(Math.floor(elapsed/4.1)!==Math.floor((elapsed-dt)/4.1)){blinkUntil=elapsed+.17;}eyes.style.transform=elapsed<blinkUntil?'scaleY(.08)':'scaleY(1)';}requestAnimationFrame(frame);}
toggle.addEventListener('click',()=>{paused=!paused;last=0;updateLabels();});
document.getElementById('blink').addEventListener('click',()=>{if(paused){paused=false;}blinkRequested=true;updateLabels();});
document.getElementById('reset').addEventListener('click',()=>{mood.value='neutral';motion.value='50';speed.value='100';paused=prefersReduced.matches;elapsed=0;blinkUntil=0;blinkRequested=false;updateLabels();});
for(const control of [mood,motion,speed])control.addEventListener('input',updateLabels);
prefersReduced.addEventListener?.('change',e=>{paused=e.matches;updateLabels();});
updateLabels();requestAnimationFrame(frame);
