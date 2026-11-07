/* ================= 5 · pen plotter ================= */
const PLT={
  scene(w,h,seed){
    const rg=mulberry(seed),R=(a,b)=>a+rg()*(b-a);
    const S=[]; let M={ox:0,oy:0,k:1};
    const sub=(pts,amp)=>{
      const o=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/(6/M.k)));
        for(let j=0;j<n;j++){const t=j/n;o.push([M.ox+(a[0]+(b[0]-a[0])*t)*M.k+(rg()-.5)*amp,M.oy+(a[1]+(b[1]-a[1])*t)*M.k+(rg()-.5)*amp])}}
      const e=pts[pts.length-1];o.push([M.ox+e[0]*M.k,M.oy+e[1]*M.k]);return o;
    };
    const add=(pts,amp=.5)=>{if(pts.length>1)S.push(sub(pts,amp))};
    const ln=(a,b,c,d)=>add([[a,b],[c,d]]);
    const poly=(pts,close)=>add(close?[...pts,pts[0]]:pts);
    const arc=(cx,cy,rx,ry,a0,a1,rot=0)=>{const n=Math.max(10,Math.round(Math.max(rx,ry)*M.k*1.1)),o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;const x=Math.cos(a)*rx,y=Math.sin(a)*ry;o.push([cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)])}add(o)};
    const rect=(x,y,ww,hh)=>poly([[x,y],[x+ww,y],[x+ww,y+hh],[x,y+hh]],true);
    const bH=f=>h*f;
    /* --- band 1: himalayan ridge --- */
    {
      const y0=bH(.015),y1=bH(.27),bh=y1-y0;
      const layers=[{base:y1-bh*.38,amp:bh*.62,pk:[[.16,.7],[.37,1],[.58,.72],[.86,.88]],step:7,hat:true},{base:y1-bh*.08,amp:bh*.34,pk:[[.05,.5],[.3,.8],[.55,.6],[.78,1],[.97,.5]],step:7,hat:true}];
      layers.forEach((L,li)=>{
        const pts=[];for(let x=0;x<=w;x+=L.step){let y=0;for(const p of L.pk){const d=Math.abs(x/w-p[0]),wd=li?.13:.17;y=Math.max(y,p[1]*Math.max(0,1-d/wd))}
          y=L.amp*Math.pow(y,.95)+Math.sin(x*.07+li)*2.2+rg()*1.6;pts.push([x,L.base-y])}
        add(pts,.4);
        // shading hatch on the right-hand slopes
        for(let i=1;i<pts.length-1;i+=1){const dy=pts[i+1][1]-pts[i-1][1];if(dy>3&&i%3===0){const len=Math.min(bh*.22,dy*2.4+4);ln(pts[i][0],pts[i][1],pts[i][0]-len*.35,pts[i][1]+len)}}
        if(li===0){ // snow line and strata under the highest peak
          for(const p of L.pk){if(p[1]<.85)continue;const px=p[0]*w,py=L.base-L.amp*p[1];poly([[px-26,py+bh*.15],[px-16,py+bh*.1],[px-8,py+bh*.16],[px,py+bh*.1],[px+9,py+bh*.17],[px+18,py+bh*.11],[px+27,py+bh*.15]])}
        }
      });
      // sun with rays, and birds
      const sx=w*.14,sy=y0+bh*.2,sr=bh*.09+4;arc(sx,sy,sr,sr,0,TAU);arc(sx,sy,sr*.6,sr*.6,0,TAU);
      for(let i=0;i<14;i++){const a=i*TAU/14;ln(sx+Math.cos(a)*(sr+5),sy+Math.sin(a)*(sr+5),sx+Math.cos(a)*(sr+5+(i%2?5:11)),sy+Math.sin(a)*(sr+5+(i%2?5:11)))}
      for(const [bx,by,bs] of [[.52,.1,1],[.6,.17,.8],[.46,.2,.7]]){const X=w*bx,Y=y0+bh*by;add([[X-9*bs,Y-3*bs],[X-4*bs,Y-7*bs],[X,Y],[X+4*bs,Y-7*bs],[X+9*bs,Y-3*bs]])}
      // clouds
      for(const [cx,cy,cs] of [[.7,.12,1],[.34,.08,.7]]){const X=w*cx,Y=y0+bh*cy;add([[X-30*cs,Y],[X-30*cs,Y-6*cs],[X-20*cs,Y-12*cs],[X-10*cs,Y-8*cs],[X,Y-16*cs],[X+12*cs,Y-10*cs],[X+22*cs,Y-13*cs],[X+32*cs,Y-5*cs],[X+34*cs,Y],[X-30*cs,Y]])}
    }
    /* --- band 2: swayambhu on its hill --- */
    {
      const y0=bH(.285),y1=bH(.565),bh=y1-y0,cx=w*.5,base=y1-2,hill=bh*.2,SZ=Math.min(w*.46,bh*.8);
      const hy=x=>base-hill*Math.exp(-Math.pow((x-cx)/(w*.3),2));
      const hp=[];for(let x=0;x<=w;x+=8)hp.push([x,hy(x)]);add(hp,.6);
      const cr=hy(cx);
      // steps
      for(let i=0;i<22;i++){const t=i/21,x=lerp(cx-w*.3,cx-SZ*.26,t),y=hy(x)-t*4;ln(x-9,y,x+9,y)}
      ln(cx-w*.3-9,hy(cx-w*.3),cx-SZ*.26-9,cr-hill*.0);ln(cx-w*.3+9,hy(cx-w*.3),cx-SZ*.26+9,cr);
      // plinth, dome, harmika, spire
      rect(cx-SZ*.4,cr-SZ*.05,SZ*.8,SZ*.05);rect(cx-SZ*.32,cr-SZ*.1,SZ*.64,SZ*.05);
      const dy=cr-SZ*.1;arc(cx,dy,SZ*.27,SZ*.25,PI,TAU);
      arc(cx,dy,SZ*.2,SZ*.18,PI*1.1,PI*1.9);
      const hxw=SZ*.17,hy0=dy-SZ*.25;rect(cx-hxw/2,hy0-SZ*.12,hxw,SZ*.12);
      const ey=hy0-SZ*.07;for(const sx of [-1,1]){arc(cx+sx*hxw*.24,ey,hxw*.14,hxw*.07,0,TAU)}
      ln(cx,ey+1,cx,ey+SZ*.012);arc(cx,hy0-SZ*.045,SZ*.014,SZ*.014,-PI*.1,PI*1.2);
      for(let i=0;i<13;i++){const wd=SZ*(.12-i*.0058)/2,yy=hy0-SZ*.12-i*SZ*.0145;poly([[cx-wd,yy],[cx-wd+1,yy-SZ*.0145],[cx+wd-1,yy-SZ*.0145],[cx+wd,yy]],false)}
      const ty=hy0-SZ*.12-13*SZ*.0145;arc(cx,ty,SZ*.05,SZ*.022,PI,TAU);ln(cx,ty-SZ*.022,cx,ty-SZ*.06);arc(cx,ty-SZ*.068,SZ*.01,SZ*.01,0,TAU);
      // prayer flags
      for(const sd of [-1,1]){
        const ex=cx+sd*w*.44,ey2=hy(ex)-6;const p0=[cx,ty-SZ*.065],p1=[ex,ey2];
        const sag=n=>Math.sin(n*PI)*bh*.05;
        const pts=[];for(let i=0;i<=24;i++){const n=i/24;pts.push([lerp(p0[0],p1[0],n),lerp(p0[1],p1[1],n)+sag(n)])}add(pts,.2);
        for(let i=1;i<10;i++){const n=i/10,x=lerp(p0[0],p1[0],n),y=lerp(p0[1],p1[1],n)+sag(n);rect(x-3,y,6,7+(i%3))}
      }
      // trees
      const tree=(x,sc)=>{const y=hy(x);ln(x,y,x,y-18*sc);for(const [dx,dy,r] of [[0,-28,10],[-8,-22,8],[8,-23,8]])arc(x+dx*sc,y+dy*sc,r*sc,r*sc,0,TAU);for(let i=0;i<4;i++)ln(x-8*sc+i*5*sc,y-28*sc,x-12*sc+i*5*sc,y-18*sc)};
      for(const [fx,sc] of [[.08,.9],[.2,1.1],[.82,1],[.93,.85],[.72,.8]]) tree(w*fx,sc*(SZ/200+.4));
    }
    /* --- band 3: rooftops --- */
    {
      const y0=bH(.58),y1=bH(.765),bh=y1-y0,base=y1-2;
      ln(0,base,w,base);
      let x=4,pag=false;const tops=[];
      while(x<w-30){
        const wd=R(30,56),ht=R(.28,.62)*bh*.9;
        if(!pag&&x>w*.18){pag=true; // temple
          const px=x+34,th=bh*.17;
          for(let i=0;i<3;i++){const yy=base-th*.9-i*th*1.9,ww=34-i*8;
            rect(px-ww*.55,yy,ww*1.1,th*.9);if(i===0)rect(px-5,yy+th*.2,10,th*.7);else{for(let k=0;k<3;k++)ln(px-ww*.35+k*ww*.35,yy+th*.15,px-ww*.35+k*ww*.35,yy+th*.75)}
            poly([[px-ww-10,yy-6],[px-ww-3,yy+1],[px-ww+4,yy],[px+ww-4,yy],[px+ww+3,yy+1],[px+ww+10,yy-6],[px+ww-8,yy-th*.95],[px-ww+8,yy-th*.95]],true);
            for(let k=0;k<5;k++)ln(px-ww*.6+k*ww*.3,yy-th*.95+2,px-ww*.6+k*ww*.3,yy-4)}
          ln(px,base-th*.9-2*th*1.9-th*.95,px,base-th*.9-2*th*1.9-th*.95-14);arc(px,base-th*.9-2*th*1.9-th*.95-17,3,3,0,TAU);x+=76;continue}
        rect(x,base-ht,wd,ht);ln(x-2,base-ht,x+wd+2,base-ht);
        const rows=Math.max(1,Math.floor(ht/20)),cols2=Math.max(1,Math.floor(wd/17));
        for(let r=0;r<rows;r++)for(let c2=0;c2<cols2;c2++){if(rg()<.8)rect(x+6+c2*(wd-12)/cols2,base-ht+6+r*18,7,9)}
        const q=rg();
        if(q<.3){rect(x+wd*.3,base-ht-12,wd*.35,12);ln(x+wd*.3,base-ht-6,x+wd*.65,base-ht-6)}
        else if(q<.5){ln(x+wd*.5,base-ht,x+wd*.5,base-ht-20);ln(x+wd*.5-8,base-ht-15,x+wd*.5+8,base-ht-15);ln(x+wd*.5-5,base-ht-9,x+wd*.5+5,base-ht-9)}
        tops.push([x+wd/2,base-ht]);x+=wd+R(3,8);
      }
      // power line sagging between rooftops
      for(let i=0;i<tops.length-2;i+=2){const a=tops[i],b=tops[i+2];const pts=[];for(let k=0;k<=10;k++){const n=k/10;pts.push([lerp(a[0],b[0],n),lerp(a[1],b[1],n)-8+Math.sin(n*PI)*10])}add(pts,.2)}
    }
    /* --- band 4: the desk, drawn in a 560 x 150 unit box --- */
    {
      const y0=bH(.785),y1=bH(.985),bh=y1-y0,k=Math.min(w/570,bh/150,1.35);
      M={ox:(w-560*k)/2,oy:y1,k};
      const X=0;
      ln(0,0,560,0);ln(40,-70,520,-70);ln(40,-64,520,-64);ln(46,-64,46,0);ln(514,-64,514,0);ln(90,-64,90,-50);ln(470,-64,470,-50);
      // pendant lamp, like the one on this site
      ln(150,-150,150,-118);poly([[128,-98],[136,-118],[164,-118],[172,-98]],true);arc(150,-98,22,6,0,PI);ln(150,-98,150,-96);
      ln(172,-100,172,-84);arc(172,-82,2.5,2.5,0,TAU);
      for(let i=0;i<5;i++){const xx=134+i*8;ln(xx,-90,xx+(i-2)*3,-72)}
      // laptop
      poly([[326,-70],[404,-70],[396,-77],[334,-77]],true);poly([[336,-77],[342,-140],[396,-140],[394,-77]],true);poly([[342,-132],[390,-132],[390,-84],[344,-84]],true);
      for(let i=0;i<5;i++)ln(350+(i%2)*4,-124+i*8,350+(i%2)*4+[22,34,16,28,12][i],-124+i*8);ln(350,-84+0,356,-84);
      // mug
      poly([[210,-70],[212,-96],[236,-96],[238,-70]],true);arc(224,-96,12,3.5,0,TAU);arc(239,-84,8,7,-PI*.5,PI*.5);
      for(let i=0;i<3;i++){const xx=216+i*8;add([[xx,-102],[xx-4,-110],[xx+3,-118],[xx-2,-126]],.2)}
      // books
      rect(262,-82,52,12);rect(266,-94,44,12);rect(262,-104,50,10);ln(268,-76,308,-76);ln(272,-88,304,-88);
      // arduino with an LED and wire
      rect(60,-84,56,14);for(let i=0;i<8;i++){ln(64+i*6.5,-84,64+i*6.5,-88)}rect(100,-80,10,6);arc(76,-77,3,3,0,TAU);
      add([[116,-76],[128,-76],[132,-88],[146,-88]],.3);arc(150,-88,4,4,0,TAU);for(let i=0;i<6;i++){const a=-PI*.9+i*PI*.36;ln(150+Math.cos(a)*7,-88+Math.sin(a)*7,150+Math.cos(a)*11,-88+Math.sin(a)*11)}
      // plant
      poly([[452,-70],[456,-92],[484,-92],[488,-70]],true);ln(454,-84,486,-84);
      for(let i=0;i<6;i++){const a=-PI*.5+(i-2.5)*.42,L=26+(i%3)*8;add([[470,-92],[470+Math.cos(a)*L*.5+Math.sin(a)*4,-92+Math.sin(a)*L*.5],[470+Math.cos(a)*L,-92+Math.sin(a)*L]],.3);arc(470+Math.cos(a)*L,-92+Math.sin(a)*L,6,3,0,TAU,a)}
      M={ox:0,oy:0,k:1};
    }
    return S;
  },
  doodles(rg){ // each doodle: list of strokes in a 40x40 box centred on 0
    const D=[
      ()=>{const o=[];for(let i=0;i<=5;i++){const a=-PI/2+i*4*PI/5;o.push([Math.cos(a)*16,Math.sin(a)*16])}return [o]},
      ()=>{const o=[];for(let i=0;i<=36;i++){const q=i/36,a=q*TAU*2.4,r=2+q*16;o.push([Math.cos(a)*r,Math.sin(a)*r])}return [o]},
      ()=>{const c=[];for(let i=0;i<=24;i++){const a=i*TAU/24;c.push([Math.cos(a)*15,Math.sin(a)*15])}const m=[];for(let i=0;i<=8;i++){const a=PI*.15+i*PI*.7/8;m.push([Math.cos(a)*9,Math.sin(a)*9+1])}return [c,m,[[-6,-5],[-6,-3]],[[6,-5],[6,-3]]]},
      ()=>{const o=[];for(let i=0;i<=30;i++){const a=i*TAU/30,x=16*Math.pow(Math.sin(a),3),y=-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*1.05;o.push([x*.95,y*.95])}return [o]},
      ()=>[[[-14,6],[-4,-2],[-8,-2],[4,-14],[0,-4],[6,-4],[-6,14]]],
      ()=>{const o=[[-14,12],[-14,-2],[0,-14],[14,-2],[14,12],[-14,12]];return [o,[[-4,12],[-4,2],[4,2],[4,12]]]},
      ()=>{const c=[];for(let i=0;i<=20;i++){const a=i*TAU/20;c.push([Math.cos(a)*11,Math.sin(a)*10+2])}return [c,[[-10,-4],[-12,-14],[-3,-8]],[[10,-4],[12,-14],[3,-8]],[[-14,4],[-24,2]],[[-14,7],[-24,9]],[[14,4],[24,2]],[[14,7],[24,9]],[[-4,2],[-4,3]],[[4,2],[4,3]]]},
      ()=>[[[-16,-6],[-8,-14],[0,-6],[8,-14],[16,-6]],[[-16,6],[-8,-2],[0,6],[8,-2],[16,6]]]
    ];
    return D;
  }
};
VAR[5]={name:'pen plotter',short:'plotter',
init(c){
  const strokes=PLT.scene(c.w,c.h,c.seed*3+11).map(pts=>{let y0=1e9,L=0;for(let i=0;i<pts.length;i++){if(pts[i][1]<y0)y0=pts[i][1];if(i)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])}return {pts,y0,L}});
  // plot order: top of the sheet to the bottom, in 14px swaths, left to right inside a swath
  strokes.sort((a,b)=>Math.floor(a.y0/14)-Math.floor(b.y0/14)||a.pts[0][0]-b.pts[0][0]);
  // occupancy grid for finding empty margin to doodle in
  const cs=22,gw=Math.ceil(c.w/cs),gh=Math.ceil(c.h/cs),occ=new Uint8Array(gw*gh);
  for(const s of strokes)for(const p of s.pts){const gx=Math.floor(p[0]/cs),gy=Math.floor(p[1]/cs);if(gx>=0&&gx<gw&&gy>=0&&gy<gh)occ[gy*gw+gx]=1}
  return {strokes,bins:new Map(),si:0,sp:0,mode:'idle',px:c.w*.5,py:20,ox:0,oy:0,vox:0,voy:0,cur:[],idle:0,q:[],occ,gw,gh,cs,nd:0,rgd:mulberry(c.seed+99),inkmark:0,drawing:false,dn:0,pen:{x:c.w*.5,y:20}};
},
tap(c,s,x,y){s.ox+=(Math.random()-.5)*24;s.oy+=(Math.random()-.5)*24;s.idle=0},
update(c,s,dt){
  const allowY=E.reduced?1e9:(E.ref-c.t)+E.H*.18;
  let allow=0;{let lo=0,hi=s.strokes.length;while(lo<hi){const m=(lo+hi)>>1;if(s.strokes[m].y0<=allowY)lo=m+1;else hi=m}allow=lo}
  // pen nudge from the pointer
  if(c.mIn){const dx=s.pen.x-c.mx,dy=s.pen.y-c.my,d=Math.hypot(dx,dy);if(d<60){const f=(1-d/60)*60;s.vox+=dx/(d||1)*f*dt*30;s.voy+=dy/(d||1)*f*dt*30}}
  s.vox+=(-s.ox*140-s.vox*9)*dt;s.voy+=(-s.oy*140-s.voy*9)*dt;s.ox=clamp(s.ox+s.vox*dt,-22,22);s.oy=clamp(s.oy+s.voy*dt,-22,22);
  let tb=E.reduced?1e9:dt,guard=0;
  while(tb>1e-6&&guard++<6000){
    const st=s.q.length?s.q[0]:(s.si<allow?s.strokes[s.si]:null);
    if(!st){s.drawing=false;s.idle+=dt;if(s.idle>(E.reduced?0:1.4)&&s.q.length===0)PLT.queueDoodle(c,s);break}
    s.idle=0;
    if(s.mode!=='draw'&&s.mode!=='travel')s.mode='travel';
    const a=st.pts[0];
    if(s.mode==='travel'){
      s.drawing=false;
      const dx=a[0]-s.px,dy=a[1]-s.py,d=Math.hypot(dx,dy),need=d/6500;
      if(need<=tb){tb-=need;s.px=a[0];s.py=a[1];s.mode='draw';s.cur=[[a[0]+s.ox,a[1]+s.oy]];s.k=0;s.f=0}
      else{const mv=6500*tb;s.px+=dx/d*mv;s.py+=dy/d*mv;tb=0}
      continue;
    }
    s.drawing=true;
    const ahead=Math.max(0,allowY-s.py), sp=clamp(420+ahead*7,420,8000);
    while(tb>1e-6&&s.k<st.pts.length-1){
      const p0=st.pts[s.k],p1=st.pts[s.k+1],L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])||1e-3,left=L*(1-s.f),need=left/sp;
      if(need<=tb){tb-=need;s.k++;s.f=0;const q=st.pts[s.k];s.px=q[0];s.py=q[1];s.cur.push([q[0]+s.ox,q[1]+s.oy])}
      else{s.f+=sp*tb/L;tb=0;s.px=lerp(p0[0],p1[0],s.f);s.py=lerp(p0[1],p1[1],s.f)}
    }
    if(s.k>=st.pts.length-1){
      const bi=Math.floor(st.y0/200);let P=s.bins.get(bi);if(!P){P={path:new Path2D()};s.bins.set(bi,P)}
      const cp=s.cur;P.path.moveTo(cp[0][0],cp[0][1]);for(let i=1;i<cp.length;i++)P.path.lineTo(cp[i][0],cp[i][1]);
      s.cur=[];s.f=0;s.k=0;s.mode='travel';
      if(s.q.length)s.q.shift();else s.si++;
    }
  }
  s.pen.x=s.px+s.ox;s.pen.y=s.py+s.oy;
},
draw(c,s){
  const w=c.w,h=c.h;
  // crop marks at the sheet corners
  const m=8,L=18;g.beginPath();for(const [x,y,dx,dy] of [[m,m,1,1],[w-m,m,-1,1],[m,h-m,1,-1],[w-m,h-m,-1,-1]]){g.moveTo(x+dx*L,y);g.lineTo(x,y);g.lineTo(x,y+dy*L)}ink(.55,1.2);
  // ink so far
  g.lineJoin='round';g.lineCap='round';
  g.strokeStyle=SA(.92);g.lineWidth=1.45;
  for(const [bi,B] of s.bins){if((bi+1)*200<c.v0-300||bi*200>c.v1+300)continue;g.stroke(B.path)}
  if(s.cur.length>1){g.beginPath();g.moveTo(s.cur[0][0],s.cur[0][1]);for(let i=1;i<s.cur.length;i++)g.lineTo(s.cur[i][0],s.cur[i][1]);g.lineTo(s.pen.x,s.pen.y);ink(.92,1.45)}
  // the gantry: bar across the sheet, end blocks, carriage and pen
  const px=s.pen.x,py=s.pen.y,by=py-16;
  if(by>c.v0-40&&by<c.v1+40){
    g.beginPath();g.moveTo(2,by-4);g.lineTo(w-2,by-4);g.moveTo(2,by+4);g.lineTo(w-2,by+4);ink(.75,1.4);
    for(const x of [0,w-12]){g.beginPath();g.rect(x+1,by-12,11,24);fillP();ink(.9,1.6);g.beginPath();g.moveTo(x+4,by-6);g.lineTo(x+9,by-6);g.moveTo(x+4,by+6);g.lineTo(x+9,by+6);ink(.6,1.1)}
    g.beginPath();g.rect(px-11,by-9,22,18);fillP();ink(.95,1.8);
    g.beginPath();g.moveTo(px-6,by-5);g.lineTo(px+6,by-5);ink(.6,1.1);circ(px+6,by+2,2);ink(.7,1.1);
    const lift=s.drawing?0:5;
    g.beginPath();g.rect(px-3,by+8-lift,6,14);fillP();ink(.95,1.6);
    g.beginPath();g.moveTo(px-3,py-lift-2);g.lineTo(px,py-lift+2);g.lineTo(px+3,py-lift-2);ink(.95,1.5);
    if(s.drawing){circ(px,py,2.2);fillS(1)}
  }
}};
PLT.queueDoodle=function(c,s){
  // find an empty 3x3 patch near the pen, among cells nobody has inked yet
  const rg=s.rgd,D=PLT.doodles();
  const gy0=Math.max(1,Math.floor((s.py-260)/s.cs)),gy1=Math.min(s.gh-3,Math.floor((s.py+60)/s.cs));
  let best=null;
  for(let t=0;t<40;t++){const gx=1+Math.floor(rg()*(s.gw-4)),gy=gy0+Math.floor(rg()*Math.max(1,gy1-gy0+1));let ok=true;
    for(let a=0;a<3&&ok;a++)for(let b=0;b<3;b++){if(s.occ[(gy+b)*s.gw+gx+a]){ok=false;break}}
    if(ok){best=[gx*s.cs+s.cs*1.5,gy*s.cs+s.cs*1.5];break}}
  if(!best){s.idle=-3;return}
  const d=D[s.dn++%D.length]();
  for(const stk of d){const pts=stk.map(p=>[best[0]+p[0]*.9,best[1]+p[1]*.9]);const sub=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/5));for(let j=0;j<n;j++)sub.push([lerp(a[0],b[0],j/n),lerp(a[1],b[1],j/n)])}sub.push(pts[pts.length-1]);s.q.push({pts:sub,y0:Math.min(...sub.map(p=>p[1])),L:0});}
  // mark the area used so doodles do not stack
  const gx=Math.floor(best[0]/s.cs)-1,gy=Math.floor(best[1]/s.cs)-1;for(let a=0;a<3;a++)for(let b=0;b<3;b++)s.occ[(gy+b)*s.gw+gx+a]=1;
  s.idle=0;
};
