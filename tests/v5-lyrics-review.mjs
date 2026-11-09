import assert from 'node:assert/strict';
import {build} from 'esbuild';
const code=await build({entryPoints:['src/audio/lyricsIntelligence.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const v5=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
const lrc=v5.parseTimedLyrics('[00:10.00]Nevermind\n[00:21.20]Sounds like a bound that erases your fear\n[00:29.50]Yeah yeah',180);
assert.equal(lrc.length,3);
assert.deepEqual(lrc.map(x=>x.start),[10,21.2,29.5]);
assert.deepEqual(lrc.map(x=>x.text),['Nevermind','Sounds like a bound that erases your fear','Yeah yeah']);
assert.ok(lrc.every(x=>x.reviewed&&x.origin==='lrc'&&v5.safeLyricCandidate(x,180)));
const words=[{text:'Sounds',start:.4,end:.9},{text:'like',start:1,end:1.4},{text:'a',start:1.41,end:1.63},
 {text:'bound',start:1.64,end:2.15},{text:'that',start:2.2,end:2.6},{text:'erases',start:2.65,end:3.3},
 {text:'your',start:3.4,end:3.72},{text:'fear.',start:3.8,end:4.45},
 {text:'Nevermind',start:8.2,end:9.1}];
const out=v5.groupTranscriptWords(words,30,180);
assert.equal(out.length,2,'word gaps split long phrase into separate passages');
assert.equal(out[0].text,'Sounds like a bound that erases your fear.');
assert.ok(out[0].end-out[0].start>3);
assert.equal(out[0].reviewed,false,'ASR cannot auto-approve');
assert.equal(out[0].start,30.4);
assert.ok(out.every(x=>v5.safeLyricCandidate(x,180)));
assert.ok(out.every(x=>x.origin==='asr'));
const orbit=v5.lyricToOrbit({...out[0],reviewed:true},99,'lead',180);
assert.equal(orbit.source,'lead');assert.ok(orbit.duration>3&&orbit.duration<=6.5);assert.equal(orbit.note,out[0].text);
assert.equal(v5.safeLyricCandidate({...out[0],start:-1},180),false);
assert.equal(v5.safeLyricCandidate({...out[0],text:''},180),false);
assert.equal(v5.safeLyricCandidate({...out[0],end:999},180),false);
assert.deepEqual(v5.groupTranscriptWords([{text:'hallucination',start:10,end:4}],0,100),[]);
console.log('V5 lyric review gate: LRC, transcript grouping, manual approval, timestamps PASS');
