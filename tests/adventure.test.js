'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),A=require('../src/adventure.js');
test('seven original islands each have art and a learning dialogue',()=>{assert.equal(A.stories.length,7);for(let i=0;i<7;i++){assert.equal(A.stories[i].length,3);assert.match(A.island(i),/<svg/);assert.ok(!A.island(i).includes('undefined'));}});
test('both original guides render, without external assets or storage changes',()=>{for(const k of ['sprout','butterfly'])assert.match(A.buddy(k),/<svg/);const s=fs.readFileSync('src/adventure.js','utf8');assert.doesNotMatch(s,/localStorage|fetch\(|https?:|Math.random/);});
test('island adventures retain original concept learning entry and daily plan',()=>{const s=fs.readFileSync('src/app.html','utf8');assert.match(s,/openIsland\(cid\)/);assert.match(s,/d.remove\(\);renderConcept\(cid\)/);assert.match(s,/id="goAll"/);assert.match(s,/src\/adventure.js/);});
