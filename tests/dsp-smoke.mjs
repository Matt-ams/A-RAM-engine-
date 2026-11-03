import assert from 'node:assert/strict';
globalThis.AudioBuffer=class AudioBuffer{
 constructor({length,numberOfChannels,sampleRate}){this.length=length;this.numberOfChannels=numberOfChannels;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length))}
 getChannelData(c){return this.channels[c]}
};
const {linkedDynamics,dynamicsDefaults}=await import('../.dsp-test/dynamics.mjs');
const {spectralDenoise,denoiseDefaults}=await import('../.dsp-test/denoise.mjs');
const {superboostRoom}=await import('../.dsp-test/superboost.mjs');
const {studioQuality}=await import('../.dsp-test/studioQuality.mjs');
const sr=16000,n=8192,src=new AudioBuffer({length:n,numberOfChannels:2,sampleRate:sr});
for(let i=0;i<n;i++){const t=i/sr,noise=.016*Math.sin(2*Math.PI*1300*t),music=i<3200?0:.5*Math.sin(2*Math.PI*300*t);src.getChannelData(0)[i]=noise+music;src.getChannelData(1)[i]=noise+.76*music}
const before=src.getChannelData(0).slice();
function finite(b){for(let c=0;c<b.numberOfChannels;c++)for(let i=0;i<b.length;i++)assert(Number.isFinite(b.getChannelData(c)[i]));}
const transparent=linkedDynamics(src,-26,1,.03,.2,dynamicsDefaults);
for(let i=0;i<n;i++)assert(Math.abs(transparent.buffer.getChannelData(0)[i]-before[i])<1e-8);
const d=linkedDynamics(src,-30,2.4,.025,.2,dynamicsDefaults);finite(d.buffer);
assert(d.report.peakGrDb>0,'compressor must measure real gain reduction');
assert(d.report.peakGrDb<=dynamicsDefaults.maxReduction+1e-6);
const off=spectralDenoise(src,denoiseDefaults,true);
assert.equal(off.buffer,src,'OFF denoiser is exact bypass');
const settings={enabled:true,reduction:.55,preserve:.7,start:.02,end:.18};
const noise=spectralDenoise(src,settings,true);finite(noise.buffer);finite(noise.removed);
for(let i=0;i<n;i++)assert(Math.abs(noise.buffer.getChannelData(0)[i]+noise.removed.getChannelData(0)[i]-src.getChannelData(0)[i])<1e-6,'audition must be removed-only signal');
assert.deepEqual(src.getChannelData(0),before,'source must not mutate');
assert.equal(await superboostRoom(src,0,.3),src,'off room bypass');
const room=await superboostRoom(src,.85,.25);finite(room);
const quality=studioQuality(room);finite(quality);
const mono=new AudioBuffer({length:n,numberOfChannels:1,sampleRate:sr});
mono.getChannelData(0).fill(.1);const dc=studioQuality(mono);finite(dc);
const tailMean=dc.getChannelData(0).subarray(n-1000).reduce((a,b)=>a+b,0)/1000;
assert(Math.abs(tailMean)<.03,'DC-block should reject sustained DC');
console.log('PASS 10 DSP invariants: bypass, dynamics GR, denoise profile/audition, stereo/mono, DC, immutability');
