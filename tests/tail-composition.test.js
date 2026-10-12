'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),model=require('../prototype/tail-composition.js');
test('nine placement presets are valid and isolated',()=>{const a=model.defaults(),b=model.defaults();assert.equal(model.validate(a).length,9);a[0].x=99;assert.notEqual(b[0].x,99);});
test('z ordering must be a permutation',()=>{const a=model.defaults();a[0].z=a[1].z;assert.throws(()=>model.validate(a),RangeError);});
test('out of range and malformed placements fail',()=>{const a=model.defaults();a[1].rotation=181;assert.throws(()=>model.validate(a),RangeError);assert.throws(()=>model.validate(a.slice(1)),RangeError);});
test('validation returns copies',()=>{const a=model.defaults(),v=model.validate(a);v[0].x=91;assert.notEqual(a[0].x,91);});
