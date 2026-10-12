'use strict';
(function(){
  const stage=document.querySelector('.stage'),svg=document.getElementById('reika');
  const toolbar=document.createElement('div');toolbar.className='portrait-toolbar';
  const label=document.createElement('label');label.htmlFor='portraitFile';label.textContent='Загрузить эталонный портрет (PNG, JPEG или WebP)';
  const input=document.createElement('input');input.type='file';input.id='portraitFile';input.accept='image/png,image/jpeg,image/webp';
  const mode=document.createElement('select');mode.id='displayMode';mode.setAttribute('aria-label','Режим отображения');
  [['vector','SVG-анимация'],['portrait','Портрет'],['compare','Сравнение']].forEach(([value,name])=>{const o=document.createElement('option');o.value=value;o.textContent=name;mode.appendChild(o);});
  const clear=document.createElement('button');clear.type='button';clear.textContent='Убрать портрет';
  const info=document.createElement('p');info.id='portraitInfo';info.className='foot';info.setAttribute('role','status');info.textContent='Портрет пока не выбран. Используйте файл, созданный для Reika.';
  const gallery=document.createElement('div');gallery.className='portrait-gallery';
  const preview=document.createElement('img');preview.alt='Загруженный эталонный портрет Рэйки';preview.hidden=true;
  gallery.appendChild(preview);toolbar.append(label,input,mode,clear,info);
  svg.parentNode.insertBefore(toolbar,svg);svg.parentNode.insertBefore(gallery,svg.nextSibling);
  let objectUrl=null;
  function refresh(){
    const selected=mode.value;
    const hasPortrait=!!objectUrl;
    const showImage=hasPortrait&&selected!=='vector';
    svg.hidden=hasPortrait&&selected==='portrait';
    gallery.hidden=!showImage;
    gallery.classList.toggle('side-by-side',selected==='compare');
    stage.classList.toggle('portrait-comparison',hasPortrait&&selected==='compare');
    if(!hasPortrait&&selected!=='vector'){mode.value='vector';svg.hidden=false;gallery.hidden=true;}
  }
  function unload(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}preview.removeAttribute('src');preview.hidden=true;input.value='';info.textContent='Портрет удалён из предпросмотра.';mode.value='vector';refresh();}
  input.addEventListener('change',()=>{
    const file=input.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){info.textContent='Выберите PNG, JPEG или WebP размером до 15 МБ.';input.value='';return;}
    const next=URL.createObjectURL(file);
    const probe=new Image();probe.onload=()=>{
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      objectUrl=next;preview.src=next;preview.hidden=false;mode.value='portrait';
      info.textContent='Локальный портрет: '+probe.naturalWidth+' × '+probe.naturalHeight+' пикс. Файл не отправлен на сервер.';
      refresh();
    };
    probe.onerror=()=>{URL.revokeObjectURL(next);info.textContent='Не удалось открыть изображение.';};
    probe.src=next;
  });
  mode.addEventListener('change',refresh);clear.addEventListener('click',unload);
  window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);},{once:true});
  refresh();
})();
