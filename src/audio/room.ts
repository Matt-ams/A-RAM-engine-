/**
 * A$RAM ROOM V4.2 — geometry-inspired, frequency-conscious STEM room rendering.
 *
 * Explicitly NOT ray tracing, Dolby Atmos, an individualized HRTF, or a measured room IR.
 * - All stems remain synchronous at the dry onset (no fake speed-of-sound alignment delays).
 * - Mono sub is centered, copy sub is suppressed, and stereo source channels stay distinct.
 * - HRTF is emitted from 1 mono or 2 stereo virtual sources; position is audible but HRTF is browser-specific.
 * - Early and late room reflections are bounded non-feedback delay taps.
 * - Different sample rates are resampled by the OfflineAudioContext and the output is allocated in SECONDS.
 */
export type RoomStemKey='beat'|'lead'|'doubles'|'adlibs';
export type RoomStem={buffer:AudioBuffer|null;gain:number;pan:number;mute:boolean;solo:boolean};
export type RoomCopy={id:number;key:RoomStemKey;pan:number;depth:number;distance?:number};
export type RoomOptions={
 roomDepth:Record<RoomStemKey,number>;
 roomDistance:Record<RoomStemKey,number>;
 roomCopies:RoomCopy[];
 binauralStems:boolean;
 size:number;
 reflections:number;
 absorption:number;
 monoSubHz:number;
};
export type RoomDiagnostics={
 sampleRate:number;renderedSeconds:number;sourceSeconds:number;tailSeconds:number;
 inputCount:number;sourceRateConversions:number;copiesRendered:number;
 earlyReflections:number;peakBeforeTrim:number;peakAfterTrim:number;
 monoCorrelation:number;trimDb:number;stereoHrtfSources:number;
};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const toGain=(v:number)=>Math.pow(10,v/20);
const keys:RoomStemKey[]=['beat','lead','doubles','adlibs'];
function biquad(ctx:OfflineAudioContext,type:BiquadFilterType,freq:number,q=.707){
 const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=clamp(freq,10,ctx.sampleRate*.47);f.Q.value=q;return f;
}
function correlation(b:AudioBuffer){
 const l=b.getChannelData(0),r=b.numberOfChannels>1?b.getChannelData(1):l;
 let ll=0,rr=0,lr=0;
 for(let i=0;i<b.length;i+=8){ll+=l[i]*l[i];rr+=r[i]*r[i];lr+=l[i]*r[i]}
 if(ll<1e-12&&rr<1e-12)return 1;
 return lr/Math.sqrt(Math.max(1e-12,ll*rr));
}
function createPosition(ctx:OfflineAudioContext,source:AudioNode,channels:number,pan:number,frontBack:number,
 distance:number,size:number,binaural:boolean,gainValue:number){
 const x=clamp(pan,-1,1)*(1.25+size*2.1);
 // Listener faces -Z: front is negative Z, rear positive Z.
 const z=(frontBack>=0?-1:1)*(.8+Math.abs(frontBack)*(1.4+size*2.6)+distance*1.5);
 const gain=ctx.createGain();gain.gain.value=gainValue;gain.connect(ctx.destination);
 if(!binaural){
  const p=ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);source.connect(p);p.connect(gain);return 0;
 }
 const place=(dx:number)=>{
  const p=ctx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';
  p.refDistance=1.5;p.maxDistance=35;p.rolloffFactor=.13;
  p.coneInnerAngle=360;p.positionX.value=x+dx;p.positionY.value=0;p.positionZ.value=z;
  p.connect(gain);return p;
 };
 if(channels===1){source.connect(place(0));return 0}
 // Never silently collapse a stereo stem into one mono HRTF emitter.
 const split=ctx.createChannelSplitter(2);source.connect(split);
 const left=place(-.24),right=place(.24);
 split.connect(left,0);split.connect(right,1);
 return 1;
}
export async function renderEnhancedRoom(stems:Record<RoomStemKey,RoomStem>,p:RoomOptions):
 Promise<{buffer:AudioBuffer;report:RoomDiagnostics}>{
 if(!stems.beat?.buffer||!stems.lead?.buffer)throw Error('BEAT and LEAD are required for ROOM.');
 const active=keys.filter(k=>stems[k].buffer);
 const solo=active.some(k=>stems[k].solo);
 const playing=active.filter(k=>!stems[k].mute&&(!solo||stems[k].solo));
 if(!playing.length)throw Error('ROOM is silent: unmute or clear solo before building.');
 const all=active.map(k=>stems[k].buffer!);
 const sampleRate=Math.min(96000,Math.max(...all.map(x=>x.sampleRate)));
 const sourceSeconds=Math.max(...all.map(x=>x.duration));
 const size=clamp(p.size,0,1),reflect=clamp(p.reflections,0,1),absorption=clamp(p.absorption,0,1);
 const monoHz=clamp(p.monoSubHz,75,180);
 const tailSeconds=reflect>0?.22+size*.27:0;
 const length=Math.max(1,Math.ceil((sourceSeconds+tailSeconds)*sampleRate));
 const ctx=new OfflineAudioContext(2,length,sampleRate);
 let earlyReflections=0,copiesRendered=0,stereoHrtfSources=0;
 for(const key of playing){
  const stem=stems[key],audio=stem.buffer!;
  const copies=p.roomCopies.filter(c=>c.key===key&&Number.isFinite(c.pan)&&Number.isFinite(c.depth)).slice(0,8);
  const positions=[{pan:stem.pan,depth:p.roomDepth[key]??0,distance:p.roomDistance[key]??.25,primary:true},
   ...copies.map(c=>({pan:c.pan,depth:c.depth,distance:c.distance??p.roomDistance[key]??.25,primary:false}))];
  const normalization=1/(1+copies.length*.46);
  for(let index=0;index<positions.length;index++){
   const pos=positions[index],frontBack=clamp(pos.depth,-1,1),distance=clamp(pos.distance,0,1),pan=clamp(pos.pan,-1,1);
   const source=ctx.createBufferSource();source.buffer=audio;
   const musicalGain=toGain(clamp(stem.gain,-48,18));
   const copyGain=pos.primary?1:.46;
   const common=musicalGain*copyGain*normalization;
   const distanceGain=1-.38*distance;
   const rearDamping=frontBack<0?.12*Math.abs(frontBack):0;
   // Band-split: only ONE primary sends its sub content to the center.
   if(pos.primary){
    const lp=biquad(ctx,'lowpass',monoHz);
    source.connect(lp);
    const lowGain=ctx.createGain();lowGain.gain.value=common*distanceGain*(1-rearDamping*.5);
    if(audio.numberOfChannels>1){
     const split=ctx.createChannelSplitter(2),l=ctx.createGain(),r=ctx.createGain(),sum=ctx.createGain();
     l.gain.value=.5;r.gain.value=.5;lp.connect(split);split.connect(l,0);split.connect(r,1);
     l.connect(sum);r.connect(sum);sum.connect(lowGain);
    }else lp.connect(lowGain);
    lowGain.connect(ctx.destination);
   }
   // Copies only carry spatial mids/highs, with bounded decorrelation.
   const hp=biquad(ctx,'highpass',pos.primary?monoHz:Math.max(225,monoHz));
   const shade=biquad(ctx,'lowpass',clamp(16500-6500*distance-2700*(frontBack<0?Math.abs(frontBack):0)-1500*absorption,3400,17000));
   source.connect(hp);hp.connect(shade);
   let main:AudioNode=shade;
   if(!pos.primary){
    const allpass=biquad(ctx,'allpass',550+(index*730)%4200,.55+index*.12);
    const delay=ctx.createDelay(.05);delay.delayTime.value=.005+((index*7)%13)/1000;
    main.connect(allpass);allpass.connect(delay);main=delay;
    copiesRendered++;
   }
   const direct=common*distanceGain*(1-rearDamping);
   stereoHrtfSources+=createPosition(ctx,main,Math.min(2,audio.numberOfChannels),pan,frontBack,distance,size,p.binauralStems,direct);
   // Image-source-like tap delays (first-order wall paths + short scattered tail),
   // intentionally NOT claiming simulated real wall geometry.
   if(reflect>0){
    const maxTaps=4;
    for(let tap=0;tap<maxTaps;tap++){
     const reflected=ctx.createDelay(.5);
     const geometryDelay=.013+size*.022+tap*(.012+size*.012)+distance*.014+Math.abs(frontBack)*.008;
     reflected.delayTime.value=geometryDelay;
     const highpass=biquad(ctx,'highpass',Math.max(200,monoHz*1.3));
     const dark=biquad(ctx,'lowpass',5600-absorption*3600-tap*350);
     const echoPan=ctx.createStereoPanner();
     echoPan.pan.value=clamp((tap%2===0?-1:1)*(.45+size*.35)+pan*.2,-.95,.95);
     const wet=ctx.createGain();
     const strength=(.045+size*.018)*reflect*(1-.65*absorption)*Math.pow(.77,tap);
     wet.gain.value=common*strength*(1-.22*distance);
     main.connect(reflected);reflected.connect(highpass);highpass.connect(dark);dark.connect(echoPan);
     echoPan.connect(wet);wet.connect(ctx.destination);earlyReflections++;
    }
    // Bounded non-feedback scattered reflections contribute room size, not infinite reverb.
    for(let tap=0;tap<3;tap++){
     const scatter=ctx.createDelay(.5);scatter.delayTime.value=.082+size*.05+tap*(.026+size*.021)+distance*.015;
     const dark=biquad(ctx,'lowpass',3900-absorption*2700-tap*250);
     const hpScatter=biquad(ctx,'highpass',280);
     const echoPan=ctx.createStereoPanner();echoPan.pan.value=clamp((tap===1?-.65:.65)+pan*.15,-.85,.85);
     const wet=ctx.createGain();wet.gain.value=common*reflect*(1-absorption)*.012*Math.pow(.7,tap);
     main.connect(scatter);scatter.connect(hpScatter);hpScatter.connect(dark);dark.connect(echoPan);echoPan.connect(wet);wet.connect(ctx.destination);
     earlyReflections++;
    }
   }
   source.start(0);
  }
 }
 const buffer=await ctx.startRendering();
 const l=buffer.getChannelData(0),r=buffer.getChannelData(1);
 // Full-band correlation guard; prevent advanced ROOM from creating additional severe anti-phase.
 let corr=correlation(buffer);
 if(corr<.03){
  const reduction=clamp((.03-corr)*.5,.03,.35);
  for(let i=0;i<buffer.length;i++){
   const mid=(l[i]+r[i])*.5,side=(l[i]-r[i])*.5*(1-reduction);
   l[i]=mid+side;r[i]=mid-side;
  }
  corr=correlation(buffer);
 }
 let peak=0;for(let i=0;i<buffer.length;i++)peak=Math.max(peak,Math.abs(l[i]),Math.abs(r[i]));
 const gain=peak>.96?.96/peak:1;
 if(gain<1)for(let i=0;i<buffer.length;i++){l[i]*=gain;r[i]*=gain}
 const report:RoomDiagnostics={
  sampleRate,renderedSeconds:buffer.duration,sourceSeconds,tailSeconds,
  inputCount:playing.length,sourceRateConversions:all.filter(b=>b.sampleRate!==sampleRate).length,
  copiesRendered,earlyReflections,stereoHrtfSources,
  peakBeforeTrim:peak,peakAfterTrim:peak*gain,monoCorrelation:corr,
  trimDb:20*Math.log10(gain)
 };
 return{buffer,report};
}
