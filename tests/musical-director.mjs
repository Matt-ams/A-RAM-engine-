/** Synthetic regression for whole-song event distribution, not listening QA. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/audio/musicalDirector.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const director=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const sr=8000,duration=74;
const beat=new Float32Array(sr*duration),lead=new Float32Array(beat.length),doubles=new Float32Array(beat.length),adlibs=new Float32Array(beat.length);
function voice(out,t0,len,amplitude,freq){
 const start=Math.floor(t0*sr),end=Math.min(out.length,Math.round((t0+len)*sr));
 for(let i=start;i<end;i++){
  const t=(i-start)/sr,fade=Math.max(0,Math.min(1,t/.055,(len-t)/.08));
  out[i]+=amplitude*fade*(.76*Math.sin(2*Math.PI*freq*t)+.24*Math.sin(2*Math.PI*freq*2.1*t));
 }
}
for(const t of [3,16,28,44,62])voice(lead,t,.9,.27,220);
for(const t of [10,32,53,69])voice(doubles,t,.78,.21,333);
for(const t of [13,57])voice(adlibs,t,.57,.19,460);
voice(adlibs,39,4.15,.19,460); // phrase-length onset rather than a one-word accent
for(let i=0;i<beat.length;i++){const t=i/sr,step=t%0.52;beat[i]=step<.065?.16*Math.sin(2*Math.PI*75*step)*(1-step/.065):0;}
const mix=new Float32Array(beat.length);
for(let i=0;i<mix.length;i++)mix[i]=beat[i]+lead[i]+doubles[i]+adlibs[i];
function wrap(data){return {sampleRate:sr,length:data.length,duration:data.length/sr,numberOfChannels:1,getChannelData:ch=>{assert.equal(ch,0);return data;}}}
const stems={lead:{buffer:wrap(lead),mute:false,solo:false},doubles:{buffer:wrap(doubles),mute:false,solo:false},adlibs:{buffer:wrap(adlibs),mute:false,solo:false}};
const source=wrap(mix),reference=mix.slice();
const events=director.scoutMusicalDirector(source,stems,'stems',15);
assert.ok(events.length>=8,'spread vocal events through song');
assert.ok(events.some(e=>e.at<16),'first section covered');
assert.ok(events.some(e=>e.at>32&&e.at<55),'middle sections covered');
assert.ok(events.some(e=>e.at>55),'late section covered');
assert.ok(events.every(e=>e.source==='lead'||e.source==='doubles'||e.source==='adlibs'),'never the beat');
assert.ok(events.some(e=>e.source==='adlibs'&&e.duration>=3),'retain a continuous multi-second vocal phrase');
assert.ok(events.every(e=>e.at>=0&&e.at+e.duration<duration+1&&e.duration>=.55&&e.duration<=6.5));
assert.deepEqual(events,director.scoutMusicalDirector(source,stems,'stems',15),'deterministic director');
assert.deepEqual(events.length<=15,true);
assert.deepEqual(mix,reference,'source untouched');
assert.deepEqual(director.scoutMusicalDirector(source,{},'stereo',15),[],'do not pretend stereo has reliable isolated stems');
console.log('whole-song director: synthetic distribution test OK',events.map(e=>e.at));
