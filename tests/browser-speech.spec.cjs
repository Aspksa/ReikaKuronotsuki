'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('speech controls appear, empty text is rejected, stop works',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);
 await expect(page.locator('#speechText')).toBeVisible();
 await page.locator('#speechPlay').click();
 await expect(page.locator('#speechStatus')).toContainText('Введите текст');
 await page.locator('#speechText').fill('Привет! Я Рэйка.');
 await page.locator('#speechStop').click();
 await expect(page.locator('#speechStatus')).toContainText('остановлена');
 expect(errors).toEqual([]);
});
