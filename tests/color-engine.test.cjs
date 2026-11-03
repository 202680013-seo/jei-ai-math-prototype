const assert=require('node:assert/strict');const E=require('../dist/admin/color-engine.js');
assert.equal(E.normalize('#abc'),'#aabbcc');assert.equal(E.normalize('xyz'),null);
assert.ok(Math.abs(E.contrast('#000000','#ffffff')-21)<1e-9);
let count=0;const samples=['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#00ffff','#ff00ff','#808080','#e5303a'];for(let i=0;i<1000;i++)samples.push('#'+((i*2654435761)>>>8).toString(16).padStart(6,'0'));
for(const h of samples){const back=E.hex(E.lch(h));for(const i of [1,3,5])assert.ok(Math.abs(parseInt(back.slice(i,i+2),16)-parseInt(h.slice(i,i+2),16))<=1);const p=E.palette(h);assert.equal(Object.keys(p).length,11);let last=2;for(const s of E.steps){const v=E.lch(p[s].hex);assert.ok(v[0]<last);last=v[0];assert.match(p[s].oklch,/^oklch\(/);assert.ok(E.contrast(p[s].hex,E.ink(p[s].hex))>=4.5);count++;}}
for(let L=.1;L<1;L+=.1)for(let h=0;h<360;h+=5){const v=E.map(L,.4,h);assert.ok(E.inGamut(E.toLinear(v)));assert.equal(v[0],L);assert.equal(v[2],h);assert.ok(v[1]<=.4);}
console.log(`PASS: ${samples.length} color roundtrips, ${count} palette steps, 648 gamut/hue checks`);
