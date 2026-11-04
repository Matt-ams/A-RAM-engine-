/** REAR ORBITS — optional, wet-only micro-event spatial motion.
 * Independent of ROOM V4.1 / V4.2 / V4.3, which must remain unchanged.
 * A small, filtered COPY of a short chosen fragment moves behind the listener.
 * No source separation, no generative AI, no Dolby Atmos certification.
 */
export type OrbitSource='mix'|'lead'|'doubles'|'adlibs';
export type OrbitPath='left-rear-right'|'right-rear-left'|'rear-drift-left'|'rear-drift-right'|'front-left-right'|'front-right-left'|'front-to-rear-left'|'front-to-rear-right'|'rear-to-front-left'|'rear-to-front-right'|'full-orbit-cw'|'full-orbit-ccw';
export type OrbitBand='detail'|'voice';
export type OrbitEvent={id:number;source:OrbitSource;at:number;duration:number;path:OrbitPath;band:OrbitBand;level:number};
export type OrbitSettings={enabled:boolean;amount:number;rear:number;hrtf:boolean;motion?:number;trail?:number};
export type OrbitStem={buffer:AudioBuffer|null;mute:boolean;solo:boolean};
export type OrbitStemMap=Partial<Record<Exclude<OrbitSource,'mix'>,OrbitStem>>;
export const orbitDefaults:OrbitSettings={enabled:false,amount:.4,rear:.78,hrtf:true,motion:.75,trail:.22};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const paths:OrbitPath[]=['left-rear-right','right-rear-left','rear-drift-left','rear-drift-right','front-left-right','front-right-left','front-to-rear-left','front-to-rear-right','rear-to-front-left','rear-to-front-right','full-orbit-cw','full-orbit-ccw'];
const bands:OrbitBand[]=['detail','voice'];
const sources:OrbitSource[]=['mix','lead','doubles','adlibs'];
export function validOrbitEvent(x:unknown):x is OrbitEvent{
 if(!x||typeof x!=='object')return false;
 const e=x as Partial<OrbitEvent>;
 return Number.isSafeInteger(e.id)&&Number.isFinite(e.at)&&e.at!>=0&&Number.isFinite(e.duration)&&e.duration!>=.12&&e.duration!<=2.4&&sources.includes(e.source as OrbitSource)&&paths.includes(e.path as OrbitPath)&&bands.includes(e.band as OrbitBand)&&Number.isFinite(e.level)&&e.level!>=0&&e.level!<=1;
}
export function validOrbitSettings(x:unknown):x is OrbitSettings{
 if(!x||typeof x!=='object')return false;
 const s=x as Partial<OrbitSettings>;
 return typeof s.enabled==='boolean'&&typeof s.hrtf==='boolean'&&Number.isFinite(s.amount)&&s.amount!>=0&&s.amount!<=1&&Number.isFinite(s.rear)&&s.rear!>=0&&s.rear!<=1&&(s.motion===undefined||Number.isFinite(s.motion)&&s.motion>=0&&s.motion<=1)&&(s.trail===undefined||Number.isFinite(s.trail)&&s.trail>=0&&s.trail<=1);
}
export function orbitEventSources(stems:OrbitStemMap, mode:'stems'|'stereo'):{source:OrbitSource;buffer:AudioBuffer}[]{
 const anySolo=Object.values(stems).some(x=>x?.buffer&&x.solo);
 const output:{source:OrbitSource;buffer:AudioBuffer}[]=[];
 if(mode==='stems')for(const source of ['adlibs','doubles','lead'] as const){
  const st=stems[source];if(st?.buffer&&!st.mute&&(!anySolo||st.solo))output.push({source,buffer:st.buffer});
 }
 return output;
}
const scoreFragment=(buffer:AudioBuffer,t:number)=>{
 const rate=buffer.sampleRate,start=Math.floor(t*rate),end=Math.min(buffer.length,start+Math.floor(rate*.09)),n=Math.min(220,end-start-3);
 if(n<24)return {score:0,energy:0};
 const data=buffer.getChannelData(0);let sum=0,contrast=0,low=0;
 // Contiguous short blocks at multiple points preserve high-frequency transient evidence.
 for(let block=0;block<8;block++){
  const i0=start+Math.floor(block*(end-start)/9);
  let prev=data[i0]||0,average=prev;
  for(let k=1;k<=n/8;k++){
   const v=data[i0+k]||0;sum+=v*v;contrast+=Math.abs(v-prev);average=average*.91+v*.09;low+=average*average;prev=v;
  }
 }
 const energy=Math.sqrt(sum/Math.max(1,n)),snap=contrast/Math.max(1,n),lowRatio=low/Math.max(sum,1e-9);
 return {score:Math.log1p(energy*140)*(.25+Math.min(2.1,snap/Math.max(energy,.0001))*1.15)/(1+.30*lowRatio),energy};
};
/** Bounded, deterministic signal heuristic. Highlights transient/bright moments.
 * NOT speech recognition or true instrument/voice isolation.
 * In STEM mode never proposes BEAT; prefer ADLIBS > DOUBLES > tiny LEAD fragments.
 * In stereo mode proposes only bright selected MIX fragments, never entire beat.
 */
export function scoutMicroOrbits(mix:AudioBuffer,stems:OrbitStemMap,mode:'stems'|'stereo',count=6):OrbitEvent[]{
 if(!mix||mix.duration<.8)return [];
 const candidates=orbitEventSources(stems,mode);
 if(!candidates.length)candidates.push({source:'mix',buffer:mix});
 const limit=Math.min(8,Math.max(1,Math.trunc(count)));
 const found:Array<{source:OrbitSource;time:number;score:number}>=[];
 for(const {source,buffer} of candidates){
  const until=Math.min(mix.duration,buffer.duration)-.8;
  for(let time=.4;time<until;time+=.17){
   const {score,energy}=scoreFragment(buffer,time);
   if(energy<.0015)continue;
   const preference=source==='adlibs'?1.9:source==='doubles'?1.48:source==='lead'?.90:.5;
   found.push({source,time,score:score*preference});
  }
 }
 found.sort((a,b)=>b.score-a.score||a.time-b.time);
 const chosen:typeof found=[];
 const spacing=Math.min(8,Math.max(2,mix.duration/(limit+1)*.28));
 for(const c of found){
  if(chosen.every(d=>Math.abs(d.time-c.time)>spacing)){chosen.push(c);if(chosen.length>=limit)break}
 }
 chosen.sort((a,b)=>a.time-b.time);
 return chosen.map((e,i)=>{
  const duration=e.source==='lead'?.72:e.source==='mix'?.42:.78;
  return {id:i+1,source:e.source,at:Math.round(e.time*100)/100,duration,path:(['front-to-rear-left','rear-drift-right','front-left-right','rear-to-front-right','left-rear-right','full-orbit-cw'] as OrbitPath[])[i%6],band:e.source==='mix'?'detail':e.source==='lead'?'voice':'detail',level:e.source==='mix'?.62:.8};
 });
}
/** The WebAudio listener faces negative Z. Positive Z is BEHIND the ears.
 * Keyframes intentionally describe actual front/rear motion, not just pan.
 * All trajectories are local wet reflections and never reposition original stems.
 */
export const orbitPathPositions=(path:OrbitPath,rear:number,strength:number):Array<[number,number]>=>{
 const x=0.85+0.9*clamp(strength,0,1),zFront=-(.8+.9*clamp(strength,0,1));
 const zRear=.8+1.35*clamp(rear,0,1)*(.65+.35*clamp(strength,0,1));
 const rearLeft:[number,number]=[-x,zRear],rearRight:[number,number]=[x,zRear];
 const frontLeft:[number,number]=[-x,zFront],frontRight:[number,number]=[x,zFront];
 const front:[number,number]=[0,zFront],back:[number,number]=[0,zRear+0.3];
 const left:[number,number]=[-x*1.08,0],right:[number,number]=[x*1.08,0];
 switch(path){
  case 'front-left-right':return [frontLeft,[-x*.55,zFront*1.12],front,[x*.55,zFront*1.12],frontRight];
  case 'front-right-left':return [frontRight,[x*.55,zFront*1.12],front,[-x*.55,zFront*1.12],frontLeft];
  case 'front-to-rear-left':return [front,frontLeft,left,rearLeft,back];
  case 'front-to-rear-right':return [front,frontRight,right,rearRight,back];
  case 'rear-to-front-left':return [back,rearLeft,left,frontLeft,front];
  case 'rear-to-front-right':return [back,rearRight,right,frontRight,front];
  case 'full-orbit-cw':return [front,frontRight,right,rearRight,back,rearLeft,left,frontLeft,front];
  case 'full-orbit-ccw':return [front,frontLeft,left,rearLeft,back,rearRight,right,frontRight,front];
  case 'rear-drift-left':return [rearRight,[x*.5,zRear*1.1],back,[-x*.5,zRear*1.1],rearLeft];
  case 'rear-drift-right':return [rearLeft,[-x*.5,zRear*1.1],back,[x*.5,zRear*1.1],rearRight];
  case 'right-rear-left':return [right,rearRight,back,rearLeft,left];
  default:return [left,rearLeft,back,rearRight,right];
 }
};
function motion(param:AudioParam,values:number[],time:number,duration:number){
 param.setValueAtTime(values[0],time);
 for(let i=1;i<values.length;i++)param.linearRampToValueAtTime(values[i],time+duration*i/(values.length-1));
}
export async function renderMicroOrbits(
 original:AudioBuffer,stems:OrbitStemMap,events:OrbitEvent[],settings:OrbitSettings
):Promise<AudioBuffer>{
 // EXACT identity path: OFF does not render, copy or modify any PCM.
 if(!settings.enabled||settings.amount===0||!events.length)return original;
 const included=events.filter(e=>validOrbitEvent(e)&&e.at<original.duration-.12).slice(0,12);
 if(!included.length)return original;
 const ctx=new OfflineAudioContext(Math.min(2,Math.max(1,original.numberOfChannels)),original.length,original.sampleRate);
 const dry=ctx.createBufferSource();dry.buffer=original;dry.connect(ctx.destination);dry.start(0);
 const anySolo=Object.values(stems).some(st=>st?.buffer&&st.solo);
 for(const event of included){
  const st=event.source==='mix'?null:stems[event.source];
  if(event.source!=='mix'&&(!st?.buffer||st.mute||(anySolo&&!st.solo)))continue;
  const buffer=st?.buffer??original;
  if(event.at>=buffer.duration-.1)continue;
  const t=event.at,d=Math.min(event.duration,buffer.duration-t,original.duration-t);
  if(d<.12)continue;
  const fragment=ctx.createBufferSource();fragment.buffer=buffer;
  const highpass=ctx.createBiquadFilter();highpass.type='highpass';
  highpass.frequency.value=event.source==='mix'?1300:event.band==='voice'?560:980;
  const lowpass=ctx.createBiquadFilter();lowpass.type='lowpass';
  lowpass.frequency.value=event.band==='voice'?5700:7600;
  const env=ctx.createGain(),startFade=Math.min(.045,d*.25),endFade=Math.min(.095,d*.35);
  env.gain.setValueAtTime(0,t);
  env.gain.linearRampToValueAtTime(1,t+startFade);
  env.gain.setValueAtTime(1,Math.max(t+startFade,t+d-endFade));
  env.gain.linearRampToValueAtTime(0,t+d);
  fragment.connect(highpass).connect(lowpass).connect(env);
  // Energy deliberately bounded. The direct beat/lead and ROOM dry are untouched.
  const level=clamp(settings.amount,0,1)*clamp(event.level,0,1)*.19*(event.source==='mix'?.46:event.source==='lead'?.80:1);
  const coords=orbitPathPositions(event.path,settings.rear,settings.motion??orbitDefaults.motion??.75);
  const rear=ctx.createDelay(.18);rear.delayTime.value=.028+settings.rear*.032;
  const gain=ctx.createGain();gain.gain.value=level;
  env.connect(rear).connect(gain);
  if(settings.hrtf){
   const panner=ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
   panner.refDistance=1;panner.maxDistance=20;panner.rolloffFactor=0;panner.coneInnerAngle=360;
   motion(panner.positionX,coords.map(c=>c[0]),t,d);
   motion(panner.positionZ,coords.map(c=>c[1]),t,d);
   panner.positionY.value=0;
   const headGain=ctx.createGain();headGain.gain.value=.97;
   gain.connect(panner).connect(headGain).connect(ctx.destination);
  }
  // A quiet side cue remains when HRTF feels muffled or browser rear cues are weak.
  const side=ctx.createStereoPanner();
  motion(side.pan,coords.map(c=>clamp(c[0]/2.7,-.95,.95)),t,d);
  const sideGain=ctx.createGain();sideGain.gain.value=settings.hrtf?.19:.85;
  gain.connect(side).connect(sideGain).connect(ctx.destination);
  // Rear persistence, bounded and independent from the dry signal.
  const trail=clamp(settings.trail??orbitDefaults.trail??.22,0,1);
  if(trail>0){
   const tailDelay=ctx.createDelay(.35);tailDelay.delayTime.value=.095+settings.rear*.065;
   const tailGain=ctx.createGain();tailGain.gain.value=trail*.20;
   const tailPan=ctx.createStereoPanner();
   tailPan.pan.value=clamp(coords[coords.length-1][0]/2.5,-.8,.8);
   gain.connect(tailDelay).connect(tailGain).connect(tailPan).connect(ctx.destination);
  }
  fragment.start(t,t,d);fragment.stop(t+d);
 }
 return await ctx.startRendering();
}
