/** MUSICAL SPATIAL DIRECTOR V0.1
 * Deterministic STEM-driven event selection across a complete song.
 * No transcript, no source separation, no beat movement. Keeps dry mix anchored.
 */
import {orbitEventSources,type OrbitEvent,type OrbitStemMap,type OrbitSource,type OrbitPath} from './microOrbits';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
type Hit={source:OrbitSource;at:number;duration:number;score:number;section:number};
const routes:Record<'lead'|'doubles'|'adlibs',OrbitPath[]>={
 lead:['front-left-right','front-right-left','front-to-rear-left','rear-to-front-right'],
 doubles:['right-rear-left','rear-drift-left','left-rear-right','front-to-rear-right'],
 adlibs:['left-rear-right','rear-drift-right','right-rear-left','rear-to-front-left']
};
/** Returns a level envelope every 80ms from both channels (max 240 taps/frame). */
function envelope(buffer:AudioBuffer,hop=.08):number[]{
 const sr=buffer.sampleRate,frames=Math.ceil(buffer.duration/hop),result:number[]=[];
 for(let f=0;f<frames;f++){
  const begin=Math.floor(f*hop*sr),end=Math.min(buffer.length,begin+Math.floor(.075*sr));
  if(end<=begin){result.push(0);continue}
  const stride=Math.max(1,Math.ceil((end-begin)/240));
  let sum=0,n=0;
  for(let i=begin;i<end;i+=stride){
   for(let ch=0;ch<Math.min(2,buffer.numberOfChannels);ch++){
    const v=buffer.getChannelData(ch)[i];sum+=v*v;n++;
   }
  }
  result.push(Math.sqrt(sum/Math.max(n,1)));
 }
 return result;
}
const average=(x:number[],start:number,end:number)=>{
 let sum=0,n=0;for(let i=Math.max(0,start);i<Math.min(x.length,end);i++){sum+=x[i];n++}
 return sum/Math.max(n,1);
};
export function scoutMusicalDirector(
 mix:AudioBuffer,stems:OrbitStemMap,mode:'stems'|'stereo',count=18
):OrbitEvent[]{
 if(mode!=='stems'||mix.duration<1)return [];
 const voices=orbitEventSources(stems,mode);
 if(!voices.length)return [];
 const requested=clamp(Math.trunc(count)||18,1,24);
 const hop=.08, mixEnv=envelope(mix,hop);
 const hits:Hit[]=[];
 for(const {source,buffer} of voices){
  const env=envelope(buffer,hop),sorted=[...env].sort((a,b)=>a-b);
  const floor=sorted[Math.floor(sorted.length*.20)]??0;
  const upper=sorted[Math.floor(sorted.length*.90)]??0;
  const gate=Math.max(.002,floor*1.75,upper*.12);
  const minSpacingFrames=5;let lastHit=-1000;
  for(let i=4;i<env.length-8;i++){
   const current=average(env,i,i+3),before=average(env,i-4,i-1);
   const relative=current/Math.max(before,gate*.42,.0003);
   const active=current>gate*1.35;
   const newEntrance=before<gate*.7&&relative>1.8;
   const newAccent=relative>2.15&&current>gate*2;
   if(!active||!(newEntrance||newAccent)||i-lastHit<minSpacingFrames)continue;
   // Contrast with previous song section; purely signal-based, not semantic.
   const mBefore=average(mixEnv,Math.max(0,i-17),Math.max(0,i-4));
   const mAfter=average(mixEnv,i,i+12);
   const structuralChange=clamp(Math.abs(Math.log((mAfter+.0004)/(mBefore+.0004))),0,1.2);
   const sourceWeight=source==='adlibs'?1.55:source==='doubles'?1.35:1;
   const onsetStrength=clamp(Math.log2(Math.max(1,relative)),0,3);
   const score=sourceWeight*(.68+.3*onsetStrength+.18*structuralChange)
    *(.6+.4*clamp(current/(upper+.001),0,1.4));
   const at=Math.max(0,i*hop-.075);
   // Hold the accent, but allow its tail to finish rather than chopping to 350ms.
   let last=i+4;
   while(last<env.length-1 && last<i+23 && average(env,last,last+2)>gate*.56)last++;
   const duration=clamp((last-i)*hop+.2,.55,2.3);
   hits.push({source,at,duration,score,section:0});
   lastHit=i;
  }
 }
 if(!hits.length)return [];
 const duration=mix.duration;
 // Select useful moments from different sections, not merely the loudest chorus.
 const sectionLength=clamp(duration/Math.max(7,requested*.75),6,15);
 for(const h of hits)h.section=Math.floor(h.at/sectionLength);
 hits.sort((a,b)=>b.score-a.score||a.at-b.at);
 const chosen:Hit[]=[],usedSections=new Set<number>();
 const spacing=Math.max(1.4,Math.min(3,duration/Math.max(15,requested*4)));
 for(let pass=0;pass<2;pass++){
  for(const hit of hits){
   if(chosen.length>=requested)break;
   if(pass===0&&usedSections.has(hit.section))continue;
   if(chosen.some(x=>Math.abs(x.at-hit.at)<spacing))continue;
   if(chosen.some(x=>x.section===hit.section&&x.source===hit.source))continue;
   chosen.push(hit);usedSections.add(hit.section);
  }
 }
 chosen.sort((a,b)=>a.at-b.at);
 return chosen.map((h,i)=>{
  const key=h.source as 'lead'|'doubles'|'adlibs';
  const choices=routes[key];
  return {id:i+1,source:h.source,at:Math.round(h.at*100)/100,
   duration:Math.round(h.duration*100)/100,
   path:choices[(h.section+i)%choices.length],
   band:key==='lead'?'voice':'detail',
   level:key==='adlibs'?.94:key==='doubles'?.86:.78};
 });
}
