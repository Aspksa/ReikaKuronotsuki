'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaExpressions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const MOUTHS={neutral:'M384 333 Q401 345 418 332',happy:'M382 329 Q400 358 420 328',thinking:'M390 338 Q401 334 411 337',magic:'M389 328 Q400 347 412 328',serious:'M384 337 Q401 331 418 337'};
function expression(mood){return {mouth:MOUTHS[mood]||MOUTHS.neutral,eyeScale:mood==='happy'?.82:mood==='serious'?.9:1,brow:mood==='serious'?4:mood==='thinking'?-2:0};}
function blink(t,{period=4.1,duration=.17}={}){if(!Number.isFinite(t)||t<0)return false;return t%period<duration&&t>0;}
return {expression,blink,MOUTHS};
});
