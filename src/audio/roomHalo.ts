/** ROOM V4.3 Clean Center + Halo
 * Reuses the exact original V4.1 Classic mixer graph when halo=0 and centerLead=false.
 * Only the HALO mode optionally anchors lead dry and adds distant, filtered, low-level WET taps.
 * The unfiltered dry signal and beat's classic duplicate structure remain in their original path.
 * Not convolution/realtime HRTF; wet taps create perceived distance without replacing direct timbre.
 */
export type StemKey='beat'|'lead'|'doubles'|'adlibs';
export type Stem={buffer:AudioBuffer|null;gain:number;pan:number;mute:boolean;solo:boolean};
export type Copy={id:number;key:StemKey;pan:number;depth:number;distance?:number};
export async function renderCleanHalo(
 stems:Record<StemKey,Stem>,
 roomDepth:Record<StemKey,number>,
 roomCopies:Copy[],
 binauralStems:boolean,
 halo:number,
 size:number,
 absorption:number,
 centerLead=true
):Promise<AudioBuffer>{
 halo=Math.min(.5,Math.max(0,Number.isFinite(halo)?halo:0));
 size=Math.min(1,Math.max(0,Number.isFinite(size)?size:0));
 absorption=Math.min(1,Math.max(0,Number.isFinite(absorption)?absorption:0));
 const keys=(Object.keys(stems) as StemKey[]).filter(k=>stems[k].buffer);if(!stems.beat.buffer||!stems.lead.buffer)throw Error('BEAT + LEAD required');const sr=halo>0?Math.min(96000,Math.max(...keys.map(k=>stems[k].buffer!.sampleRate))):stems.beat.buffer.sampleRate,len=halo>0?Math.ceil((Math.max(...keys.map(k=>stems[k].buffer!.duration))+.36)*sr):Math.max(...keys.map(k=>stems[k].buffer!.length)),ctx=new OfflineAudioContext(2,len,sr),anySolo=keys.some(k=>stems[k].solo);keys.forEach(k=>{const st=stems[k];if(st.mute||(anySolo&&!st.solo))return;const copies=roomCopies.filter(c=>c.key===k&&!(centerLead&&k==='lead')),positions=[{pan:st.pan,depth:roomDepth[k]},...copies];positions.forEach((pos,index)=>{const s=ctx.createBufferSource(),g=ctx.createGain(),pan=ctx.createStereoPanner();s.buffer=st.buffer;g.gain.value=Math.pow(10,st.gain/20)/positions.length*(binauralStems?.85:1);pan.pan.value=centerLead&&k==='lead'?0:pos.pan;const depth=centerLead&&k==='lead'?0:pos.depth;if(binauralStems&&!(centerLead&&k==='lead')){const h=ctx.createPanner();h.panningModel='HRTF';h.distanceModel='inverse';h.refDistance=1;h.maxDistance=20;h.rolloffFactor=.22;h.coneInnerAngle=360;h.positionX.value=pos.pan*3;h.positionY.value=0;h.positionZ.value=depth>=0?-(.7+depth*4):(.7+Math.abs(depth)*4);s.connect(g).connect(h).connect(ctx.destination)}else{ s.connect(g).connect(pan).connect(ctx.destination)}if((!binauralStems||(centerLead&&k==='lead'))&&depth>.01){const tap=ctx.createDelay(.1),wet=ctx.createGain(),tap2=ctx.createDelay(.1),wet2=ctx.createGain();tap.delayTime.value=.017+depth*.021;tap2.delayTime.value=.034+depth*.027;wet.gain.value=depth*.085;wet2.gain.value=depth*.045;pan.connect(tap).connect(wet).connect(ctx.destination);pan.connect(tap2).connect(wet2).connect(ctx.destination)}if(halo>0&&index===0){
  // Pure wet path; never EQ, cross-filter, or decorrelate the musical dry signal.
  // 83/141/223ms delay taps avoid sub-35ms comb coloration.
  const filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=420;
  const damp=ctx.createBiquadFilter();damp.type='lowpass';damp.frequency.value=6900-2200*absorption;
  s.connect(filter);filter.connect(damp);
  const leadWet=k==='lead'?.38:1;
  for(let j=0;j<3;j++){
   const delay=ctx.createDelay(.4);delay.delayTime.value=[.083,.141,.223][j]+size*[.02,.03,.05][j];
   const stereo=ctx.createStereoPanner();stereo.pan.value=[-.85,.83,-.66][j];
   const wet=ctx.createGain();wet.gain.value=Math.pow(10,Math.max(-48,st.gain)/20)*halo*.075*leadWet*[1,.75,.52][j]*(1-.65*absorption);
   damp.connect(delay);delay.connect(stereo);stereo.connect(wet);wet.connect(ctx.destination);
  }
 }s.start()})});return await ctx.startRendering()
}
