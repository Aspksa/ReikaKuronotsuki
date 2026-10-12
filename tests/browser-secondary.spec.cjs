'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('secondary motion updates ears and breathing without page errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await expect(page.locator('#tails > g')).toHaveCount(9);
 expect(await page.evaluate(()=>typeof window.ReikaSecondaryMotion.step)).toBe('function');
 await expect.poll(()=>page.locator('#body').getAttribute('transform')).toContain('scale(1 ');
 await expect.poll(()=>page.locator('.ear.left').evaluate(el=>el.style.transform)).toContain('rotate(');
 expect(errors).toEqual([]);
});
test('zero motion produces no procedural breathing',async({page})=>{
 await page.goto(url);
 await page.locator('#motion').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.locator('#body').getAttribute('transform')).toContain('scale(1)');
});
