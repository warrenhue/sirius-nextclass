'use strict';
var assert = require('assert'), core = require('./nextclass.js');
function row(date,time,subject,group) { return {section_type:'group',target:group || 'К0409-23',date:date,start_time:time,discipline:subject,classroom:'101'}; }
var group = 'К0409-23';
var now = new Date('2026-10-22T09:00:00Z'); // 12:00 Moscow
var a = row('22.10.2026','12:30','A');
var b = row('22.10.2026','12:30','B');
assert.deepStrictEqual(core.nextLessons([row('22.10.2026','11:00','past'),a,a,b,row('22.10.2026','12:10','wrong','К0409-231')],group,now),[a,b]);
assert.strictEqual(core.moscowDate(new Date('2026-10-22T22:00:00Z')),'23.10.2026');
assert.strictEqual(core.start(a),Date.parse('2026-10-22T09:30:00Z'));
assert.ok(Number.isNaN(core.start(row('31.02.2026','12:00','bad'))));
assert.ok(Number.isNaN(core.start(row('22.10.2026','99:00','bad'))));
assert.strictEqual(core.nextLessons([a],group,new Date('2026-10-22T09:30:00.001Z')).length,0);
assert.strictEqual(core.nextLessons([row('26.10.2026','08:30','Monday')],group,new Date('2026-10-23T20:00:00Z'))[0].discipline,'Monday');
assert.deepStrictEqual(core.nextLessons([],group,now),[]);
console.log('8 checks passed');
