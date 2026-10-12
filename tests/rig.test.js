'use strict';
const assert=require('node:assert/strict');const test=require('node:test');
const {COUNT,DEFAULTS,normalize,sample}=require('../prototype/rig.js');
test('nine distinct tail transforms at idle',()=>{assert.equal(COUNT,9);const p=sample(0,DEFAULTS);assert.equal(p.tails.length,9);assert.equal(new Set(p.tails.map(Math.round)).size,9);});
test('sample deterministic at same time and settings',()=>{assert.deepEqual(sample(1.5,DEFAULTS),sample(1.5,DEFAULTS));});
test('normalize invalid settings and clamp extremes',()=>{const n=normalize({mood:'bad',motion:900,speed:-5,ears:999,hair:-2,eyes:300,tailOffsets:[900]});assert.equal(n.mood,'neutral');assert.equal(n.motion,100);assert.equal(n.speed,20);assert.equal(n.ears,100);assert.equal(n.hair,0);assert.equal(n.eyes,100);assert.equal(n.tailOffsets[0],30);assert.equal(n.tailOffsets.length,9);});
test('each tail offset changes just its own output',()=>{const a=sample(1,DEFAULTS);const b=sample(1,{...DEFAULTS,tailOffsets:[0,0,7]});for(let i=0;i<9;i++)assert.equal(b.tails[i]-a.tails[i],i===2?7:0);});
test('zero motion means no procedural sway',()=>{const s=normalize({...DEFAULTS,motion:0});assert.deepEqual(sample(0,s).tails,sample(13,s).tails);});
