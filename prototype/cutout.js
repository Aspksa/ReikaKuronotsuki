'use strict';
/**
 * Manual portrait-to-layer cutout studio. Each manually traced polygon exports
 * an individual transparent PNG, with original image dimensions preserved.
 * This does not pretend that a flat portrait is already a Live2D PSD.
 */
(function(){
const parent=document.querySelector('.stage');
const toolbar=document.querySelector('.portrait-toolbar');
if(!toolbar)return;
const section=document.createElement('section');
section.className='layer-editor';
section.innerHTML='<h2>Редактор графических слоёв</h2><p class="foot">Загрузите портрет выше. Выберите часть персонажа и расставьте точки по её контуру. Замкните контур, затем экспортируйте прозрачный PNG.</p><label for="layerPart">Слой</label><select id="layerPart" aria-label="Часть персонажа"></select><div class="layer-tools"><button id="layerUndo" type="button">Отменить точку</button><button id="layerClose" type="button">Замкнуть</button><button id="layerClear" type="button">Очистить слой</button><button id="layerExport" type="button">Экспорт PNG</button><button id="layerManifest" type="button">Манифест JSON</button></div><p class="foot" id="layerStatus" role="status">Загрузите портрет, чтобы начать.</p><div class="layer-canvas-wrap"><canvas id="layerCanvas" aria-label="Редактор обводки графического слоя"></canvas></div>';
toolbar.after(section);
const parts=['body','face','hair_back','hair_front','ear_left','ear_right','eye_left','eye_right',...Array.from({length:9},(_,i)=>'tail_'+(i+1))];
const select=section.querySelector('#layerPart'),canvas=section.querySelector('canvas'),ctx=canvas.getContext('2d'),message=section.querySelector('#layerStatus');
for(const part of parts){const o=document.createElement('option');o.value=part;o.textContent=part.replace('_',' ');select.appendChild(o);}
const polygons=Object.fromEntries(parts.map(p=>[p,[]]));
let loadedImage=null,sourceName='';
const source=document.getElementById('portraitFile');
function resetAll(){for(const p of parts)polygons[p]=[];loadedImage=null;sourceName='';canvas.width=640;canvas.height=480;draw();}
function note(text){message.textContent=text;}
function draw(){
ctx.clearRect(0,0,canvas.width,canvas.height);
if(loadedImage)ctx.drawImage(loadedImage,0,0,canvas.width,canvas.height);
const pts=polygons[select.value];
if(pts.length){ctx.strokeStyle='#67c9fa';ctx.fillStyle='#67c9fa';ctx.lineWidth=Math.max(2,canvas.width/500);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x*canvas.width,p.y*canvas.height):ctx.moveTo(p.x*canvas.width,p.y*canvas.height));if(pts.length>2){ctx.closePath();ctx.fillStyle='#67c9fa22';ctx.fill();}ctx.stroke();for(const p of pts){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,Math.max(3,canvas.width/180),0,Math.PI*2);ctx.fillStyle='#67c9fa';ctx.fill();}}
}
function normalizedPointer(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
canvas.addEventListener('pointerdown',e=>{if(!loadedImage)return;polygons[select.value].push(normalizedPointer(e));draw();note(select.value+': '+polygons[select.value].length+' точек');});
select.addEventListener('change',()=>{draw();note('Редактируется: '+select.value);});
section.querySelector('#layerUndo').onclick=()=>{polygons[select.value].pop();draw();};
section.querySelector('#layerClear').onclick=()=>{polygons[select.value]=[];draw();note('Слой очищен');};
section.querySelector('#layerClose').onclick=()=>{if(polygons[select.value].length<3){note('Нужно минимум 3 точки');return;}draw();note('Контур замкнут для экспорта');};
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
section.querySelector('#layerExport').onclick=()=>{
const points=polygons[select.value];if(!loadedImage||points.length<3){note('Сначала выберите изображение и обведите слой минимум тремя точками.');return;}
const c=document.createElement('canvas');c.width=loadedImage.naturalWidth;c.height=loadedImage.naturalHeight;const x=c.getContext('2d');
x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x*c.width,p.y*c.height):x.moveTo(p.x*c.width,p.y*c.height));x.closePath();x.clip();x.drawImage(loadedImage,0,0);c.toBlob(blob=>{if(blob){download(blob,'reika_'+select.value+'.png');note('Экспортирован: '+select.value);}else note('Не удалось создать PNG');},'image/png');
};
section.querySelector('#layerManifest').onclick=()=>{if(!loadedImage){note('Сначала загрузите портрет');return;}const manifest={version:1,source:sourceName,width:loadedImage.naturalWidth,height:loadedImage.naturalHeight,layers:polygons};download(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),'reika_layer_manifest.json');};
source.addEventListener('change',()=>{const f=source.files?.[0];if(!f){resetAll();return;}if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>15*1024*1024){resetAll();note('Неподдерживаемый файл');return;}const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{resetAll();loadedImage=img;sourceName=f.name;const scale=Math.min(1,900/img.naturalWidth,900/img.naturalHeight);canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));draw();note('Портрет загружен. Выберите слой и расставьте точки.');URL.revokeObjectURL(url);};img.onerror=()=>{URL.revokeObjectURL(url);note('Не удалось прочитать портрет.');};img.src=url;});
resetAll();
})();
