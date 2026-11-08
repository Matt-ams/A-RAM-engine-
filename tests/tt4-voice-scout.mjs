/** Mechanical sanity check for TT4-style vocal phrase detection.
 * Synthetic voice envelopes only. Not proof of intelligibility or musicality.
 */
import fs from 'node:fs';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
const src=fs.readFileSync('src/audio/microOrbits.ts','utf8');
const {code}=await transform(src,{loader:'ts',format:'esm'});
const audio=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(audio.ORBIT_MAX_EVENTS,48);
const sr=8000,duration=55;
const pcm=new Float32Array(duration*sr);
const phrases=[{at:2.8,len:1.05},{at:10.25,len:.65},{at:23.5,len:1.38},{at:42,len:1.65}];
for(const {at,len} of phrases){
 const start=Math.floor(at*sr),end=Math.min(pcm.length,Math.round((at+len)*sr));
 for(let i=start;i<end;i++){
  const t=(i-start)/sr,e=Math.min(1,t/.075,(len-t)/.075);
  pcm[i]=Math.max(0,e)*(.31*Math.sin(2*Math.PI*205*t)+.13*Math.sin(2*Math.PI*445*t));
 }
}
const wrap=(x)=>({sampleRate:sr,length:x.length,duration:x.length/sr,numberOfChannels:1,getChannelData:(ch)=>{assert.equal(ch,0);return x;}});
const lead=wrap(pcm),mix=wrap(new Float32Array(pcm.length));
const stems={lead:{buffer:lead,mute:false,solo:false}};
const source=pcm.slice();
const out=audio.scoutVocalPhrases(mix,stems,'stems',18);
assert.ok(out.length>=3,'vocal scout should find at least three of four vocal phrases');
for(const {at} of phrases){
 assert.ok(out.some(e=>Math.abs(e.at-at)<.23),'missing phrase near '+at);
}
assert.ok(out.every(e=>e.source==='lead'&&e.duration>=.15&&e.duration<=2.4));
assert.deepEqual(out,audio.scoutVocalPhrases(mix,stems,'stems',18),'determinism');
assert.deepEqual(pcm,source,'scout must not touch source PCM');
const focussed=audio.scoutVocalPhrases(mix,stems,'stems',7,42);
assert.ok(focussed.length>=1&&focussed.every(e=>Math.abs(e.at-42)<4),'focused scan window');
console.log('TT4 vocal phrase scout: synthetic event tests OK',out.map(e=>e.at));
