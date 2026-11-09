import {useMemo,useState,type Dispatch,type SetStateAction} from 'react';
import type {OrbitStemMap,OrbitSource,OrbitEvent,OrbitPath} from './audio/microOrbits';
import {
 SATURN_MAX_EVENTS,SATURN_MAX_DURATION,scoutSaturn,saturnPathPoints,saturnDefaults,type SaturnEvent,type SaturnPath,type SaturnSettings
} from './audio/saturn';

type Props={
 mix:AudioBuffer;mode:'stems'|'stereo';stems:OrbitStemMap;
 settings:SaturnSettings;setSettings:Dispatch<SetStateAction<SaturnSettings>>;
 events:SaturnEvent[];setEvents:Dispatch<SetStateAction<SaturnEvent[]>>;
 playhead:number;onSeek:(time:number)=>void;
 roomPending:boolean;legacyOrbitsActive:boolean;legacyEvents:OrbitEvent[];originalLock:boolean;
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const clock=(s:number)=>Math.floor(s/60)+':'+Math.floor(s%60).toString().padStart(2,'0');
const routeOptions:Array<{value:SaturnPath;label:string}>=[
 {value:'slide-left-rear',label:'SLIDE · LEFT EAR → DEEP REAR'},
 {value:'slide-right-rear',label:'SLIDE · RIGHT EAR → DEEP REAR'},
 {value:'rear-left-right',label:'REAR · LEFT → RIGHT'},
 {value:'rear-right-left',label:'REAR · RIGHT → LEFT'},
 {value:'rear-hover',label:'REAR · HOVER / RESIDENCE'},
 {value:'rear-loop-cw',label:'REAR ORBIT · CLOCKWISE'},
 {value:'rear-loop-ccw',label:'REAR ORBIT · COUNTERCLOCKWISE'},
 {value:'front-side-rear',label:'FRONT EDGE → SIDE → REAR'},
 {value:'head-orbit-cw',label:'HEAD ORBIT · FRONT → LEFT → REAR → RIGHT → FRONT'},
 {value:'head-orbit-ccw',label:'HEAD ORBIT · FRONT → RIGHT → REAR → LEFT → FRONT'}
];
const point=([x,z]:[number,number])=>({x:230+x*79,y:102+z*37});
const pathSvg=(p:Array<[number,number]>)=>p.map((pt,i)=>{const s=point(pt);return (i?'L':'M')+' '+s.x.toFixed(1)+' '+s.y.toFixed(1)}).join(' ');
function Slider({name,value,onChange}: {name:string;value:number;onChange:(n:number)=>void}){
 return <label className='saturnSlider'><span>{name}<b>{Math.round(value*100)}%</b></span><input aria-label={'SATURN '+name} type='range' min={0} max={100} step={1} value={Math.round(value*100)} onChange={e=>onChange(Number(e.currentTarget.value)/100)}/></label>;
}
export default function SaturnPanel({
 mix,mode,stems,settings,setSettings,events,setEvents,playhead,onSeek,
 roomPending,legacyOrbitsActive,legacyEvents,originalLock
}:Props){
 const [selectedId,setSelectedId]=useState<number|null>(null);
 const selected=events.find(e=>e.id===selectedId)??events[0]??null;
 const updateSettings=<K extends keyof SaturnSettings>(key:K,value:SaturnSettings[K])=>setSettings(s=>({...s,[key]:value}));
 const updateEvent=(patch:Partial<SaturnEvent>)=>{if(selected)setEvents(xs=>xs.map(x=>x.id===selected.id?{...x,...patch}:x))};
 const nextId=(xs:SaturnEvent[])=>Math.max(Date.now(),0,...xs.map(x=>x.id+1));
 const scout=(focus:boolean)=>{
  if(roomPending||events.length>=SATURN_MAX_EVENTS)return;
  const proposals=scoutSaturn(mix,stems,mode,focus?12:24,focus?playhead:undefined,events);
  const count=SATURN_MAX_EVENTS-events.length;
  const additions=proposals.slice(0,count).map((e,i)=>({...e,id:nextId(events)+i}));
  if(additions.length){setEvents(xs=>[...xs,...additions].sort((a,b)=>a.at-b.at));setSelectedId(additions[0].id)}
 };
 const addAtPlayhead=()=>{
  if(events.length>=SATURN_MAX_EVENTS||roomPending)return;
  const available=(['adlibs','doubles','lead'] as const).find(k=>mode==='stems'&&stems[k]?.buffer&&!stems[k]?.mute);
  const source:OrbitSource=available??'mix';
  const e:SaturnEvent={
   id:nextId(events),source,at:Math.round(clamp(playhead,0,mix.duration-.5)*100)/100,
   duration:source==='mix'?.42:.7,path:'slide-left-rear',level:.66
  };
  setEvents(xs=>[...xs,e].sort((a,b)=>a.at-b.at));setSelectedId(e.id);
 };
 const addOutroOrbit=()=>{
  if(mode!=='stems'||!stems.lead?.buffer||stems.lead.mute||roomPending||originalLock||events.length>=SATURN_MAX_EVENTS)return;
  const available=stems.lead.buffer.duration;
  const at=Math.round(clamp(playhead,0,Math.max(0,Math.min(mix.duration,available)-.8))*100)/100;
  const d=Math.min(5.8,Math.min(mix.duration,available)-at-.15);
  if(d<.5)return;
  const e:SaturnEvent={id:nextId(events),source:'lead',at,duration:Math.round(d*100)/100,path:'head-orbit-cw',level:.93};
  setEvents(xs=>[...xs,e].sort((a,b)=>a.at-b.at));
  setSelectedId(e.id);
  setSettings(st=>({...st,enabled:true,wet:Math.max(.58,st.wet),depth:Math.max(.84,st.depth),glide:Math.max(.88,st.glide),trail:Math.max(.58,st.trail)}));
  onSeek(at);
 };
 const legacyRoutes:Record<OrbitPath,SaturnPath>={
  'left-rear-right':'rear-left-right','right-rear-left':'rear-right-left',
  'rear-drift-left':'rear-right-left','rear-drift-right':'rear-left-right',
  'front-left-right':'slide-left-rear','front-right-left':'slide-right-rear',
  'front-to-rear-left':'slide-left-rear','front-to-rear-right':'slide-right-rear',
  'rear-to-front-left':'rear-right-left','rear-to-front-right':'rear-left-right',
  'full-orbit-cw':'rear-loop-cw','full-orbit-ccw':'rear-loop-ccw'
 };
 const copyLegacy=()=>{
  if(roomPending||!legacyEvents.length)return;
  const available=SATURN_MAX_EVENTS-events.length;
  if(available<=0)return;
  const old=legacyEvents.filter(e=>events.every(x=>x.source!==e.source||Math.abs(x.at-e.at)>.25)).slice(0,available);
  const begin=nextId(events);
  const additions:SaturnEvent[]=old.map((e,i)=>({
   id:begin+i,source:e.source,at:e.at,duration:clamp(e.duration,.15,3.2),
   path:legacyRoutes[e.path],level:e.level
  }));
  if(additions.length){setEvents(xs=>[...xs,...additions].sort((a,b)=>a.at-b.at));setSelectedId(additions[0].id)}
 };
 const route=saturnPathPoints(selected?.path??'slide-left-rear',settings.depth,settings.glide);
 const routeStart=point(route[0]),routeEnd=point(route[route.length-1]);
 const active=selected&&playhead>=selected.at&&playhead<=selected.at+selected.duration;
 const ratio=selected?clamp((playhead-selected.at)/selected.duration,0,1):0;
 const position=ratio*(route.length-1),index=Math.min(route.length-2,Math.floor(position));
 const mixRatio=position-index;
 const travelPoint=point([
  route[index][0]*(1-mixRatio)+route[index+1][0]*mixRatio,
  route[index][1]*(1-mixRatio)+route[index+1][1]*mixRatio
 ]);
 const trailPoint:[number,number]=[
  route[index][0]*(1-mixRatio)+route[index+1][0]*mixRatio,
  route[index][1]*(1-mixRatio)+route[index+1][1]*mixRatio
 ];
 const visibleRoute=route.slice(0,index+1).concat([trailPoint]);
 const sourceOptions=mode==='stems'
  ?([...(['adlibs','doubles','lead'] as const).filter(k=>stems[k]?.buffer&&!stems[k]?.mute),'mix'] as OrbitSource[])
  :(['mix'] as OrbitSource[]);
 const audioHint=useMemo(()=>mode==='stems'
  ?'Uses available vocal ADLIBS / DOUBLES / LEAD, NEVER the BEAT stem.'
  :'Stereo MIX only: high-passed details are approximate; individual snare/voice instruments cannot be separated.',[mode]);
 return <section className='saturnLab' aria-label='SATURN LAB experimental spatial field'>
  <div className='saturnHeading'>
   <div><span className='saturnEyebrow'>ISOLATED V0.1 · EXPERIMENTAL WET-ONLY POST-MASTER</span>
    <h2>SATURN <span>THE REAR FIELD</span></h2>
    <p>Fixed FRONT: kick · snare · direct lead. Moving BEHIND: only selected filtered reflections, slides and rear resonance. Original TT2 / TT3 mastering remains the dry reference.</p>
   </div>
   <button className={settings.enabled?'saturnPower selected':'saturnPower'} aria-pressed={settings.enabled}
    disabled={roomPending&&!settings.enabled} onClick={()=>updateSettings('enabled',!settings.enabled)}>
    SATURN LAYER · {settings.enabled?'ON':'OFF'}
   </button>
  </div>
  <div className='saturnColumns'>
   <div className='saturnStage'>
    <svg viewBox='0 0 460 305' role='img' aria-label='SATURN diagram: anchored kick snare and lead at front, animated selected wet trajectory towards rear'>
     <defs><linearGradient id='saturnTrailGradient' x1='0%' y1='0%' x2='100%' y2='100%'><stop stopColor='#76e1df'/><stop offset='.57' stopColor='#c0a6ef'/><stop offset='1' stopColor='#f6c77c'/></linearGradient></defs>
     <rect x='2' y='2' width='456' height='301' rx='15' fill='#09111b' stroke='#263849'/>
     <ellipse cx='230' cy='198' rx='159' ry='85' fill='none' stroke='#56687f' strokeDasharray='5 9' opacity='.65'/>
     <ellipse cx='230' cy='202' rx='110' ry='46' fill='#18243a' stroke='#688bb3' strokeDasharray='3 8' opacity='.45'/>
     <circle cx='230' cy='112' r='35' fill='#243447' stroke='#90aabb'/>
     <path d='M 203 95 Q 230 78 257 95' fill='none' stroke='#b9ced8' strokeWidth='3'/>
     <text x='230' y='119' textAnchor='middle' fill='#eff8fc' fontSize='11'>YOU</text>
     <text x='230' y='23' textAnchor='middle' fill='#c1d6e7' fontSize='10' letterSpacing='2'>FRONT · LOCKED CENTER</text>
     <circle cx='142' cy='52' r='5' fill='#9ad7d2'/><text x='142' y='67' textAnchor='middle' fill='#d6ebea' fontSize='10'>KICK</text>
     <circle cx='230' cy='52' r='5' fill='#f3c57d'/><text x='230' y='67' textAnchor='middle' fill='#f9deb9' fontSize='10'>LEAD</text>
     <circle cx='318' cy='52' r='5' fill='#9ad7d2'/><text x='318' y='67' textAnchor='middle' fill='#d6ebea' fontSize='10'>SNARE</text>
     <text x='230' y='283' textAnchor='middle' fill='#93a7c4' fontSize='12' letterSpacing='3'>REAR RESONANCE FIELD</text>
     <path d={pathSvg(route)} fill='none' stroke='url(#saturnTrailGradient)' opacity='.55' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'/>
     {active&&<path d={pathSvg(visibleRoute)} fill='none' stroke='#d8c0ff' strokeWidth='5' strokeLinecap='round' strokeLinejoin='round' opacity='.97'/>}
     <circle cx={routeStart.x} cy={routeStart.y} r='5' fill='#8be2e2'/><circle cx={routeEnd.x} cy={routeEnd.y} r='5' fill='#ffe1a0'/>
     {active&&<circle cx={travelPoint.x} cy={travelPoint.y} r='9' fill='#d8c0ff' opacity='.93' stroke='#fff' strokeWidth='1.5'/>}
    </svg>
    <small>Selected event: glowing path and dot follow the shared playhead. This diagram is not a measured 3D sound field.</small>
    <div className='saturnStatus'>
     <strong>{events.length} / {SATURN_MAX_EVENTS} EVENTS</strong>
     <span>{settings.enabled?'WET FIELD ACTIVE':'BYPASSED · TT3 MASTER UNCHANGED'}</span>
    </div>
    <div className='saturnTimeline'>
     <div className='saturnTimelineHead'><b>EVENT TIMELINE</b><span>{clock(playhead)} / {clock(mix.duration)}</span></div>
     <div className='saturnTimelineTrack'>
      {events.map(e=><button key={e.id} className={e.id===selected?.id?'saturnMarker selected':'saturnMarker'}
       style={{left:clamp(e.at/mix.duration*100,0,99.5)+'%'}}
       aria-label={'SATURN event '+e.id+' at '+clock(e.at)}
       title={e.source.toUpperCase()+' '+clock(e.at)}
       onClick={()=>{setSelectedId(e.id);onSeek(e.at)}}/>)}
      <i className='saturnCursor' style={{left:clamp(playhead/mix.duration*100,0,100)+'%'}}/>
     </div>
    </div>
   </div>
   <div className='saturnControls'>
    <div className='saturnControlGrid'>
     <Slider name='WET MOTION' value={settings.wet} onChange={v=>updateSettings('wet',v)}/>
     <Slider name='REAR DEPTH' value={settings.depth} onChange={v=>updateSettings('depth',v)}/>
     <Slider name='SLIDE / GLIDE' value={settings.glide} onChange={v=>updateSettings('glide',v)}/>
     <Slider name='REAR TRAIL' value={settings.trail} onChange={v=>updateSettings('trail',v)}/>
     <Slider name='LEAD PRIORITY' value={settings.voicePriority} onChange={v=>updateSettings('voicePriority',v)}/>
    </div>
    <div className='saturnPresetRow'>
     <button onClick={()=>setSettings({...saturnDefaults,enabled:true})} aria-label='SATURN preset deep rear'>
      SATURN PRESET · DEEP REAR
     </button>
     <button onClick={()=>setSettings({...saturnDefaults,enabled:true,glide:.96,trail:.34,wet:.42})} aria-label='SATURN preset sliding field'>
      SATURN PRESET · SLIDING FIELD
     </button>
    </div>
    <div className='saturnSwitches'>
     <button aria-pressed={settings.hrtf} className={settings.hrtf?'selected':''} onClick={()=>updateSettings('hrtf',!settings.hrtf)}>
      EXPERIMENTAL HRTF · WET ONLY {settings.hrtf?'ON':'OFF'}
     </button>
     <button aria-pressed={settings.matchHrtf} className={settings.matchHrtf?'selected':''} onClick={()=>updateSettings('matchHrtf',!settings.matchHrtf)}>
      HRTF WET RMS MATCH {settings.matchHrtf?'ON':'OFF'}
     </button>
    </div>
    <small>HRTF NEVER reduces dry kick, snare or lead. The optional match compares wet-field energy only (±4 dB bounded); it cannot guarantee equal perceived timbre or real surround.</small>
    {legacyOrbitsActive&&<p className='saturnCaution'>V4.6 ORBITS IS ALSO ON: its existing wet events stay part of the earlier master. Turn those off to hear SATURN as the only motion layer; do not erase their events.</p>}
    {originalLock&&<p className='saturnCaution'>ORIGINAL LOCK is active: WAV export intentionally bypasses SATURN and all mastering. Disable lock only if you want to export processed audio.</p>}
    {roomPending&&<p className='saturnCaution'>STEMS CHANGED · REBUILD ROOM BUS before auditioning or scouting.</p>}
    <div className='saturnOutro'>
     <button type='button' onClick={addOutroOrbit} disabled={mode!=='stems'||!stems.lead?.buffer||stems.lead.mute||roomPending||originalLock||events.length>=SATURN_MAX_EVENTS||mix.duration<1}>
      SPECTRAL OUTRO · HEAD ORBIT AT PLAYHEAD
     </button>
     <small>Place the playhead at the FIRST WORD of the outro, then adjust DURATION below. The dry lead, kick and snare stay anchored. This is a moving wet reflection; HRTF ON adds experimental front/rear cues, OFF keeps an audible stereo left/right circuit. Reserve tail time in the original file: this does NOT extend the WAV.</small>
    </div>
    <div className='saturnActions'>
     <button disabled={roomPending||legacyEvents.length===0||events.length>=SATURN_MAX_EVENTS} onClick={copyLegacy}>COPY V4.6 EVENTS → SATURN</button>
     <button disabled={roomPending||events.length>=SATURN_MAX_EVENTS||mix.duration<.8} onClick={()=>scout(true)}>SCOUT BREAK · ±5s</button>
     <button disabled={roomPending||events.length>=SATURN_MAX_EVENTS||mix.duration<.8} onClick={()=>scout(false)}>SCOUT FULL · +24 MAX</button>
     <button disabled={roomPending||events.length>=SATURN_MAX_EVENTS||mix.duration<.8} onClick={addAtPlayhead}>+ EVENT AT PLAYHEAD</button>
     <button disabled={!selected} onClick={()=>{if(!selected)return;setEvents(xs=>xs.filter(x=>x.id!==selected.id));setSelectedId(null)}}>REMOVE SELECTED</button>
    </div>
    {selected&&<div className='saturnEventEditor'>
      <b>SELECTED EVENT · {clock(selected.at)}</b>
      <label>Event <select aria-label='SATURN selected event' value={selected.id} onChange={e=>setSelectedId(Number(e.currentTarget.value))}>
       {events.map(e=><option key={e.id} value={e.id}>{clock(e.at)} · {e.source.toUpperCase()} · {e.path}</option>)}
      </select></label>
      <label>Source <select aria-label='SATURN event source' value={selected.source} onChange={e=>updateEvent({source:e.currentTarget.value as OrbitSource})}>
       {sourceOptions.map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
      </select></label>
      <label>Route <select aria-label='SATURN event route' value={selected.path} onChange={e=>updateEvent({path:e.currentTarget.value as SaturnPath})}>
       {routeOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
      <label className='saturnSlider'><span>TIME · {clock(selected.at)}<b>{selected.at.toFixed(2)}s</b></span>
       <input aria-label='SATURN event time' type='range' min={0} max={Math.max(.2,mix.duration-.4)}
        step={.05} value={selected.at} onChange={e=>updateEvent({at:Number(e.currentTarget.value)})}/>
      </label>
      <label className='saturnSlider'><span>DURATION<b>{selected.duration.toFixed(2)}s</b></span>
       <input aria-label='SATURN event duration' type='range' min={.15} max={SATURN_MAX_DURATION} step={.05}
        value={selected.duration} onChange={e=>updateEvent({duration:Number(e.currentTarget.value)})}/>
      </label>
      <label>EXACT START (s)<input type='number' min={0} max={Math.max(0,mix.duration-.2)} step={.01} value={selected.at} onChange={e=>updateEvent({at:Math.round(clamp(Number(e.target.value)||0,0,Math.max(0,mix.duration-.2))*100)/100})}/></label>
      <label>EXACT DURATION (s)<input type='number' min={.15} max={SATURN_MAX_DURATION} step={.01} value={selected.duration} onChange={e=>updateEvent({duration:Math.round(clamp(Number(e.target.value)||.15,.15,SATURN_MAX_DURATION)*100)/100})}/></label>
      <Slider name='EVENT GAIN' value={selected.level} onChange={v=>updateEvent({level:v})}/>
    </div>}
    <small>{audioHint} SCOUT only ADDS new moments. SATURN is opt-in and has its own event scene; the existing V4.6 Orbits list stays untouched.</small>
   </div>
  </div>
 </section>;
}
