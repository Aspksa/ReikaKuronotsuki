'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),chat=require('../prototype/chat.js');
test('offline response never claims AI backend',()=>assert.match(chat.respond('что нового'),/без подключения к нейросети/));
test('greetings have a response',()=>assert.match(chat.respond('Привет'),/Рэйка/));
test('history stays bounded and defensively copied',()=>{const s=chat.createStore();for(let i=0;i<50;i++)s.add('user',String(i));assert.equal(s.all.length,40);const items=s.all;items[0].text='changed';assert.notEqual(s.all[0].text,'changed');s.clear();assert.equal(s.all.length,0);});
test('messages trimmed and role validated',()=>{const s=chat.createStore();assert.equal(s.add('user','   '),false);assert.throws(()=>s.add('admin','test'),TypeError);assert.equal(chat.clean('x'.repeat(700)).length,500);});
