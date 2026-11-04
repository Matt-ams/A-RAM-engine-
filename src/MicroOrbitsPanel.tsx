import {useMemo,useState,type Dispatch,type SetStateAction} from 'react';
import {
 orbitEventSources,scoutMicroOrbits,type OrbitEvent,type OrbitSettings,
 type OrbitSource,type OrbitPath,type OrbitBand,type OrbitStemMap
} from './audio/microOrbits';

type Props={
 mix:AudioBuffer; mode:'stems'|'stereo';stems:OrbitStemMap;
 events:OrbitEvent[];setEvents:Dispatch<SetStateAction<OrbitEvent[]>>;
 settings:OrbitSettings;setSettings:Dispatch<SetStateAction<OrbitSettings>>;
 playhead:number;originalLock:boolean;
};
const paths:{id:OrbitPath;label:string}[]=[
 {id:'left-rear-right',label:'LEFT EAR → REAR → RIGHT EAR'},
 {id:'right-rear-left',label:'RIGHT EAR → REAR → LEFT EAR'},
 {id:'rear-drift-left',label:'REAR RIGHT → REAR LEFT'},
 {id:'rear-drift-right',label:'REAR LEFT → REAR RIGHT'}
];
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
function curve(path:OrbitPath){
 if(path==='left-rear-right')return 'M 112 121 C 98 218 382 239 368 121';
 if(path==='right-rear-left')return 'M 368 121 C 382 239 98 218 112 121';
 if(path==='rear-drift-left')return 'M 318 180 Q 240 242 162 180';
 return 'M 162 180 Q 240 242 318 180';
}
export default function MicroOrbitsPanel({mix,mode,stems,events,setEvents,settings,setSettings,playhead,originalLock}:Props){
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const selected=events.find(e=>e.id===selectedId)??events[0]??null;
 const candidates=useMemo(()=>orbitEventSources(stems,mode).map(s=>s.source),[stems,mode]);
 const availableSources:OrbitSource[]=mode==='stems'?[...candidates,'mix']:['mix'];
 const updateSetting=<K extends keyof OrbitSettings>(k:K,v:OrbitSettings[K])=>setSettings(s=>({...s,[k]:v}));
 const updateEvent=(p:Partial<OrbitEvent>)=>{if(!selected)return;setEvents(es=>es.map(e=>e.id===selected.id?{...e,...p}:e))};
 const addManual=()=>{setEvents(prev=>{
  if(prev.length>=12)return prev;
  const at=Math.round(clamp(playhead,0,Math.max(0,mix.duration-.8))*100)/100;
  const source=availableSources[0]??'mix';
  const duration=source==='mix'?.32:source==='lead'?.42:.55;
  const id=Math.max(Date.now(),...prev.map(e=>e.id+1));
  setSelectedId(id);
  return [...prev,{id,source,at,duration,path:'left-rear-right',band:source==='lead'?'voice':'detail',level:.75}].sort((a,b)=>a.at-b.at);
 })};
 const scan=()=>{const proposals=scoutMicroOrbits(mix,stems,mode,7);
  setEvents(proposals);setSelectedId(proposals[0]?.id??null);
 };
 const rearPath=selected?curve(selected.path):'M 112 121 C 98 218 382 239 368 121';
 return <section className='orbitLab' aria-label='Rear Orbits Micro Events'>
  <header className='orbitHead'>
   <div><p className='orbitEyebrow'>OPTIONAL POST-ROOM EXPERIMENT · WET ONLY</p><h2>REAR ORBITS <span>MICRO-EVENT MOTION</span></h2><p>Let tiny ad-libs, vocal fragments and selected stereo details travel around the back of the head. The BEAT and dry LEAD never move. Independent of ROOM and HALO.</p></div>
   <button className={settings.enabled?'orbitToggle active':'orbitToggle'} aria-pressed={settings.enabled} onClick={()=>updateSetting('enabled',!settings.enabled)}>{settings.enabled?'ORBIT ENGINE · ON':'ORBIT ENGINE · OFF'}</button>
  </header>
  <div className='orbitBody'>
   <div className='orbitScene' role='img' aria-label='Head and ear diagram showing wet sound movement behind listener'>
    <svg viewBox='0 0 480 270' aria-hidden='true'>
     <defs><radialGradient id='orbit-v44-night'><stop stopColor='#203342'/><stop offset='1' stopColor='#0a121b'/></radialGradient>
     <linearGradient id='orbit-v44-trail'><stop stopColor='#8ddfe3'/><stop offset='.5' stopColor='#c6a5ed'/><stop offset='1' stopColor='#8ddfe3'/></linearGradient></defs>
     <rect width='480' height='270' rx='14' fill='url(#orbit-v44-night)'/>
     <path d='M 83 116 Q 240 -19 397 116' fill='none' stroke='#3a6270' strokeWidth='2' strokeDasharray='4 8'/>
     <path d='M 76 120 Q 55 246 240 251 Q 425 246 404 120' fill='none' stroke='#354658' strokeWidth='1.5' strokeDasharray='5 7'/>
     <ellipse cx='240' cy='128' rx='76' ry='79' fill='#1a2c3a' stroke='#698da0' strokeWidth='2'/>
     <path d='M 180 109 Q 166 102 165 128 Q 166 151 184 150' fill='none' stroke='#b3c6d3' strokeWidth='6' strokeLinecap='round'/>
     <path d='M 300 109 Q 314 102 315 128 Q 314 151 296 150' fill='none' stroke='#b3c6d3' strokeWidth='6' strokeLinecap='round'/>
     <path d='M 213 92 Q 240 70 267 92' fill='none' stroke='#819dac' strokeWidth='3'/>
     <circle cx='240' cy='118' r='13' fill='#c9dee8' opacity='.92'/>
     <path d={rearPath} fill='none' stroke='url(#orbit-v44-trail)' strokeWidth='4' strokeLinecap='round'/>
     <circle cx={selected?.path==='right-rear-left'?368:112} cy='121' r='6' fill='#bce7e9'/>
     <circle cx='240' cy='218' r='5' fill='#c5a9e5'/>
     <circle cx={selected?.path==='right-rear-left'?112:368} cy='121' r='6' fill='#bce7e9'/>
     <text x='240' y='22' fill='#9ec0cb' textAnchor='middle' fontSize='11' fontFamily='monospace'>FRONT / DRY ANCHOR</text>
     <text x='240' y='263' fill='#c6b3dc' textAnchor='middle' fontSize='11' fontFamily='monospace'>REAR FIELD · WET REFLECTIONS</text>
     <text x='94' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>LEFT EAR</text>
     <text x='389' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>RIGHT EAR</text>
    </svg>
    <small>Conceptual rear cues, not measured 360° placement. HRTF is wet-only and headphone-dependent.</small>
   </div>
   <div className='orbitWorkbench'>
    <div className='orbitControls'>
     <label>WET INTENSITY <b>{Math.round(settings.amount*100)}%</b><input aria-label='Orbit wet intensity' type='range' min='0' max='100' step='5' value={settings.amount*100} onChange={e=>updateSetting('amount',Number(e.target.value)/100)}/></label>
     <label>REAR DEPTH <b>{Math.round(settings.rear*100)}%</b><input aria-label='Orbit rear depth' type='range' min='0' max='100' step='5' value={settings.rear*100} onChange={e=>updateSetting('rear',Number(e.target.value)/100)}/></label>
    </div>
    <button className={settings.hrtf?'orbitHrtf on':'orbitHrtf'} aria-pressed={settings.hrtf} onClick={()=>updateSetting('hrtf',!settings.hrtf)}>REAR HRTF · WET ONLY {settings.hrtf?'ON':'OFF'}</button>
    <p className='orbitDetailNote'>At 100% wet intensity, the fragment layer is still gain-capped. It is not a full-song autopanner. The main beat, direct voice and existing ROOM dry path are unchanged.</p>
    <div className='orbitActions'>
     <button onClick={scan} disabled={mix.duration<.8}>SMART SCOUT · FIND DETAILS</button>
     <button onClick={addManual} disabled={events.length>=12||mix.duration<.8}>+ DETAIL AT PLAYHEAD ({clock(playhead)})</button>
     <button onClick={()=>{setEvents([]);setSelectedId(null)}} disabled={!events.length}>CLEAR</button>
    </div>
    <small className='orbitDetailNote'>LOCAL SIGNAL HEURISTIC · prefers AD-LIBS / DOUBLES, then short LEAD snippets. Never selects the BEAT stem. In stereo mode, spectral filtering is approximate: voices and instruments cannot be separated reliably.</small>
   </div>
  </div>
  <div className='orbitTimeline'>
   <div className='orbitTimelineTitle'><b>EVENT MAP</b><span>{events.length} / 12 micro-events · {mix.duration.toFixed(1)}s</span></div>
   <div className='orbitTrack' role='group' aria-label='Selected micro-events along track'>
    {events.map(e=><button key={e.id} className={selected?.id===e.id?'orbitMarker selected':'orbitMarker'} title={`${e.source.toUpperCase()} · ${clock(e.at)} · ${e.path}`} style={{left:`${clamp(e.at/mix.duration*100,0,99)}%`}} aria-label={`Event ${e.source} at ${clock(e.at)}`} onClick={()=>setSelectedId(e.id)}/>)}
   </div>
  </div>
  {selected?<div className='orbitEditor'>
   <div className='orbitSelected'><strong>DETAIL {events.indexOf(selected)+1} · {selected.source.toUpperCase()}</strong><span>{clock(selected.at)} → {clock(selected.at+selected.duration)} · WET ONLY</span></div>
   <div className='orbitEditorGrid'>
    <label>SOURCE<select aria-label='Orbit event source' value={selected.source} onChange={e=>updateEvent({source:e.target.value as OrbitSource,band:e.target.value==='lead'?'voice':'detail'})}>{availableSources.map(s=><option value={s} key={s}>{s==='mix'?'STEREO / ROOM MIX · FILTERED':s.toUpperCase()}</option>)}</select></label>
    <label>ROUTE<select aria-label='Orbit event route' value={selected.path} onChange={e=>updateEvent({path:e.target.value as OrbitPath})}>{paths.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <label>DETAIL BAND<select aria-label='Orbit event band' value={selected.band} onChange={e=>updateEvent({band:e.target.value as OrbitBand})}><option value='detail'>BRIGHT DETAIL</option><option value='voice'>VOCAL PRESENCE</option></select></label>
    <label>START · {selected.at.toFixed(2)}s<input aria-label='Orbit event time' type='range' min='0' max={Math.max(.1,mix.duration-1.2)} step='.05' value={selected.at} onChange={e=>updateEvent({at:Number(e.target.value)})}/></label>
    <label>DURATION · {selected.duration.toFixed(2)}s<input aria-label='Orbit event duration' type='range' min='.15' max='1.20' step='.05' value={selected.duration} onChange={e=>updateEvent({duration:Number(e.target.value)})}/></label>
    <label>EVENT LEVEL · {Math.round(selected.level*100)}%<input aria-label='Orbit event level' type='range' min='0' max='100' step='5' value={selected.level*100} onChange={e=>updateEvent({level:Number(e.target.value)/100})}/></label>
   </div>
   <button className='orbitRemove' onClick={()=>{setEvents(es=>es.filter(e=>e.id!==selected.id));setSelectedId(null)}}>REMOVE SELECTED DETAIL</button>
  </div>:<div className='orbitEmpty'>No orbit events. Mark a specific “hola” moment with the playhead, or run SMART SCOUT for suggested short fragments.</div>}
  <div className='orbitFooter'>
   <span>{settings.enabled?'ON · ORBIT WET LAYER INCLUDED IN NEXT MASTER RENDER':'OFF · ORIGINAL AUDIO PIPELINE BYPASSED EXACTLY'}</span>
   {originalLock&&<b>ORIGINAL LOCK IS ON — ORBITS WILL NOT ENTER LOCKED EXPORT</b>}
  </div>
 </section>;
}
