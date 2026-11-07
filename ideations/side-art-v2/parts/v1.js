/* ================= 1 · marble run ================= */
const BR=9;
VAR[1]={name:'marble run',short:'marble',
init(c){
  const w=c.w,h=c.h,m=24,gap=46,slope=.115;
  const n=Math.max(3,Math.round((h-130)/(c.phone?112:146)));
  const top=96, step=(h-120-top)/(n-1);
  const segs=[],pegs=[],bells=[],mills=[],funnels=[],tubes=[],lips=[],chev=[];
  for(let i=0;i<n;i++){
    const y=top+i*step, dir=i%2?-1:1, k=i%5;
    const xs=dir>0?m:w-m;
    if(k===2&&i>0){ // funnel row: two slopes into a centre hole
      const cx=w/2, hw=7, sl=.2;
      segs.push([m,y,cx-hw,y+(cx-hw-m)*sl,'f'],[w-m,y,cx+hw,y+(w-m-cx-hw)*sl,'f']);
      tubes.push([cx,y+(cx-hw-m)*sl]);
      lips.push([m,y,-1],[w-m,y,1]);
      funnels.push(i);
      continue;
    }
    let xe=dir>0?w-m-gap:m+gap;
    if(k===3&&i<n-1){xe=w/2+dir*10}
    const len=Math.abs(xe-xs), ye=y+len*slope;
    segs.push([xs,y,xe,ye,'r']); lips.push([xs,y,-dir]);
    chev.push([(xs+xe)/2,(y+ye)/2,dir]);
    if(k===1&&i<n-1){bells.push({x:xe+dir*20,y:ye+34,ax:xe,ay:ye,dir,ring:0,ph:rnd(i)*6})}
    if(k===3&&i<n-1){mills.push({x:xe+dir*2,y:ye+52,th:rnd(i)*3,om:0,R:27})}
    if(k===0&&i>0){pegs.push([xe+dir*-4,ye+36,5],[xe+dir*24,ye+62,5])}
    if(k===4&&i>0){pegs.push([w/2+dir*30,y+step*.52,5])}
  }
  // the bin
  const by=h-26;
  segs.push([m,by,w-m,by,'b']);
  return {segs,pegs,bells,mills,tubes,lips,chev,balls:[],n,m,idle:2.5,acc:0,lever:0,top,bin:by,gx:0,hop:[m+34,34],pops:[],bursts:[]};
},
tap(c,s,x,y){ if(s.balls.length>7) s.balls.shift(); s.balls.push(ball(x,Math.max(20,y),(Math.random()-.5)*40,0)); s.pops.push({x,y,t:0}); },
update(c,s,dt){
  const g0=1500;
  s.idle-=dt; s.acc+=Math.abs(E.sv)*dt;
  if(s.acc>240){s.acc=0;release(s)}
  if(s.idle<=0&&s.balls.length<4){release(s);s.idle=5.5}
  if(s.idle<=0) s.idle=2;
  s.lever*=Math.exp(-dt*3); s.gx=clamp(E.sv*.45,-380,380);
  for(const b of s.bells) b.ring*=Math.exp(-dt*2.2);
  for(const p of s.pops) p.t+=dt; s.pops=s.pops.filter(p=>p.t<.5);
  for(const q of s.bursts) q.t+=dt; s.bursts=s.bursts.filter(q=>q.t<.8);
  for(const mm of s.mills){mm.th+=mm.om*dt;mm.om*=Math.exp(-dt*.7)}
  const bs=s.balls; let vmax=0; for(const b of bs) vmax=Math.max(vmax,Math.hypot(b.vx,b.vy));
  const ns=clamp(Math.ceil(vmax*dt/3.5),2,10), h=dt/ns;
  for(let k=0;k<ns;k++){
    for(const b of bs){
      b.vx+=s.gx*h;b.vy+=g0*h;b.x+=b.vx*h;b.y+=b.vy*h;
      for(const sg of s.segs) hitSeg(b,sg[0],sg[1],sg[2],sg[3],0,0,s,null,sg[4]==='b'?.25:.3);
      for(const p of s.pegs) hitCirc(b,p[0],p[1],p[2],.55);
      for(const be of s.bells) if(hitCirc(b,be.x,be.y,9,.45)>70) be.ring=1;
      for(const mm of s.mills){for(let q=0;q<4;q++){const a=mm.th+q*PI/2;hitSeg(b,mm.x,mm.y,mm.x+Math.cos(a)*mm.R,mm.y+Math.sin(a)*mm.R,mm.x,mm.y,s,mm,.3)}}
      if(b.x<BR+2){b.x=BR+2;b.vx=Math.abs(b.vx)*.4} if(b.x>c.w-BR-2){b.x=c.w-BR-2;b.vx=-Math.abs(b.vx)*.4}
      if(b.y>c.h-BR-1){b.y=c.h-BR-1;b.vy=-Math.abs(b.vy)*.2}
    }
    for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
      const a=bs[i],b=bs[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d<BR*2&&d>1e-3){const nx=dx/d,ny=dy/d,o=(BR*2-d)/2;a.x-=nx*o;a.y-=ny*o;b.x+=nx*o;b.y+=ny*o;const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){a.vx+=nx*vn*.6;a.vy+=ny*vn*.6;b.vx-=nx*vn*.6;b.vy-=ny*vn*.6}}
    }
  }
  for(const b of bs){b.rot+=b.vx*dt/BR;b.age+=dt; const sp=Math.hypot(b.vx,b.vy); if(sp<14&&b.y>c.h-40) b.still+=dt; else b.still=0; if(b.still>3.5||b.age>45){b.dead=true}
    if(!b.landed&&b.y>c.h-48){b.landed=true;s.count=(s.count||0)+1;s.bursts.push({x:b.x,y:c.h-40,t:0})} const m=1500;if(sp>m){b.vx*=m/sp;b.vy*=m/sp}}
  s.balls=bs.filter(b=>!b.dead);
},
draw(c,s){
  const w=c.w,h=c.h, y0=c.v0,y1=c.v1;
  g.lineCap='round';
  // planks
  for(let i=0;i<s.segs.length;i++){
    const sg=s.segs[i]; if(Math.max(sg[1],sg[3])<y0-20||Math.min(sg[1],sg[3])>y1+20) continue;
    const dx=sg[2]-sg[0],dy=sg[3]-sg[1],L=Math.hypot(dx,dy),nx=-dy/L*3.2,ny=dx/L*3.2;
    g.beginPath();PL([[sg[0],sg[1]],[sg[2],sg[3]]],i*3+1,.9);ink(.95,2.8);
    if(sg[4]!=='b'){
      g.beginPath();PL([[sg[0]-nx,sg[1]-ny],[sg[2]-nx,sg[3]-ny]],i*3+2,.8);ink(.45,1.1);
      g.beginPath();for(let t=24;t<L-10;t+=30){g.moveTo(sg[0]+dx*t/L,sg[1]+dy*t/L);g.lineTo(sg[0]+dx*t/L-nx,sg[1]+dy*t/L-ny)}ink(.4,1);
    }
  }
  // bin (bowl)
  if(s.bin>y0-40&&s.bin<y1+60){
    const by=s.bin,m=s.m;
    g.beginPath();SM([[m-8,by-34],[m+2,by-8],[m+40,by+14],[w/2,by+22],[w-m-40,by+14],[w-m-2,by-8],[w-m+8,by-34]]);ink(.9,2);
    g.beginPath();SM([[m+8,by+8],[w/2,by+34],[w-m-8,by+8]]);ink(.4,1.1);
  }
  // tally of marbles that made it down
  { const n=s.count||0;if(n&&s.bin>y0&&s.bin<y1+80){g.beginPath();for(let i=0;i<n&&i<40;i++){const gi=Math.floor(i/5),k=i%5,x=s.m+60+gi*26,y=s.bin-60;if(k<4){g.moveTo(x+k*5,y);g.lineTo(x+k*5,y+16)}else{g.moveTo(x-3,y+13);g.lineTo(x+20,y+3)}}ink(.8,1.7)} }
  // lips, chevrons
  g.beginPath();for(const l of s.lips){g.moveTo(l[0],l[1]-1);g.lineTo(l[0],l[1]-15)}ink(.9,2);
  g.beginPath();for(const q of s.chev){const x=q[0],y=q[1]-9,d=q[2];g.moveTo(x-5*d,y-4);g.lineTo(x+3*d,y+.5);g.lineTo(x-5*d,y+5)}ink(.5,1.3);
  for(const t of s.tubes){g.beginPath();g.moveTo(t[0]-6,t[1]-1);g.lineTo(t[0]-6,t[1]+16);g.moveTo(t[0]+6,t[1]-1);g.lineTo(t[0]+6,t[1]+16);ink(.9,1.8)}
  // pegs
  for(const p of s.pegs){circ(p[0],p[1],p[2]);fillP();ink(.9,1.8);g.beginPath();g.moveTo(p[0],p[1]+p[2]);g.lineTo(p[0],p[1]+p[2]+7);ink(.5,1.1)}
  // bells
  for(const b of s.bells){
    g.beginPath();g.moveTo(b.ax,b.ay);g.lineTo(b.ax+b.dir*20,b.ay+5);g.lineTo(b.x,b.y-14);ink(.7,1.3);
    g.save();g.translate(b.x,b.y-14);g.rotate(Math.sin(E.tt*26+b.ph)*b.ring*.3);
    g.beginPath();g.moveTo(-3,0);g.bezierCurveTo(-4,6,-12,10,-14,22);g.lineTo(14,22);g.bezierCurveTo(12,10,4,6,3,0);g.closePath();fillP();ink(.95,1.8);
    g.beginPath();g.moveTo(-13,26);g.lineTo(13,26);ink(.7,1.4);circ(0,29,2.6);fillS(.9);
    g.restore();
    if(b.ring>.15){g.beginPath();g.arc(b.x,b.y+4,19,PI*.78,PI*1.02);g.arc(b.x,b.y+4,19,-.02*PI,.22*PI);ink(b.ring*.7,1.4);g.beginPath();g.arc(b.x,b.y+4,26,PI*.8,PI*1.0);g.arc(b.x,b.y+4,26,0,.2*PI);ink(b.ring*.45,1.2)}
  }
  // windmills
  for(const m of s.mills){
    g.beginPath();g.moveTo(m.x,m.y);g.lineTo(m.x,m.y+40);ink(.5,1.2);
    for(let q=0;q<4;q++){const a=m.th+q*PI/2,ex=m.x+Math.cos(a)*m.R,ey=m.y+Math.sin(a)*m.R;g.beginPath();g.moveTo(m.x,m.y);g.lineTo(ex,ey);ink(.95,2.2);
      const px=-Math.sin(a)*7,py=Math.cos(a)*7;g.beginPath();g.moveTo(ex+px,ey+py);g.lineTo(ex-px,ey-py);ink(.8,1.6)}
    circ(m.x,m.y,4);fillP();ink(.95,1.8);
  }
  // hopper
  const hx=s.hop[0],hy=s.hop[1];
  if(hy<y1+60){
    g.beginPath();g.moveTo(hx-26,hy-22);g.lineTo(hx-9,hy+12);g.moveTo(hx+26,hy-22);g.lineTo(hx+9,hy+12);ink(.95,2.2);
    g.beginPath();g.moveTo(hx-9,hy+12);g.lineTo(hx-9,hy+22);g.moveTo(hx+9,hy+12);g.lineTo(hx+9,hy+22);ink(.95,2.2);
    g.save();g.translate(hx,hy+19);g.rotate(s.lever*.9);g.beginPath();g.moveTo(-14,0);g.lineTo(14,0);ink(.95,2.4);circ(14,0,2);fillS(.9);g.restore();
    circ(hx-3,hy-8,8.5);fillP();ink(.8,1.6);circ(hx+8,hy-14,8.5);fillP();ink(.8,1.6);
  }
  for(const q of s.bursts){const a=1-q.t/.8;g.beginPath();for(let i=0;i<10;i++){const an=-PI+i*PI/9,r0=10+q.t*40,r1=r0+8+(i%2)*6;g.moveTo(q.x+Math.cos(an)*r0,q.y+Math.sin(an)*r0);g.lineTo(q.x+Math.cos(an)*r1,q.y+Math.sin(an)*r1)}ink(a,2)}
  for(const p of s.pops){g.beginPath();g.arc(p.x,p.y,8+p.t*60,0,TAU);ink(.7*(1-p.t*2),1.4)}
  // balls
  for(const b of s.balls){
    circ(b.x,b.y,BR);fillP();ink(1,2.1);
    g.beginPath();g.moveTo(b.x+Math.cos(b.rot)*BR,b.y+Math.sin(b.rot)*BR);g.lineTo(b.x-Math.cos(b.rot)*BR,b.y-Math.sin(b.rot)*BR);ink(.7,1.4);
    g.beginPath();g.arc(b.x,b.y,BR*.5,b.rot+PI*.3,b.rot+PI*.9);ink(.7,1.3);
  }
}};
function ball(x,y,vx,vy){return {x,y,vx,vy,rot:0,age:0,still:0}}
function release(s){if(s.balls.length>7)return;s.lever=1;s.balls.push(ball(s.hop[0]+rnd(E.tt)*6-3,s.hop[1]+30,60+rnd(E.tt,2)*40,0))}
function hitCirc(b,cx,cy,r,e){
  const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy),R=r+BR; if(d>=R||d<1e-4) return 0;
  const nx=dx/d,ny=dy/d; b.x=cx+nx*R;b.y=cy+ny*R; const vn=b.vx*nx+b.vy*ny; if(vn<0){b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;return -vn} return 0;
}
function hitSeg(b,x1,y1,x2,y2,ox,oy,s,mill,e){
  const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy; let t=((b.x-x1)*dx+(b.y-y1)*dy)/L2; t=clamp(t,0,1);
  const px=x1+dx*t,py=y1+dy*t,ex=b.x-px,ey=b.y-py,d=Math.hypot(ex,ey),R=BR+1.6; if(d>=R) return;
  let nx,ny; if(d<1e-4){nx=0;ny=-1}else{nx=ex/d;ny=ey/d}
  b.x=px+nx*R;b.y=py+ny*R;
  let svx=0,svy=0; if(mill){const rx=px-ox,ry=py-oy;svx=-ry*mill.om;svy=rx*mill.om}
  const vn=(b.vx-svx)*nx+(b.vy-svy)*ny; if(vn<0){
    b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;
    // rolling friction along the plank
    const tx=-ny,ty=nx,vt=b.vx*tx+b.vy*ty; b.vx-=vt*tx*.004;b.vy-=vt*ty*.004;
    if(mill){const rx=px-ox,ry=py-oy,rl=Math.hypot(rx,ry)||1;const imp=-(1+e)*vn;mill.om=clamp(mill.om+(-(nx*(-ry)+ny*rx)/rl)*imp*.012*-1,-7,7)}
  }
}
