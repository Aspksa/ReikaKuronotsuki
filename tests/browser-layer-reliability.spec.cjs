'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('replacement layers can change resolution when no other layer is loaded',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const png=async(size)=>Buffer.from(await page.evaluate(n=>{const c=document.createElement('canvas');c.width=c.height=n;c.getContext('2d').fillRect(0,0,n,n);return c.toDataURL('image/png').split(',')[1];},size),'base64');
 await page.locator('#playerFiles').setInputFiles({name:'reika_tail_1.png',mimeType:'image/png',buffer:await png(2)});
 await expect(page.locator('#playerSurface img')).toHaveCount(1);
 await page.locator('#playerFiles').setInputFiles({name:'reika_tail_1.png',mimeType:'image/png',buffer:await png(4)});
 await expect(page.locator('#playerSurface img')).toHaveCount(1);
 await expect(page.locator('#playerStatus')).toContainText('1 / 17');
 await page.locator('#playerFiles').setInputFiles({name:'reika_tail_2.png',mimeType:'image/png',buffer:await png(2)});
 await expect(page.locator('#playerStatus')).toContainText('Пропущено файлов: 1');
 await expect(page.locator('#playerSurface img')).toHaveCount(1);
 expect(errors).toEqual([]);
});
test('play button announces paused state',async({page})=>{
 await page.goto(url);
 await expect(page.locator('#playerStart')).toHaveAttribute('aria-pressed','true');
 await page.locator('#playerStart').click();
 await expect(page.locator('#playerStart')).toHaveAttribute('aria-pressed','false');
});
