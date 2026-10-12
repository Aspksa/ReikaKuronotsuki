'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaSecondaryMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
function create(){return {leftEar:0,rightEar:0,hairX:0,headY:0,breath:1};}
function sample(t,settings){const intensity=Math.max(0,Math.min(1,Number(settings.motion)/100||0));return {breath:1+Math.sin(t*1.65)*.006*intensity};}
function step(state,target,dt,{enabled=true}={}){
if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid delta');
if(!enabled){Object.assign(state,target);return state;}
const alpha=1-Math.exp(-Math.min(dt,.1)*11);
for(const key of ['leftEar','rightEar','hairX','headY','breath']){if(!Number.isFinite(target[key]))throw new TypeError('Invalid target '+key);state[key]+=(target[key]-state[key])*alpha;}
return state;
}
return {create,sample,step};
});
