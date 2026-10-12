'use strict';
const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../prototype/index.html')).href;
test('tail spring physics loads and nine tails animate',async({page})=>{
const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url);
await expect(page.locator('#tails > g')).toHaveCount(9);
expect(await page.evaluate(()=>typeof window.ReikaPhysics.step)).toBe('function');
await expect.poll(()=>page.locator('#tails > g').first().getAttribute('transform')).toContain('rotate(');
expect(errors).toEqual([]);
});
test('reduced motion allows static tail positions',async({browser})=>{
const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
await page.goto(url);await expect(page.locator('#toggle')).toHaveAttribute('aria-pressed','true');
const old=await page.locator('#tails > g').first().getAttribute('transform');
await page.waitForTimeout(160);
expect(await page.locator('#tails > g').first().getAttribute('transform')).toBe(old);
await context.close();
});
