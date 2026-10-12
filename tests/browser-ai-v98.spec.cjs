'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('AI mode opt in and offline fallback when no server',async({page})=>{await page.goto(url);await expect(page.locator('#chatMode')).toHaveValue('offline');await page.locator('#chatMode').selectOption('ai');await page.locator('#chatInput').fill('Привет');await page.locator('#chatSend').click();await expect(page.locator('#chatStatus')).toContainText('AI недоступен');await expect(page.locator('#chatHistory .chat-line')).toHaveCount(2);});
test('AI client module and local behavior remain available',async({page})=>{await page.goto(url);expect(await page.evaluate(()=>typeof window.ReikaAI.ask)).toBe('function');await page.locator('#chatInput').fill('Привет');await page.locator('#chatSend').click();await expect(page.locator('#chatStatus')).toContainText('локально');});
