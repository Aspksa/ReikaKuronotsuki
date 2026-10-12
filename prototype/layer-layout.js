'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReikaLayerLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const positions={
tail_1:[30,69],tail_2:[32,67],tail_3:[35,66],tail_4:[39,65],tail_5:[50,64],
tail_6:[61,65],tail_7:[65,66],tail_8:[68,67],tail_9:[70,69],
hair_back:[50,29],body:[50,52],ear_left:[45,15],ear_right:[58,15],
face:[50,26],eye_left:[46,28],eye_right:[54,28],hair_front:[50,24]};
const order=['hair_back',...Array.from({length:9},(_,i)=>'tail_'+(i+1)),'body','ear_left','ear_right','face','eye_left','eye_right','hair_front'];
function get(part){if(!Object.hasOwn(positions,part))throw new Error('Unknown layer: '+part);return {origin:positions[part].slice(),z:order.indexOf(part)+1};}
function tailRotation(index,angle){if(!Number.isInteger(index)||index<0||index>=9||!Number.isFinite(angle))throw new RangeError('Invalid tail transform');return (angle-(-112+index*28))*.35;}
return {get,tailRotation,order};
});
