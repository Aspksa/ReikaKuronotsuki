'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),v=require('../prototype/layer-validation.js');
test('exactly nine unique tail layer names',()=>{const t=v.PARTS.filter(x=>x.startsWith('tail_'));assert.equal(t.length,9);assert.equal(new Set(t).size,9);});
test('accepted case-insensitive exported names',()=>{assert.equal(v.match('reika_tail_9.PNG'),'tail_9');assert.equal(v.match('reika_eye_left.png'),'eye_left');});
test('reject unrecognized paths and file types',()=>{assert.equal(v.match('other.png'),null);assert.equal(v.validate({name:'reika_tail_1.png',type:'image/jpeg',size:100},{width:100,height:100}).ok,false);});
test('verify PNG dimensions and size',()=>{const f={name:'reika_tail_1.png',type:'image/png',size:120};assert.equal(v.validate(f,{width:2048,height:2048}).ok,true);assert.equal(v.validate(f,{width:0,height:2048}).ok,false);});
test('pivots differ by body part',()=>{assert.notDeepEqual(v.pivot('tail_1'),v.pivot('ear_left'));assert.deepEqual(v.pivot('tail_9'),[50,65]);});
