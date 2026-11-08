/**
 * A$RAM SPATIAL FIELD VISUALIZER — experimental READ-ONLY display.
 *
 * Draws the actual configured ORBIT/SATURN keyframe geometry against the
 * existing transport playhead. Never creates AudioNodes, changes DSP, presets,
 * input buffers, or the exported master. Trail opacity is a visual indication
 * derived from controls, NOT a measurement of the acoustic impulse response.
 */
import {useMemo, useState} from 'react';
import {orbitPathPositions, type OrbitEvent, type OrbitSettings} from './audio/microOrbits';
import {saturnPathPoints, type SaturnEvent, type SaturnSettings} from './audio/saturn';
import './SpatialFieldVisualizer.css';

type Point = [number, number];
type Kind = 'orbit' | 'saturn';
type FieldEvent = {
  key: string;
  kind: Kind;
  id: number;
  at: number;
  duration: number;
  source: string;
  path: string;
  level: number;
  points: Point[];
  enabled: boolean;
  residence: number;
};
type Props = {
  mix: AudioBuffer;
  playhead: number;
  playing: boolean;
  onSeek: (seconds: number) => void;
  orbitEvents: OrbitEvent[];
  orbitSettings: OrbitSettings;
  saturnEvents: SaturnEvent[];
  saturnSettings: SaturnSettings;
  haloMode: boolean;
  haloAmount: number;
  roomDepth: Record<'beat'|'lead'|'doubles'|'adlibs', number>;
  roomPending: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
// Audio coordinates: -Z is FRONT, +Z is REAR. This is a schematic top view.
const screen = ([x,z]: Point) => ({x: 320+x*88, y: 176+z*67});
function atProgress(points: Point[], t: number): Point {
  if (!points.length) return [0,0];
  if (points.length === 1) return points[0];
  const span = clamp(t,0,1)*(points.length-1);
  const index = Math.min(points.length-2,Math.floor(span));
  const mix = span-index;
  return [points[index][0]*(1-mix)+points[index+1][0]*mix,points[index][1]*(1-mix)+points[index+1][1]*mix];
}
const route = (points: Point[]) => points.map((p,i) => {
  const q=screen(p);return `${i?'L':'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}).join(' ');

function buildWaveform(buffer: AudioBuffer): string {
  const signal=buffer.getChannelData(0), bins=360;
  if (!signal.length) return '';
  const top: string[]=[], bottom: string[]=[];
  for(let i=0;i<bins;i++){
    const from=Math.floor(i*signal.length/bins),to=Math.min(signal.length,Math.floor((i+1)*signal.length/bins));
    const step=Math.max(1,Math.floor((to-from)/48));let peak=0;
    for(let s=from;s<to;s+=step)peak=Math.max(peak,Math.abs(signal[s]));
    const h=Math.max(1.3,Math.min(21,peak*28));
    const x=i*1000/(bins-1);top.push(`${i?'L':'M'}${x.toFixed(2)} ${(27-h).toFixed(2)}`);
    bottom.push(`L${x.toFixed(2)} ${(27+h).toFixed(2)}`);
  }
  return `${top.join(' ')} ${bottom.reverse().join(' ')} Z`;
}

export default function SpatialFieldVisualizer({
  mix,playhead,playing,onSeek,orbitEvents,orbitSettings,saturnEvents,saturnSettings,
  haloMode,haloAmount,roomDepth,roomPending
}:Props){
  const [mode,setMode]=useState<'follow'|'inspect'>('follow');
  const [inspectedKey,setInspectedKey]=useState<string|null>(null);
  const [showOrbit,setShowOrbit]=useState(true);
  const [showSaturn,setShowSaturn]=useState(true);
  const waveform=useMemo(()=>buildWaveform(mix),[mix]);
  const events=useMemo<FieldEvent[]>(()=>[
    ...orbitEvents.map(e=>({
      key:`orbit-${e.id}`,kind:'orbit' as Kind,id:e.id,at:e.at,duration:e.duration,
      source:e.source,path:e.path,level:e.level,
      points:orbitPathPositions(e.path,orbitSettings.rear,orbitSettings.motion??.75),
      enabled:orbitSettings.enabled,residence:orbitSettings.trail??.22
    })),
    ...saturnEvents.map(e=>({
      key:`saturn-${e.id}`,kind:'saturn' as Kind,id:e.id,at:e.at,duration:e.duration,
      source:e.source,path:e.path,level:e.level,
      points:saturnPathPoints(e.path,saturnSettings.depth,saturnSettings.glide),
      enabled:saturnSettings.enabled,residence:saturnSettings.trail
    }))
  ].sort((a,b)=>a.at-b.at),[
    orbitEvents,orbitSettings.enabled,orbitSettings.rear,orbitSettings.motion,orbitSettings.trail,
    saturnEvents,saturnSettings.enabled,saturnSettings.depth,saturnSettings.glide,saturnSettings.trail
  ]);
  const visible=events.filter(e=>(e.kind==='orbit'?showOrbit:showSaturn));
  const active=visible.filter(e=>e.enabled&&playhead>=e.at&&playhead<e.at+e.duration);
  const tails=visible.filter(e=>{
    const seconds=.15+.65*e.residence;
    return e.enabled&&playhead>=e.at+e.duration&&playhead<e.at+e.duration+seconds;
  });
  const inspected=visible.find(e=>e.key===inspectedKey)??null;
  const focused=mode==='inspect'&&inspected?inspected:active[0]??null;
  const inView=[...active,...tails].filter((e,i,all)=>all.findIndex(x=>x.key===e.key)===i);
  const plotted=focused&&inView.every(e=>e.key!==focused.key)?[...inView,focused]:inView;
  const nearest=[...visible].sort((a,b)=>Math.abs(a.at-playhead)-Math.abs(b.at-playhead)).slice(0,8);
  const duration=Math.max(.001,mix.duration);
  const clickWave=(event:React.MouseEvent<HTMLDivElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    if(rect.width)onSeek(clamp((event.clientX-rect.left)/rect.width,0,1)*duration);
  };
  return <section className='asramField' aria-label='Spatial Field Visualizer — experimental read-only view'>
    <div className='asramFieldHeader'>
      <div><span className='asramFieldEyebrow'>A$RAM ENGINE · EXPERIMENTAL VISUAL LAYER</span>
        <h2>SPATIAL FIELD <em>VISUALIZER</em></h2>
        <p>See configured ORBIT motion, SATURN resonance and ROOM depth on the same song clock. Visualization only — master audio untouched.</p>
      </div>
      <div className='asramFieldStatus'><span className={playing?'asramFieldLight live':'asramFieldLight'}/>{playing?'FOLLOWING PLAYBACK':'TRANSPORT PAUSED'}<b>{clock(playhead)} / {clock(mix.duration)}</b></div>
    </div>
    <div className='asramFieldTimeline'>
      <div className='asramFieldTimelineTop'><span>01 / MASTER WAVEFORM · CLICK TO SEEK</span><span>{orbitEvents.length} ORBIT EVENTS · {saturnEvents.length} SATURN EVENTS</span></div>
      <div className='asramFieldWave' onClick={clickWave} title='Seek using the existing ENGINE transport'>
        <svg viewBox='0 0 1000 54' preserveAspectRatio='none' aria-hidden='true'><path d={waveform} fill='#579cae' opacity='.67'/><line x1='0' x2='1000' y1='27' y2='27' stroke='#7eb0c2' strokeOpacity='.25'/></svg>
        {visible.map(e=><span key={e.key} className={`asramFieldWaveMarker ${e.kind}`} style={{left:`${clamp(e.at/duration*100,0,100)}%`}} title={`${e.kind.toUpperCase()} · ${clock(e.at)} · ${e.source}`}/>)}
        <span className='asramFieldPlayhead' style={{left:`${clamp(playhead/duration*100,0,100)}%`}}/>
      </div>
      <input aria-label='Spatial visualizer song position' className='asramFieldSeek' type='range' min='0' max={duration} step='.01' value={clamp(playhead,0,duration)} onChange={e=>onSeek(Number(e.currentTarget.value))}/>
    </div>
    <div className='asramFieldBody'>
      <div className='asramFieldScene'>
        <div className='asramFieldSceneBar'><span>02 / LISTENER FIELD · TOP VIEW</span><span>FRONT −Z / REAR +Z</span></div>
        <svg viewBox='0 0 640 418' className='asramFieldStage' role='img' aria-label='Schematic spatial field of configured moving wet events around a fixed center'>
          <defs><radialGradient id='asram-field-bg'><stop stopColor='#1e3341'/><stop offset='1' stopColor='#070c13'/></radialGradient><filter id='asram-field-glow'><feGaussianBlur stdDeviation='3.5'/></filter></defs>
          <rect width='640' height='418' rx='16' fill='url(#asram-field-bg)'/>
          {[70,145,220].map(r=><ellipse key={r} cx='320' cy='176' rx={r} ry={r*.78} fill='none' stroke='#5b8297' strokeOpacity='.23' strokeDasharray='4 9'/>)}
          <path d='M 320 16 V400 M 31 176 H609' stroke='#5b8297' strokeOpacity='.2' strokeDasharray='5 9'/>
          <text x='320' y='20' fill='#9cb6c6' textAnchor='middle' fontSize='12' letterSpacing='3'>FRONT · DIRECT</text>
          <text x='320' y='403' fill='#c6b6db' textAnchor='middle' fontSize='12' letterSpacing='3'>REAR · RESONANCE</text>
          <text x='36' y='170' fill='#769cae' fontSize='12'>LEFT</text><text x='575' y='170' fill='#769cae' fontSize='12'>RIGHT</text>
          <circle cx='320' cy='176' r='39' fill='#182a38' stroke='#789bad' strokeWidth='2'/>
          <path d='M 306 164 Q 320 152 334 164' fill='none' stroke='#a6c0cd' strokeWidth='4' strokeLinecap='round'/>
          <circle cx='320' cy='179' r='10' fill='#cedbe2'/>
          <path d='M 320 154 V125' stroke='#d8e5eb' strokeWidth='2'/><path d='M 313 134 L 320 123 L 327 134' stroke='#d8e5eb' fill='none'/>
          <text x='320' y='230' textAnchor='middle' fontSize='11' fill='#cbdbe5'>CENTER LOCK</text>
          {haloMode&&<ellipse cx='320' cy='176' rx={70+haloAmount*65} ry={65+haloAmount*68} fill='none' stroke='#a8ced8' strokeOpacity={.14+haloAmount*.3} strokeWidth='5' strokeDasharray='7 13'/>}
          {plotted.map(e=>{
            const isRunning=e.enabled&&playhead>=e.at&&playhead<e.at+e.duration;
            const progress=clamp((playhead-e.at)/Math.max(.01,e.duration),0,1);
            const p=screen(atProgress(e.points,progress));
            const tailLife=.15+.65*e.residence;
            const fade=isRunning?1:playhead<e.at?.34:Math.max(.05,1-(playhead-e.at-e.duration)/tailLife);
            const color=e.kind==='orbit'?'#75dce4':'#c5a4ee';
            return <g key={e.key} opacity={e.enabled?fade:.23}>
              <path d={route(e.points)} fill='none' stroke={color} strokeWidth={focused?.key===e.key?3:1.8} strokeDasharray={isRunning?'':'5 7'} strokeOpacity='.7'/>
              {isRunning&&<circle cx={p.x} cy={p.y} r={14+e.residence*12} fill={color} opacity='.34' filter='url(#asram-field-glow)'/>}
              <circle cx={p.x} cy={p.y} r={isRunning?7:4} fill={color} stroke='#07121b' strokeWidth='2'/>
            </g>;
          })}
        </svg>
        <div className='asramFieldStats'><span>BEAT DEPTH <b>{Math.round(roomDepth.beat*100)}%</b></span><span>LEAD DEPTH <b>{Math.round(roomDepth.lead*100)}%</b></span><span>HALO <b>{haloMode?`${Math.round(haloAmount*100)}%`:'OFF'}</b></span><span>ACTIVE <b>{active.length}</b></span><span>TRAILS <b>{tails.length}</b></span></div>
        <p className='asramFieldDisclaimer'>Schematic keyframe positions, not a physical sound-field measurement. Trail persistence is an illustrative control preview; headphones and DSP determine the actual auditory image.</p>
      </div>
      <div className='asramFieldInspector'>
        <div className='asramFieldInspectorHead'><span>03 / EVENT INSPECTOR</span><div><button className={mode==='follow'?'selected':''} onClick={()=>setMode('follow')}>FOLLOW</button><button className={mode==='inspect'?'selected':''} onClick={()=>setMode('inspect')}>INSPECT</button></div></div>
        <div className='asramFieldFilter'><button className={showOrbit?'on':''} aria-pressed={showOrbit} onClick={()=>setShowOrbit(x=>!x)}>ORBIT <b>{orbitEvents.length}</b></button><button className={showSaturn?'on':''} aria-pressed={showSaturn} onClick={()=>setShowSaturn(x=>!x)}>SATURN <b>{saturnEvents.length}</b></button></div>
        <div className='asramFieldFeature'><small>{focused?'CURRENT EVENT':'NO ACTIVE MOTION'}</small><b>{focused?`${focused.kind.toUpperCase()} · ${focused.source.toUpperCase()}`:'CENTER / ROOM ANCHOR'}</b><span>{focused?focused.path.split('-').join(' → ').toUpperCase():'Wait for an event or select one below.'}</span></div>
        <div className='asramFieldEvents' aria-label='Events nearest current playhead'>
          {nearest.length?nearest.map(e=><button key={e.key} className={focused?.key===e.key?'focused':''} onClick={()=>{setMode('inspect');setInspectedKey(e.key);onSeek(e.at)}} title={`Seek to ${e.kind.toUpperCase()} at ${clock(e.at)}`}>
            <span className={`asramFieldDot ${e.kind}`}/><b>{clock(e.at)}</b><span>{e.source.toUpperCase()} · {e.path.split('-').join(' ')}</span><small>{e.enabled?'ON':'OFF'}</small>
          </button>):<p>No ORBIT or SATURN events yet. The original ENGINE controls can create them.</p>}
        </div>
        {roomPending&&<p className='asramFieldPending'>ROOM changes pending. Rebuild ROOM BUS before evaluating the audio; this view does not trigger renders.</p>}
        <p className='asramFieldDisclaimer'>READ ONLY · Select an event to seek. This panel never changes event positions, stem gain, master DSP or WAV output.</p>
      </div>
    </div>
  </section>;
}
