/**
 * Tre Stern–Gerlach-magneter etter hverandre, tegnet skjematisk fra siden.
 * Atomene går fra ovnen til venstre mot skjermen til høyre. Magnet 1 og 3
 * måler S_z, magnet 2 måler spinnet langs n̂ = (sin θ, 0, cos θ). Hver
 * magnet sender atomet ut øverst ved +ħ/2 og nederst ved −ħ/2, og atomet
 * står etterpå i egentilstanden for måleverdien. Magnet 1 stopper spinn ned,
 * og magnet 2 slipper bare den valgte utgangen videre.
 *
 * Sannsynlighetene: spinn opp langs z inn i magnet 2 gir P(+) = cos²(θ/2)
 * og P(−) = sin²(θ/2). Fra +n̂ inn i magnet 3 er P(↑) = cos²(θ/2), fra −n̂
 * er P(↑) = sin²(θ/2). Hvert atom trekker utgangene sine tilfeldig med
 * disse sannsynlighetene når det sendes ut, og bredden på strålene er den
 * forventede intensiteten.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler, så figuren
 * bytter tema av seg selv.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const TRAVEL = 2.6; // sekunder fra ovnen til skjermen
  const SPAWN = 0.045; // sekunder mellom hvert atom
  const FADE = 0.3; // sekunder et stoppet atom blir synlig
  const HIT = 1.4; // sekunder et treff lyser på skjermen
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let thetaDeg = 90;
  let pass = 1; // +1: utgang + slipper gjennom magnet 2, −1: utgang −
  let playing = !reduce;

  const c2 = () => Math.cos((thetaDeg * Math.PI) / 360) ** 2; // cos²(θ/2)

  // ── kontroller ────────────────────────────────────────────────────────────
  const tLabel = document.createElement("label");
  tLabel.append("θ ");
  const tOut = document.createElement("output");
  const tInput = document.createElement("input");
  tInput.type = "range";
  tInput.min = "0";
  tInput.max = "180";
  tInput.step = "5";
  tInput.value = String(thetaDeg);
  tInput.setAttribute("aria-label", "Vinkelen θ mellom aksen til magnet 2 og z-aksen");
  tLabel.append(tOut, tInput);
  tInput.addEventListener(
    "input",
    () => {
      thetaDeg = Number(tInput.value);
      tOut.textContent = `${thetaDeg}°`;
      if (!playing) draw();
    },
    { signal },
  );
  tOut.textContent = `${thetaDeg}°`;

  function button(text) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sim-btn";
    b.textContent = text;
    return b;
  }
  const plusBtn = button("Slipp gjennom +");
  const minusBtn = button("Slipp gjennom −");
  function setPass(p) {
    pass = p;
    plusBtn.setAttribute("aria-pressed", String(p === 1));
    minusBtn.setAttribute("aria-pressed", String(p === -1));
    // Magnet 3 flytter seg til den andre utgangen, så atomene underveis
    // ville fått feil bane.
    dots.length = 0;
    hits.length = 0;
    draw();
  }
  plusBtn.addEventListener("click", () => setPass(1), { signal });
  minusBtn.addEventListener("click", () => setPass(-1), { signal });

  const playBtn = button(playing ? "Pause" : "Spill av");
  playBtn.addEventListener(
    "click",
    () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Spill av";
      if (playing) start();
    },
    { signal },
  );
  controls.append(tLabel, plusBtn, minusBtn, playBtn);

  // ── atomene ───────────────────────────────────────────────────────────────
  let simT = 0;
  let spawnAcc = 0;
  const dots = []; // { t0, b1, b2, b3 }, b = +1 øvre utgang, −1 nedre
  const hits = []; // { b3, t, j }

  function newDot(t0) {
    const c = c2();
    const pUp3 = pass === 1 ? c : 1 - c;
    return {
      t0,
      b1: Math.random() < 0.5 ? 1 : -1,
      b2: Math.random() < c ? 1 : -1,
      b3: Math.random() < pUp3 ? 1 : -1,
      done: false,
    };
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  function layout(w, h) {
    const pad = 10;
    const W = w - 2 * pad;
    const X = (f) => pad + f * W;
    const m1 = { xa: X(0.08), xb: X(0.19) };
    const m2 = { xa: X(0.36), xb: X(0.47) };
    const m3 = { xa: X(0.64), xb: X(0.75) };
    const len = m1.xb - m1.xa;
    const gap = m2.xa - m1.xb;
    const xs = X(0.97); // skjermen
    const x0 = X(0.06); // ovnens åpning
    // Avbøyningen er en parabel inne i magneten og en rett linje etter den,
    // valgt så strålen når neste magnet ±D fra midten.
    const yG = 22; // pilene over magnetene
    const rG = 13;
    const yTop = yG + rG + 24;
    const yBot = h - 12;
    const D = Math.max(14, Math.min(48, (yBot - yTop) / 4.7));
    const din = D / (1 + (2 * gap) / len);
    const slope = (2 * din) / len;
    const dEnd = din + slope * (xs - m3.xb); // avbøyningen ved skjermen
    // Begge valgene for magnet 2 skal få plass uten at figuren flytter seg.
    const span = 2 * D + 2 * dEnd;
    const y1 = yTop + Math.max(0, (yBot - yTop - span) / 2) + 2 * D + dEnd;
    const y2 = y1 - D;
    const y3 = y2 - pass * D;
    const block1 = m1.xb + 0.92 * gap;
    const block2 = m2.xb + 0.92 * gap;
    return { pad, W, X, m1, m2, m3, len, gap, xs, x0, yG, rG, D, din, slope, dEnd, y1, y2, y3, block1, block2 };
  }

  function defl(L, x, m) {
    if (x <= m.xa) return 0;
    if (x <= m.xb) {
      const u = (x - m.xa) / L.len;
      return L.din * u * u;
    }
    return L.din + L.slope * (x - m.xb);
  }
  // Høyden til en bane i x. b1, b2, b3 er utgangene i de tre magnetene.
  function yAt(L, x, b1, b2, b3) {
    if (x <= L.m1.xa) return L.y1;
    if (x <= L.m2.xa) return L.y1 - b1 * defl(L, x, L.m1);
    if (x <= L.m3.xa) return L.y2 - b2 * defl(L, x, L.m2);
    return L.y3 - b3 * defl(L, x, L.m3);
  }
  function endX(L, d) {
    if (d.b1 === -1) return L.block1;
    if (d.b2 !== pass) return L.block2;
    return L.xs;
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

  function arrow(x1, y1, x2, y2, head) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
    ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  const pct = (p) => `${Math.round(100 * p)} %`;

  function draw() {
    const { w, h } = getSize();
    if (w < 120 || h < 120) return;
    ctx.clearRect(0, 0, w, h);
    const accent = cssVar("--accent", "#9b2d6f");
    const muted = cssVar("--muted", "#6b7280");
    const border = cssVar("--border", "#d0d5dc");
    const strong = cssVar("--border-strong", "#b0b7c1");
    const fg = cssVar("--fg", "#111111");
    const mono = cssVar("--font-mono", "ui-monospace, monospace");

    const L = layout(w, h);
    const c = c2();
    const P2 = { 1: c, [-1]: 1 - c }; // utgangene i magnet 2
    const pUp3 = pass === 1 ? c : 1 - c;
    const P3 = { 1: pUp3, [-1]: 1 - pUp3 }; // utgangene i magnet 3
    const Ipass = 0.5 * P2[pass];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.textBaseline = "middle";

    // Strålene, med bredde etter forventet intensitet. En utgang som ingen
    // atomer tar, vises stiplet.
    function beam(x1, x2, I, f) {
      if (x2 <= x1) return;
      ctx.beginPath();
      for (let x = x1; ; x += 3) {
        const xx = Math.min(x, x2);
        if (xx === x1) ctx.moveTo(xx, f(xx));
        else ctx.lineTo(xx, f(xx));
        if (xx === x2) break;
      }
      if (I < 0.004) {
        ctx.strokeStyle = border;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
      } else {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = Math.max(1.5, 12 * I);
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    beam(L.x0, L.m1.xa, 1, () => L.y1);
    for (const b of [1, -1]) {
      beam(L.m1.xa, b === 1 ? L.m2.xa : L.block1, 0.5, (x) => L.y1 - b * defl(L, x, L.m1));
      beam(L.m2.xa, b === pass ? L.m3.xa : L.block2, 0.5 * P2[b], (x) => L.y2 - b * defl(L, x, L.m2));
      beam(L.m3.xa, L.xs, Ipass * P3[b], (x) => L.y3 - b * defl(L, x, L.m3));
    }

    // Ovnen.
    ctx.fillStyle = border;
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    const ovenW = L.x0 - L.pad;
    ctx.fillRect(L.pad, L.y1 - 11, ovenW, 22);
    ctx.strokeRect(L.pad, L.y1 - 11, ovenW, 22);
    ctx.fillStyle = muted;
    ctx.font = `11px ${mono}`;
    ctx.textAlign = "center";
    ctx.fillText("Ag", L.pad + ovenW / 2, L.y1 + 22);

    // Magnetene: to polstykker med strålen mellom, nummeret og aksen over.
    const mags = [
      [L.m1, L.y1, 0, "1"],
      [L.m2, L.y2, thetaDeg, "2"],
      [L.m3, L.y3, 0, "3"],
    ];
    for (const [m, yc, deg, num] of mags) {
      const ph = 12;
      const open = L.din + 5;
      ctx.fillStyle = strong;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(m.xa, yc - open - ph, m.xb - m.xa, ph);
      ctx.fillRect(m.xa, yc + open, m.xb - m.xa, ph);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = strong;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(m.xa, yc - open - ph, m.xb - m.xa, ph);
      ctx.strokeRect(m.xa, yc + open, m.xb - m.xa, ph);

      const cx = (m.xa + m.xb) / 2;
      // Stiplet linje fra nummeret ned til magneten.
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, L.yG + L.rG + 18);
      ctx.lineTo(cx, yc - open - ph - 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = muted;
      ctx.font = `12px ${mono}`;
      ctx.textAlign = "center";
      ctx.fillText(num, cx, L.yG + L.rG + 10);

      // Aksen sett langs strålen: z opp, x til høyre.
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, L.yG, L.rG, 0, 2 * Math.PI);
      ctx.moveTo(cx - L.rG, L.yG);
      ctx.lineTo(cx + L.rG, L.yG);
      ctx.moveTo(cx, L.yG - L.rG);
      ctx.lineTo(cx, L.yG + L.rG);
      ctx.stroke();
      const a = (deg * Math.PI) / 180;
      const tipX = cx + (L.rG - 1) * Math.sin(a);
      const tipY = L.yG - (L.rG - 1) * Math.cos(a);
      if (num === "2") {
        if (deg >= 10) {
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(cx, L.yG, 0.5 * L.rG, -Math.PI / 2, -Math.PI / 2 + a);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
      } else {
        ctx.strokeStyle = fg;
        ctx.fillStyle = fg;
      }
      ctx.lineWidth = 2;
      arrow(cx, L.yG, tipX, tipY, 6);
      // Navnet på aksen ved spissen, med n̂ tegnet som n med hatt.
      ctx.fillStyle = num === "2" ? accent : muted;
      ctx.font = `12px ${mono}`;
      ctx.textAlign = "left";
      const lx = cx + L.rG + 4;
      const ly = L.yG - L.rG + 3;
      if (num === "2") {
        ctx.fillText("n", lx, ly);
        const nw = ctx.measureText("n").width;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx + 0.15 * nw, ly - 6);
        ctx.lineTo(lx + 0.5 * nw, ly - 9);
        ctx.lineTo(lx + 0.85 * nw, ly - 6);
        ctx.stroke();
      } else {
        ctx.fillText("z", lx, ly);
      }
      if (num === "1") {
        ctx.fillStyle = muted;
        ctx.fillText("x", cx + L.rG + 4, L.yG + 6);
      }
    }

    // Stoppene.
    ctx.fillStyle = fg;
    const stopAt = (x, y) => ctx.fillRect(x - 2, y - 8, 4, 16);
    stopAt(L.block1, L.y1 + defl(L, L.block1, L.m1));
    stopAt(L.block2, L.y2 + pass * defl(L, L.block2, L.m2));

    // Skjermen, med en flekk der hver stråle treffer.
    const yS = { 1: L.y3 - L.dEnd, [-1]: L.y3 + L.dEnd };
    ctx.strokeStyle = strong;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(L.xs, Math.min(yS[1], yS[-1]) - 22);
    ctx.lineTo(L.xs, Math.max(yS[1], yS[-1]) + 22);
    ctx.stroke();
    for (const b of [1, -1]) {
      const I = Ipass * P3[b];
      if (I < 0.004) continue;
      ctx.fillStyle = accent;
      ctx.globalAlpha = Math.min(0.9, 0.2 + 1.4 * I);
      ctx.beginPath();
      ctx.arc(L.xs, yS[b], 3 + 10 * Math.sqrt(I), 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const hit of hits) {
      const age = simT - hit.t;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = Math.max(0, 1 - age / HIT);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L.xs - 5, yS[hit.b3] + hit.j);
      ctx.lineTo(L.xs + 5, yS[hit.b3] + hit.j);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Atomene.
    const v = (L.xs - L.x0) / TRAVEL;
    ctx.fillStyle = accent;
    for (const d of dots) {
      const xe = endX(L, d);
      let x = L.x0 + v * (simT - d.t0);
      let alpha = 1;
      if (x >= xe) {
        alpha = Math.max(0, 1 - (x - xe) / (v * FADE));
        x = xe;
      }
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, yAt(L, x, d.b1, d.b2, d.b3), 2.3, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Utgangene. Magnet 1 får bare pilene; magnet 2 og 3 får sannsynligheten
    // for hver utgang for et atom som kommer inn.
    // Etikettene står mellom de to utgående strålene, der de har gått så
    // langt fra hverandre at teksten får plass.
    ctx.font = `11px ${mono}`;
    ctx.textAlign = "left";
    const HALF = 20; // halv avstand mellom strålene ved etikettens venstre kant
    const lx = (m) => m.xb + Math.max(6, (HALF - L.din) / L.slope);
    const ly = (m) => defl(L, lx(m), m) - 9.5;
    ctx.fillStyle = muted;
    ctx.fillText("↑", lx(L.m1), L.y1 - ly(L.m1));
    ctx.fillText("↓", lx(L.m1), L.y1 + ly(L.m1));
    for (const b of [1, -1]) {
      ctx.fillStyle = b === pass ? fg : muted;
      ctx.fillText(`${b === 1 ? "+" : "−"} ${pct(P2[b])}`, lx(L.m2), L.y2 - b * ly(L.m2));
    }
    ctx.textAlign = "right";
    ctx.fillStyle = fg;
    for (const b of [1, -1]) {
      ctx.fillText(`${b === 1 ? "↑" : "↓"} ${pct(P3[b])}`, L.xs - 8, yS[b] - b * 12);
    }
  }

  // ── animasjon ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  function start() {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  function frame(now) {
    raf = 0;
    if (signal?.aborted || !playing) return;
    // Første bilde etter start har ingen gyldig forrige tid; klem dt ≥ 0.
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0), 0.05) : 0;
    last = now;
    simT += dt;
    spawnAcc += dt;
    while (spawnAcc >= SPAWN) {
      spawnAcc -= SPAWN;
      dots.push(newDot(simT - spawnAcc));
    }
    // Atomer som har nådd skjermen blir et treff; stoppede atomer forsvinner
    // etter FADE.
    const { w, h } = getSize();
    const L = layout(w, h);
    const v = (L.xs - L.x0) / TRAVEL;
    for (const d of dots) {
      const x = L.x0 + v * (simT - d.t0);
      const xe = endX(L, d);
      if (!d.done && x >= xe && xe === L.xs) {
        hits.push({ b3: d.b3, t: simT, j: (Math.random() - 0.5) * 6 });
        d.done = true;
      }
      if (x >= xe + v * FADE) d.dead = true;
    }
    for (let i = dots.length - 1; i >= 0; i--) if (dots[i].dead) dots.splice(i, 1);
    while (hits.length && simT - hits[0].t > HIT) hits.shift();
    draw();
    raf = requestAnimationFrame(frame);
  }

  onResize(draw);
  setPass(1);
  if (playing) start();
}
