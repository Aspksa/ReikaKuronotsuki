'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),physics=require('../prototype/physics.js');
test('nine independent spring states converge',()=>{const p=physics.create();const target=[20,0,0,0,0,0,0,0,0];for(let i=0;i<120;i++)physics.step(p,target,1/60);assert.ok(Math.abs(p.angles[0]-20)<.2);assert.deepEqual(p.angles.slice(1),Array(8).fill(0));});
test('reduced motion snaps and clears velocity',()=>{const p=physics.create();physics.step(p,Array(9).fill(12),.05);physics.step(p,Array(9).fill(8),.01,{enabled:false});assert.deepEqual(p.angles,Array(9).fill(8));assert.deepEqual(p.velocities,Array(9).fill(0));});
test('reject malformed targets and negative delta',()=>{const p=physics.create();assert.throws(()=>physics.step(p,[1],.01),TypeError);assert.throws(()=>physics.step(p,Array(9).fill(0),-.1),RangeError);});
test('large frame delta remains bounded',()=>{const p=physics.create();for(let i=0;i<30;i++)physics.step(p,Array(9).fill(25),.4);assert.ok(p.angles.every(Number.isFinite));});
