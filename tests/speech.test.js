'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),s=require('../prototype/speech.js');
test('speech input normalized and capped',()=>{assert.equal(s.normalizeText(' hello '),'hello');assert.equal(s.normalizeText('x'.repeat(700)).length,500);});
test('lip controller lifecycle',()=>{const c=s.createController();assert.equal(c.open,false);c.start();assert.equal(c.open,true);c.boundary();assert.equal(c.open,false);c.stop();assert.equal(c.active,false);});
test('speech mouth path provided only for open state',()=>{assert.equal(s.mouthPath(false),null);assert.match(s.mouthPath(true),/^M/);});
