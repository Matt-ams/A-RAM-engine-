/** Read-only metrics QA. No presets, source PCM or DSP stages are mutated. */
export type InspectorMetrics={
 peak:number;truePeak:number;lufs:number;rms:number;crest:number;
 correlation:number;dc:number;sub:number;low:number;mid:number;high:number
};
export type InspectorFinding={level:'review'|'info';name:string;detail:string};
export type InspectorReview={
 findings:InspectorFinding[];loudnessDelta:number|null;crestDelta:number|null;
 monoRisk:boolean;sampleOver:boolean;ready:boolean
};
/** Operational review flags, NOT a score for musical quality or Atmos/localization certification. */
export function reviewMaster(
 input:InspectorMetrics|null,output:InspectorMetrics|null,
 state:{busy:boolean;roomPending:boolean;originalLock:boolean}
):InspectorReview{
 const findings:InspectorFinding[]=[];
 if(state.originalLock)findings.push({level:'review',name:'ORIGINAL LOCK',detail:'The export currently bypasses the master; disable lock before approving an Engine export.'});
 if(state.roomPending)findings.push({level:'review',name:'ROOM STALE',detail:'Rebuild ROOM using restored stem controls before comparing or exporting.'});
 if(state.busy)findings.push({level:'info',name:'RENDER IN PROGRESS',detail:'Measurements refer to the last completed buffer until rendering finishes.'});
 if(!input||!output)findings.push({level:'info',name:'OUTPUT UNAVAILABLE',detail:'Load a source and finish the current Engine render to inspect the output.'});
 if(output){
  if(!Number.isFinite(output.truePeak))findings.push({level:'review',name:'TRUE PEAK',detail:'True-peak reading is unavailable; verify the export WAV separately.'});
  else if(output.truePeak>0)findings.push({level:'review',name:'INTER-SAMPLE OVER',detail:'Measured true peak exceeds 0 dBTP; check for clipping.'});
  else if(output.truePeak>-.5)findings.push({level:'review',name:'TRUE-PEAK MARGIN',detail:'Less than 0.5 dBTP headroom. Check delivery requirements; -1 dBTP is a common conservative reference, not a universal law.'});
  if(output.correlation<0)findings.push({level:'review',name:'MONO / PHASE',detail:'Negative whole-song L/R correlation: inspect a mono fold-down by ear.'});
  else if(output.correlation<.2)findings.push({level:'info',name:'STEREO COMPATIBILITY',detail:'Very low whole-song correlation. Check mono; this does not prove a phase defect.'});
  if(Math.abs(output.dc)>.01)findings.push({level:'review',name:'DC OFFSET',detail:'Possible significant DC offset in the final signal.'});
  if(output.crest<4)findings.push({level:'info',name:'DYNAMICS',detail:'Very low crest factor; listen for flattened transients or intentional density.'});
 }
 const loudnessDelta=input&&output&&Number.isFinite(input.lufs)&&Number.isFinite(output.lufs)?output.lufs-input.lufs:null;
 const crestDelta=input&&output&&Number.isFinite(input.crest)&&Number.isFinite(output.crest)?output.crest-input.crest:null;
 if(!findings.length)findings.push({level:'info',name:'NO AUTOMATIC WARNINGS',detail:'No review threshold triggered; subjective A/B, mono and device listening still required.'});
 return {findings,loudnessDelta,crestDelta,monoRisk:!!output&&output.correlation<0,sampleOver:!!output&&output.truePeak>0,
 ready:!!output&&!state.busy&&!state.roomPending&&!state.originalLock};
}
