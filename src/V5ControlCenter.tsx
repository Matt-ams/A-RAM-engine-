import {useMemo} from 'react';
import {eventRouteAudit} from './audio/eventAudit';
import type {OrbitEvent,OrbitSettings,OrbitStemMap} from './audio/microOrbits';
import type {SaturnSettings} from './audio/saturn';
type Props={duration:number;sourceReady:boolean;processedReady:boolean;busy:boolean;roomPending:boolean;
 originalLock:boolean;orbit:OrbitSettings;setOrbit:React.Dispatch<React.SetStateAction<OrbitSettings>>;
 saturn:SaturnSettings;setSaturn:React.Dispatch<React.SetStateAction<SaturnSettings>>;
 events:OrbitEvent[];stems:OrbitStemMap;superboost:boolean;onSeek:(seconds:number)=>void};
export default function V5ControlCenter({duration,sourceReady,processedReady,busy,roomPending,originalLock,orbit,setOrbit,saturn,setSaturn,events,stems,superboost,onSeek}:Props){
 const audit=useMemo(()=>eventRouteAudit(events,orbit,stems,duration,originalLock,roomPending),[events,orbit,stems,duration,originalLock,roomPending]);
 const ready=audit.filter(e=>e.state==='ready').length,risk=audit.filter(e=>e.state==='risk').length;
 const noSound=originalLock||roomPending||!orbit.enabled||!orbit.amount;
 const core=()=>{setOrbit(x=>({...x,enabled:false}));setSaturn(x=>({...x,enabled:false}));};
 const expand=()=>{if(!events.length||roomPending||originalLock)return;setOrbit(x=>({...x,enabled:true,amount:Math.max(.52,x.amount),presence:x.presence??.72}));};
 return <section className='v5Deck' data-testid='asram-v5-command-center' aria-label='A$RAM ENGINE V5.0 control and routing audit'>
  <div className='v5DeckHeading'>
   <div><small>QUALITY · ENGINEERING · PRECISION</small><h2>ENGINE <em>V5.0</em></h2><p>SPATIAL INTELLIGENCE · PREVIEW CANDIDATE · TT2/TT3 REFERENCES FROZEN</p></div>
   <span className='v5PreviewTag'>V5.0 · EXPERIMENTAL</span>
  </div>
  <div className='v5DeckPipeline'>
   <div><span>01 · FOUNDATION</span><b>ROOM + MASTER</b><small>Keep approved sonic identity</small></div>
   <div><span>02 · EXPRESSION</span><b>ORBIT + SATURN</b><small>Optional movements, never mandatory</small></div>
   <div><span>03 · INTELLIGENCE</span><b>VOCAL PHRASE REVIEW</b><small>Opt-in local transcription and explicit approval</small></div>
  </div>
  <div className='v5DeckActions'>
   <button onClick={core} data-testid='v5-core-bypass'>ROOM + CORE MASTER · REFERENCE LISTEN</button>
   <button onClick={expand} disabled={!events.length||roomPending||originalLock} data-testid='v5-motion-engage'>ENGAGE APPROVED ORBITS · {events.length} EVENTS</button>
  </div>
  <div className='v5DeckMeters' role='status'>
   <span className={sourceReady?'v5Ok':'v5Off'}>SOURCE {sourceReady?'READY':'MISSING'}</span>
   <span className={roomPending?'v5Warn':'v5Ok'}>ROOM {roomPending?'REBUILD REQUIRED':'READY'}</span>
   <span className={busy||!processedReady?'v5Warn':'v5Ok'}>MASTER {busy?'RENDERING':processedReady?'READY':'NOT READY'}</span>
   <span className={orbit.enabled&&!noSound?'v5Ok':'v5Off'}>ORBIT {orbit.enabled?'ON':'OFF'}</span>
   <span className={saturn.enabled?'v5Ok':'v5Off'}>SATURN {saturn.enabled?'ON':'OFF'}</span>
   <span className={superboost?'v5Ok':'v5Off'}>SUPERBOOST {superboost?'ON':'OFF'}</span>
   {originalLock&&<span className='v5Warn'>ORIGINAL LOCK: EFFECTS BYPASSED IN EXPORT</span>}
  </div>
  <details className='v5DeckAudit'>
   <summary>AUDIT MOTION ROUTING · {ready} READY / {risk} NEED REVIEW / {audit.length-ready-risk} BYPASSED</summary>
   <p>This checks event routing against source availability, mute/SOLO, time bounds and loudness heuristics. It does not prove that an effect is perceptible in the exported audio.</p>
   {audit.length?<div className='v5DeckEventList'>{audit.slice(0,48).map(e=><button key={e.id} onClick={()=>onSeek(e.at)} title='Seek to inspect event in playback' className={e.state==='ready'?'ready':e.state==='risk'?'warning':'off'}><b>{e.at.toFixed(2)}s</b><span>{e.reason}</span></button>)}</div>:<small>No movements are active until you explicitly add or approve them.</small>}
  </details>
 </section>
}
