import {useMemo} from 'react';
import {reviewMaster,type InspectorMetrics} from './audio/masterInspector';

type Props={
 input:InspectorMetrics|null;output:InspectorMetrics|null;
 source:AudioBuffer|null;processed:AudioBuffer|null;
 busy:boolean;roomPending:boolean;originalLock:boolean
};
const display=(value:number|null|undefined,unit='',digits=1)=>
 value===null||value===undefined||!Number.isFinite(value)?'—':value.toFixed(digits)+unit;
export default function MasterInspector({input,output,source,processed,busy,roomPending,originalLock}:Props){
 const review=useMemo(()=>reviewMaster(input,output,{busy,roomPending,originalLock}),[input,output,busy,roomPending,originalLock]);
 const format=[{name:'INTEGRATED LOUDNESS',key:'lufs' as const,unit:' LUFS'},
               {name:'TRUE PEAK',key:'truePeak' as const,unit:' dBTP'},
               {name:'SAMPLE PEAK',key:'peak' as const,unit:' dBFS'},
               {name:'CREST FACTOR',key:'crest' as const,unit:' dB'},
               {name:'L/R CORRELATION',key:'correlation' as const,unit:''},
               {name:'DC OFFSET',key:'dc' as const,unit:''}];
 const sameLength=!!source&&!!processed&&source.length===processed.length&&source.sampleRate===processed.sampleRate;
 return <section data-testid='asram-master-inspector' aria-label='Read-only master inspector'
 style={{border:'1px solid #334d5b',borderRadius:14,background:'#101920',padding:16,margin:'18px 0',color:'#e4edf2'}}>
   <header style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
    <div><small>QUALITY CONTROL · READ ONLY</small><h2 style={{margin:'6px 0'}}>MASTER INSPECTOR <span style={{fontSize:12,color:'#91b8c4'}}>V0.1</span></h2>
    <p style={{fontSize:12,color:'#aabac4'}}>Measured original vs completed ENGINE buffer. A diagnostic, not automatic mastering or musical approval.</p></div>
    <b data-testid='inspector-status' style={{color:review.ready?'#a4d6cc':'#e6bf91'}}>{review.ready?'READY FOR LISTENING QA':'NOT READY FOR APPROVAL'}</b>
   </header>
   <details>
    <summary style={{cursor:'pointer',padding:'12px 0'}}>OPEN LEVEL / DYNAMICS / PHASE REPORT · {review.findings.filter(f=>f.level==='review').length} REVIEW FLAGS</summary>
    <div role='table' aria-label='Master inspector metric comparison'>
     <div role='row' style={{display:'grid',gridTemplateColumns:'minmax(125px,1fr) minmax(80px,.8fr) minmax(80px,.8fr)',gap:8,padding:'7px 0',borderBottom:'1px solid #31434d'}}>
      <b role='columnheader'>MEASUREMENT</b><b role='columnheader'>SOURCE</b><b role='columnheader'>ENGINE</b>
     </div>
     {format.map(f=><div role='row' key={f.key} style={{display:'grid',gridTemplateColumns:'minmax(125px,1fr) minmax(80px,.8fr) minmax(80px,.8fr)',gap:8,padding:'7px 0',borderBottom:'1px solid #24343c',fontSize:12}}>
       <span role='cell'>{f.name}</span><span role='cell'>{display(input?.[f.key],f.unit,f.key==='correlation'?3:f.key==='dc'?4:1)}</span><strong role='cell'>{display(output?.[f.key],f.unit,f.key==='correlation'?3:f.key==='dc'?4:1)}</strong>
     </div>)}
    </div>
    <p style={{fontSize:12}}>LOUDNESS CHANGE: {display(review.loudnessDelta,' LU',1)} · CREST CHANGE: {display(review.crestDelta,' dB',1)}</p>
    <p style={{fontSize:12,color:sameLength?'#a4d6cc':'#f0c993'}}>SOURCE / ENGINE LENGTH + SAMPLE RATE: {source&&processed?(sameLength?'MATCH':'MISMATCH — INVESTIGATE'):'NOT CHECKED'}</p>
    <div style={{display:'grid',gap:8,margin:'12px 0'}}>
     {review.findings.map((f,i)=><div key={i} style={{borderLeft:'3px solid '+(f.level==='review'?'#edb680':'#688b9e'),padding:'6px 10px',background:'#15232b'}}><b style={{fontSize:12}}>{f.name}</b><p style={{margin:'4px 0',fontSize:12,color:'#b9cbd4'}}>{f.detail}</p></div>)}
    </div>
    <p style={{fontSize:12,color:'#9eafbb'}}>These are whole-song statistics. They do not assess spatial depth, local transients, clipping in external playback devices, HRTF realism or artistic quality. A/B at matched loudness and inspect the actual exported WAV before approving TT2 / TT3 / TT4. No source audio is changed here.</p>
   </details>
 </section>;
}
