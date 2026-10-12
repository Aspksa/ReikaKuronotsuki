'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaLayerValidation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const PARTS=['hair_back',...Array.from({length:9},(_,i)=>'tail_'+(i+1)),'body','ear_left','ear_right','face','eye_left','eye_right','hair_front'];
const match=name=>{if(typeof name!=='string'||!/\.png$/i.test(name))return null;const part=name.replace(/\.png$/i,'').replace(/^reika_/i,'').toLowerCase();return PARTS.includes(part)?part:null;};
const pivot=part=>part.startsWith('tail_')?[50,65]:part.startsWith('ear_')?[50,26]:part.startsWith('eye_')?[50,36]:part.startsWith('hair_')?[50,30]:[50,50];
function validate(file,dimensions){const part=match(file?.name);if(!part)return {ok:false,reason:'Unknown layer name'};if(file.type!=='image/png'||file.size<=0||file.size>20*1024*1024)return {ok:false,reason:'Expected PNG under 20 MB'};if(!Number.isInteger(dimensions?.width)||!Number.isInteger(dimensions?.height)||dimensions.width<1||dimensions.height<1)return {ok:false,reason:'Invalid dimensions'};return {ok:true,part};}
return {PARTS,match,pivot,validate};
});
