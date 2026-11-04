import {useMemo,useState,type Dispatch,type SetStateAction} from 'react';
import {
 orbitEventSources,scoutMicroOrbits,orbitPathPositions,type OrbitEvent,type OrbitSettings,
 type OrbitSource,type OrbitPath,type OrbitBand,type OrbitStemMap
} from './audio/microOrbits';

type Props={
 mix:AudioBuffer; mode:'stems'|'stereo';stems:OrbitStemMap;
 events:OrbitEvent[];setEvents:Dispatch<SetStateAction<OrbitEvent[]>>;
 settings:OrbitSettings;setSettings:Dispatch<SetStateAction<OrbitSettings>>;
 playhead:number;originalLock:boolean;roomPending?:boolean;
};
const paths:{id:OrbitPath;label:string}[]=[
 {id:'left-rear-right',label:'LEFT → REAR → RIGHT'},
 {id:'right-rear-left',label:'RIGHT → REAR → LEFT'},
 {id:'rear-drift-left',label:'BACK RIGHT → BACK LEFT'},
 {id:'rear-drift-right',label:'BACK LEFT → BACK RIGHT'},
 {id:'front-left-right',label:'FRONT LEFT → FRONT RIGHT'},
 {id:'front-right-left',label:'FRONT RIGHT → FRONT LEFT'},
 {id:'front-to-rear-left',label:'FRONT → LEFT EAR → BEHIND'},
 {id:'front-to-rear-right',label:'FRONT → RIGHT EAR → BEHIND'},
 {id:'rear-to-front-left',label:'BEHIND → LEFT EAR → FRONT'},
 {id:'rear-to-front-right',label:'BEHIND → RIGHT EAR → FRONT'},
 {id:'full-orbit-cw',label:'360° FRONT → RIGHT → BACK → LEFT'},
 {id:'full-orbit-ccw',label:'360° FRONT → LEFT → BACK → RIGHT'}
];
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const svgPath=(p:Array<[number,number]>)=>p.map(([x,z],i)=>`${i===0?'M':'L'} ${(240+x*65).toFixed(2)} ${(127+z*44).toFixed(2)}`).join(' ');
export default function MicroOrbitsPanel({mix,mode,stems,events,setEvents,settings,setSettings,playhead,originalLock,roomPending=false}:Props){
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
  const event:OrbitEvent={id,source,at,duration,path:'front-to-rear-left',band:source==='lead'?'voice':'detail',level:.75};return [...prev,event].sort((a,b)=>a.at-b.at);
 })};
 const scan=()=>{const proposals=scoutMicroOrbits(mix,stems,mode,7);
  setEvents(proposals);setSelectedId(proposals[0]?.id??null);
 };
 const points=orbitPathPositions(selected?.path??'left-rear-right',settings.rear,settings.motion??.75);
 const rearPath=svgPath(points);
 const begin=points[0],end=points[points.length-1];
 const screenPoint=([x,z]:[number,number])=>({x:240+x*65,y:127+z*44});
 return <section className='orbitLab' aria-label='Rear Orbits Micro Events'>
  <header className='orbitHead'>
   <div><p className='orbitEyebrow'>OPTIONAL POST-ROOM EXPERIMENT · WET ONLY</p><h2>REAR ORBITS <span>FRONT / REAR · SENSORIAL MICRO-SWEEPS</span></h2><p>Animate short vocal fragments across the front, around an ear, and behind the head. The main BEAT, direct LEAD, and existing ROOM stay anchored.</p></div>
   <button className={settings.enabled?'orbitToggle active':'orbitToggle'} aria-pressed={settings.enabled} disabled={roomPending&&!settings.enabled} onClick={()=>updateSetting('enabled',!settings.enabled)}>{settings.enabled?'ORBIT ENGINE · ON':'ORBIT ENGINE · OFF'}</button>
  </header>
  <div className='orbitBody'>
   <div className='orbitScene' role='img' aria-label='Top-down headphone diagram showing front, ear-side and rear wet sound trajectories'>
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
     <circle cx={screenPoint(begin).x} cy={screenPoint(begin).y} r='6' fill='#bce7e9'/>
     <circle cx={screenPoint(end).x} cy={screenPoint(end).y} r='6' fill='#e3b4ee'/>
     <circle r='5' fill='#c9f0f2' opacity='.9'><animateMotion dur={`${Math.max(.6,selected?.duration??1)*2}s`} repeatCount='indefinite' path={rearPath}/></circle>
     <text x='240' y='22' fill='#9ec0cb' textAnchor='middle' fontSize='11' fontFamily='monospace'>FRONT / DRY ANCHOR</text>
     <text x='240' y='263' fill='#c6b3dc' textAnchor='middle' fontSize='11' fontFamily='monospace'>BEHIND · WET REFLECTIONS</text>
     <text x='94' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>LEFT EAR</text>
     <text x='389' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>RIGHT EAR</text>
    </svg>
    <small>Animated trajectory is illustrative. Audio uses matching 3D front/back keyframes, but actual perception depends on headphones, ears and browser HRTF.</small>
   </div>
   <div className='orbitWorkbench'>
    <div className='orbitControls'>
     <label>WET INTENSITY <b>{Math.round(settings.amount*100)}%</b><input aria-label='Orbit wet intensity' type='range' min='0' max='100' step='5' value={settings.amount*100} onChange={e=>updateSetting('amount',Number(e.target.value)/100)}/></label>
     <label>REAR DEPTH <b>{Math.round(settings.rear*100)}%</b><input aria-label='Orbit rear depth' type='range' min='0' max='100' step='5' value={settings.rear*100} onChange={e=>updateSetting('rear',Number(e.target.value)/100)}/></label>
    </div>
    <div className='orbitControls'>
     <label>TRAJECTORY SPAN <b>{Math.round((settings.motion??.75)*100)}%</b><input aria-label='Orbit trajectory span' type='range' min='0' max='100' step='5' value={(settings.motion??.75)*100} onChange={e=>updateSetting('motion',Number(e.target.value)/100)}/></label>
     <label>REAR PERSISTENCE <b>{Math.round((settings.trail??.22)*100)}%</b><input aria-label='Orbit rear persistence' type='range' min='0' max='100' step='5' value={(settings.trail??.22)*100} onChange={e=>updateSetting('trail',Number(e.target.value)/100)}/></label>
    </div>
    <button className={settings.hrtf?'orbitHrtf on':'orbitHrtf'} aria-pressed={settings.hrtf} onClick={()=>updateSetting('hrtf',!settings.hrtf)}>3D HRTF · WET ONLY {settings.hrtf?'ON':'OFF'}</button>
    <p className='orbitDetailNote'>WET-only fragments, gain-limited. Turn 3D HRTF ON for front/back cues; OFF reduces to left/right stereo. If Safari sounds boxy, compare both. This is NOT discrete Atmos.</p>
    {roomPending&&<p className='orbitPending' role='status'>STEMS CHANGED OR ROOM SETTINGS PENDING · REBUILD ROOM BUS BEFORE USING SMART SCOUT OR RE-ENABLING ORBITS.</p>}
    <div className='orbitActions'>
     <button onClick={scan} disabled={roomPending||mix.duration<.8}>SMART SCOUT · FIND DETAILS</button>
     <button onClick={addManual} disabled={roomPending||events.length>=12||mix.duration<.8}>+ DETAIL AT PLAYHEAD ({clock(playhead)})</button>
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
