// butterfly.js: "The Butterfly Net", 15 s. See STORYBOARD.md for the shot list and the reads.
//   Shot A (0–5.2 s):    a butterfly lands on a pink flower; Clawd stalks it and slams the net down, too late.
//   Shot B (5.2–9.6 s):  the chase and the big leap, which misses and ends face-first in the flowers.
//   Shot C (9.6–15 s):   Clawd gives up and sits still, and the butterfly lands on the flower stuck on Clawd's head.
(() => {
  const COL = {
    skyAM: '#A8D2EA', skyPM: '#F2D2A6', cloud: PAL.cream,
    far: '#9DC2CF', farPM: '#C7B8A4', mid: '#8DB872', midPM: '#A9B566', ground: '#78A85E', groundPM: '#8FA552',
    grass: '#4E8044', grassPM: '#5F7E3C', stem: '#4E8A4A',
    wing: '#4C7BD4', wingLt: '#86AEEE', bug: '#3A2F4A', pink: '#EF8DA8', wood: '#B98A55', mesh: '#FFF8EC'
  };
  const warmK = t => ease(seg(t, 8.6, 12.4));                 // the colour arc: cool morning → warm late light
  const wc = (a, b, t) => mixCol(COL[a], COL[b], warmK(t));

  // ---------- small geometry helpers ----------
  const dir = a => [Math.cos(a), Math.sin(a)];
  const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
  // a point along a smooth path through P (Catmull-Rom), k = 0..1
  function pathAt(P, k) {
    const n = P.length - 1, s = clamp(k) * n, i = Math.min(n - 1, Math.floor(s)), u = s - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)], u2 = u * u, u3 = u2 * u;
    return [0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3));
  }
  // where a body-local point (in u, front-view coordinates) of a clawd() call lands in the world
  function bodyPt(x, y, u, o, px, py) {
    const sq = o.sq || 0, sx = (o.flip ? -1 : 1) * (1 + sq * .6) * (1 + clamp(o.smear || 0) * .35), sy = 1 - sq, r = o.rot || 0;
    const X = px * u * sx, Y = py * u * sy;
    return [x + (o.dx || 0) * u + X * Math.cos(r) - Y * Math.sin(r), y + (o.dy || 0) * u + X * Math.sin(r) + Y * Math.cos(r)];
  }
  // the tip of Clawd's arm 'L' (the near arm in side view, screen-left in front view), and its world angle
  function handL(x, y, u, o) {
    const a = o.aL ?? .2, v = o.view || 'front';
    let px, py, ang;
    if (v === 'side') { const r = .7 - a; px = 1.6 + 2.1 * Math.cos(r); py = -4.2 + 2.1 * Math.sin(r); ang = r; }
    else { const piv = (v === 'q' ? -4.7 : -4.9) - .55 * clamp((Math.abs(a) - .7) / .9); px = piv - 2.2 * Math.cos(a); py = -4.5 - 2.2 * Math.sin(a); ang = Math.PI + a; }
    return { p: bodyPt(x, y, u, o, px, py), ang: ang + (o.rot || 0) };
  }

  // ---------- the world ----------
  // Sky in screen space; clouds drift with global time and shift with the camera's tilt (oy), the same in every
  // shot, so the B→C tilt carries straight through the cut.
  // Big flat areas use flat() (see core.js): they come first in the frame, so the brush work lands on top.
  // a soft-edged watercolour patch as flat layers: a darker body and a paler, uneven rim
  function patch(pts, col, a = 255, b = .12) {
    for (const [s, k] of [[1 + b, .45], [1, .7], [1 - b * .8, .55]]) {
      let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
      flat(pts.map(([x, y]) => [cx + (x - cx) * s + jit(2), cy + (y - cy) * s + jit(2)]), col, a * k);
    }
  }
  function sky(t, oy) {
    boilSeed('sky');
    flat(rectPts(-60, -60, W + 120, H + 120), wc('skyAM', 'skyPM', t));
    boilSeed('sun');
    const k = warmK(t);
    if (k > .02) patch(ellPts(1560, 170 + oy * .2, 62, 62, 24, 1.5), mixCol(COL.skyPM, PAL.cream, .8), 255 * k, .25);
    for (let i = 0; i < 6; i++) {
      boilSeed('cloud' + i);
      const x = ((hash(i + 4) * (W + 700) + t * (14 + 10 * hash(i))) % (W + 700)) - 350, y = 90 + hash(i + 9) * 330 + oy * .25, s = 70 + 70 * hash(i + 2);
      patch(ellPts(x, y, s * 1.9, s * .55, 18, 4), COL.cloud, 170, .1);
      patch(ellPts(x - s * .5, y - s * .35, s * .8, s * .5, 16, 3), COL.cloud, 150, .1);
      patch(ellPts(x + s * .6, y - s * .25, s * .7, s * .42, 16, 3), COL.cloud, 150, .1);
    }
  }
  // Hills and ground, in world space under the camera; far layers move less (parallax), keyed off the camera centre.
  function land(t, cam, G) {
    const L = cam.cx - 1400, R = cam.cx + 1400;
    const layer = (name, f, y, ry, step, col) => {
      const ox = (cam.cx - 960) * (1 - f), oy = (cam.cy - 540) * (1 - f) * .6;
      for (let i = Math.floor((L - ox) / step) - 1; i <= Math.ceil((R - ox) / step) + 1; i++) {
        boilSeed(name + i);
        const cx = i * step + hash(i * 3.1 + f) * step * .5 + ox;
        const P = ellPts(cx, y + oy + 40 * hash(i + f * 7), step * .85, ry * (.7 + .5 * hash(i * 1.7 + f)), 30, 2);
        flat(P, col); patch(P.map(([px, py]) => [px, py + 25]), mixCol(col, PAL.cream, .3), 70, .1);
      }
    };
    layer('far', .3, G - 150, 170, 620, wc('far', 'farPM', t));
    layer('mid', .6, G - 70, 120, 480, wc('mid', 'midPM', t));
    boilSeed('ground');
    const gc = wc('ground', 'groundPM', t), top = [];
    for (let x = Math.floor(L / 160) * 160; x <= R + 160; x += 160) top.push([x, G - 95 + 10 * Math.sin(x * .004) + 6 * hash(x)]);
    flat([...top, [R + 160, G + 1400], [L - 160, G + 1400]], gc);
    // a soft, darker band of paint low in the meadow, so the ground isn't one flat colour
    patch(rectPts(L - 100, G + 70, R - L + 200, 900, 6), mixCol(gc, PAL.ink, .12), 110, .02);
    return () => { boilSeed('groundline'); for (let i = 0; i + 1 < top.length; i += 3) inkLine(top.slice(i, i + 4), .7, mixCol(gc, PAL.ink, .35), 'inkfine', .5); };
  }
  // A grass tuft: three blades, swaying on its own clock.
  function tuft(x, y, h, t, seed, col, sw = .8) {
    boilSeed('tuft' + seed);
    const s = wob(t, .45 + .2 * hash(seed), hash(seed + 1)) * h * .16;
    for (const k of [-1, 0, 1]) inkLine([[x + k * h * .18, y], [x + k * h * .3 + s * .5, y - h * .5], [x + k * h * .42 + s, y - h * (.85 + .25 * hash(seed + k + 3))]], sw, col, 'inkfine', .5);
  }
  function grassRow(t, cam, y, h, step, col, key, sw) {
    const L = cam.cx - 1150, R = cam.cx + 1150;
    for (let i = Math.floor(L / step); i <= R / step; i++) tuft(i * step + hash(i + key) * step * .7, y + hash(i * 1.3 + key) * 40, h * (.7 + .5 * hash(i + key * 2)), t, key * 1000 + i, col, sw);
  }
  // A flower head: five rounded petals as one outline, with an ochre centre.
  function bloom(x, y, r, col, rot = 0, sw = .8) {
    const P = []; for (let i = 0; i < 40; i++) { const a = rot + i / 40 * TAU, rr = r * (.6 + .4 * Math.pow(Math.abs(Math.cos((a - rot) * 2.5)), .7)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    paint(P, { wash: col, ink: PAL.ink, sw });
    paint(ellPts(x, y, r * .3, r * .3, 12), { wash: PAL.ochre, ink: PAL.ink, sw: sw * .7 });
  }
  // A whole flower on a stem from the ground point (x, gy). bend tips the stem (px); returns the head's centre.
  const num = s => typeof s === 'number' ? s : [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
  function flower(x, gy, h, r, col, t, key, bend = 0, sw = .8) {
    boilSeed('flower' + key);
    const seed = num(key);
    const s = wob(t, .35 + .15 * hash(seed), hash(seed + 2)) * h * .06 + bend, tip = [x + s, gy - h * (1 - .35 * Math.min(1, Math.abs(bend) / h))];
    inkLine([[x, gy], [x + s * .3, gy - h * .5], tip], sw * 1.1, COL.stem, 'ink', .5);
    push(); translate(x + s * .2, gy - h * .4); rotate(-.7 + s * .004);
    paint(ellPts(h * .1, 0, h * .12, h * .05, 12), { wash: COL.stem, ink: PAL.ink, sw: sw * .6 });
    pop();
    bloom(tip[0], tip[1], r, col, hash(seed) * 2 + s * .01, sw);
    return tip;
  }
  // scattered meadow flowers, far behind the action: flat shapes in the background pass (a darker rim for an outline),
  // stable per position, swaying
  function meadowFlowers(t, cam, G, skip = () => false) {
    const L = cam.cx - 1150, R = cam.cx + 1150, cols = [PAL.cream, PAL.ochre, COL.pink, '#F6E9A8'];
    for (let i = Math.floor(L / 170); i <= R / 170; i++) {
      const x = i * 170 + hash(i * 5.3) * 120, gy = G - 70 + hash(i * 2.9) * 50;
      if (skip(x)) continue;
      boilSeed('mf' + i);
      const h = 34 + 26 * hash(i * 1.9), r = 9 + 5 * hash(i * 4.1), col = cols[Math.floor(hash(i * 7.7) * 4)];
      const sw = wob(t, .35 + .15 * hash(i), hash(i + 2)) * h * .07, tip = [x + sw, gy - h];
      flat(ribbon([[x, gy], [x + sw * .3, gy - h * .5], tip], 3.4, 2.2), mixCol(COL.stem, PAL.ink, .15));
      flat(ellPts(x + sw * .2 + h * .1, gy - h * .45, h * .13, h * .055, 12, 0, -.6), COL.stem);
      const P = []; for (let k = 0; k < 30; k++) { const a = hash(i) * 2 + k / 30 * TAU, rr = r * (.6 + .4 * Math.pow(Math.abs(Math.cos((a - hash(i) * 2) * 2.5)), .7)); P.push([tip[0] + Math.cos(a) * rr, tip[1] + Math.sin(a) * rr]); }
      flat(P.map(([px, py]) => [tip[0] + (px - tip[0]) * 1.14, tip[1] + (py - tip[1]) * 1.14]), mixCol(col, PAL.ink, .45));
      flat(P.map(([px, py]) => [px + jit(.6), py + jit(.6)]), col);
      flat(ellPts(tip[0], tip[1], r * .3, r * .3, 10), PAL.ochre);
    }
  }

  // ---------- the butterfly ----------
  // Drawn from above, as a flat cartoon: open = 0..1 is how far the wings are spread (a flap is the wings narrowing
  // to their edge and back). s = the length of one forewing in px. Faces up (rot turns it).
  function butterfly(x, y, s, open, rot = 0, key = 'bfly') {
    boilSeed(key);
    const k = lerp(.3, 1, clamp(open)), sw = clamp(s / 34, .4, 1);
    push(); translate(x, y); rotate(rot);
    for (const side of [-1, 1]) {
      const P = pts => pts.map(([a, b]) => [a * s * k * side, b * s]);
      const hind = P([[.04, .02], [.5, .06], [.78, .4], [.66, .82], [.34, .92], [.1, .55]]);
      const fore = P([[.04, -.12], [.3, -.72], [.78, -.98], [1.06, -.72], [.98, -.3], [.62, .04], [.1, .08]]);
      paint(hind, { wash: COL.wingLt, ink: PAL.ink, sw, curv: .6 });
      paint(fore, { wash: COL.wing, ink: PAL.ink, sw, curv: .6 });
      paint(P([[.16, -.12], [.42, -.55], [.7, -.68], [.66, -.32], [.4, -.04]]), { wash: COL.wingLt, washOp: 200, ink: null, curv: .6 });
      if (k > .35) for (const [a, b, r] of [[.86, -.7, .07], [.72, -.84, .05], [.55, .62, .06]])
        paint(ellPts(a * s * k * side, b * s, r * s * k, r * s, 10), { wash: PAL.cream, ink: null });
    }
    paint(ellPts(0, .18 * s, .09 * s, .42 * s, 12), { wash: COL.bug, ink: PAL.ink, sw: sw * .7 });
    paint(ellPts(0, -.32 * s, .11 * s, .11 * s, 10), { wash: COL.bug, ink: null });
    for (const side of [-1, 1]) {
      inkLine([[side * .04 * s, -.38 * s], [side * .14 * s, -.62 * s], [side * .3 * s, -.78 * s]], sw * .6, PAL.ink, 'inkfine', .5);
      paint(ellPts(side * .31 * s, -.79 * s, .045 * s, .045 * s, 8), { wash: PAL.ink, ink: null });
    }
    pop();
  }
  // flying: fast flaps (on its own clock), a little lift on each downstroke
  const flap = (t, hz = 5) => .5 + .5 * Math.cos(t * TAU * hz);
  const flutter = (t, amt = 1, ph = 0) => [amt * (9 * Math.sin(t * 3.1 + ph) + 5 * Math.sin(t * 7.3 + ph * 2)), amt * (12 * Math.sin(t * 4.3 + ph) + 6 * Math.sin(t * 10.1))];
  // the bank of the butterfly along its path (it leans into the way it's going)
  const bank = (P, k, amt = .5) => { const a = pathAt(P, Math.max(0, k - .01)), b = pathAt(P, Math.min(1, k + .01)); return clamp((b[0] - a[0]) * .04, -1, 1) * amt; };

  // ---------- the net ----------
  // In world space: a wooden handle from the hand at world angle ang, a wire hoop (rx, ry in u: ry < rx tips it
  // toward lying flat), and a mesh bag hanging off the hoop toward bagAng.
  function net(hand, ang, u, o = {}) {
    boilSeed('net');
    const len = (o.len ?? 6) * u, rx = (o.rx ?? 1.7) * u, ry = (o.ry ?? 1.5) * u, sw = clamp(u / 15, .45, 2) * .8;
    const d = dir(ang), start = add(hand, d, -.6 * u), end = add(hand, d, len);
    const rim = Math.hypot(rx * d[0], ry * d[1]) / Math.hypot(d[0], d[1]) * .92;
    const c = add(end, d, Math.min(rx, ry) + (rim - Math.min(rx, ry)) * .9);
    const ba = o.bagAng ?? Math.PI / 2, bl = (o.bag ?? 3) * u, bd = dir(ba), pp = [-bd[1], bd[0]];
    const onRim = a => [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry];
    // the rim points where the bag leaves the hoop: the two ends of the hoop's diameter across the bag's direction
    const ra = Math.atan2(pp[1] * rx, pp[0] * ry), A = onRim(ra), B = onRim(ra + Math.PI);
    const tip = add(c, bd, bl), w = Math.hypot(A[0] - B[0], A[1] - B[1]) * .5;
    const bag = through([A, add(add(c, bd, bl * .55), pp, w * .95), tip, add(add(c, bd, bl * .55), pp, -w * .95), B], 6);
    for (let i = 1; i <= 8; i++) bag.push(onRim(ra + Math.PI + i / 9 * Math.PI * (Math.sin(ra - ba) > 0 ? -1 : 1)));
    paint(bag, { wash: COL.mesh, washOp: 140, ink: mixCol(PAL.ink, COL.mesh, .35), sw: sw * .6,
      hatch: { d: u * .38, a: ba + .6, o: { rand: .1 }, b: 'HB', c: mixCol(PAL.ink, COL.mesh, .45), w: .5 } });
    inkLine([start, end], sw * 2.6, PAL.ink, 'ink', 0);
    inkLine([start, end], sw * 1.5, COL.wood, 'ink', 0);
    paint(ellPts(c[0], c[1], rx, ry, 28), { ink: PAL.ink, sw: sw * 1.2 });
    return { c, rx, ry };
  }
  // the pink flower that ends up on Clawd's head, drawn in body space through clawd's draw hook
  const HF = { x: 1.3, y: -7.95, len: 1.2, r: .8 };
  const headFlower = (lean, k = 1) => (u, sw) => {
    if (k <= 0) return;
    push(); translate(HF.x * u, HF.y * u); rotate(lean); scale(k);
    inkLine([[0, .2 * u], [.05 * u, -HF.len * .5 * u], [0, -HF.len * u]], sw * .9, COL.stem, 'ink', .5);
    bloom(0, -HF.len * u, HF.r * u, COL.pink, .3, sw * .8);
    pop();
  };
  // the top of the head flower, in body space (for the butterfly to stand on)
  const headFlowerTop = lean => [HF.x + Math.sin(lean) * HF.len + Math.sin(lean) * HF.r * .3, HF.y - Math.cos(lean) * HF.len - HF.r * .35];

  // paint streaks for the whip pan: k = 0..1 strength (screen space)
  function streaks(k, t) {
    if (k <= .15) return;
    boilSeed('streaks' + Math.floor(t * 24));
    const cols = [mixCol(COL.ground, PAL.cream, .3), PAL.cream, wc('skyAM', 'skyPM', t), COL.mid, COL.grass];
    for (let i = 0; i < 22; i++) {
      const y = hash(i * 3.7) * H, x = hash(i * 1.3 + Math.floor(t * 24)) * W, l = (300 + 700 * hash(i * 2.1)) * k;
      inkLine([[x - l, y], [x, y + jit(4)], [x + l, y]], 1 + 2.5 * hash(i), cols[i % 5], 'dry', .3);
    }
  }

  // ---------- shot A: the stalk ----------
  const GA = 845, uA = 22;
  const A = { notice: 1.85, scheme: 2.4, turn0: 2.45, turn1: 2.62, sneak0: 2.7, sneak1: 3.6, wind: 3.62, slam0: 3.9, slam: 4.02, peek: 4.08, look: 4.6, zip: 4.95, dur: 5.2 };
  const xA0 = 640, xA1 = 930;
  // Clawd's pose in shot A, as a function of time (also used to find where the net lands)
  function clawdA(t, slamAng) {
    const mood = emotions(t, [[0, 'bored'], [A.notice, 'surprised', { lookX: 1, lookY: -.2 }], [A.scheme, 'mischief', { lookX: 1 }],
      [A.wind - .05, 'determined'], [A.peek, 'hopeful', { lookX: .5, lookY: .9 }], [A.look, 'surprised', { lookX: .2, lookY: -1 }], [A.zip - .1, 'determined']]);
    const o = { ...mood };
    let x = xA0, aL = mood.aL, ang;   // ang = the net handle's world angle
    const lean = (wob(t, .25) * .06);
    if (t < A.turn0) { aL = .05; ang = -1.5 + lean - .25 * seg(t, A.notice, A.notice + .3) * (1 - seg(t, A.scheme, A.turn0)); }
    else if (t < A.turn1) { Object.assign(o, turn(t, A.turn0, A.turn1, 0, .25)); aL = lerp(.05, .9, seg(t, A.turn0, A.turn1)); ang = lerp(-1.5, -1.05, ease(seg(t, A.turn0, A.turn1))); }
    else {
      o.view = 'side';
      const s = stroll(t, A.sneak0, A.sneak1, xA0, xA1, uA), steps = s.walk * 1.6;
      x = s.x;
      if (t < A.wind) {   // tiptoe: crouched, a little rise on every step, net held high and forward
        const moving = t > A.sneak0 && t < A.sneak1;
        o.walk = steps; o.sq = (o.sq || 0) * .4 + .14 * seg(t, A.turn1, A.sneak0) - (moving ? .05 * Math.abs(Math.sin(steps * Math.PI * 2)) : 0);
        o.dy = (o.dy || 0) * .3 - (moving ? .35 * Math.abs(Math.sin(steps * Math.PI * 2)) : 0);
        o.rot = .06; aL = .9 + .05 * Math.sin(steps * TAU); ang = -1.05 + .05 * Math.sin(steps * TAU + 1);
      } else if (t < A.slam0) {   // wind-up: the net goes up and back over the head, the body leans back and squashes
        const k = ease(seg(t, A.wind, A.slam0));
        o.rot = lerp(.06, -.16, k); o.sq = lerp(.1, .18, k); o.dy = 0; aL = lerp(.9, 1.55, k); ang = lerp(-1.05, -2.45, k);
      } else {   // the slam, then the hold on it
        const k = easeIn(seg(t, A.slam0, A.slam)), a = Math.max(0, t - A.slam);
        o.rot = lerp(-.16, .2, k) - .08 * seg(a, .1, .5) + .03 * spring(t, A.slam, 7, 22); o.sq = lerp(.18, -.12, k) + .2 * spring(t, A.slam, 8, 20) + (t > A.slam ? .06 : 0);
        o.dy = (t > A.look ? (mood.dy || 0) * .3 : 0);
        aL = lerp(1.55, -.35, k); ang = lerp(-2.45, slamAng ?? SLAM.ang, k) + .04 * spring(t, A.slam, 7, 24);
        if (t > A.zip) {   // lift the net and start the run (the move carries through the cut)
          const z = ease(seg(t, A.zip, A.dur));
          x += 90 * easeIn(seg(t, A.zip, A.dur)); o.walk = (t - A.zip) * 4; o.rot = lerp(o.rot, -.08, z); aL = lerp(aL, .6, z); ang = lerp(ang, -.4, z);
        }
      }
    }
    o.aL = aL;
    return { o, x, ang };
  }
  // Where the net lands: solve once for the slam angle that puts the flat hoop on the ground, and plant the flower there.
  const SLAM = (() => {
    const s = { ang: .5 }, probe = t => { const c = clawdA(t, s.ang), h = handL(c.x, GA, uA, c.o); return h; };
    let hoop;
    for (let i = 0; i < 12; i++) {
      const h = probe(A.slam + .001), d = dir(s.ang), len = 6 * uA, rx = 1.7 * uA, ry = .45 * uA;
      const rim = Math.hypot(rx * d[0], ry * d[1]) * .92, c = add(h.p, d, len + ry + (rim - ry) * .9);
      hoop = c; s.ang += clamp((GA - 18 - c[1]) / (len + rim), -.3, .3);
    }
    s.fx = hoop[0];
    return s;
  })();
  const FA = { x: SLAM.fx, h: 58, r: 21 };   // the hero flower

  function shotA(t, lt, dur) {
    const camX = kf(lt, [[0, 1010], [1.9, 880], [A.slam, 900]]) + 10 * Math.sin(lt * .5) + 1500 * easeIn(seg(lt, A.zip + .02, dur));
    const cam = { cx: camX, cy: kf(lt, [[0, 660], [1.9, 630]]) + 5 * Math.sin(lt * .7), z: kf(lt, [[0, 1.62], [1.9, 1.45], [A.slam, 1.5], [dur, 1.53]]) };
    sky(t, 0);
    camBegin(cam.cx, cam.cy, cam.z);
    const gl = land(t, cam, GA);
    meadowFlowers(t, cam, GA, x => Math.abs(x - FA.x) < 140 || Math.abs(x - 640) < 170);
    gl();
    grassRow(t, cam, GA - 40, 34, 95, mixCol(wc('grass', 'grassPM', t), PAL.cream, .2), 1, .6);

    // the hero flower: bends and flinches when the net hits it
    const hit = t > A.slam ? spring(t, A.slam, 5, 20) : 0;
    const head = flower(FA.x, GA - 4, FA.h, FA.r, COL.pink, t, 'hero', -10 * hit + 3 * Math.sin(t * 1.3), .9);

    const c = clawdA(t);
    clawd(c.x, GA, uA, c.o);
    const h = handL(c.x, GA, uA, c.o);
    const slammed = t >= A.slam, flat = slammed ? 1 : ease(seg(t, A.slam0 + .04, A.slam));
    const swingK = seg(t, A.slam0, A.slam);
    net(h.p, c.ang, uA, { ry: lerp(1.5, .45, flat), bagAng: slammed ? -Math.PI / 2 + .25 * spring(t, A.slam, 4, 14) : lerp(Math.PI / 2, Math.PI * .95, swingK * (1 - swingK) * 4), bag: slammed ? 3.2 : 3 });

    // the butterfly: flutters in, lands on the flower, lifts off just before the slam, hovers above Clawd, zips off
    const flyIn = [[120, 90], [520, 250], [860, 150], [1180, 330], [FA.x + 120, head[1] - 90], [head[0], head[1] - 10]];
    let bp, open, rot = 0;
    if (lt < 1.65) {
      const k = easeOut(seg(lt, .15, 1.65)), f = flutter(lt, 1 - seg(lt, 1.2, 1.6));
      bp = add(pathAt(flyIn, k), f); open = lt > 1.45 ? lerp(flap(lt), .9, seg(lt, 1.45, 1.65)) : flap(lt); rot = bank(flyIn, k);
    } else if (lt < 3.88) {
      const a = lt - 1.65;
      bp = [head[0], head[1] - 10]; open = .72 + .28 * Math.cos(a * TAU * .8); rot = -.1 + .04 * Math.sin(a * 2);
      if (lt > 3.6) open = lerp(open, 1, seg(lt, 3.6, 3.75));   // it senses Clawd: wings stop
    } else {
      const hover = [h.p[0] - 10, GA - 13.5 * uA];
      const up = [[head[0], head[1] - 10], [head[0] + 40, head[1] - 120], [hover[0] + 120, hover[1] - 30], hover];
      const k = easeOut(seg(lt, 3.88, 4.45)), f = flutter(lt, .5 + .5 * seg(lt, 4.3, 4.6), 2);
      bp = add(lt < 4.45 ? pathAt(up, k) : hover, f); open = flap(lt, 6); rot = .15 * Math.sin(lt * 3);
      if (lt > A.zip) { const z = easeIn(seg(lt, A.zip, dur)); bp = add(bp, [2300 * z, -260 * z]); rot = .9 * seg(lt, A.zip, A.zip + .08); }
    }
    butterfly(bp[0], bp[1], 33, open, rot);

    grassRow(t, cam, GA + 70, 52, 140, wc('grass', 'grassPM', t), 2, .9);
    const flowerAt = toScreen(head[0], head[1]);
    camEnd();
    boilSeed('transition');
    if (lt < .55) iris(...flowerAt, lerp(0, 1500, easeIn(lt / .55)));
    streaks(seg(lt, A.zip + .05, dur) ** 2, t);
  }

  // ---------- shot B: the chase ----------
  const GB = 845, uB = 22;
  const B = { crouch: 1.25, leap: 1.4, land: 1.95, up: 2.35, sad: 3.05, tilt: 3.55, dur: 4.4 };
  const xRun = lt => kf(lt, [[0, -1500], [.35, 100], [B.crouch, 730], [B.leap, 830], [B.land, 1280], [2.3, 1330]], x => x);
  const CX = 1300;   // the flower bed
  const bed = [[-150, PAL.cream, 40], [-80, COL.pink, 52], [20, '#F6E9A8', 46], [95, COL.pink, 60], [150, PAL.cream, 44], [220, PAL.ochre, 50], [290, COL.pink, 42]];
  const POP = 3;   // which bed flower ends up on Clawd's head
  function camB(lt) {
    const s = Math.min(lt, 1.5), d = clamp(lt - 1.5, 0, .8);
    const cx = 700 + 450 * s + 450 * (d - d * d / 1.6) - 1300 * (1 - easeOut(seg(lt, 0, .38)));
    return { cx, cy: 665 - 1100 * easeIn(seg(lt, B.tilt, B.dur)) - 20 * ease(seg(lt, B.sad, B.tilt)), z: 1.5 + .06 * ease(seg(lt, B.sad - .4, B.tilt)) };
  }
  function clawdB(lt) {
    const mood = emotions(lt, [[0, 'determined'], [B.land, 'dizzy'], [B.sad, 'sad', { lookX: .5, lookY: -.8, emote: undefined }]]);
    const o = { ...mood, view: 'side' }, x = xRun(lt);
    let ang;
    if (lt < B.crouch) {   // run
      const ph = lt * 3.6;
      o.walk = ph; o.dy = -.7 * Math.abs(Math.sin(ph * TAU)); o.sq = .06 * Math.cos(ph * TAU * 2); o.rot = .1;
      o.aL = .55 + .12 * Math.sin(ph * TAU); ang = -.45 + .1 * Math.sin(ph * TAU + .8);
    } else if (lt < B.land) {   // crouch, leap, the overhead swing
      const j = jump(lt, B.leap, B.land, 4.2), w = ease(seg(lt, B.crouch, B.leap + .08)), sw = ease(seg(lt, 1.56, 1.8));
      o.dy = j.dy; o.sq = j.sq + .12 * w * (1 - seg(lt, B.leap, B.leap + .1)); o.walk = null;
      o.rot = lerp(.1, -.15, w) + .5 * sw * seg(lt, 1.6, B.land);
      o.aL = lerp(lerp(.55, 1.55, w), -.3, sw); ang = lerp(lerp(-.45, -2.5, w), .95, sw);
    } else {   // face-first into the flowers, then sitting up, dazed, then sad
      const a = lt - B.land, upK = ease(seg(lt, B.up - .15, B.up + .25));
      o.rot = lerp(.62, 0, upK) + .06 * spring(lt, B.up + .2, 6, 16) + (mood.rot || 0) * upK;
      o.sq = lerp(.3 * Math.exp(-a * 3) + .12, 0, upK) + (mood.sq || 0) * upK + .2 * spring(lt, B.land, 9, 26);
      o.dy = (mood.dy || 0) * upK; o.dx = (mood.dx || 0) * upK;
      o.aL = lerp(-.4, mood.aL ?? -.6, upK); ang = lerp(.55, .3, upK);
    }
    // the flower lands on the head at B.up - .1 and stays (with a wobble)
    const lean = .25 + .35 * spring(lt, B.up - .1, 5, 16) + .2 * spring(lt, B.up + .2, 6, 15) + .05 * Math.sin(lt * 2);
    if (lt > B.up - .1) o.draw = headFlower(lean);
    return { o, x, ang };
  }
  function shotB(t, lt, dur) {
    const cam = camB(lt);
    sky(t, 665 - cam.cy);
    camBegin(cam.cx, cam.cy, cam.z);
    const gl = land(t, cam, GB);
    meadowFlowers(t, cam, GB, x => Math.abs(x - CX - 70) < 280);
    gl();
    grassRow(t, cam, GB - 40, 34, 95, mixCol(wc('grass', 'grassPM', t), PAL.cream, .2), 3, .6);

    // the flower bed: flattened by the crash, petals burst, one flower flips up onto Clawd's head
    const hitK = lt > B.land ? 1 : 0;
    bed.forEach(([dx, col, h], i) => {
      if (i === POP && lt > B.land) return;
      const near = Math.exp(-((dx - 40) ** 2) / 18000), bend = hitK * near * (60 * Math.exp(-(lt - B.land) * 2.2) + 14) * (dx < 40 ? -1 : 1) + hitK * near * 30 * spring(lt, B.land, 5, 15);
      flower(CX + dx, GB - 6 + (i % 2) * 10, h, 13 + (i % 3) * 2, col, t, 'bed' + i, bend, .8);
    });
    const c = clawdB(lt);
    if (lt > B.land && lt < B.up) {   // the popped flower's flight: from the bed up onto the head
      const lean = .25, top = bodyPt(c.x, GB, uB, c.o, HF.x, HF.y), from = [CX + bed[POP][0], GB - 6 - bed[POP][2]];
      const k = easeOut(seg(lt, B.land, B.up - .1)), p = arcPt(from, top, 160, k);
      boilSeed('popflower');
      push(); translate(p[0], p[1]); rotate(k * 7);
      inkLine([[0, 0], [0, -HF.len * uB]], .8, COL.stem, 'ink', .5); bloom(0, -HF.len * uB, HF.r * uB, COL.pink, .3, .8);
      pop();
    }
    clawd(c.x, GB, uB, c.o);
    const h = handL(c.x, GB, uB, c.o);
    const sw = seg(lt, 1.56, 1.8), down = lt > 1.8;
    net(h.p, c.ang, uB, { ry: lt > B.land ? lerp(.6, .9, seg(lt, B.up - .2, B.up + .3)) : 1.5, bagAng: down ? Math.PI * .5 - .5 * Math.exp(-(lt - 1.8) * 4) : lt < B.crouch ? Math.PI * .85 : lerp(Math.PI * .7, Math.PI * 1.1, sw) });

    // petals: a burst from the crash
    if (lt > B.land && lt < B.land + 1.1) {
      for (let i = 0; i < 12; i++) {
        boilSeed('petal' + i);
        const a = lt - B.land, k = seg(a, 0, .9 + .2 * hash(i)), ang = -Math.PI / 2 + (hash(i * 3) - .5) * 2.6, v = 120 + 160 * hash(i * 7);
        const p = [xRun(B.land) + 7 * uB + Math.cos(ang) * v * k * 1.3 + 14 * Math.sin(a * 9 + i), GB - 25 + Math.sin(ang) * v * k + 300 * k * k];
        if (k < 1) paint(ellPts(p[0], p[1], 7, 4, 10, 0, a * 8 + i), { wash: [COL.pink, PAL.cream, '#F6E9A8'][i % 3], washOp: 255 * (1 - k * k), ink: PAL.ink, sw: .4 });
      }
    }

    // the butterfly: zigzags ahead, dips under the swing, hovers over the crash, then rises up and away
    const zig = l => [820 + 460 * l + 40 * Math.sin(l * 5), 600 + 45 * Math.sin(l * 7)];
    let bp, rot = .15 * Math.sin(lt * 4), open = flap(lt, 5.5);
    if (lt < 1.5) bp = zig(lt);
    else if (lt < 2.6) {
      const P = [zig(1.5), [1440, 590], [1460, 420], [1370, 360], [1250, 430]], k = easeOut(seg(lt, 1.5, 2.6));
      bp = add(pathAt(P, k), flutter(lt, .4)); rot = bank(P, k, .8);
    } else {
      const P = [[1250, 430], [1290, 360], [1200, 300], [1300, 150], [1420, -500], [1520, -1300]];
      const k = lt < 3.2 ? .3 * seg(lt, 2.6, 3.2) : .3 + .7 * easeIn(seg(lt, 3.2, 4.25));
      bp = add(pathAt(P, k), flutter(lt, .8)); rot = bank(P, k, .5);
    }
    butterfly(bp[0], bp[1], 33, open, rot);

    grassRow(t, cam, GB + 70, 52, 140, wc('grass', 'grassPM', t), 4, .9);
    camEnd();
    boilSeed('transition');
    streaks((1 - seg(lt, 0, .38)) ** 2, t);
  }

  // ---------- shot C: stillness ----------
  const GC = 880, uC = 34, xC = 960;
  const Cc = { give: .85, drop: 1.35, calm: 1.3, fly0: 1.55, perch: 3.05, wonder: 3.2, love: 3.8, iris: 4.45, dur: 5.4 };
  function clawdC(lt) {
    const mood = emotions(lt, [[0, 'sad', { lookX: .3, lookY: -.3, emote: undefined }], [Cc.calm, 'relieved', { emote: undefined }], [Cc.wonder, 'hopeful', { lookY: -1, lookX: .35 }], [Cc.love, 'love']], { take: .35 });
    const o = { ...mood, noShadow: false };
    // holding still once the butterfly is on: Clawd's own motion is damped
    const still = 1 - .7 * seg(lt, Cc.perch - .2, Cc.perch + .2);
    o.dy = (o.dy || 0) * still + .25; o.rot = (o.rot || 0) * still; o.dx = (o.dx || 0) * still; o.sq = (o.sq || 0) * still + .06;
    // the net: rests on the shoulder, is lowered to the ground and let go
    const lo = ease(seg(lt, Cc.give, Cc.drop));
    o.aL = lt < Cc.drop ? lerp(.45, -.25, lo) : lerp(-.25, mood.aL ?? -.6, ease(seg(lt, Cc.drop, Cc.drop + .4)));
    const lean = .25 + .03 * Math.sin(lt * 1.7) + .12 * spring(lt, Cc.perch, 4, 14);
    o.draw = headFlower(lean);
    return { o, ang: lerp(-1.95, -2.95, lo), lean };
  }
  const perchC = lt => { const c = clawdC(lt); return bodyPt(xC, GC, uC, c.o, ...headFlowerTop(c.lean)); };
  function shotC(t, lt, dur) {
    const camY = 540 - 1100 * (1 - easeOut(seg(lt, 0, .95)));
    const z = 1.08 + .4 * ease(seg(lt, .6, dur)), cam = { cx: lerp(960, 975, seg(lt, .6, dur)), cy: lerp(camY, camY + (620 - 540), ease(seg(lt, .6, dur))), z };
    sky(t, 540 - camY);
    camBegin(cam.cx, cam.cy, cam.z);
    const gl = land(t, cam, GC);
    meadowFlowers(t, cam, GC, x => Math.abs(x - xC) < 230);
    gl();
    grassRow(t, cam, GC - 40, 40, 95, mixCol(wc('grass', 'grassPM', t), PAL.cream, .2), 5, .7);

    const c = clawdC(lt);
    clawd(xC, GC, uC, c.o);
    // the net, in the hand until it's let go; then it settles flat in the grass
    const hRel = handL(xC, GC, uC, clawdC(Cc.drop).o), relC = clawdC(Cc.drop);
    if (lt < Cc.drop) { const h = handL(xC, GC, uC, c.o); net(h.p, c.ang, uC, { ry: lerp(1.5, 1, seg(lt, Cc.give, Cc.drop)), len: 5.6, bagAng: Math.PI / 2 }); }
    else {
      const k = easeIn(seg(lt, Cc.drop, Cc.drop + .25)), b = .5 * spring(lt, Cc.drop + .25, 8, 22);
      const d = dir(relC.ang), hoopAir = add(hRel.p, d, 5.6 * uC), hoopEnd = [hoopAir[0] - 25 * k, lerp(hoopAir[1], GC - 1.6 * uC, k)];
      const start = [lerp(hRel.p[0], hRel.p[0] + 20, k), lerp(hRel.p[1], GC - 10, k) - 8 * b];
      const ang = Math.atan2(hoopEnd[1] - start[1], hoopEnd[0] - start[0]);
      net(start, ang, uC, { ry: lerp(1, .8, k), len: Math.hypot(hoopEnd[0] - start[0], hoopEnd[1] - start[1]) / uC, bagAng: Math.PI / 2 });
    }

    // the butterfly: drifts down in loops and lands on the flower on Clawd's head
    if (lt > Cc.fly0) {
      const end = perchC(Cc.perch), P = [[1750, -260], [1420, 100], [1560, 300], [1240, 230], [1150, 420], [end[0] + 50, end[1] - 90], end];
      let bp, open, rot;
      if (lt < Cc.perch) {
        const k = ease(seg(lt, Cc.fly0, Cc.perch)) * .6 + .4 * seg(lt, Cc.fly0, Cc.perch);
        bp = add(pathAt(P, k), flutter(lt, 1 - seg(lt, 2.6, Cc.perch))); rot = bank(P, k, .6) * (1 - seg(lt, 2.7, Cc.perch));
        open = lt > 2.8 ? lerp(flap(lt, 4), .9, seg(lt, 2.85, Cc.perch)) : flap(lt, 5);
      } else {
        const a = lt - Cc.perch;
        bp = perchC(lt); rot = c.lean * .5 - .05; open = .72 + .28 * Math.cos(a * TAU * .7);
      }
      butterfly(bp[0], bp[1] - 2, 36, open, rot);
    }
    grassRow(t, cam, GC + 30, 70, 120, wc('grass', 'grassPM', t), 6, 1);
    const eye = toScreen(...bodyPt(xC, GC, uC, c.o, 0, -6.6));
    camEnd();
    boilSeed('transition');
    if (lt > Cc.iris) {   // a heart-shaped iris closes on the two of them, holds, and shuts
      const r = lt < Cc.iris + .55 ? lerp(1700, 330, ease(seg(lt, Cc.iris, Cc.iris + .55))) : lt < dur - .3 ? lerp(330, 310, seg(lt, Cc.iris + .55, dur - .3)) : lerp(310, 0, easeIn(seg(lt, dur - .3, dur - .04)));
      if (r < 6) paint(rectPts(-60, -60, W + 120, H + 120), { wash: PAL.ink, ink: null });
      else irisShape(heartPts(eye[0], eye[1] - r * .1, r, 40), PAL.ink);
    }
  }

  shots([[0, shotA], [5.2, shotB], [9.6, shotC]]);
})();
