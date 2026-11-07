/* ================= 2 · hanging mobile ================= */
const MOB={
  sling(x1,y1,x2,y2){g.beginPath();g.moveTo(0,0);g.lineTo(x1,y1);g.moveTo(0,0);g.lineTo(x2,y2);ink(.6,1.1)},
  mug(t){
    MOB.sling(-15,14,15,14);
    g.beginPath();g.moveTo(-15,14);g.lineTo(-13.5,40);g.quadraticCurveTo(-12,47,-5,47);g.lineTo(5,47);g.quadraticCurveTo(12,47,13.5,40);g.lineTo(15,14);fillP();ink(.95,1.8);
    g.beginPath();EL(0,14,15,4.2,3,.4);fillP();ink(.95,1.6);
    g.beginPath();g.moveTo(15,22);g.bezierCurveTo(28,20,28,38,14,36);ink(.95,1.7);
    g.beginPath();g.moveTo(-12,28);g.quadraticCurveTo(0,31,12,28);g.moveTo(-11,35);g.quadraticCurveTo(0,38,11,35);ink(.4,1);
    g.beginPath();g.moveTo(-4,11);g.bezierCurveTo(-8,4,0,1,-3,-4);ink(.5,1.1);  // steam
  },
  bike(t){
    const ph=t*.9; MOB.sling(-8,16,14,16);
    for(const x of [-20,20]){g.beginPath();g.arc(x,34,12,0,TAU);fillP();ink(.95,1.8);
      g.beginPath();for(let i=0;i<4;i++){const a=ph+i*PI/4;g.moveTo(x+Math.cos(a)*12,34+Math.sin(a)*12);g.lineTo(x-Math.cos(a)*12,34-Math.sin(a)*12)}ink(.4,.9)}
    g.beginPath();g.moveTo(-20,34);g.lineTo(-3,34);g.lineTo(-8,16);g.lineTo(14,16);g.lineTo(20,34);g.moveTo(-20,34);g.lineTo(-8,16);g.moveTo(-3,34);g.lineTo(14,16);ink(.95,1.9);
    g.beginPath();g.moveTo(-13,13);g.lineTo(-4,13);g.moveTo(14,16);g.lineTo(16,9);g.lineTo(22,9);ink(.95,1.9);
    g.beginPath();g.moveTo(-3,34);g.lineTo(-3+Math.cos(ph*2)*5,34+Math.sin(ph*2)*5);ink(.8,1.5);
  },
  dog(t){
    MOB.sling(-6,6,12,5);
    const wag=Math.sin(t*9)*.25;
    g.beginPath();SM([[-21,10],[-12,6],[2,6],[11,5],[16,0],[19,-5],[27,-2],[34,4],[30,8],[22,10],[18,17],[12,20],[-6,20],[-14,18]],true);fillP();ink(.95,1.9);
    g.beginPath();g.moveTo(-21,10);g.quadraticCurveTo(-27,6+wag*20,-26,-3+wag*14);ink(.95,2);
    for(const [x,off] of [[12,0],[7,3],[-12,-2],[-17,1]]){g.beginPath();g.moveTo(x,19);g.lineTo(x+off*.5,36);ink(.95,1.9);g.beginPath();g.moveTo(x+off*.5-2,36);g.lineTo(x+off*.5+3,36);ink(.9,1.7)}
    g.beginPath();g.moveTo(18,-3);g.quadraticCurveTo(14,2,16,10);g.quadraticCurveTo(22,4,21,-1);fillP();ink(.9,1.5);
    circ(26,0,1.3);fillS(1);circ(34,3.5,1.6);fillS(1);
    g.beginPath();g.moveTo(14,10);g.lineTo(22,11);ink(.6,1.4);
  },
  flower(t){
    g.beginPath();g.moveTo(0,0);g.lineTo(0,6);ink(.6,1.1);
    for(let i=0;i<8;i++){const a=i*TAU/8+.2;g.beginPath();EL(Math.cos(a)*13,22+Math.sin(a)*13,9,4.6,i+2,.4,a);fillP();ink(.95,1.7)}
    circ(0,22,6);fillP();ink(.95,1.7);g.beginPath();g.arc(0,22,2.5,0,TAU);fillS(.8);
    g.beginPath();g.moveTo(0,36);g.quadraticCurveTo(3,44,0,52);ink(.8,1.5);
    g.beginPath();g.moveTo(1,45);g.quadraticCurveTo(11,41,15,47);g.quadraticCurveTo(8,52,1,45);fillP();ink(.85,1.4);
  },
  keyboard(t){
    MOB.sling(-26,12,26,12);
    g.beginPath();PL([[-27,12],[27,12],[29,34],[-29,34]],5,.6,true);fillP();ink(.95,1.9);
    g.beginPath();for(let r=0;r<3;r++)for(let k=0;k<(r===2?1:9);k++){if(r===2){g.rect(-14,28,26,3.4)}else{const x=-23+k*5.4+r*2;g.rect(x,15+r*5.2,3.6,3.4)}}ink(.7,1);
  },
  stupa(t){
    g.beginPath();g.moveTo(0,0);g.lineTo(0,5);ink(.6,1.1);
    g.beginPath();g.moveTo(-5,24);g.lineTo(-3.5,6);g.lineTo(3.5,6);g.lineTo(5,24);g.closePath();fillP();ink(.9,1.5);
    g.beginPath();g.moveTo(-3.5,10);g.lineTo(3.5,10);g.moveTo(-4,14);g.lineTo(4,14);g.moveTo(-4.5,19);g.lineTo(4.5,19);ink(.6,1);
    g.beginPath();g.rect(-8,24,16,9);fillP();ink(.95,1.7);circ(-3,28.5,1.5);circ(3,28.5,1.5);fillS(.9);
    g.beginPath();g.moveTo(0,30.5);g.lineTo(0,32);ink(.9,1.2);
    g.beginPath();g.moveTo(-26,45);g.bezierCurveTo(-26,33,-14,32,0,32);g.bezierCurveTo(14,32,26,33,26,45);g.closePath();fillP();ink(.95,1.9);
    g.beginPath();g.moveTo(-30,45);g.lineTo(30,45);g.lineTo(32,50);g.lineTo(-32,50);g.closePath();fillP();ink(.9,1.6);
    g.beginPath();g.moveTo(-18,40);g.quadraticCurveTo(0,35,18,40);ink(.35,1);
  },
  chip(t){
    MOB.sling(-15,10,15,10);
    g.beginPath();g.rect(-17,10,34,28);fillP();ink(.95,1.9);
    g.beginPath();for(let i=0;i<5;i++){const y=13+i*5.5;g.moveTo(-17,y);g.lineTo(-22,y);g.moveTo(17,y);g.lineTo(22,y)}ink(.9,1.7);
    g.beginPath();g.arc(-11,16,2,0,TAU);ink(.8,1.3);
    g.font='9px ui-monospace,Menlo,monospace';g.textAlign='center';g.fillStyle=SA(.9);g.fillText('R4',3,29);
    const on=(Math.sin(t*3)>0);circ(11,16,1.8);if(on)fillS(1);else ink(.8,1);
  },
  butterfly(t){
    const f=Math.abs(Math.cos(t*2.2))*.85+.15;
    g.beginPath();g.moveTo(0,0);g.lineTo(0,10);ink(.6,1.1);
    for(const sd of [-1,1]){
      g.save();g.translate(0,22);g.scale(sd*f,1);
      g.beginPath();g.moveTo(0,-2);g.bezierCurveTo(12,-24,30,-12,22,0);g.bezierCurveTo(20,5,8,4,0,3);fillP();ink(.95,1.7);
      g.beginPath();g.moveTo(0,3);g.bezierCurveTo(14,4,22,14,15,22);g.bezierCurveTo(8,26,2,14,0,8);fillP();ink(.95,1.6);
      circ(15,-5,3.4);ink(.7,1.2);circ(10,15,2);ink(.7,1.1);g.restore();
    }
    g.beginPath();g.moveTo(0,10);g.lineTo(0,32);ink(1,2.4);
    g.beginPath();g.moveTo(0,10);g.quadraticCurveTo(-3,4,-6,5);g.moveTo(0,10);g.quadraticCurveTo(3,4,6,5);ink(.8,1.1);
  },
  bulb(t){
    g.beginPath();g.moveTo(0,0);g.lineTo(0,8);ink(.6,1.1);
    g.beginPath();g.rect(-6,8,12,9);fillP();ink(.95,1.7);g.beginPath();g.moveTo(-6,11.5);g.lineTo(6,11.5);g.moveTo(-6,14.5);g.lineTo(6,14.5);ink(.6,1);
    g.beginPath();g.moveTo(-6,17);g.bezierCurveTo(-18,24,-14,46,0,46);g.bezierCurveTo(14,46,18,24,6,17);g.closePath();fillP();ink(.95,1.8);
    g.beginPath();g.moveTo(-3,40);g.lineTo(-3,30);g.lineTo(0,26);g.lineTo(3,30);g.lineTo(3,40);ink(.8,1.3);
    const gl=.5+.5*Math.sin(t*2);g.beginPath();g.arc(0,32,18,PI*.1,PI*.9);ink(.2+gl*.25,1.2);
  }
};
MOB.rest=function(nodes,cx,sc){
  for(const n of nodes){
    let px,py; if(!n.parent){px=cx;py=0}else{px=n.parent.ex0[n.side>0?1:0];py=n.parent.ey0[n.side>0?1:0]}
    const hx=px,hy=py+n.L;
    if(n.kind==='rod'){n.x=hx;n.y=hy+16;n.ex0=[hx-n.r1,hx+n.r2];n.ey0=[hy+16,hy+16]}else{n.x=hx;n.y=hy+26*sc}
  }
};
MOB.build=function(c,sc,seed){
  const w=c.w,h=c.h,rg=mulberry(seed);
  const kinds=['mug','bike','dog','flower','keyboard','stupa','chip','butterfly','bulb'];
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(rg()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]]}
  let ki=0; const nodes=[]; const T0=h>800?64:54;
  const D=Math.max(2,Math.min(6,Math.round((h-150)/175)));
  const Ls=(h-T0-34-60*sc)/(D+0.15);
  function mk(depth,main,off,parent,side,L){
    const n={id:nodes.length,parent,side,L,th:0,thv:0,ax:0,p1:0,p2:0,depth,x:0,y:0};
    nodes.push(n);
    n.th=(rg()-.5)*.1;
    const rodChance=main?(depth<D):(depth<D-1&&depth<4&&rg()<.5);
    if(!rodChance){n.kind='leaf';n.obj=kinds[ki++%kinds.length];n.m=1;n.sp=rg()*3;n.spv=0;n.ph=rg()*10;return n}
    n.kind='rod';n.phi=0;n.phv=0;
    const hs=Math.max(34,w*.27*Math.pow(.72,depth));
    const mainSide=off>8?-1:off<-8?1:(rg()<.5?-1:1);
    const ch=[-1,1].map(sd=>{
      const isMain=main&&sd===mainSide;
      const Lc=isMain?Ls*(.95+rg()*.1):Ls*(.45+rg()*.4);
      return mk(depth+1,isMain,off+sd*hs*.9,n,sd,Math.max(34,Lc));
    });
    const mA=ch[0].m,mB=ch[1].m; n.m=.3+mA+mB;
    const tot=2*hs; let r1=clamp(tot*mB/(mA+mB),tot*.32,tot*.68); n.r1=r1;n.r2=tot-r1;
    return n;
  }
  mk(0,true,0,null,0,T0);
  return {nodes,cx:w/2};
};
VAR[2]={name:'hanging mobile',short:'mobile',
init(c){
  const w=c.w,h=c.h,sc=c.phone?1.25:1.7;
  let best=null,bs=1e9;
  for(let at=0;at<60;at++){
    const r=MOB.build(c,sc,c.seed*13+5+at*31);
    // arrange at rest, scale arms to fit, score overlaps
    let f=1;
    for(let pass=0;pass<2;pass++){
      MOB.rest(r.nodes,0,sc);
      let mn=1e9,mx=-1e9;for(const n of r.nodes){const xs=n.kind==='rod'?[n.ex0[0],n.ex0[1]]:[n.x];for(const x of xs){mn=Math.min(mn,x-(n.kind==='leaf'?34*sc/1.3:8));mx=Math.max(mx,x+(n.kind==='leaf'?34*sc/1.3:8))}}
      f=Math.min(1,(w-40)/(mx-mn));
      if(f<.999) for(const n of r.nodes) if(n.kind==='rod'){n.r1*=f;n.r2*=f}
      r.cx=w/2-(mn+mx)/2*Math.min(1,f);
    }
    MOB.rest(r.nodes,r.cx,sc);
    const lv=r.nodes.filter(n=>n.kind==='leaf'),rods=r.nodes.filter(n=>n.kind==='rod');let sco=0;const u=sc/1.3;
    for(let i=0;i<lv.length;i++)for(let j=i+1;j<lv.length;j++){if(Math.abs(lv[i].x-lv[j].x)<58*u&&Math.abs(lv[i].y-lv[j].y)<54*u)sco+=10}
    for(const n of lv){if(n.x<34||n.x>w-34)sco+=20;for(const q of rods){const yr=q.ey0[0];const lo=Math.min(q.ex0[0],q.ex0[1])-26*u,hi=Math.max(q.ex0[0],q.ex0[1])+26*u;if(n.parent!==q&&yr>n.y-34*u-4&&yr<n.y+40*u&&n.x>lo&&n.x<hi)sco+=9}}
    for(const q of rods){if(q.ex0[0]<12||q.ex0[1]>w-12)sco+=20}
    sco+=Math.abs(r.nodes.reduce((a,n)=>Math.max(a,n.y||0),0)-(h-50))*.05-lv.length*(c.phone?1:1.4);
    if(sco<bs){bs=sco;best=r}
  }
  best.sc=sc;best.pm=null;best.pv=[0,0];
  return best;
},
tap(c,s,x,y){
  let best=null,bd=1e9;
  for(const n of s.nodes){const dx=n.x-x,dy=n.y-y,d=Math.hypot(dx,dy);
    const imp=1700/(1+(d/90)*(d/90)); n.thv+=(dx/(d||1))*imp*.0022*(120/n.L);
    if(n.kind==='rod')n.phv+=(dx>0?1:-1)*imp*.002;
    if(n.kind==='leaf'&&d<bd){bd=d;best=n}}
  if(best){best.spv+=16}
  for(const n of s.nodes) if(n.kind==='leaf'&&Math.hypot(n.x-x,n.y-y)<170) n.spv+=7*(rnd(n.id)>.5?1:-1);
},
update(c,s,dt){
  dt=Math.max(dt,1/60); const g0=620, t=E.tt;
  // pointer velocity (local)
  let pvx=0,pvy=0; if(c.mIn&&s.pm){pvx=(c.mx-s.pm[0])/dt;pvy=(c.my-s.pm[1])/dt}
  s.pm=c.mIn?[c.mx,c.my]:null;
  const sw=clamp(E.sv*.5,-1500,1500);
  for(const n of s.nodes){
    let px,py;
    if(!n.parent){px=s.cx;py=0}else{px=n.parent.ex[n.side>0?1:0];py=n.parent.ey[n.side>0?1:0]}
    if(!n.init){n.init=1;n.p1=n.p2=px} const ax=clamp((px-2*n.p1+n.p2)/(dt*dt),-1500,1500); n.p2=n.p1;n.p1=px;
    n.ax+=(ax-n.ax)*.35;
    const wind=95*(Math.sin(t*.6+n.id*.9)*.7+Math.sin(t*1.45+n.id*2.1)*.3);
    const L=n.L;
    let acc=-(g0/L)*Math.sin(n.th)-.9*n.thv-(n.ax*.6/L)*Math.cos(n.th)+((wind+sw*(.5+n.depth*.12))/L);
    n.thv+=acc*dt; n.th+=n.thv*dt; n.th=clamp(n.th,-.7,.7);
    const hx=px+Math.sin(n.th)*L, hy=py+Math.cos(n.th)*L; n.hx=hx;n.hy=hy;n.px=px;n.py=py;
    if(n.kind==='rod'){
      const qx=hx+Math.sin(n.th)*16,qy=hy+Math.cos(n.th)*16;n.qx=qx;n.qy=qy;
      const acc2=-(g0/46)*n.phi-1.4*n.phv-(n.ax/46)*.45+(wind+sw*.6)/60;
      n.phv+=acc2*dt;n.phi+=n.phv*dt;n.phi=clamp(n.phi,-.6,.6);
      const co=Math.cos(n.phi),si=Math.sin(n.phi);
      n.ex=[qx-co*n.r1,qx+co*n.r2];n.ey=[qy-si*n.r1,qy+si*n.r2];
      n.x=qx;n.y=qy;
    }else{
      n.x=hx;n.y=hy+26*s.sc;
      n.spv+=(-Math.sin(2*n.sp)*2.2-n.spv*.5+wind*.012)*dt;n.sp+=n.spv*dt;
      if(c.mIn){const d=Math.hypot(c.mx-n.x,c.my-n.y); if(d<44*s.sc){n.thv+=clamp(pvx,-1200,1200)*.0016/(L/110)*(1-d/(44*s.sc));n.spv+=Math.min(14,Math.hypot(pvx,pvy)*.008)*(pvx>0?1:-1)}}
    }
    if(c.mIn&&n.kind==='rod'){
      for(let k=0;k<2;k++){const d=Math.hypot(c.mx-n.ex[k],c.my-n.ey[k]);if(d<34){n.thv+=clamp(pvx,-1200,1200)*.0012/(L/110);n.phv+=clamp(pvy,-900,900)*(k?-1:1)*.0007}}
    }
  }
},
draw(c,s){
  const sc=s.sc, t=E.tt;
  // ceiling plate
  g.beginPath();g.arc(s.cx,0,13,0,PI);g.closePath();fillP();ink(.9,1.8);circ(s.cx-5,3,1.4);circ(s.cx+5,3,1.4);fillS(.7);
  // threads and rods first
  for(const n of s.nodes){
    if(!n.hx) continue;
    g.beginPath();g.moveTo(n.px,n.py);g.lineTo(n.hx,n.hy);ink(.7,1.2);
    if(n.kind==='rod'){
      g.beginPath();g.moveTo(n.hx,n.hy);g.lineTo(n.qx,n.qy);g.lineTo(n.ex[0],n.ey[0]);g.moveTo(n.qx,n.qy);g.lineTo(n.ex[1],n.ey[1]);ink(1,2.1);
      circ(n.hx,n.hy,2.6);fillP();ink(.95,1.5);
      for(let k=0;k<2;k++){circ(n.ex[k],n.ey[k],2.8);fillP();ink(.95,1.5)}
    }
  }
  for(const n of s.nodes){
    if(n.kind!=='leaf'||!n.hx) continue;
    if(n.hy<c.v0-90||n.hy>c.v1+10) continue;
    g.save();g.translate(n.hx,n.hy);g.rotate(n.th*.7);
    const f=Math.cos(n.sp), sx=Math.sign(f||1)*Math.max(.1,Math.abs(f));
    g.scale(sx*sc,sc);
    MOB[n.obj](t+n.ph);
    g.restore();
  }
}};
