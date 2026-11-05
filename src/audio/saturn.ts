/**
 * SATURN LAB V0.1 — EXPERIMENTAL, OPT-IN POST-MASTER WET MOTION.
 *
 * The approved ENGINE master (TT2/TT3) is NOT re-mastered, re-EQ'd or
 * attenuated. SATURN builds strictly high-passed moving reflections as a
 * separate layer, then bounds only their contribution against output headroom.
 * Stereo motion can suggest depth; it is not discrete 3D or Dolby Atmos.
 */
import {orbitVoicePriorityGain,type OrbitStemMap,type OrbitSource} from './microOrbits';

export type SaturnPath =
 'slide-left-rear'|'slide-right-rear'|'rear-left-right'|'rear-right-left'|
 'rear-hover'|'rear-loop-cw'|'rear-loop-ccw'|'front-side-rear';
export type SaturnEvent={
 id:number;source:OrbitSource;at:number;duration:number;path:SaturnPath;level:number;
};
export type SaturnSettings={
 enabled:boolean;wet:number;depth:number;glide:number;trail:number;
 hrtf:boolean;matchHrtf:boolean;voicePriority:number;
};
export const SATURN_MAX_EVENTS=48;
export const saturnDefaults:SaturnSettings={
 enabled:false,wet:.38,depth:.82,glide:.74,trail:.44,
 hrtf:false,matchHrtf:true,voicePriority:.8
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const paths:SaturnPath[]=[
 'slide-left-rear','slide-right-rear','rear-left-right','rear-right-left',
 'rear-hover','rear-loop-cw','rear-loop-ccw','front-side-rear'
];
const sources:OrbitSource[]=['mix','lead','doubles','adlibs'];
export function validSaturnEvent(x:unknown):x is SaturnEvent{
 if(!x||typeof x!=='object')return false;
 const e=x as Partial<SaturnEvent>;
 return Number.isSafeInteger(e.id)&&Number.isFinite(e.at)&&e.at!>=0&&
  Number.isFinite(e.duration)&&e.duration!>=.15&&e.duration!<=3.2&&
  sources.includes(e.source as OrbitSource)&&paths.includes(e.path as SaturnPath)&&
  Number.isFinite(e.level)&&e.level!>=0&&e.level!<=1;
}
export function validSaturnSettings(x:unknown):x is SaturnSettings{
 if(!x||typeof x!=='object')return false;
 const s=x as Partial<SaturnSettings>;
 return typeof s.enabled==='boolean'&&typeof s.hrtf==='boolean'&&
  typeof s.matchHrtf==='boolean'&&
  (['wet','depth','glide','trail','voicePriority'] as const).every(k=>Number.isFinite(s[k])&&s[k]!>=0&&s[k]!<=1);
}
/** Paths are x in [-1,1], z negative-front / positive-rear. */
export function saturnPathPoints(path:SaturnPath,depth:number,glide:number):Array<[number,number]>{
 const d=.65+1.9*clamp(depth,0,1);
 const x=.52+.45*clamp(glide,0,1);
 switch(path){
 case 'slide-left-rear':return [[-.2,-.6],[-x,-.22],[-.9*x,d*.52],[-.65*x,d]];
 case 'slide-right-rear':return [[.2,-.6],[x,-.22],[.9*x,d*.52],[.65*x,d]];
 case 'rear-left-right':return [[-x,d],[-.54*x,d*1.06],[0,d*1.14],[.65*x,d],[x,d*.93]];
 case 'rear-right-left':return [[x,d],[.54*x,d*1.06],[0,d*1.14],[-.65*x,d],[-x,d*.93]];
 case 'rear-hover':return [[-.18,d*.9],[-.22,d*1.12],[.16,d*1.12],[.25,d*.96]];
 case 'rear-loop-cw':return [[0,d*.7],[x,d*.72],[.72*x,d*1.12],[0,d*1.2],[-x,d*.86],[0,d*.7]];
 case 'rear-loop-ccw':return [[0,d*.7],[-x,d*.72],[-.72*x,d*1.12],[0,d*1.2],[x,d*.86],[0,d*.7]];
 default:return [[0,-.7],[x*.82,-.35],[x,0],[x*.8,d*.55],[.1,d*1.12]];
 }
}
const scoreMoment=(buffer:AudioBuffer,t:number)=>{
 const sr=buffer.sampleRate,data=buffer.getChannelData(0);
 const first=Math.floor(t*sr),span=Math.min(Math.floor(.075*sr),buffer.length-first);
 if(span<160)return {score:0,energy:0};
 const stride=Math.max(1,Math.floor(span/300));
 let sum=0,delta=0,previous=data[first]||0,count=0;
 for(let i=first;i<first+span;i+=stride){
  const v=data[i]||0;
  sum+=v*v;delta+=Math.abs(v-previous);previous=v;count++;
 }
 const energy=Math.sqrt(sum/Math.max(1,count));
 return {energy,score:Math.log1p(energy*120)*(1+clamp(delta/Math.max(.001,count*energy),0,2)*1.8)};
};
/**
 * Ranked but time-diverse local signal heuristic, NOT voice recognition.
 * No BEAT stem is ever a source. In stereo mode MIX is only approximate.
 * Calling scout never alters PCM, presets or existing events.
 */
export function scoutSaturn(mix:AudioBuffer,stems:OrbitStemMap,mode:'stems'|'stereo',
 count=24,focusTime?:number,existing:SaturnEvent[]=[]):SaturnEvent[]{
 if(!mix||mix.duration<.8)return [];
 const n=clamp(Math.trunc(count)||24,1,Math.min(24,SATURN_MAX_EVENTS));
 const candidates:Array<{source:OrbitSource;buffer:AudioBuffer}>=[];
 const anySolo=Object.values(stems).some(s=>s?.buffer&&s.solo);
 if(mode==='stems')for(const source of ['adlibs','doubles','lead'] as const){
  const st=stems[source];
  if(st?.buffer&&!st.mute&&(!anySolo||st.solo))candidates.push({source,buffer:st.buffer});
 }
 if(!candidates.length)candidates.push({source:'mix',buffer:mix});
 const focus=Number.isFinite(focusTime);
 const start=focus?Math.max(.2,focusTime!-5):.2;
 const end=focus?Math.min(mix.duration-.5,focusTime!+5):mix.duration-.5;
 if(end<=start)return [];
 const hits:Array<{source:OrbitSource;time:number;score:number}>=[];
 for(const {source,buffer} of candidates){
  const finish=Math.min(end,buffer.duration-.4);
  for(let t=start;t<finish;t+=.115){
   const {energy,score}=scoreMoment(buffer,t);
   if(energy<.0017)continue;
   const preference=source==='adlibs'?1.7:source==='doubles'?1.4:source==='lead'?.92:.53;
   hits.push({source,time:t,score:score*preference});
  }
 }
 if(!hits.length)return [];
 hits.sort((a,b)=>b.score-a.score||a.time-b.time);
 // Favor different song sections rather than crowding one loud chorus.
 const buckets=new Map<number,typeof hits[number]>();
 const slice=focus?1.15:Math.max(2.2,(end-start)/Math.max(8,n));
 for(const hit of hits){
  const key=Math.floor((hit.time-start)/slice);
  if(!buckets.has(key))buckets.set(key,hit);
 }
 const primary=[...buckets.values()].sort((a,b)=>b.score-a.score);
 const ordered=[...primary,...hits];
 const chosen:typeof hits=[];
 const spacing=focus?.27:Math.min(1.2,Math.max(.43,(end-start)/Math.max(24,n*8)));
 for(const candidate of ordered){
  const duplicate=existing.some(e=>e.source===candidate.source&&Math.abs(e.at-candidate.time)<Math.max(.27,spacing));
  if(duplicate)continue;
  if(chosen.some(e=>e.source===candidate.source&&Math.abs(e.time-candidate.time)<spacing))continue;
  if(chosen.some(e=>Math.abs(e.time-candidate.time)<.18))continue;
  chosen.push(candidate);
  if(chosen.length>=n)break;
 }
 chosen.sort((a,b)=>a.time-b.time);
 return chosen.map((e,i)=>({
  id:i+1,source:e.source,at:Math.round(e.time*100)/100,
  duration:e.source==='lead'?.58:e.source==='mix'?.35:.7,
  path:paths[i%paths.length],level:e.source==='mix'?.48:.72
 }));
}
const glideParam=(param:AudioParam,values:number[],at:number,duration:number)=>{
 param.setValueAtTime(values[0],at);
 for(let i=1;i<values.length;i++)
  param.linearRampToValueAtTime(values[i],at+duration*i/(values.length-1));
};
async function renderWet(master:AudioBuffer,stems:OrbitStemMap,events:SaturnEvent[],
 settings:SaturnSettings,hrtf:boolean):Promise<AudioBuffer>{
 const ctx=new OfflineAudioContext(2,master.length,master.sampleRate);
 const anySolo=Object.values(stems).some(st=>st?.buffer&&st.solo);
 for(const event of events){
  const st=event.source==='mix'?null:stems[event.source];
  if(event.source!=='mix'&&(!st?.buffer||st.mute||(anySolo&&!st.solo)))continue;
  const buf=st?.buffer??master;
  const at=event.at,d=Math.min(event.duration,buf.duration-at,master.duration-at);
  if(d<.15)continue;
  const fragment=ctx.createBufferSource();fragment.buffer=buf;
  const high=ctx.createBiquadFilter();high.type='highpass';
  // Never route kick/sub frequencies, even when only the stereo mix is available.
  high.frequency.value=event.source==='mix'?1700:event.source==='lead'?650:900;
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=event.source==='lead'?6200:7800;
  const env=ctx.createGain();
  const rise=Math.min(.055,d*.24),fall=Math.min(.14,d*.33);
  env.gain.setValueAtTime(0,at);
  env.gain.linearRampToValueAtTime(1,at+rise);
  env.gain.setValueAtTime(1,Math.max(at+rise,at+d-fall));
  env.gain.linearRampToValueAtTime(0,at+d);
  const pre=ctx.createGain();
  pre.gain.value=.105*clamp(event.level,0,1)*clamp(settings.wet,0,1);
  const depthDelay=ctx.createDelay(.25);
  depthDelay.delayTime.value=.028+settings.depth*.062;
  fragment.connect(high).connect(low).connect(env).connect(depthDelay).connect(pre);
  const lead=stems.lead&&!stems.lead.mute&&(!anySolo||stems.lead.solo)?stems.lead.buffer:null;
  if(lead&&settings.voicePriority>0){
   const slices=Math.max(1,Math.ceil(d/.035));
   for(let k=0;k<=slices;k++){
    const time=at+d*k/slices;
    const gain=orbitVoicePriorityGain(lead,time,settings.voicePriority,event.source==='lead');
    if(k===0)pre.gain.setValueAtTime(pre.gain.value*gain,time);
    else pre.gain.linearRampToValueAtTime(.105*event.level*settings.wet*gain,time);
   }
  }
  const points=saturnPathPoints(event.path,settings.depth,settings.glide);
  const begin=at+depthDelay.delayTime.value;
  const motionDur=d;
  if(hrtf){
   const panner=ctx.createPanner();
   panner.panningModel='HRTF';panner.distanceModel='inverse';
   panner.refDistance=1;panner.maxDistance=20;panner.rolloffFactor=0;
   panner.coneInnerAngle=360;panner.positionY.value=0;
   glideParam(panner.positionX,points.map(p=>p[0]*1.3),begin,motionDur);
   glideParam(panner.positionZ,points.map(p=>p[1]),begin,motionDur);
   pre.connect(panner).connect(ctx.destination);
  }else{
   const pan=ctx.createStereoPanner();
   glideParam(pan.pan,points.map(p=>clamp(p[0],-.96,.96)),begin,motionDur);
   pre.connect(pan).connect(ctx.destination);
  }
  // The delayed reflection's extra persistence conveys rear depth without moving dry sources.
  if(settings.trail>0){
   const tailDelay=ctx.createDelay(.5);
   tailDelay.delayTime.value=.10+settings.depth*.105;
   const trailFilter=ctx.createBiquadFilter();trailFilter.type='lowpass';
   trailFilter.frequency.value=2300+2600*(1-settings.depth);
   const tailGain=ctx.createGain();tailGain.gain.value=settings.trail*.32;
   const tailPan=ctx.createStereoPanner();
   tailPan.pan.value=clamp(points[points.length-1][0]*-.65,-.9,.9);
   env.connect(tailDelay).connect(trailFilter).connect(tailGain).connect(tailPan).connect(ctx.destination);
   // The tail is also wet, and subject to the same global amount.
   tailGain.gain.value*=.105*event.level*settings.wet;
  }
  fragment.start(at,at,d);
 }
 return ctx.startRendering();
}
const rmsStereo=(buffer:AudioBuffer)=>{
 let squares=0;
 for(let c=0;c<Math.min(2,buffer.numberOfChannels);c++){
  const x=buffer.getChannelData(c);
  for(let i=0;i<x.length;i++)squares+=x[i]*x[i];
 }
 return Math.sqrt(squares/(buffer.length*Math.min(2,buffer.numberOfChannels)));
};
export type SaturnReport={wetHrtfCorrection:number;limitedSamples:number;peak:number};
/** The reference master is read-only. No global gain, EQ or compression of dry.
 * HRTF calibration changes only SATURN's wet reflections, bounded to +/- 4dB.
 * The last wet-only safety bound does not clip or lower dry, even near the ceiling.
 */
export async function renderSaturn(master:AudioBuffer,stems:OrbitStemMap,
 events:SaturnEvent[],settings:SaturnSettings):Promise<AudioBuffer>{
 if(!settings.enabled||settings.wet<=0||events.length===0)return master;
 const valid=events.filter(e=>validSaturnEvent(e)&&e.at<master.duration-.15).slice(0,SATURN_MAX_EVENTS);
 if(!valid.length)return master;
 const wet=await renderWet(master,stems,valid,settings,settings.hrtf);
 let compensation=1;
 if(settings.hrtf&&settings.matchHrtf){
  const ref=await renderWet(master,stems,valid,settings,false);
  const a=rmsStereo(ref),b=rmsStereo(wet);
  if(a>1e-7&&b>1e-7)compensation=clamp(a/b,Math.pow(10,-4/20),Math.pow(10,4/20));
 }
 const ctx=new OfflineAudioContext(Math.min(2,master.numberOfChannels),master.length,master.sampleRate);
 const output=ctx.createBuffer(Math.min(2,master.numberOfChannels),master.length,master.sampleRate);
 const channels=output.numberOfChannels;
 for(let ch=0;ch<channels;ch++){
  const dry=master.getChannelData(ch),w=wet.getChannelData(ch),dest=output.getChannelData(ch);
  for(let i=0;i<dry.length;i++){
   const addition=w[i]*compensation;
   // Never lower or reprocess the approved original sample. Restrict ONLY wet signal.
   const available=Math.max(0,.985-Math.abs(dry[i]));
   const bounded=clamp(addition,-available,available);
   dest[i]=dry[i]+bounded;
  }
 }
 return output;
}
