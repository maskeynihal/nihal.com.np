/* eslint-disable */
// @ts-nocheck
/** Kite over Kathmandu (section art). A Nepali kite on a string the height of the section, a valley with a stupa, pagoda and rooftops low down. */
import { E, g, SA, PG, ink, fillS, fillP, PL, LN, SM, EL, arcPts, hatch, circ, glow, clamp, lerp, sm, rnd, mulberry, TAU, PI } from './core';

/**
 * The kite's largest extent from the string's end, in px. Height is at most KITE_H_MAX; the axis is held
 * to KITE_MAX_TILT, so the top point, the sides and the bow stay within these reaches; the tail is
 * clamped to the safe width. The whole kite is kept in the safe rect with them.
 */
export const KITE_H_MAX = 125;
export const KITE_MAX_TILT = 0.45;
export const KITE_REACH_X = 116;
export const KITE_REACH_UP = 160;

const KT={
  valley(c,s,u){
    const W=c.w/u, rg=mulberry(c.seed*5+2), t=E.tt;
    // far ridge
    const peaks=[[.1,48],[.46,60],[.8,52]];
    const ridge=[];
    for(let x=-10;x<=W+10;x+=12){
      let y=70+16*Math.sin(x*.012+1)+9*Math.sin(x*.031+2);
      for(const p of peaks){const d=Math.abs(x-p[0]*W);y=Math.max(y,p[1]+78-d*.5+ (d<40?6:0))}
      ridge.push([x,-y]);
    }
    g.beginPath();PL([[-10,0],...ridge,[W+10,0]],4,.7,false);fillP(.0);
    {const fg=g.createLinearGradient(0,0,W,0);fg.addColorStop(0,SA(0));fg.addColorStop(.1,SA(.7));fg.addColorStop(.9,SA(.7));fg.addColorStop(1,SA(0));g.beginPath();PL(ridge,7,.9);g.strokeStyle=fg;g.lineWidth=1.1;g.stroke()}
    // snow caps: short zigzags under the peaks
    for(const p of peaks){const px=p[0]*W,py=-(p[1]+78);g.beginPath();g.moveTo(px-22,py+12);g.lineTo(px-12,py+8);g.lineTo(px-5,py+14);g.lineTo(px,py+7);g.lineTo(px+7,py+14);g.lineTo(px+14,py+9);g.lineTo(px+24,py+13);ink(.45,1.1)}
    // the stupa
    const xs=W*.22;
    g.beginPath();PL([[xs-70,0],[xs-70,-18],[xs-60,-18],[xs-60,-30],[xs-48,-30],[xs-48,-42],[xs+48,-42],[xs+48,-30],[xs+60,-30],[xs+60,-18],[xs+70,-18],[xs+70,0]],3,.6,false);fillP();ink(.9,1.7);
    g.beginPath();g.moveTo(xs-60,-18);g.lineTo(xs+60,-18);g.moveTo(xs-48,-30);g.lineTo(xs+48,-30);ink(.5,1.1);
    g.beginPath();g.moveTo(xs-40,-42);g.bezierCurveTo(xs-40,-86,xs+40,-86,xs+40,-42);g.closePath();fillP();ink(.95,1.9);
    g.beginPath();g.moveTo(xs-30,-50);g.bezierCurveTo(xs-24,-78,xs+24,-78,xs+30,-50);ink(.3,1);
    g.beginPath();g.rect(xs-13,-100,26,18);fillP();ink(.95,1.8);
    // wisdom eyes + nose mark
    g.beginPath();EL(xs-5.5,-93,3.4,1.9,9,.2);EL(xs+5.5,-93,3.4,1.9,10,.2);ink(.95,1.3);
    circ(xs-5.5,-93,.9);circ(xs+5.5,-93,.9);fillS(1);
    g.beginPath();g.moveTo(xs,-91);g.quadraticCurveTo(xs+2.5,-88,xs,-85.5);ink(.8,1.2);
    // 13 steps of the spire
    for(let i=0;i<7;i++){const y=-100-i*5,hw=12-i*1.3;g.beginPath();g.moveTo(xs-hw,y);g.lineTo(xs-hw+1,y-5);g.lineTo(xs+hw-1,y-5);g.lineTo(xs+hw,y);g.closePath();fillP();ink(.9,1.3)}
    g.beginPath();g.moveTo(xs-9,-142);g.quadraticCurveTo(xs,-152,xs+9,-142);g.closePath();fillP();ink(.9,1.4);
    g.beginPath();g.moveTo(xs,-148);g.lineTo(xs,-158);ink(.9,1.5);circ(xs,-160,1.8);fillS(1);
    // prayer flags
    const flag=(x0,y0,x1,y1,n,sd)=>{
      g.beginPath();g.moveTo(x0,y0);g.quadraticCurveTo((x0+x1)/2,(y0+y1)/2+10,x1,y1);ink(.6,1.1);
      for(let i=1;i<=n;i++){const q=i/(n+1),x=lerp(x0,x1,q),y=lerp(y0,y1,q)+Math.sin(q*PI)*10*.9;const fl=Math.sin(t*5+i*1.3+sd)*2+Math.sin(t*3.1+i)*1.2;
        g.beginPath();g.moveTo(x-3.5,y);g.lineTo(x+3.5,y);g.lineTo(x+3.5+fl*.4,y+9);g.lineTo(x-3.5+fl*.4,y+9.5);g.closePath();if(i%2)fillS(.55);else{fillP();ink(.8,1.1)}}
    };
    flag(xs,-158,xs-96,-34,7,0);flag(xs,-158,xs+112,-44,8,2);
    // rooftops
    const houses=[];
    for(let x=W*.4;x<W-8;){const wd=34+rg()*30,ht=30+rg()*34;if(x+wd>W-6)break;houses.push([x,wd,ht,rg()]);x+=wd+rg()*5}
    for(let x=6;x<xs-80;){const wd=28+rg()*22,ht=22+rg()*26;houses.push([x,wd,ht,rg()]);x+=wd+rg()*4}
    let kidX=0,kidY=0;
    const kidHouse=houses.findIndex(h0=>h0[0]>W*.74&&h0[2]>40);
    houses.forEach((h0,i)=>{
      const [x,wd,ht0,q]=h0; const ht=i===kidHouse?Math.max(ht0,48):ht0;
      g.beginPath();g.rect(x,-ht,wd,ht+2);fillP();ink(.9,1.7);
      g.beginPath();g.moveTo(x-2,-ht);g.lineTo(x+wd+2,-ht);ink(.95,2.2);
      // windows
      const nw=Math.max(1,Math.floor(wd/17));g.beginPath();for(let k=0;k<nw;k++){const wx=x+8+k*(wd-16)/Math.max(1,nw-1||1)-(nw===1?wd/2-8-3:0);const wy=-ht+9;g.rect(wx-(nw>1?3:0),wy,6,8)}ink(.7,1.1);
      if(q>.55&&wd>40){ // water tank
        const tx=x+wd*.5;g.beginPath();g.rect(tx-8,-ht-14,16,12);fillP();ink(.9,1.5);g.beginPath();g.moveTo(tx-8,-ht-2);g.lineTo(tx-9,-ht);g.moveTo(tx+8,-ht-2);g.lineTo(tx+9,-ht);ink(.8,1.3);g.beginPath();g.moveTo(tx-8,-ht-9);g.lineTo(tx+8,-ht-9);ink(.5,1)}
      else if(q<.25){g.beginPath();g.moveTo(x+wd*.3,-ht);g.lineTo(x+wd*.3,-ht-16);g.moveTo(x+wd*.3-6,-ht-12);g.lineTo(x+wd*.3+6,-ht-12);g.moveTo(x+wd*.3-4,-ht-7);g.lineTo(x+wd*.3+4,-ht-7);ink(.7,1.2)}
      if(i===kidHouse){kidX=x+wd*.5;kidY=-ht}
    });
    // pagoda
    const px=W*.36,py=0;
    g.beginPath();g.rect(px-13,-36,26,36);fillP();ink(.9,1.7);g.beginPath();g.rect(px-4,-14,8,14);ink(.8,1.3);
    for(let i=0;i<3;i++){const y=-36-i*17,wd=30-i*7;g.beginPath();g.moveTo(px-wd-9,y-6);g.quadraticCurveTo(px-wd-2,y+1,px-wd+4,y);g.lineTo(px+wd-4,y);g.quadraticCurveTo(px+wd+2,y+1,px+wd+9,y-6);g.lineTo(px+wd-6,y-14);g.lineTo(px-wd+6,y-14);g.closePath();fillP();ink(.95,1.7);
      if(i<2){g.beginPath();g.rect(px-wd*.45,y-14,wd*.9,8);ink(.4,1)}}
    g.beginPath();g.moveTo(px,-88);g.lineTo(px,-100);ink(.9,1.5);circ(px,-102,1.6);fillS(1);
    // the ground the houses stand on, edge to edge, at the bottom of the section
    {const fg=g.createLinearGradient(0,0,W,0);fg.addColorStop(0,SA(0));fg.addColorStop(.06,SA(.9));fg.addColorStop(.94,SA(.9));fg.addColorStop(1,SA(0));g.beginPath();g.moveTo(0,0);g.lineTo(W,0);g.strokeStyle=fg;g.lineWidth=1.2;g.stroke()}
    s.kid={x:kidX,y:kidY};
  },
  kid(x,y,arm){ // a child on the roof, holding the spool, arms raised
    g.beginPath();g.moveTo(x-4,y);g.lineTo(x-4,y-14);g.moveTo(x+4,y);g.lineTo(x+4,y-14);ink(.95,2);
    g.beginPath();g.moveTo(x,y-14);g.lineTo(x,y-30);ink(.95,2.2);
    g.beginPath();g.moveTo(x,y-28);g.lineTo(x-9,y-38+arm);g.moveTo(x,y-28);g.lineTo(x+7,y-40+arm);ink(.95,1.8);
    g.beginPath();g.arc(x,y-36,5.5,0,TAU);fillP();ink(.95,1.8);
    g.beginPath();g.arc(x,y-37,5.5,PI*1.05,PI*1.95);ink(.95,2.4);
    circ(x+7,y-40+arm,3.2);fillP();ink(.9,1.5);
  },
  kite(len,wd,rot){}
};
export const kite={name:'kite over kathmandu',short:'kite',
init(c){
  const N=c.h>700?30:22, u=clamp(c.w/520,.72,1.1);
  const ax=c.w*.72, ay=c.h-62*u;
  const Hh=108*Math.min(1.15,Math.max(.8,u*1.05));
  const ex=c.w*.5, ey=clamp(E.sy-c.t+E.H*.27,KITE_REACH_UP+4,Math.max(KITE_REACH_UP+14,c.h-250));
  const nodes=[];for(let i=0;i<N;i++){const q=i/(N-1);const x=lerp(ax,ex,q)+Math.sin(q*PI)*30,y=lerp(ay,ey,q);nodes.push({x,y,ox:x,oy:y})}
  const e=nodes[N-1];
  const tail=[];for(let i=0;i<8;i++)tail.push({x:e.x,y:e.y+8+i*9,ox:e.x,oy:e.y+8+i*9});
  return {kx:ex,ky:ey,kvx:0,kvy:0,N,nodes,tail,u,L:Math.hypot(ax-ex,ay-ey)*1.04+24,ax,ay,gust:0,gdir:1,swirls:[],kid:{x:0,y:0},ang:0,sw:0};
},
tap(c,s,x,y){s.gust=1;s.gdir=x<s.kx?-1:1;s.kvx+=s.gdir*170;s.kvy-=120;for(let i=0;i<3;i++)s.swirls.push({x:-30-i*60,y:y+(i-1)*34,t:0,sp:80+i*10,r:9+i*2})},
update(c,s,dt){
  const t=E.tt,u=s.u;
  s.gust*=Math.exp(-dt*1.6); s.sw=lerp(s.sw,clamp(E.sv*.4,-500,500),1-Math.exp(-dt*6));
  if(s.kid.x&&s.kid.y){const ax=(s.kid.x+7)*u, ay=c.h+(s.kid.y-40)*u; s.ax=ax; s.ay=ay}
  const N=s.N,nodes=s.nodes;
  // The whole kite stays inside the column: its real extent (top point, side points, tilt, gust
  // overshoot) sets how close the string end may come to the top and the sides.
  const minY=KITE_REACH_UP+4, minX=KITE_REACH_X, maxX=Math.max(minX+10,c.w-KITE_REACH_X);
  // target: the viewport's sky, leaning a little toward a resting pointer, never a quick tug
  const tx=clamp(c.mIn?c.mx:c.w*.5+Math.sin(t*.27)*c.w*.1+Math.sin(t*.61)*c.w*.03,minX,maxX);
  const ty=clamp(E.sy-c.t+E.H*.27,minY,Math.max(minY+10,c.h-250));
  // reel in/out
  const d=Math.hypot(s.kx-s.ax,s.ky-s.ay); const dtar=Math.hypot(tx-s.ax,ty-s.ay); s.L=lerp(s.L,Math.max(d*1.04+24,dtar*1.03+30),1-Math.exp(-dt*3));
  const seg=s.L/(N-1);
  // the kite: a damped spring chasing the viewport and the pointer, with wind on top
  const W2=6, ax_=(tx-s.kx)*W2-4.4*s.kvx+Math.sin(t*1.1)*35+s.sw*.4;
  const ay_=(ty-s.ky)*W2-4.4*s.kvy-30*Math.sin(t*.9)-s.gust*100;
  s.kvx+=ax_*dt; s.kvy+=ay_*dt; s.kx+=s.kvx*dt; s.ky+=s.kvy*dt; s.kx=clamp(s.kx,minX,maxX); if(s.ky<minY){s.ky=minY;if(s.kvy<0)s.kvy=0}
  { // string is a limit: kite cannot go past the rope length
    const dx=s.kx-s.ax,dy=s.ky-s.ay,dd=Math.hypot(dx,dy),mx=s.L-6;
    if(dd>mx){s.kx=s.ax+dx/dd*mx;s.ky=s.ay+dy/dd*mx;const vn=(s.kvx*dx+s.kvy*dy)/dd;if(vn>0){s.kvx-=vn*dx/dd;s.kvy-=vn*dy/dd}}
    s.kx=clamp(s.kx,minX,maxX); if(s.ky<minY)s.ky=minY;
  }
  const g0=130;
  for(let i=1;i<N-1;i++){
    const n=nodes[i]; let vx=(n.x-n.ox)*.992,vy=(n.y-n.oy)*.992; n.ox=n.x;n.oy=n.y;
    const ax=Math.sin(t*1.7+i*.5)*30*(i/N)+s.gust*s.gdir*160*(i/N);
    n.x+=vx+ax*dt*dt;n.y+=vy+g0*dt*dt;
  }
  for(let it=0;it<14;it++){
    nodes[0].x=s.ax;nodes[0].y=s.ay;nodes[N-1].x=s.kx;nodes[N-1].y=s.ky;
    for(let k=0;k<N-1;k++){const i=(it&1)?N-2-k:k;
      const a=nodes[i],b=nodes[i+1],dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1e-3,df=(dd-seg)/dd;
      const wa=i===0?0:1,wb=i===N-2?0:1,ws=wa+wb||1;
      a.x+=dx*df*wa/ws;a.y+=dy*df*wa/ws;b.x-=dx*df*wb/ws;b.y-=dy*df*wb/ws;
    }
  }
  const end=nodes[N-1];
  // kite axis from the string's last stretch
  const q=nodes[N-3]; let ux=end.x-q.x,uy=end.y-q.y; const ul=Math.hypot(ux,uy)||1; ux/=ul;uy/=ul;
  s.ux=lerp(s.ux??ux,ux,1-Math.exp(-dt*8));s.uy=lerp(s.uy??uy,uy,1-Math.exp(-dt*8));
  // tail
  const ang=Math.atan2(s.ux,-s.uy)+Math.sin(t*2)*.03*(1+s.gust)+clamp((tx-end.x)*.0003,-.1,.1);
  s.ang=clamp(ang,-KITE_MAX_TILT,KITE_MAX_TILT); const V0x=end.x+Math.sin(s.ang)*20, V0y=end.y-Math.cos(s.ang)*20; s.v0=[V0x,V0y];
  const tl=s.tail; tl[0].x=V0x-Math.sin(ang)*(-8)*0;tl[0].y=V0y;tl[0].x=V0x;
  for(let i=1;i<tl.length;i++){const n=tl[i];let vx=(n.x-n.ox)*.985,vy=(n.y-n.oy)*.985;n.ox=n.x;n.oy=n.y;
    n.x+=vx+(Math.sin(t*3+i*.9)*40+s.gdir*s.gust*320+s.sw*.4)*dt*dt*1;n.y+=vy+(380)*dt*dt}
  for(let it=0;it<4;it++){tl[0].x=V0x;tl[0].y=V0y;for(let i=0;i<tl.length-1;i++){const a=tl[i],b=tl[i+1],dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1e-3,df=(dd-11)/dd;if(i===0){b.x-=dx*df;b.y-=dy*df}else{a.x+=dx*df*.5;a.y+=dy*df*.5;b.x-=dx*df*.5;b.y-=dy*df*.5}}}
  for(const n of tl)n.x=clamp(n.x,12,c.w-12);
  for(const n of nodes)n.x=clamp(n.x,2,c.w-2);
  // swirls
  for(const w of s.swirls){w.t+=dt;w.x+=w.sp*dt*s.gdir*(s.gdir>0?1:1)}
  s.swirls=s.swirls.filter(w=>w.t<2.2&&w.x<c.w+60&&w.x>-80);
  if(!s.amb) s.amb=0; s.amb-=dt; if(s.amb<=0){s.amb=10+rnd(t)*8;s.swirls.push({x:-30,y:60+rnd(t,3)*(c.h-300),t:0,sp:40,r:7,amb:1})}
},
draw(c,s){
  const u=s.u,t=E.tt;
  // string
  const nodes=s.nodes;
  g.beginPath();g.moveTo(nodes[0].x,nodes[0].y);for(let i=1;i<nodes.length-1;i++){const a=nodes[i],b=nodes[i+1];g.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2)}g.lineTo(nodes[nodes.length-1].x,nodes[nodes.length-1].y);ink(.9,1.4);
  // wind swirls
  for(const w of s.swirls){const a=Math.sin(w.t/2.2*PI)*(w.amb?.4:.75);g.beginPath();g.moveTo(w.x-28,w.y);g.bezierCurveTo(w.x-14,w.y-4,w.x-4,w.y+2,w.x+4,w.y-1);g.arc(w.x+4,w.y-w.r*.7,w.r*.7,PI*.5,-PI*1.1,true);ink(a,1.4);g.beginPath();g.moveTo(w.x-44,w.y+10);g.lineTo(w.x-20,w.y+9);ink(a*.6,1.2)}
  // valley
  g.save();g.translate(0,c.h);g.scale(u,u);KT.valley(c,s,u);
  const kx=s.kid.x,ky=s.kid.y;
  if(kx){KT.kid(kx,ky,Math.sin(t*3)*1.2);
    // the spool
    g.beginPath();g.arc(kx+7,ky-40+Math.sin(t*3)*1.2,4.5,0,TAU);fillP();ink(.95,1.6);}
  g.restore();
  // tail
  const tl=s.tail;g.beginPath();g.moveTo(tl[0].x,tl[0].y);for(let i=1;i<tl.length-1;i++){const a=tl[i],b=tl[i+1];g.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2)}g.lineTo(tl[tl.length-1].x,tl[tl.length-1].y);ink(.9,1.4);
  for(let i=1;i<tl.length;i+=2){const a=tl[i-1],b=tl[i],ang=Math.atan2(b.y-a.y,b.x-a.x)+PI/2;g.save();g.translate(b.x,b.y);g.rotate(ang);g.beginPath();g.moveTo(0,0);g.lineTo(-6,-4);g.lineTo(-6,4);g.closePath();g.moveTo(0,0);g.lineTo(6,-4);g.lineTo(6,4);g.closePath();fillP();ink(.9,1.3);g.restore()}
  // the kite itself
  const end=nodes[nodes.length-1],H=108*Math.min(1.15,Math.max(.8,u*1.05)),Wd=H*.42;
  g.save();g.translate(s.v0[0],s.v0[1]);g.rotate(s.ang);
  g.beginPath();g.moveTo(0,0);g.lineTo(-Wd,-H*.34);g.lineTo(0,-H);g.lineTo(Wd,-H*.34);g.closePath();fillP();
  // panels: hatch two opposite triangles
  g.save();g.beginPath();g.moveTo(0,0);g.lineTo(-Wd,-H*.34);g.lineTo(0,-H*.34);g.closePath();g.moveTo(0,-H);g.lineTo(Wd,-H*.34);g.lineTo(0,-H*.34);g.closePath();g.clip();
  hatch(-Wd,-H,Wd,0,4.5,.9,.7,1.1);g.restore();
  g.beginPath();g.moveTo(0,0);g.lineTo(-Wd,-H*.34);g.lineTo(0,-H);g.lineTo(Wd,-H*.34);g.closePath();ink(1,2.2);
  g.beginPath();g.moveTo(0,0);g.lineTo(0,-H);g.moveTo(-Wd,-H*.34);g.quadraticCurveTo(0,-H*.34+7,Wd,-H*.34);ink(.9,1.6);
  g.restore();
  // bridle
  const sx=s.v0[0],sy=s.v0[1],ca=Math.cos(s.ang),sa=Math.sin(s.ang);
  const pt=(f)=>[sx+sa*H*f,sy-ca*H*f];
  const b1=pt(.2),b2=pt(.55);
  g.beginPath();g.moveTo(end.x,end.y);g.lineTo(b1[0],b1[1]);g.moveTo(end.x,end.y);g.lineTo(b2[0],b2[1]);ink(.7,1.1);
  circ(end.x,end.y,2.2);fillS(.9);
}};
