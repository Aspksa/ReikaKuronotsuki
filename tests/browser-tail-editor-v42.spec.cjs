'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('advanced nine-tail controls modify layout and undo safely',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.locator('#tailPivotX')).toBeVisible();
 await page.locator('#tailPresetFan').click();
 await expect(page.locator('#tailAdvancedStatus')).toContainText('веер');
 await page.locator('#tailUndo').click();
 await expect(page.locator('#tailAdvancedStatus')).toContainText('отменено');
 await page.locator('#tailAnimationPause').click();
 await expect(page.locator('#tailAnimationPause')).toHaveAttribute('aria-pressed','true');
 const valid=await page.evaluate(()=>window.ReikaTailEditor.parse(JSON.stringify(window.ReikaTailEditor.pack(window.ReikaTailCompositionController.state))).tails.length);
 expect(valid).toBe(9);expect(errors).toEqual([]);
});
test('invalid JSON import retains existing transforms',async({page})=>{
 await page.goto(url);const before=await page.evaluate(()=>JSON.stringify(window.ReikaTailCompositionController.state));
 await page.locator('#tailImportJson').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from('{"version":999}')});
 await expect(page.locator('#tailAdvancedStatus')).toContainText('Недействительный');
 const after=await page.evaluate(()=>JSON.stringify(window.ReikaTailCompositionController.state));
 expect(after).toBe(before);
});
