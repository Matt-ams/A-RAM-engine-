/** A$RAM DSP experiments: linked stereo dynamics; no claim of certified mastering. */
export type Detail={sibilance:number;lowReduction:number;highReduction:number;phaseCorrelation:number};
const db=(x:number)=>20*Math.log10(Math.max(x,1e-12));
const gain=(x:number)=>Math.pow(10,x/20);
export function enhanceDynamics(src:AudioBuffer,profile:'power'|'spectral'|'transparent'|'studio'): {buffer:AudioBuffer;detail:Detail}{
 const n=src.length,sr=src.sampleRate,count=Math.min(2,src.numberOfChannels);
 const out=new AudioBuffer({length:n,numberOfChannels:count,sampleRate:sr});
 const input=Array.from({length:count},(_,c)=>src.getChannelData(c));
 const output=Array.from({length:count},(_,c)=>out.getChannelData(c));
 // Three complementary bands from two matched one-pole crossovers; identical filters for both channels.
 const lo=Array(count).fill(0),hi=Array(count).fill(0),sibilant=Array(count).fill(0);
 const aLow=Math.exp(-2*Math.PI*145/sr),aHigh=Math.exp(-2*Math.PI*3800/sr),aSib=Math.exp(-2*Math.PI*6500/sr);
 const levels=[0,0,0];let sibEnv=0,lowReduction=0,highReduction=0,sibReduction=0,lr=0,ll=0,rr=0;
 // Conservative dynamics: preserve consonant attacks and existing sample texture.
 const strength=profile==='power'?.48:profile==='spectral'?.36:profile==='transparent'?.08:.25;
 const thresholds=[-19,-17,-22],ratios=[1+1.4*strength,1+.65*strength,1+1.15*strength];
 const atk=Math.exp(-1/(sr*.025)),rel=Math.exp(-1/(sr*.19)),sibAtk=Math.exp(-1/(sr*.002)),sibRel=Math.exp(-1/(sr*.065));
 for(let i=0;i<n;i++){
  const bands:number[][]=[];let sib=0;
  for(let c=0;c<count;c++){
   const x=input[c][i];lo[c]=aLow*lo[c]+(1-aLow)*x;hi[c]=aHigh*hi[c]+(1-aHigh)*x;
   sibilant[c]=aSib*sibilant[c]+(1-aSib)*x;
   bands.push([lo[c],hi[c]-lo[c],x-hi[c]]);
   sib=Math.max(sib,Math.abs(x-sibilant[c]));
  }
  const energies=[0,0,0];
  for(const b of bands)for(let k=0;k<3;k++)energies[k]=Math.max(energies[k],Math.abs(b[k]));
  const gains=[1,1,1];
  for(let k=0;k<3;k++){
   const e=energies[k],coef=e>levels[k]?atk:rel;levels[k]=coef*levels[k]+(1-coef)*e;
   const above=Math.max(0,db(levels[k])-thresholds[k]);
   const reduction=Math.min(k===0?2.5:k===2?3.5:2,above*(1-1/ratios[k]));
   gains[k]=gain(-reduction);if(k===0)lowReduction+=reduction;if(k===2)highReduction+=reduction;
  }
  sibEnv=(sib>sibEnv?sibAtk:sibRel)*sibEnv+(1-(sib>sibEnv?sibAtk:sibRel))*sib;
  // High-frequency dynamic attenuation only; soft knee near threshold, shared L/R.
  const sibOver=Math.max(0,db(sibEnv)-(-28));
  const sibDb=Math.min(2.5,sibOver*.22)*strength,sibGain=gain(-sibDb);sibReduction+=sibDb;
  for(let c=0;c<count;c++){const b=bands[c];output[c][i]=b[0]*gains[0]+b[1]*gains[1]+b[2]*gains[2]*sibGain}
  if(count===2){const l=output[0][i],r=output[1][i];lr+=l*r;ll+=l*l;rr+=r*r}
 }
 return{buffer:out,detail:{sibilance:sibReduction/Math.max(1,n),lowReduction:lowReduction/Math.max(1,n),highReduction:highReduction/Math.max(1,n),phaseCorrelation:count===2?lr/Math.sqrt(Math.max(1e-12,ll*rr)):1}};
}
