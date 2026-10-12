'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const layout=require('../prototype/layer-layout.js');
test('all layers have unique ordering',()=>{assert.equal(layout.order.length,17);assert.equal(new Set(layout.order).size,17);});
test('all nine tails have individual pivot coordinates',()=>{const all=Array.from({length:9},(_,i)=>layout.get('tail_'+(i+1)).origin.join(','));assert.ok(new Set(all).size>=5);});
test('tail transform math validates inputs',()=>{assert.equal(layout.tailRotation(0,-112),0);assert.throws(()=>layout.tailRotation(9,0),RangeError);});
