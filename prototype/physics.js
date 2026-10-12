'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaPhysics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const COUNT=9;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function create(initial=Array(COUNT).fill(0)){if(!Array.isArray(initial)||initial.length!==COUNT||!initial.every(Number.isFinite))throw new TypeError('Expected nine finite angles');return {angles:[...initial],velocities:Array(COUNT).fill(0)};}
function reset(state,targets){if(!Array.isArray(targets)||targets.length!==COUNT||!targets.every(Number.isFinite))throw new TypeError('Expected nine finite targets');state.angles=[...targets];state.velocities.fill(0);return state;}
function step(state,targets,dt,{frequency=2.2,damping=1,enabled=true}={}){
if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid delta time');
if(!Array.isArray(targets)||targets.length!==COUNT||!targets.every(Number.isFinite))throw new TypeError('Expected nine finite targets');
if(!enabled)return reset(state,targets);
const count=Math.max(1,Math.ceil(clamp(dt,0,.25)/(.01)));const h=clamp(dt,0,.25)/count,omega=2*Math.PI*clamp(frequency,.1,10),zeta=clamp(damping,.1,3);
for(let n=0;n<count;n++)for(let i=0;i<COUNT;i++){
 const x=state.angles[i],v=state.velocities[i],a=omega*omega*(targets[i]-x)-2*zeta*omega*v;
 const nextV=v+a*h;
 state.velocities[i]=nextV;
 state.angles[i]=x+nextV*h;
}
return state;
}
return {COUNT,create,step,reset};
});
