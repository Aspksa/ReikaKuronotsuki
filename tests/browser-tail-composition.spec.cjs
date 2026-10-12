'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('nine-tail composition editor adjusts and resets transforms',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.locator('#tailCompositionSelect option')).toHaveCount(9);
 await page.locator('#tailCompositionSelect').selectOption('2');
 await page.locator('#tailCompX').evaluate(input=>{input.value='77';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.ReikaTailCompositionController.state[2].x)).toBe(77);
 await page.locator('#tailCompFront').click();
 expect(await page.evaluate(()=>window.ReikaTailCompositionController.state.map(s=>s.z).sort((a,b)=>a-b))).toEqual([1,2,3,4,5,6,7,8,9]);
 await page.locator('#tailCompReset').click();
 await expect(page.locator('#tailCompositionStatus')).toContainText('сброшены');
 expect(errors).toEqual([]);
});
