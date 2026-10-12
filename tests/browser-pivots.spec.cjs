'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
test('each tail has an independent pivot and debug marker',async({page})=>{
 await page.goto(url);
 await page.locator('#playerFiles').setInputFiles(Array.from({length:9},(_,i)=>({name:'reika_tail_'+(i+1)+'.png',mimeType:'image/png',buffer:png})));
 await expect(page.locator('#playerSurface img')).toHaveCount(9);
 const origins=await page.locator('#playerSurface img').evaluateAll(els=>els.map(el=>el.style.transformOrigin));
 expect(new Set(origins).size).toBeGreaterThan(4);
 await page.locator('#playerPivots').check();
 await expect(page.locator('.player-pivot')).toHaveCount(9);
 await page.locator('#playerPivots').uncheck();
 await expect(page.locator('.player-pivot')).toHaveCount(0);
});
test('rig transform responds to animation and controls',async({page})=>{
 await page.goto(url);
 await page.locator('#playerFiles').setInputFiles({name:'reika_tail_1.png',mimeType:'image/png',buffer:png});
 const layer=page.locator('[data-layer="tail_1"]');
 await expect(layer).toHaveAttribute('style',/rotate\(/);
 const before=await layer.evaluate(el=>el.style.transform);
 await page.locator('#motion').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>layer.evaluate(el=>el.style.transform),{timeout:4000}).not.toBe(before);
});
