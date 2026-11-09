import {useMemo,useState,type Dispatch,type SetStateAction} from 'react';
import {scoutMusicalDirector} from './audio/musicalDirector';
import {
 orbitEventSources,scoutMicroOrbits,scoutVocalPhrases,ORBIT_MAX_EVENTS,ORBIT_MAX_DURATION,orbitPathPositions,type OrbitEvent,type OrbitSettings,
 type OrbitSource,type OrbitPath,type OrbitBand,type OrbitStemMap
} from './audio/microOrbits';

type Props={
 mix:AudioBuffer; mode:'stems'|'stereo';stems:OrbitStemMap;
 events:OrbitEvent[];setEvents:Dispatch<SetStateAction<OrbitEvent[]>>;
 settings:OrbitSettings;setSettings:Dispatch<SetStateAction<OrbitSettings>>;
 playhead:number;playing:boolean;onTogglePlay:()=>void;onSeek:(seconds:number)=>void;originalLock:boolean;roomPending?:boolean;
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
export default function MicroOrbitsPanel({mix,mode,stems,events,setEvents,settings,setSettings,playhead,playing,onTogglePlay,onSeek,originalLock,roomPending=false}:Props){
 const [selectedId,setSelectedId]=useState<number|null>(null);
 // Downsample once per source buffer, NOT 60 times per second while playback moves.
 const waveform=useMemo(()=>{
  const data=mix.getChannelData(0),bins=224,step=Math.max(1,Math.floor(data.length/bins));
  const top:string[]=[],bottom:string[]=[];
  for(let i=0;i<bins;i++){
   let peak=0;const begin=i*step,finish=Math.min(data.length,begin+step);
   for(let j=begin;j<finish;j+=Math.max(1,Math.floor(step/55)))peak=Math.max(peak,Math.abs(data[j]));
   const value=Math.max(2,Math.min(29,peak*40));
   top.push(`${i===0?'M':'L'} ${(i*1000/(bins-1)).toFixed(1)} ${(34-value).toFixed(1)}`);
   bottom.push(`L ${(i*1000/(bins-1)).toFixed(1)} ${(34+value).toFixed(1)}`);
  }
  return top.join(' ')+' '+bottom.reverse().join(' ')+' Z';
 },[mix]);
 const selected=events.find(e=>e.id===selectedId)??events[0]??null;
 const candidates=useMemo(()=>orbitEventSources(stems,mode).map(s=>s.source),[stems,mode]);
 const availableSources:OrbitSource[]=mode==='stems'?[...candidates,'mix']:['mix'];
 const updateSetting=<K extends keyof OrbitSettings>(k:K,v:OrbitSettings[K])=>setSettings(s=>({...s,[k]:v}));
 const updateEvent=(p:Partial<OrbitEvent>)=>{if(!selected)return;setEvents(es=>es.map(e=>e.id===selected.id?{...e,...p}:e))};
 const addManual=()=>{setEvents(prev=>{
  if(prev.length>=ORBIT_MAX_EVENTS)return prev;
  const at=Math.round(clamp(playhead,0,Math.max(0,mix.duration-.8))*100)/100;
  const source=availableSources[0]??'mix';
  const duration=source==='mix'?.45:source==='lead'?.85:.9;
  const id=Math.max(Date.now(),...prev.map(e=>e.id+1));
  setSelectedId(id);
  const event:OrbitEvent={id,source,at,duration,path:'front-to-rear-left',band:source==='lead'?'voice':'detail',level:.75};return [...prev,event].sort((a,b)=>a.at-b.at);
 })};
 const scan=(around=false,kind:'voice'|'details'='voice')=>{
  const proposals=kind==='voice'
    ?scoutVocalPhrases(mix,stems,mode,around?7:18,around?playhead:undefined)
    :scoutMicroOrbits(mix,stems,mode,around?4:7,around?playhead:undefined);
  // Only add genuinely new suggestions; never erase approved manual events.
  setEvents(prev=>{
   let nextId=Math.max(Date.now(),...prev.map(e=>e.id+1));
   const additions=proposals.filter(candidate=>prev.every(e=>Math.abs(e.at-candidate.at)>.4||e.source!==candidate.source))
     .slice(0,Math.max(0,ORBIT_MAX_EVENTS-prev.length))
     .map(p=>({...p,id:nextId++}));
   if(additions.length)setSelectedId(additions[0].id);
   return additions.length?[...prev,...additions].sort((a,b)=>a.at-b.at):prev;
  });
 };
 const recomposeWholeSong=()=>{
  if(mode!=='stems'||!candidates.length)return;
  const suggestions=scoutMusicalDirector(mix,stems,mode,Math.max(8,Math.min(24,Math.round(mix.duration/10))));
  // Explicit RECOMPOSE replaces previously suggested/manual event positions.
  // It never touches the audio itself. User can save preset first.
  let id=Math.max(Date.now(),...events.map(e=>e.id+1));
  const scene=suggestions.map(e=>({...e,id:id++}));
  setEvents(scene);
  setSelectedId(scene[0]?.id??null);
  if(scene.length)setSettings(s=>({...s,enabled:true,amount:Math.max(.52,s.amount),presence:s.presence??.72}));
 };
 const appendDirector=()=>{
  if(mode!=='stems'||!candidates.length)return;
  const proposals=scoutMusicalDirector(mix,stems,mode,18);
  if(proposals.length)setSettings(s=>({...s,enabled:true,amount:Math.max(.52,s.amount),presence:s.presence??.72}));
  setEvents(prev=>{
   let id=Math.max(Date.now(),...prev.map(e=>e.id+1));
   const additions=proposals.filter(e=>prev.every(p=>Math.abs(p.at-e.at)>.65))
    .slice(0,Math.max(0,ORBIT_MAX_EVENTS-prev.length)).map(e=>({...e,id:id++}));
   if(additions.length)setSelectedId(additions[0].id);
   return [...prev,...additions].sort((a,b)=>a.at-b.at);
  });
 };
 const addTagSweep=()=>{
  setEvents(prev=>{
   if(prev.length>=ORBIT_MAX_EVENTS)return prev;
   const source:OrbitSource=availableSources.includes('lead')?'lead':availableSources.includes('adlibs')?'adlibs':availableSources.includes('doubles')?'doubles':'mix';
   const id=Math.max(Date.now(),...prev.map(e=>e.id+1));
   const at=Math.round(clamp(playhead,0,Math.max(0,mix.duration-2.2))*100)/100;
   // This is a deliberate MANUAL placement, NOT a claim of speech recognition.
   const event:OrbitEvent={id,source,at,duration:Math.min(2.2,mix.duration-at),
     path:'left-rear-right',band:'voice',level:1};
   setSelectedId(id);
   return [...prev,event].sort((a,b)=>a.at-b.at);
  });
 };
 const points=orbitPathPositions(selected?.path??'left-rear-right',settings.rear,settings.motion??.75);
 const rearPath=svgPath(points);
 const begin=points[0],end=points[points.length-1];
 const screenPoint=([x,z]:[number,number])=>({x:240+x*65,y:127+z*44});
 // Cursor and moving dot use exactly the same clock as the upper playback transport.
 const highlighted=selected&&playhead>=selected.at&&playhead<selected.at+selected.duration;
 const eventProgress=selected?clamp((playhead-selected.at)/Math.max(.001,selected.duration),0,1):0;
 const section=eventProgress*(points.length-1),pointIndex=Math.min(points.length-2,Math.floor(section)),blend=section-pointIndex;
 const motionPoint=screenPoint([points[pointIndex][0]*(1-blend)+points[pointIndex+1][0]*blend,points[pointIndex][1]*(1-blend)+points[pointIndex+1][1]*blend]);
 return <section className='orbitLab' aria-label='Rear Orbits Micro Events'>
  <header className='orbitHead'>
   <div><p className='orbitEyebrow'>EXPERIMENTAL WHOLE-SONG MOTION · WET ONLY</p><h2>REAR ORBITS <span>MUSICAL SPATIAL DIRECTOR</span></h2><p>Arrange audible, section-aware motion through the whole song: vocal entrances, adlib responses, changes in energy and meaningful silences. Dry BEAT, main LEAD and ROOM stay anchored.</p></div>
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
     <circle cx={motionPoint.x} cy={motionPoint.y} r={highlighted?7:4} fill='#c9f0f2' opacity={highlighted?1:.3}/>
     <text x='240' y='22' fill='#9ec0cb' textAnchor='middle' fontSize='11' fontFamily='monospace'>FRONT / DRY ANCHOR</text>
     <text x='240' y='263' fill='#c6b3dc' textAnchor='middle' fontSize='11' fontFamily='monospace'>BEHIND · WET REFLECTIONS</text>
     <text x='94' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>LEFT EAR</text>
     <text x='389' y='92' fill='#a3c0cf' textAnchor='middle' fontSize='11' fontFamily='monospace'>RIGHT EAR</text>
    </svg>
    <small>Position dot follows the same song playhead as the mini waveform when the selected event is active. 3D HRTF perception still depends on headphones and the listener.</small>
   </div>
   <div className='orbitWorkbench'>
    <div className='orbitControls'>
     <label>WET INTENSITY <b>{Math.round(settings.amount*100)}%</b><input aria-label='Orbit wet intensity' type='range' min='0' max='100' step='5' value={settings.amount*100} onChange={e=>updateSetting('amount',Number(e.target.value)/100)}/></label>
     <label>REAR DEPTH <b>{Math.round(settings.rear*100)}%</b><input aria-label='Orbit rear depth' type='range' min='0' max='100' step='5' value={settings.rear*100} onChange={e=>updateSetting('rear',Number(e.target.value)/100)}/></label>
    </div>
    <div className='orbitControls'>
     <label>MOTION PRESENCE <b>{Math.round((settings.presence??.72)*100)}%</b><input aria-label='Orbit motion presence' type='range' min='0' max='100' step='5' value={(settings.presence??.72)*100} onChange={e=>updateSetting('presence',Number(e.target.value)/100)}/></label>
     <label>TRAJECTORY SPAN <b>{Math.round((settings.motion??.75)*100)}%</b><input aria-label='Orbit trajectory span' type='range' min='0' max='100' step='5' value={(settings.motion??.75)*100} onChange={e=>updateSetting('motion',Number(e.target.value)/100)}/></label>
     <label>REAR PERSISTENCE <b>{Math.round((settings.trail??.22)*100)}%</b><input aria-label='Orbit rear persistence' type='range' min='0' max='100' step='5' value={(settings.trail??.22)*100} onChange={e=>updateSetting('trail',Number(e.target.value)/100)}/></label>
    </div>
    <div className='orbitControls orbitVoiceProtect'>
      <label>VOICE PRIORITY · WET DUCK <b>{Math.round((settings.voicePriority??.72)*100)}%</b><input aria-label='Orbit voice priority' type='range' min='0' max='100' step='5' value={(settings.voicePriority??.72)*100} onChange={e=>updateSetting('voicePriority',Number(e.target.value)/100)}/></label>
      <small>{mode==='stems'&&stems.lead?.buffer&&!stems.lead.mute?'LEAD detected · mobile reflections automatically yield while your main vocal is singing.':'Requires an active LEAD stem for automatic vocal priority; no separation of voices from stereo mixes.'} Main LEAD and BEAT are never ducked.</small>
    </div>
    <button className={settings.hrtf?'orbitHrtf on':'orbitHrtf'} aria-pressed={settings.hrtf} onClick={()=>updateSetting('hrtf',!settings.hrtf)}>3D HRTF · WET ONLY {settings.hrtf?'ON':'OFF'}</button>
    <p className='orbitDetailNote'>MOTION PRESENCE increases only the moving reflection, with bounded headroom protection. 3D HRTF OFF keeps strong left/right stereo trajectories; ON is experimental for front/rear. New presets start in stereo mode. This is NOT discrete Atmos.</p>
    {roomPending&&<p className='orbitPending' role='status'>STEMS CHANGED OR ROOM SETTINGS PENDING · REBUILD ROOM BUS BEFORE USING SMART SCOUT OR RE-ENABLING ORBITS.</p>}
    <div className='orbitActions'>
     <button onClick={recomposeWholeSong} disabled={roomPending||mode!=='stems'||!candidates.length||mix.duration<1} title='Replace all ORBIT events with a new section-aware whole-song proposal; save preset first if you want to keep existing manual positions.'>MUSICAL DIRECTOR · RECOMPOSE WHOLE SONG</button>
     <button onClick={appendDirector} disabled={roomPending||mode!=='stems'||!candidates.length||events.length>=ORBIT_MAX_EVENTS||mix.duration<1}>DIRECTOR · ADD SONG MOMENTS</button>
     <button onClick={()=>scan(true,'voice')} disabled={roomPending||events.length>=ORBIT_MAX_EVENTS||mix.duration<.8}>SCOUT VOCAL PHRASES · ±4s</button>
     <button onClick={()=>scan(false,'voice')} disabled={roomPending||events.length>=ORBIT_MAX_EVENTS||mix.duration<.8}>SCOUT VOCAL PHRASES · FULL TRACK</button>
     <button onClick={()=>scan(true,'details')} disabled={roomPending||events.length>=ORBIT_MAX_EVENTS||mix.duration<.8}>SCOUT TRANSIENT DETAILS · ±4s</button>
     <button onClick={addTagSweep} disabled={roomPending||events.length>=ORBIT_MAX_EVENTS||mix.duration<.8}>EAR-TO-EAR MANUAL ACCENT ({clock(playhead)})</button>
     <button onClick={addManual} disabled={roomPending||events.length>=ORBIT_MAX_EVENTS||mix.duration<.8}>+ DETAIL AT PLAYHEAD ({clock(playhead)})</button>
     <button onClick={()=>{setEvents([]);setSelectedId(null)}} disabled={!events.length}>CLEAR</button>
    </div>
    <small className='orbitDetailNote'>MUSICAL DIRECTOR · RECOMPOSE replaces the ORBIT scene; SAVE SETTINGS beforehand if you want to preserve manual edits. ADD SONG MOMENTS preserves existing events. EAR-TO-EAR ACCENT is a manual option, not the director's target.</small>
    <small className='orbitDetailNote'>MUSICAL DIRECTOR V0.1 uses LEAD / DOUBLES / ADLIBS envelope onsets and local structural contrast to distribute meaningful changes through the track. It cannot recognize lyrics, isolate individual instruments from a stereo file or assess emotion. It never moves the original BEAT. A vocal stem is required for whole-song direction. Up to 48 wet events remain available for editing; the director deliberately creates fewer.</small>
   </div>
  </div>
  <div className='orbitTimeline'>
    <div className='orbitTimelineTitle'><b>ORBIT SYNC TIMELINE · SAME CLOCK AS MAIN PLAYER</b><span>{events.length} / {ORBIT_MAX_EVENTS} events</span></div>
    <div className='orbitMiniTransport'>
      <button aria-label={playing?'Pause from Orbit timeline':'Play from Orbit timeline'} onClick={onTogglePlay}>{playing?'Ⅱ  PAUSE':'▶  PLAY'}</button>
      <b className='orbitTimecode' aria-label='Orbit current time'>{clock(playhead)} / {clock(mix.duration)}</b>
      <span>{events.find(e=>playhead>=e.at&&playhead<e.at+e.duration)?'● WET DETAIL IN THIS SECTION':'ROOM BUS / MASTER PLAYHEAD'}</span>
    </div>
    <div className='orbitMiniWave' aria-label='Orbit mini waveform synchronized to main song'>
      <svg viewBox='0 0 1000 68' preserveAspectRatio='none' aria-hidden='true'><path d={waveform} fill='#769fb2' opacity='.7'/><path d='M 0 34 L 1000 34' stroke='#7799a7' strokeOpacity='.25'/></svg>
      <div className='orbitEventRegions' aria-hidden='true'>
        {events.map(e=><span key={e.id} className={selected?.id===e.id?'orbitEventRegion selected':'orbitEventRegion'} style={{left:`${clamp(e.at/mix.duration*100,0,99.8)}%`,width:`${Math.max(.3,Math.min(100-e.at/mix.duration*100,e.duration/mix.duration*100))}%`}}/>)}
      </div>
      <div className='orbitMiniCursor' data-testid='orbit-synced-playhead' style={{left:`${clamp(playhead/mix.duration*100,0,100)}%`}}/>
      <input className='orbitMiniSeek' aria-label='Orbit synced timeline seek' type='range' min='0' max={mix.duration} step='.01' value={playhead} onChange={e=>onSeek(Number(e.target.value))}/>
    </div>
    <div className='orbitMiniRuler'><small>0:00</small><small>SELECT A BREAK BELOW OR DRAG THE PLAYHEAD ABOVE</small><small>{clock(mix.duration)}</small></div>
    <div className='orbitTrack' role='group' aria-label='Selected micro-events along track'>
      {events.map(e=><button key={e.id} className={selected?.id===e.id?'orbitMarker selected':'orbitMarker'} title={`${e.source.toUpperCase()} · ${clock(e.at)} · ${e.path}`} style={{left:`${clamp(e.at/mix.duration*100,0,99)}%`}} aria-label={`Event ${e.source} at ${clock(e.at)}`} onClick={()=>{setSelectedId(e.id);onSeek(e.at)}}/>)}
    </div>
  </div>
  {selected?<div className='orbitEditor'>
   <div className='orbitSelected'><strong>DETAIL {events.indexOf(selected)+1} · {selected.source.toUpperCase()}</strong><span>{clock(selected.at)} → {clock(selected.at+selected.duration)} · WET ONLY</span></div>
   <div className='orbitEditorGrid'>
    <label>SOURCE<select aria-label='Orbit event source' value={selected.source} onChange={e=>updateEvent({source:e.target.value as OrbitSource,band:e.target.value==='lead'?'voice':'detail'})}>{availableSources.map(s=><option value={s} key={s}>{s==='mix'?'STEREO / ROOM MIX · FILTERED':s.toUpperCase()}</option>)}</select></label>
    <label>ROUTE<select aria-label='Orbit event route' value={selected.path} onChange={e=>updateEvent({path:e.target.value as OrbitPath})}>{paths.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <label>DETAIL BAND<select aria-label='Orbit event band' value={selected.band} onChange={e=>updateEvent({band:e.target.value as OrbitBand})}><option value='detail'>BRIGHT DETAIL</option><option value='voice'>VOCAL PRESENCE</option></select></label>
    <label>START · {selected.at.toFixed(2)}s<input aria-label='Orbit event time' type='range' min='0' max={Math.max(.1,mix.duration-.15)} step='.05' value={selected.at} onChange={e=>updateEvent({at:Number(e.target.value)})}/></label>
    <label>DURATION · {selected.duration.toFixed(2)}s (MAX {ORBIT_MAX_DURATION}s)<input aria-label='Orbit event duration' type='range' min='.15' max={ORBIT_MAX_DURATION} step='.05' value={selected.duration} onChange={e=>updateEvent({duration:Number(e.target.value)})}/></label>
    <label>EVENT LEVEL · {Math.round(selected.level*100)}%<input aria-label='Orbit event level' type='range' min='0' max='100' step='5' value={selected.level*100} onChange={e=>updateEvent({level:Number(e.target.value)/100})}/></label>
    <label>EXACT START (SECONDS)<input aria-label='Orbit exact event start' type='number' min='0' max={Math.max(0,mix.duration-.15)} step='.01' value={selected.at} onChange={e=>updateEvent({at:Math.round(clamp(Number(e.target.value)||0,0,Math.max(0,mix.duration-.15))*100)/100})}/></label>
    <label>EXACT DURATION (SECONDS)<input aria-label='Orbit exact event duration' type='number' min='.12' max={ORBIT_MAX_DURATION} step='.01' value={selected.duration} onChange={e=>updateEvent({duration:Math.round(clamp(Number(e.target.value)||.12,.12,ORBIT_MAX_DURATION)*100)/100})}/></label>
    <label>PHRASE NOTE (OPTIONAL)<input aria-label='Orbit optional phrase note' type='text' maxLength={120} placeholder='Nevermind / yeah yeah / full line…' value={selected.note??''} onChange={e=>updateEvent({note:e.target.value})}/></label>
   </div>
   <button className='orbitRemove' onClick={()=>{setEvents(es=>es.filter(e=>e.id!==selected.id));setSelectedId(null)}}>REMOVE SELECTED DETAIL</button>
  </div>:<div className='orbitEmpty'>No orbit events. Let MUSICAL DIRECTOR propose a whole-song scene, then extend or fine-tune any phrase without changing your original BEAT, LEAD or ROOM.</div>}
  <div className='orbitFooter'>
   <span>{settings.enabled?'ON · ORBIT WET LAYER INCLUDED IN NEXT MASTER RENDER':'OFF · ORIGINAL AUDIO PIPELINE BYPASSED EXACTLY'}</span>
   {originalLock&&<b>ORIGINAL LOCK IS ON — ORBITS WILL NOT ENTER LOCKED EXPORT</b>}
  </div>
 </section>;
}
