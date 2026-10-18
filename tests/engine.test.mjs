import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {status,overlaps,campusNow,validateImport} from '../dist/engine.mjs';
const room={id:'L21'},events=[{rooms:['L21'],day:1,start:600,end:660,text:'Class'}];
test('interval boundaries are start inclusive and end exclusive',()=>{assert.equal(overlaps(540,600,600,660),false);assert.equal(overlaps(660,720,600,660),false);assert.equal(overlaps(590,610,600,660),true)});
test('a class anywhere in a requested stay excludes a schedule gap',()=>{assert.equal(status(room,events,'2026-10-19',540,120).kind,'busy');assert.equal(status(room,events,'2026-10-19',540,60).kind,'free');assert.equal(status(room,events,'2026-10-19',660,60).kind,'free')});
test('weekends, out of source dates, and unreviewed hours are unknown',()=>{for(const [date,start,duration] of [['2026-10-18',600,60],['2026-10-17',600,60],['2026-10-08',600,60],['2027-01-04',600,60],['2026-10-19',1080,60]])assert.equal(status(room,events,date,start,duration).kind,'unknown')});
test('invalid and cross midnight requests cannot produce free claims',()=>{for(const [start,duration] of [[600,0],[-1,60],[1430,60],[600,-10],[NaN,60]])assert.equal(status(room,events,'2026-10-19',start,duration).kind,'unknown')});
test('campus time uses IST independently of host timezone',()=>{assert.deepEqual(campusNow(new Date('2026-10-18T20:00:00Z')),{date:'2026-10-19',minutes:90})});
test('import validation rejects invalid rows and deduplicates unchanged events',()=>{assert.equal(validateImport([...events,...events]).length,1);assert.throws(()=>validateImport([{...events[0],end:500}]));assert.throws(()=>validateImport({}))});
test('normalized data has valid intervals, unique ids, source provenance and mapped rooms',()=>{const d=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));const ids=new Set(d.rooms.map(r=>r.id));assert.equal(new Set(d.events.map(e=>e.id)).size,d.events.length);assert.equal(validateImport(d.events).length,d.events.length);for(const e of d.events){assert.ok(e.rooms.every(r=>ids.has(r)));assert.ok(d.sources.some(s=>s.page===e.page));assert.ok(e.text)}assert.equal(d.events.length+d.unresolved.length,d.cellCount)});

test('malformed calendar dates remain unknown',()=>{for(const date of ['2026-99-99','2026-11-31','bad'])assert.equal(status(room,events,date,600,60).kind,'unknown')});
