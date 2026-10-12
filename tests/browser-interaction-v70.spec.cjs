'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('chat reply drives optional temporary expression and can be disabled',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.locator('#chatInput').fill('Привет');
 await page.locator('#chatSend').click();
 await expect(page.locator('#interactionStatus')).toContainText('happy');
 expect(await page.evaluate(()=>window.ReikaInteractionController.currentMood('neutral'))).toBe('happy');
 await page.locator('#interactionAutoMood').uncheck();
 expect(await page.evaluate(()=>window.ReikaInteractionController.currentMood('neutral'))).toBe('neutral');
 await page.locator('#interactionClear').click();
 await expect(page.locator('#interactionStatus')).toContainText('сброшена');
 expect(errors).toEqual([]);
});
test('speech customization and auto speak are off by default',async({page})=>{
 await page.goto(url);await expect(page.locator('#speechRate')).toHaveValue('1');
 await expect(page.locator('#speechPitch')).toHaveValue('1');
 await expect(page.locator('#interactionAutoSpeak')).not.toBeChecked();
 await page.locator('#interactionMouthMotion').uncheck();
 expect(await page.evaluate(()=>window.ReikaInteractionController.mouthOpen())).toBe(false);
});
