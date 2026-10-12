const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const pageUrl=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('SVG render, nine tails and controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pageUrl);
 await expect(page.locator('#tails > g')).toHaveCount(9);
 await expect(page.locator('#playerFiles')).toBeVisible();
 await page.locator('#mood').selectOption('magic');
 await expect(page.locator('#status')).toContainText('Магия');
 await page.locator('#tailIndex').selectOption('8');
 await page.locator('#tailOffset').fill('17');
 await page.locator('#tailOffset').dispatchEvent('input');
 await expect.poll(()=>page.locator('#tails > g').nth(8).getAttribute('transform')).toContain('rotate(');
 await page.locator('#toggle').click();
 await expect(page.locator('#toggle')).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});
test('portrait upload, compare, remove',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pageUrl);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
 await page.locator('#portraitFile').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#portraitInfo')).toContainText('Локальный портрет');
 await page.locator('#displayMode').selectOption('compare');
 await expect(page.locator('.portrait-gallery')).toBeVisible();
 await page.locator('.portrait-toolbar button').click();
 await expect(page.locator('#displayMode')).toHaveValue('vector');
 expect(errors).toEqual([]);
});
test('layer import rejects invalid names without crashing',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pageUrl);
 await page.locator('#playerFiles').setInputFiles({name:'unknown.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
 await expect(page.locator('#playerStatus')).toContainText('Пропущено файлов: 1');
 expect(errors).toEqual([]);
});
