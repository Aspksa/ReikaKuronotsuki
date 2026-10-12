'use strict';
(function(){
const ns='http://www.w3.org/2000/svg';
function make(tag,attrs,parent){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(parent)parent.appendChild(n);return n;}
function line(d,color,width,parent,opacity){make('path',{d,fill:'none',stroke:color,'stroke-width':width,opacity:opacity??1,'stroke-linecap':'round'},parent);}
const svg=document.getElementById('reika'),defs=svg.querySelector('defs'),body=document.getElementById('body'),hair=document.getElementById('hairFront'),tails=document.getElementById('tails');
const gold=make('linearGradient',{id:'artGold'},defs);
for(const [offset,color] of [['0%','#fff4ca'],['50%','#ae8240'],['100%','#edca78']])make('stop',{offset,'stop-color':color},gold);
const backdrop=make('g',{'aria-hidden':'true'},svg);
svg.insertBefore(backdrop,tails);
make('circle',{cx:655,cy:112,r:52,fill:'#eae8dc',opacity:'.7'},backdrop);
make('circle',{cx:655,cy:112,r:88,fill:'#d3dfff',opacity:'.07'},backdrop);
for(const x of [27,116,670,766]){make('rect',{x,y:0,width:10,height:750,fill:'#c8a35d',opacity:'.32'},backdrop);}
for(let i=0;i<18;i++){const x=40+(i*87)%700,y=30+(i*133)%665;make('circle',{cx:x,cy:y,r:i%4===0?3:1.5,fill:'#ecd5a3',opacity:'.35'},backdrop);}
tails.querySelectorAll('g').forEach((g,i)=>{g.setAttribute('data-tail-number',i+1);const detail=make('g',{'pointer-events':'none'},g);for(let k=0;k<5;k++){const x=374+k*10;line('M'+x+' 457 Q'+(x-25)+' 340 '+(x+18)+' 228 Q'+(x+25)+' 170 435 107',k%2?'#ffffff':'#aebdd5',k%2?2:1.3,detail,k%2?.6:.38);}});
const embroidery=make('g',{'pointer-events':'none'},body);
for(let i=0;i<7;i++){const y=495+i*27;line('M'+(351-i*3)+' '+y+' Q400 '+(y+14)+' '+(449+i*3)+' '+y,'#b58b50',1.4,embroidery,.7);}
for(const x of [335,464])for(let j=0;j<3;j++){const y=525+j*45;line('M'+x+' '+y+' q-18 -14 -26 0 q13 15 26 0 q14 -14 26 0','#d7b46d',2,embroidery,.8);}
make('circle',{cx:400,cy:463,r:11,fill:'url(#artGold)'},embroidery);make('circle',{cx:400,cy:463,r:5,fill:'#231d29'},embroidery);
const ornaments=make('g',{},hair);for(const x of [322,475]){line('M'+x+' 198 v49','#c7a25c',2,ornaments,1);make('circle',{cx:x,cy:253,r:4,fill:'#edce86'},ornaments);}
const flower=make('g',{transform:'translate(475 188)'},ornaments);
for(let i=0;i<8;i++)make('ellipse',{cx:0,cy:-19,rx:6,ry:12,fill:'url(#artGold)',transform:'rotate('+(i*45)+')'},flower);
make('circle',{r:6,fill:'#fff2b9'},flower);
})();
