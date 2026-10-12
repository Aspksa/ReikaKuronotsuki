'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('advanced editor can undo and redo legacy slider changes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const initial=await page.evaluate(()=>window.ReikaTailCompositionController.state[0].x);
 await page.locator('#tailCompX').evaluate(el=>{el.value='85';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.ReikaTailCompositionController.state[0].x)).toBe(85);
 await page.locator('#tailUndo').click();await expect.poll(()=>page.evaluate(()=>window.ReikaTailCompositionController.state[0].x)).toBe(initial);
 await page.locator('#tailRedo').click();await expect.poll(()=>page.evaluate(()=>window.ReikaTailCompositionController.state[0].x)).toBe(85);
 await page.locator('#tailAnimationPause').click();await expect(page.locator('#tailAnimationPause')).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});
test('pivot values survive JSON import',async({page})=>{
 await page.goto(url);
 const json=await page.evaluate(()=>JSON.stringify({...window.ReikaTailEditor.pack(window.ReikaTailCompositionController.state),pivots:Array.from({length:9},(_,i)=>({x:30+i,y:70+i}))}));
 await page.locator('#tailImportJson').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(json)});
 await expect(page.locator('#tailAdvancedStatus')).toContainText('импортирована');
 expect(await page.evaluate(()=>window.ReikaTailEditorController.pivots[0].x)).toBe(30);
});
