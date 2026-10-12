'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),m=require('../prototype/secondary-motion.js');
test('breathing changes gently and stops with motion disabled',()=>{assert.equal(m.sample(1,{motion:0}).breath,1);assert.ok(Math.abs(m.sample(1,{motion:100}).breath-1)<.01);});
test('secondary motion converges and can be disabled',()=>{const state=m.create(),target={leftEar:8,rightEar:-8,hairX:4,headY:2,breath:1.004};for(let i=0;i<90;i++)m.step(state,target,1/60);assert.ok(Math.abs(state.leftEar-8)<.01);m.step(state,{...target,leftEar:0},.02,{enabled:false});assert.equal(state.leftEar,0);});
test('invalid delta rejected',()=>assert.throws(()=>m.step(m.create(),m.create(),-1),RangeError));
