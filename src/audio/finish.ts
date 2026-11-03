/** Non-destructive-in-spirit finishing pass: gentle rumble filter, DC rejection and low-end stereo control.
 * This is not a replacement for multiband dynamics or a calibrated mastering suite.
 */
export async function finishMix(input:AudioBuffer,profile:string):Promise<AudioBuffer>{
 const channels=Math.min(2,input.numberOfChannels),sr=input.sampleRate;
 const ctx=new OfflineAudioContext(channels,input.length,sr),source=ctx.createBufferSource();source.buffer=input;
 const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=profile==='power'?24:19;hp.Q.value=.707;
 source.connect(hp);hp.connect(ctx.destination);source.start();
 const filtered=await ctx.startRendering();
 if(channels<2)return filtered;
 // Frequency-selective mid/side processing: sub-bass remains centered; high frequencies retain width.
 const lowL=new Float32Array(filtered.length),lowR=new Float32Array(filtered.length);
 const left=filtered.getChannelData(0),right=filtered.getChannelData(1);
 const a=Math.exp(-2*Math.PI*105/sr);let l=0,r=0;
 for(let i=0;i<filtered.length;i++){l=a*l+(1-a)*left[i];r=a*r+(1-a)*right[i];lowL[i]=l;lowR[i]=r}
 const subSide=profile==='transparent'?.85:profile==='spectral'?.35:.5;
 for(let i=0;i<filtered.length;i++){const side=(lowL[i]-lowR[i])*.5*(1-subSide);left[i]-=side;right[i]+=side}
 return filtered;
}