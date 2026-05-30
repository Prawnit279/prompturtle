// @ts-nocheck
// justification: direct port of the avgstar vanilla-JS canvas engine. The logic
// is correct; the dense array-index and canvas-context access patterns trigger
// hundreds of strict-null false-positives that would require pervasive ! casts
// without improving safety for this self-contained rendering loop.

import { useEffect, useRef } from 'react';

// Baked engine settings (previously the Tweaks panel in the prototype).
const SETTINGS = { speed: 1, meshIntensity: 1, pointerStrength: 0.32, planes: true, ships: true, trucks: true };

// World coordinate space — all geography is baked in W×H logical pixels.
const W = 1360, H = 820;
const L = 70, R = 1300, T = 95, B = 740;
const LON0 = -180, LON1 = 180, LAT_T = 80, LAT_B = -56;

function project(lon: number, lat: number): [number, number] {
  return [
    L + (lon - LON0) / (LON1 - LON0) * (R - L),
    T + (LAT_T - lat) / (LAT_T - LAT_B) * (B - T),
  ];
}

/**
 * BackdropCanvas — "Live Logistics Map"
 * Renders a fixed-position world map canvas with animated ships, planes, trucks.
 * Pauses when the tab is hidden. Respects prefers-reduced-motion (one static frame).
 */
export default function BackdropCanvas(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── land polygon data ────────────────────────────────────────────────────
    const landLL: number[][][] = [
      [[-168,65],[-162,70],[-148,70],[-128,70],[-100,72],[-82,73],[-66,61],[-56,52],[-64,47],[-70,43],[-74,40],[-76,35],[-81,31],[-80,25],[-90,29],[-97,26],[-95,20],[-90,19],[-87,21],[-83,15],[-83,9],[-78,8],[-95,16],[-104,19],[-110,24],[-114,28],[-117,32],[-122,37],[-124,43],[-124,48],[-130,54],[-138,58],[-148,60],[-158,57],[-165,60],[-168,65]],
      [[-46,60],[-54,66],[-58,73],[-48,78],[-30,83],[-18,76],[-22,70],[-38,62],[-46,60]],
      [[-78,8],[-70,11],[-60,9],[-50,5],[-50,0],[-44,-2],[-35,-6],[-35,-9],[-39,-14],[-41,-22],[-48,-26],[-54,-34],[-58,-39],[-65,-46],[-68,-52],[-71,-54],[-74,-50],[-73,-42],[-73,-37],[-71,-30],[-70,-18],[-76,-14],[-79,-8],[-81,-5],[-80,0],[-78,4],[-78,8]],
      [[-16,14],[-17,20],[-10,27],[-6,32],[-2,35],[10,34],[20,32],[25,32],[33,31],[34,28],[36,22],[37,17],[43,12],[48,12],[51,12],[44,4],[42,-2],[40,-11],[36,-17],[33,-26],[27,-34],[20,-34],[16,-29],[13,-18],[9,-2],[5,4],[-4,5],[-12,8],[-16,14]],
      [[-10,43],[-9,38],[-6,36],[0,39],[4,43],[9,44],[12,40],[16,40],[19,42],[24,40],[27,37],[30,37],[36,36],[36,31],[34,28],[38,22],[43,13],[48,13],[52,17],[56,25],[58,24],[60,25],[64,25],[67,24],[70,21],[73,18],[76,11],[78,8],[80,13],[83,18],[87,21],[90,22],[92,21],[97,16],[100,13],[104,10],[106,16],[108,21],[113,22],[117,23],[121,24],[122,31],[121,37],[126,40],[130,42],[135,45],[140,48],[143,53],[150,59],[156,61],[162,60],[170,66],[180,67],[178,70],[160,71],[140,73],[120,74],[100,76],[80,74],[68,73],[55,71],[45,68],[38,66],[33,70],[26,71],[18,70],[12,66],[8,63],[10,58],[6,58],[4,55],[0,51],[-4,49],[-5,48],[-2,46],[-7,44],[-10,43]],
      [[114,-22],[118,-20],[122,-18],[127,-14],[131,-12],[137,-12],[141,-12],[143,-12],[146,-19],[150,-23],[153,-28],[151,-34],[147,-38],[143,-39],[138,-35],[132,-32],[126,-32],[120,-34],[115,-34],[113,-26],[114,-22]],
      [[-5,58],[-2,57],[0,53],[1,51],[-4,50],[-6,52],[-5,55],[-5,58]],
      [[141,45],[143,43],[141,39],[138,37],[136,35],[131,32],[130,34],[135,36],[139,40],[141,45]],
      [[44,-16],[50,-15],[50,-22],[46,-25],[44,-22],[44,-16]],
      [[109,2],[114,5],[118,4],[118,-2],[111,-4],[109,2]],
      [[131,-1],[138,-2],[146,-6],[150,-9],[143,-9],[136,-7],[131,-1]],
      [[173,-35],[178,-38],[175,-41],[170,-46],[167,-45],[172,-40],[173,-35]],
      [[-24,66],[-18,67],[-14,65],[-20,64],[-24,66]],
    ];

    const allPolys = landLL.map(p => p.map(pt => project(pt[0], pt[1])));

    function inPoly(px: number, py: number, poly: [number,number][]): boolean {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c;
      }
      return c;
    }
    function onLand(px: number, py: number): boolean {
      return allPolys.some(poly => inPoly(px, py, poly as [number,number][]));
    }

    // ── seeded random ────────────────────────────────────────────────────────
    let rs = 1337;
    function rnd(): number { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; }

    // ── nodes (coastline + interior grid) ────────────────────────────────────
    const nodes: { x: number; y: number; ph: number }[] = [];
    function pushN(x: number, y: number) { nodes.push({ x, y, ph: rnd() * 6.283 }); }

    allPolys.forEach(poly => {
      for (let i = 0; i < poly.length - 1; i++) {
        const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
        pushN(ax, ay);
        const segs = Math.floor(Math.hypot(bx - ax, by - ay) / 46);
        for (let s = 1; s < segs; s++) pushN(ax + (bx - ax) * s / segs, ay + (by - ay) * s / segs);
      }
    });
    const GSTEP = 34;
    for (let y = T; y <= B; y += GSTEP) {
      for (let x = L; x <= R; x += GSTEP) {
        const px = x + (rnd() - 0.5) * 22, py = y + (rnd() - 0.5) * 22;
        if (onLand(px, py)) pushN(px, py);
      }
    }

    const loneDots: { x: number; y: number; ph: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const lx = L + rnd() * (R - L), ly = T + rnd() * (B - T);
      if (!onLand(lx, ly)) loneDots.push({ x: lx, y: ly, ph: rnd() * 6.283 });
    }

    // ── edge graph ───────────────────────────────────────────────────────────
    const D = 64, MAXDEG = 6;
    const deg = new Array<number>(nodes.length).fill(0);
    const edges: [number, number][] = [];
    const cand: [number, number, number][] = [];
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < D * D) cand.push([d2, a, b]);
      }
    }
    cand.sort((p, q) => p[0] - q[0]);
    cand.forEach(([, i, j]) => {
      if (deg[i] >= MAXDEG || deg[j] >= MAXDEG) return;
      edges.push([i, j]); deg[i]++; deg[j]++;
    });

    // ── routes ───────────────────────────────────────────────────────────────
    type Pt = [number, number];
    type Route = { scr: Pt[]; seg: number[]; total: number };
    type ArcRoute = { A: Pt; B: Pt; cx: number; cy: number };

    function makeRoute(pts: [number,number][]): Route {
      const scr = pts.map(pt => project(pt[0], pt[1]) as Pt);
      const seg: number[] = [];
      let total = 0;
      for (let i = 1; i < scr.length; i++) {
        const d = Math.hypot(scr[i][0] - scr[i-1][0], scr[i][1] - scr[i-1][1]);
        seg.push(d); total += d;
      }
      return { scr, seg, total };
    }

    function sampleRoute(rt: Route, s: number): { x: number; y: number; ang: number } {
      s = ((s % 1) + 1) % 1;
      let target = s * rt.total;
      let i = 0;
      while (i < rt.seg.length && target > rt.seg[i]) { target -= rt.seg[i]; i++; }
      if (i >= rt.seg.length) i = rt.seg.length - 1;
      const a = rt.scr[i], b = rt.scr[i + 1] ?? rt.scr[i];
      const f = rt.seg[i] ? target / rt.seg[i] : 0;
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }

    function sampleArc(e: ArcRoute, s: number): { x: number; y: number; ang: number } {
      const u = 1 - s;
      const x = u*u*e.A[0] + 2*u*s*e.cx + s*s*e.B[0];
      const y = u*u*e.A[1] + 2*u*s*e.cy + s*s*e.B[1];
      const dx = 2*u*(e.cx-e.A[0]) + 2*s*(e.B[0]-e.cx);
      const dy = 2*u*(e.cy-e.A[1]) + 2*s*(e.B[1]-e.cy);
      return { x, y, ang: Math.atan2(dy, dx) };
    }

    const portLL: Record<string, [number,number]> = {
      rotterdam:[4,52],suez:[32.5,30],losAngeles:[-118,34],newYork:[-74,40.5],
      panama:[-79.5,9],santos:[-46,-24],capeTown:[18.4,-34],lagos:[3.4,6.4],
      dubai:[55,25],mumbai:[72.8,19],singapore:[104,1.3],shanghai:[122,31],
      hongKong:[114,22.3],tokyo:[140,35.5],sydney:[151,-34],durban:[31,-30],vancouver:[-123,49],
    };
    const ports: Record<string, Pt> = {};
    for (const pk in portLL) ports[pk] = project(portLL[pk][0], portLL[pk][1]) as Pt;

    const seaRoutes = [
      [[122,31],[135,36],[160,40],[-175,42],[-150,40],[-128,37],[-118,34]],
      [[104,1.3],[90,5],[72,9],[58,12],[44,12],[40,22],[34,28],[33,31],[20,35],[5,37],[-5,36],[-9,43],[-2,48],[3,51],[4,52]],
      [[-74,40.5],[-50,44],[-28,47],[-12,48],[0,50],[4,52]],
      [[-46,-24],[-25,-30],[-2,-34],[14,-35],[18,-34]],
      [[104,1.3],[110,-6],[120,-16],[135,-28],[148,-34],[151,-34]],
      [[55,25],[63,22],[68,20],[72.8,19]],
      [[-118,34],[-110,22],[-95,13],[-84,10],[-79.5,9]],
      [[18.4,-34],[28,-32],[31,-30]],
    ].map(pts => makeRoute(pts as [number,number][]));

    const airPairs: [string,string][] = [
      ['tokyo','losAngeles'],['rotterdam','newYork'],['dubai','singapore'],
      ['newYork','santos'],['rotterdam','mumbai'],['hongKong','sydney'],
      ['losAngeles','newYork'],['dubai','lagos'],['singapore','tokyo'],
      ['shanghai','vancouver'],['mumbai','durban'],
    ];
    const airRoutes: ArcRoute[] = airPairs.map(([a, b]) => {
      const A = ports[a], B = ports[b];
      const mx = (A[0]+B[0])/2, my = (A[1]+B[1])/2;
      const L2 = Math.hypot(B[0]-A[0], B[1]-A[1]);
      let nx = -(B[1]-A[1]), ny = (B[0]-A[0]);
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (ny > 0) { nx = -nx; ny = -ny; }
      return { A, B, cx: mx + nx * 0.28 * L2, cy: my + ny * 0.28 * L2 };
    });

    const roadData = [
      [[4,52],[8,50.5],[12,49],[16,48]],
      [[122,31],[116,31],[110,31],[105,30]],
      [[-118,34],[-112,36],[-106,39],[-100,40]],
      [[-74,40.5],[-80,41],[-85,41],[-88,40]],
      [[72.8,19],[76,21],[78,24],[80,26]],
      [[-46,-24],[-48,-21],[-48,-17],[-47,-14]],
      [[3.4,6.4],[6,8],[9,9],[12,11]],
    ].map(pts => makeRoute(pts as [number,number][]));

    // ── fleets ───────────────────────────────────────────────────────────────
    const ships = seaRoutes.map((rt, i) => ({ rt, s: (i * 0.17) % 1, sp: 0.016 + (i % 3) * 0.003 }));
    const planes = airRoutes.map((e, i) => ({ e, s: (i * 0.13) % 1, sp: 0.045 + (i % 3) * 0.008 }));
    const trucks: { rt: Route; s: number; sp: number; dir: number }[] = [];
    roadData.forEach((rt, i) => {
      const n = 2 + (i % 2);
      for (let k = 0; k < n; k++) trucks.push({ rt, s: (k / n) % 1, sp: 0.05 + k * 0.01, dir: k % 2 ? -1 : 1 });
    });

    const PLANE = [165, 140, 235] as const;
    const SHIP  = [88,  200, 255] as const;
    const TRUCK = [240, 205, 110] as const;

    function rgba(r: number, g: number, b: number, a: number) { return `rgba(${r},${g},${b},${a})`; }

    function capsule(c: CanvasRenderingContext2D, len: number, wid: number) {
      const r = wid / 2, hx = Math.max(0, len / 2 - r);
      c.beginPath();
      c.arc(-hx, 0, r, Math.PI / 2, Math.PI * 1.5);
      c.lineTo(hx, -r);
      c.arc(hx, 0, r, Math.PI * 1.5, Math.PI / 2);
      c.closePath();
    }

    // ── pointer + ripple state ────────────────────────────────────────────────
    type RippleState = { x: number; y: number; t0: number; amp: number };
    const pointer = { x: -9999, y: -9999, active: false };
    const ripples: RippleState[] = [];
    const lastSpawn = { x: 0, y: 0, t: 0 };
    const PART_R = 130, PART_AMP = 26, RIP_SPEED = 240, RIP_LIFE = 1.4, RIP_BAND = 34, RIP_AMP = 30;

    function toLocal(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
    }

    const handleMouseMove = (e: MouseEvent) => {
      const p = toLocal(e);
      pointer.x = p.x; pointer.y = p.y; pointer.active = true;
      const dt = performance.now() - lastSpawn.t;
      const dd = Math.hypot(p.x - lastSpawn.x, p.y - lastSpawn.y);
      if (dd > 46 && dt > 70) {
        ripples.push({ x: p.x, y: p.y, t0: performance.now() / 1000, amp: 1 });
        lastSpawn.x = p.x; lastSpawn.y = p.y; lastSpawn.t = performance.now();
      }
      if (ripples.length > 18) ripples.shift();
    };
    const handleMouseDown = (e: MouseEvent) => {
      const p = toLocal(e);
      ripples.push({ x: p.x, y: p.y, t0: performance.now() / 1000, amp: 2.1 });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    type EnvRipple = { x: number; y: number; radius: number; alpha: number; amp: number };
    const env = {
      t: 0,
      ripples: [] as EnvRipple[],
      push(x: number, y: number) {
        let dx = 0, dy = 0;
        if (pointer.active) {
          const ax = x - pointer.x, ay = y - pointer.y;
          const d2 = ax * ax + ay * ay;
          const f = Math.exp(-d2 / (PART_R * PART_R)) * PART_AMP;
          const d = Math.sqrt(d2) || 1;
          dx += ax / d * f; dy += ay / d * f;
        }
        for (const r of env.ripples) {
          const ax = x - r.x, ay = y - r.y, d = Math.hypot(ax, ay) || 1;
          const band = Math.exp(-Math.pow(d - r.radius, 2) / (RIP_BAND * RIP_BAND));
          const f = band * RIP_AMP * r.alpha * r.amp;
          dx += ax / d * f; dy += ay / d * f;
        }
        return { dx, dy };
      },
    };

    // ── draw ─────────────────────────────────────────────────────────────────
    function paint() {
      const { meshIntensity: MI, speed: SPD, pointerStrength: PUSH } = SETTINGS;
      const t = env.t;

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 80, W * 0.5, H * 0.5, H * 1.25);
      bg.addColorStop(0, '#0A1026'); bg.addColorStop(0.6, '#070C1E'); bg.addColorStop(1, '#060B1A');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      const dp = nodes.map(n => { const d = env.push(n.x, n.y); return [n.x + d.dx * PUSH, n.y + d.dy * PUSH]; });
      ctx.strokeStyle = rgba(150, 196, 220, 0.07 * MI); ctx.lineWidth = 1; ctx.beginPath();
      for (const [i, j] of edges) { ctx.moveTo(dp[i][0], dp[i][1]); ctx.lineTo(dp[j][0], dp[j][1]); }
      ctx.stroke();

      for (let i = 0; i < nodes.length; i++) {
        const tw = 0.6 + 0.4 * Math.sin(t * 0.7 + nodes[i].ph);
        ctx.fillStyle = rgba(96, 202, 226, Math.min(0.95, (0.22 + tw * 0.14) * MI));
        ctx.beginPath(); ctx.arc(dp[i][0], dp[i][1], 1.3, 0, 6.2832); ctx.fill();
      }
      for (const n of loneDots) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.6 + n.ph);
        const d = env.push(n.x, n.y);
        ctx.fillStyle = rgba(96, 202, 226, Math.min(0.8, (0.10 + tw * 0.10) * MI));
        ctx.beginPath(); ctx.arc(n.x + d.dx * PUSH, n.y + d.dy * PUSH, 1.2, 0, 6.2832); ctx.fill();
      }

      function trail(ax: number, ay: number, bx: number, by: number, col: readonly [number,number,number], al: number) {
        const g = ctx.createLinearGradient(bx, by, ax, ay);
        g.addColorStop(0, rgba(col[0], col[1], col[2], 0));
        g.addColorStop(1, rgba(col[0], col[1], col[2], al));
        ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke();
      }

      if (SETTINGS.ships) ships.forEach(sh => {
        sh.s = (sh.s + sh.sp * SPD / 60) % 1;
        const cur = sampleRoute(sh.rt, sh.s), prev = sampleRoute(sh.rt, sh.s - 0.03);
        const d = env.push(cur.x, cur.y);
        const x = cur.x + d.dx * PUSH * 0.6, y = cur.y + d.dy * PUSH * 0.6;
        trail(x, y, prev.x, prev.y, SHIP, 0.3);
        ctx.save(); ctx.translate(x, y); ctx.rotate(cur.ang);
        ctx.shadowBlur = 6; ctx.shadowColor = rgba(SHIP[0], SHIP[1], SHIP[2], 0.8);
        ctx.fillStyle = rgba(SHIP[0], SHIP[1], SHIP[2], 0.9);
        capsule(ctx, 9, 3.4); ctx.fill(); ctx.restore();
      });

      if (SETTINGS.trucks) trucks.forEach(tr => {
        tr.s = ((tr.s + tr.sp * tr.dir * SPD / 60) % 1 + 1) % 1;
        const cur = sampleRoute(tr.rt, tr.s), d = env.push(cur.x, cur.y);
        ctx.save(); ctx.shadowBlur = 5; ctx.shadowColor = rgba(TRUCK[0], TRUCK[1], TRUCK[2], 0.8);
        ctx.fillStyle = rgba(TRUCK[0], TRUCK[1], TRUCK[2], 0.92);
        ctx.beginPath(); ctx.arc(cur.x + d.dx * PUSH * 0.6, cur.y + d.dy * PUSH * 0.6, 1.7, 0, 6.2832); ctx.fill(); ctx.restore();
      });

      if (SETTINGS.planes) planes.forEach(pl => {
        pl.s = (pl.s + pl.sp * SPD / 60) % 1;
        const cur = sampleArc(pl.e, pl.s), prev = sampleArc(pl.e, Math.max(0, pl.s - 0.04));
        trail(cur.x, cur.y, prev.x, prev.y, PLANE, 0.32);
        ctx.save(); ctx.translate(cur.x, cur.y); ctx.rotate(cur.ang);
        ctx.shadowBlur = 7; ctx.shadowColor = rgba(PLANE[0], PLANE[1], PLANE[2], 0.85);
        ctx.fillStyle = rgba(PLANE[0], PLANE[1], PLANE[2], 0.95);
        ctx.beginPath(); ctx.moveTo(6.5, 0); ctx.lineTo(-4.5, 3.3); ctx.lineTo(-4.5, -3.3); ctx.closePath(); ctx.fill(); ctx.restore();
      });
    }

    // ── animation loop ────────────────────────────────────────────────────────
    let raf = 0;
    let hidden = false;
    let start = performance.now() / 1000;

    function frame() {
      if (hidden) return;
      const now = performance.now() / 1000;
      env.t = reduce ? 6.0 : now - start;
      env.ripples = [];
      for (let i = ripples.length - 1; i >= 0; i--) {
        const age = now - ripples[i].t0;
        if (age > RIP_LIFE) { ripples.splice(i, 1); continue; }
        env.ripples.push({ x: ripples[i].x, y: ripples[i].y, radius: age * RIP_SPEED, alpha: Math.max(0, 1 - age / RIP_LIFE), amp: ripples[i].amp });
      }
      ctx.clearRect(0, 0, W, H);
      paint();
      if (!reduce && !hidden) raf = requestAnimationFrame(frame);
    }

    const handleVisibility = () => {
      hidden = document.hidden;
      if (!hidden && !reduce) { start = performance.now() / 1000 - env.t; frame(); }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    frame();
    if (reduce) frame(); // render static end-state once

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <>
      <div className="lp-backdrop">
        <canvas ref={canvasRef} />
      </div>
      <div className="lp-scrim" />
    </>
  );
}
