/** Transparent event eligibility: what will/won't be rendered.
 * These are routing checks, not proof of acoustic perception.
 */
import {validOrbitEvent,type OrbitEvent,type OrbitSettings,type OrbitStemMap} from './microOrbits';
export type EventRouteResult={id:number;at:number;reason:string;state:'ready'|'off'|'risk'};
export function eventRouteAudit(
 events:OrbitEvent[],settings:OrbitSettings,stems:OrbitStemMap,duration:number,
 originalLock=false,roomPending=false
):EventRouteResult[]{
 const hasSolo=Object.values(stems).some(s=>s?.buffer&&s.solo);
 return events.map(e=>{
  const base={id:e.id,at:e.at};
  if(!validOrbitEvent(e)||e.at>=duration-.12)return {...base,state:'off' as const,reason:'Invalid/out-of-range timestamp'};
  if(originalLock)return {...base,state:'off' as const,reason:'ORIGINAL LOCK bypasses processed export'};
  if(roomPending)return {...base,state:'off' as const,reason:'ROOM needs rebuild before playback'};
  if(!settings.enabled||settings.amount<=0||e.level<=0)return {...base,state:'off' as const,reason:'ORBIT disabled or event gain zero'};
  const st=e.source==='mix'?null:stems[e.source];
  if(e.source!=='mix'&&(!st?.buffer||st.mute||(hasSolo&&!st.solo)))return {...base,state:'off' as const,reason:'Required vocal stem missing, muted or excluded by SOLO'};
  const buffer=st?.buffer;
  if(buffer&&(e.at>=buffer.duration-.1))return {...base,state:'off' as const,reason:'Event outside vocal stem duration'};
  if(buffer){
   const start=Math.floor(e.at*buffer.sampleRate),end=Math.min(buffer.length,start+Math.floor(Math.min(e.duration,.2)*buffer.sampleRate));
   const signal=buffer.getChannelData(0);let energy=0,n=0;
   const stride=Math.max(1,Math.floor((end-start)/120));
   for(let i=start;i<end;i+=stride){energy+=signal[i]*signal[i];n++}
   const rms=Math.sqrt(energy/Math.max(1,n));
   if(rms<.0006)return {...base,state:'risk' as const,reason:'Voice stem very quiet at this timestamp; movement may be inaudible'};
  }
  if(e.source==='mix')return {...base,state:'risk' as const,reason:'Stereo mix: filtered copy may also contain instruments'};
  const wet=(settings.amount||0)*e.level*(.19+.32*(settings.presence??.72));
  if(wet<.08)return {...base,state:'risk' as const,reason:'Very low moving-layer intensity'};
  const overlaps=events.filter(other=>other.id!==e.id&&other.at<e.at+e.duration&&e.at<other.at+other.duration).length;
  if(overlaps>=3)return {...base,state:'risk' as const,reason:'Four or more simultaneous movements; perceived separation may suffer'};
  return {...base,state:'ready' as const,reason:'Routing eligible — audibility still requires headphone A/B'};
 });
}
