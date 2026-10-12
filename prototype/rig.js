'use strict';
/** Pure, portable 9-tail rig math. No DOM required; usable by Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaRig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const COUNT=9,MIN=-112,STEP=28;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):min));
const DEFAULTS=Object.freeze({mood:'neutral',motion:50,speed:100,ears:50,hair:50,eyes:100,tailOffsets:Array(COUNT).fill(0)});
function normalize(input={}){const moods=['neutral','happy','thinking','magic','serious'];return {mood:moods.includes(input.mood)?input.mood:'neutral',motion:clamp(input.motion,0,100),speed:clamp(input.speed,20,200),ears:clamp(input.ears,0,100),hair:clamp(input.hair,0,100),eyes:clamp(input.eyes,0,100),tailOffsets:Array.from({length:COUNT},(_,i)=>clamp(input.tailOffsets?.[i]??0,-30,30))};}
function sample(t,settings){const s=normalize(settings),boost={neutral:1,happy:1.3,thinking:.55,magic:1.6,serious:.45}[s.mood],amp=s.motion/100*boost;return {tails:Array.from({length:COUNT},(_,i)=>MIN+i*STEP+s.tailOffsets[i]+Math.sin(t*(.9+i*.08)+i*.83)*6*amp),leftEar:Math.sin(t*1.6)*4*amp*s.ears/100,rightEar:Math.sin(t*1.35+1)*4*amp*s.ears/100,hairX:Math.sin(t*1.3)*2.5*amp*s.hair/100,headY:Math.sin(t*1.8)*1.8*amp,eyeOpen:s.eyes/100};}
return {COUNT,DEFAULTS,clamp,normalize,sample};
});
