'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('mouth responds to mood and blinking remains functional',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 const mouth=page.locator('#reikaMouth');
 await expect(mouth).toHaveCount(1);
 const neutral=await mouth.getAttribute('d');
 await page.locator('#mood').selectOption('happy');
 await expect.poll(()=>mouth.getAttribute('d')).not.toBe(neutral);
 await page.locator('#mood').selectOption('serious');
 await expect.poll(()=>mouth.getAttribute('d')).toBe(await page.evaluate(()=>window.ReikaExpressions.expression('serious').mouth));
 await page.locator('#blink').click();
 await expect.poll(()=>page.locator('.eyes').evaluate(el=>el.style.transform),{timeout:4000}).toContain('scaleY(');
 expect(errors).toEqual([]);
});
