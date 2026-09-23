/**
 * Dreieimpulsen i tilstanden |j,m⟩ (ħ = 1). Øverst vektormodellen sett litt
 * ovenfra: kula med radius |J| = √(j(j+1)), én ring for hver tillatt verdi av
 * J_z = m, og den valgte ringen med kjeglen fra origo. Under, på samme
 * x-skala, sannsynligheten for hvert utfall m′ når J_x måles i |j,m⟩.
 * Stiplede loddlinjer fra ringens ytterpunkter viser hvor langt J_x rekker
 * på kjeglen.
 *
 * Sannsynlighetene er |d^j_{m′m}(π/2)|², Wigners d-matrise ved β = π/2:
 *   d = 2^(−j) √[(j+m)!(j−m)!(j+m′)!(j−m′)!]
 *       · Σ_k (−1)^(k−m+m′) / [(j+m−k)! k! (j−k−m′)! (k−m+m′)!],
 * fordi egentilstandene til J_x er egentilstandene til J_z dreid π/2 om y.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler, så figuren
 * bytter tema av seg selv.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const JMAX = 4;
  const TILT = 0.3; // hvor mye ovenfra ringene sees (radianer)
  const CA = Math.cos(TILT);
  const SA = Math.sin(TILT);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let twoJ = 4; // 2j, så halvtallige j blir heltall
  let k = 3; // m = k − j, altså m = 1 for j = 2

  const fact = (n) => {
    let f = 1;
    for (let i = 2; i <= n; i++) f *= i;
    return f;
  };
  // Sannsynligheten for J_x = m′ når tilstanden er |j,m⟩. Tar 2j, 2m, 2m′.
  function prob(tj, tm, tmp) {
    const jpm = (tj + tm) / 2;
    const jmm = (tj - tm) / 2;
    const jpmp = (tj + tmp) / 2;
    const jmmp = (tj - tmp) / 2;
    const dm = (tmp - tm) / 2; // m′ − m
    let sum = 0;
    for (let kk = Math.max(0, -dm); kk <= Math.min(jpm, jmmp); kk++) {
      const sign = (kk + dm) % 2 === 0 ? 1 : -1;
      sum += sign / (fact(jpm - kk) * fact(kk) * fact(jmmp - kk) * fact(kk + dm));
    }
    const d = 2 ** (-tj / 2) * Math.sqrt(fact(jpm) * fact(jmm) * fact(jpmp) * fact(jmmp)) * sum;
    return d * d;
  }

  // Halvtall skrives som brøk: 3/2, −1/2.
  function frac(twice) {
    const s = twice < 0 ? "−" : "";
    const a = Math.abs(twice);
    return a % 2 === 0 ? s + a / 2 : `${s}${a}/2`;
  }
  // m·ħ som tekst: ħ, −ħ, 2ħ, 3ħ/2, 0.
  function mh(twice) {
    if (twice === 0) return "0";
    const s = twice < 0 ? "−" : "";
    const a = Math.abs(twice);
    if (a % 2 === 0) return a === 2 ? `${s}ħ` : `${s}${a / 2}ħ`;
    return a === 1 ? `${s}ħ/2` : `${s}${a}ħ/2`;
  }
  // |J| = √(j(j+1)) ħ som tekst: √6 ħ, √15/2 ħ.
  function lengthText(tj) {
    if (tj % 2 === 0) {
      const j = tj / 2;
      return `√${j * (j + 1)} ħ`;
    }
    return `√${tj * (tj + 2)}/2 ħ`;
  }

  // ── kontroller ────────────────────────────────────────────────────────────
  function slider(text, aria, onInput) {
    const label = document.createElement("label");
    label.append(text + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.step = "1";
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    input.addEventListener("input", () => onInput(Number(input.value)), { signal });
    return { label, out, input };
  }
  const sj = slider("j", "Kvantetallet j", (v) => {
    // Behold m så godt det går: flytt et halvt trinn mot null når j bytter
    // mellom heltall og halvtall, og kutt ved ±j.
    let m2 = 2 * k - twoJ;
    if ((m2 - v) % 2 !== 0) m2 += m2 > 0 ? -1 : 1;
    m2 = Math.max(-v, Math.min(v, m2));
    twoJ = v;
    k = (m2 + twoJ) / 2;
    sync(true);
  });
  sj.input.min = "1";
  sj.input.max = String(2 * JMAX);
  sj.input.value = String(twoJ);
  const sm = slider("m", "Kvantetallet m", (v) => {
    k = v;
    sync(false);
  });
  controls.append(sj.label, sm.label);

  // Vist tilstand, som glir mot målet når m endres.
  let shownM = k - twoJ / 2;
  let shownP = [];
  function target() {
    const tm = 2 * k - twoJ;
    const p = [];
    for (let i = 0; i <= twoJ; i++) p.push(prob(twoJ, tm, 2 * i - twoJ));
    return p;
  }
  function sync(jump) {
    sm.input.min = "0";
    sm.input.max = String(twoJ);
    sm.input.value = String(k);
    sj.out.textContent = frac(twoJ);
    sm.out.textContent = frac(2 * k - twoJ);
    if (jump || reduce) {
      shownM = k - twoJ / 2;
      shownP = target();
      draw();
    } else {
      start();
    }
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
    ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    const { w, h } = getSize();
    if (w < 60 || h < 60) return;
    ctx.clearRect(0, 0, w, h);
    const accent = cssVar("--accent", "#9b2d6f");
    const muted = cssVar("--muted", "#6b7280");
    const border = cssVar("--border", "#d0d5dc");
    const strong = cssVar("--border-strong", "#b0b7c1");
    const mono = cssVar("--font-mono", "ui-monospace, monospace");

    const pad = 12;
    const j = twoJ / 2;
    const R = Math.sqrt(j * (j + 1));
    const histH = Math.min(96, 0.28 * h); // søylenes område nederst
    const base = h - 40; // søylenes grunnlinje, med plass til to tekstlinjer under
    const top = 22;
    const coneH = base - histH - 14 - top;
    // Skalaen velges for gjeldende j: kula fyller det øvre feltet.
    const s = Math.min(90, (w - 2 * pad - 48) / (2 * R + 0.8), coneH / (2 * R + 0.3));
    const cx = w / 2;
    const cy = top + coneH / 2;
    const P = (x, y, z) => [cx + s * x, cy - s * (z * CA + y * SA)];

    ctx.font = `12px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.lineCap = "round";

    // Kula |J| = √(j(j+1)) sett fra siden: en sirkel.
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, R * s, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Aksene.
    ctx.strokeStyle = strong;
    ctx.fillStyle = strong;
    ctx.lineWidth = 1.5;
    arrow(cx, cy + (R + 0.15) * s, cx, top - 10, 7);
    arrow(cx - R * s, cy, cx + (R + 0.4) * s, cy, 7);

    // Ringene for alle tillatte m, med m-etiketten til venstre.
    const ring = (m, stroke, width, alphaBack, alphaFront) => {
      const r = Math.sqrt(Math.max(0, R * R - m * m));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      for (const [from, to, a, dash] of [
        [Math.PI, 2 * Math.PI, alphaBack, [3, 4]], // bakre halvdel, stiplet
        [0, Math.PI, alphaFront, []], // fremre halvdel
      ]) {
        ctx.globalAlpha = a;
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const ph = from + ((to - from) * i) / 48;
          const [X, Y] = P(r * Math.cos(ph), -r * Math.sin(ph), m);
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return r;
    };
    ctx.textAlign = "right";
    const mNow = k - j;
    for (let i = 0; i <= twoJ; i++) {
      const m = i - j;
      const r = ring(m, strong, 1, 0.5, 0.9);
      const [X, Y] = P(-r, 0, m);
      ctx.fillStyle = m === mNow ? accent : muted;
      ctx.fillText(mh(2 * m), X - 7, Y);
    }

    // Den valgte ringen og kjeglen, som glir mellom m-verdiene.
    const m = shownM;
    const r = Math.sqrt(Math.max(0, R * R - m * m));
    const [ox, oy] = P(0, 0, 0);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    for (const sx of [-1, 1]) {
      const [X, Y] = P(sx * r, 0, m);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(X, Y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ring(m, accent, 2.5, 0.5, 1);

    // Én mulig retning for J på kjeglen, pekende skrått fremover.
    const ph = 2.2;
    const [tx, ty] = P(r * Math.cos(ph), -r * Math.sin(ph), m);
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 2.5;
    arrow(ox, oy, tx, ty, 9);

    // Aksetitlene, og lengden |J| til venstre for J_z-aksen.
    ctx.fillStyle = muted;
    ctx.textAlign = "left";
    ctx.fillText("J_z", cx + 8, top - 6);
    ctx.fillText("J_x", cx + (R + 0.4) * s + 4, cy);
    ctx.textAlign = "right";
    ctx.fillText(`|J| = ${lengthText(twoJ)}`, cx - 10, top - 6);

    // Loddlinjer fra ringens ytterpunkter ned til søylene, og båndet mellom dem.
    const xl = cx - r * s;
    const xr = cx + r * s;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(xl, base - histH, xr - xl, histH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    for (const x of [xl, xr]) {
      ctx.beginPath();
      ctx.moveTo(x, P(0, 0, m)[1]);
      ctx.lineTo(x, base);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Søylene: sannsynligheten for hvert utfall m′ħ av en J_x-måling.
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - (R + 0.3) * s, base);
    ctx.lineTo(cx + (R + 0.3) * s, base);
    ctx.stroke();
    const pmax = Math.max(...shownP, 1e-9);
    const bw = Math.min(0.55 * s, 22);
    ctx.fillStyle = accent;
    for (let i = 0; i <= twoJ; i++) {
      const x = cx + (i - j) * s;
      const hh = ((shownP[i] || 0) / pmax) * (histH - 18);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x - bw / 2, base - hh, bw, hh);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.fillText("sannsynlighet for hvert utfall av J_x", cx, base + 30);
    // Etiketter under søylene, glisnet ut når de står tett.
    ctx.textAlign = "center";
    const every = s >= 40 ? 1 : twoJ % 2 === 0 ? 2 : twoJ;
    for (let i = 0; i <= twoJ; i++) {
      const edge = i === 0 || i === twoJ;
      const mid = 2 * i === twoJ;
      if (!(edge || mid || (i % every === 0 && every < twoJ))) continue;
      ctx.fillText(mh(2 * i - twoJ), cx + (i - j) * s, base + 12);
    }
  }

  // ── glidning mellom tilstander ────────────────────────────────────────────
  let raf = 0;
  function start() {
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step() {
    raf = 0;
    if (signal?.aborted) return;
    const goalM = k - twoJ / 2;
    const goalP = target();
    let moving = Math.abs(goalM - shownM) > 1e-3;
    shownM += 0.2 * (goalM - shownM);
    shownP = goalP.map((p, i) => {
      const cur = shownP[i] ?? p;
      if (Math.abs(p - cur) > 1e-3) moving = true;
      return cur + 0.2 * (p - cur);
    });
    if (!moving) {
      shownM = goalM;
      shownP = goalP;
    }
    draw();
    if (moving) start();
  }

  onResize(draw);
  sync(true);
}
