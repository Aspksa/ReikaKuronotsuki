'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('offline chat responds and clears',async({page})=>{
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);
await page.locator('#chatInput').fill('Привет');
await page.locator('#chatSend').click();
await expect(page.locator('#chatHistory .chat-line')).toHaveCount(2);
await expect(page.locator('#chatHistory')).toContainText('Рэйка');
await page.locator('#chatClear').click();
await expect(page.locator('#chatHistory .chat-line')).toHaveCount(0);
expect(errors).toEqual([]);
});
