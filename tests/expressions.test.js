'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const face=require('../prototype/expressions.js');
test('five moods have unique mouth shapes',()=>assert.equal(new Set(Object.values(face.MOUTHS)).size,5));
test('unknown mood uses neutral mouth',()=>assert.equal(face.expression('nope').mouth,face.expression('neutral').mouth));
test('expression eyelid scale remains visible',()=>{for(const mood of Object.keys(face.MOUTHS)){const e=face.expression(mood);assert.ok(e.eyeScale>0&&e.eyeScale<=1);}});
test('periodic blinks are deterministic',()=>{assert.equal(face.blink(4.15),true);assert.equal(face.blink(2),false);});
