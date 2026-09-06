/**
 * Ehrenfests teorem som interaktiv figur: en bølgepakke og en klassisk
 * partikkel starter i ro på samme sted i samme potensial. Den fylte prikken
 * er ⟨x⟩ for pakken, ringen er den klassiske partikkelen. I det harmoniske
 * potensialet (F″ = 0) faller de sammen for alltid, uansett pakkens bredde;
 * i x⁴-potensialet skiller de lag, og fortere jo bredere pakken er, fordi
 * ⟨F(x)⟩ = F(⟨x⟩) + ½(Δx)²F″(⟨x⟩) + …
 *
 * Pakken følger Schrödingerlikningen (split-operator med FFT) i enheter der
 * ħ = m = 1; den klassiske partikkelen følger Newtons likning i samme
 * potensial. Potensialene er V = x²/2 og V = x⁴/18, valgt så begge har
 * V(±3) = 4,5 og pakken starter like høyt oppe i begge.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler, så figuren bytter
 * tema av seg selv.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const N = 512; // gitterpunkter
  const L = 32; // x ∈ [−16, 16)
  const DX = L / N;
  const X0 = -3; // startposisjon; startimpulsen er 0
  const DT = 0.004; // tidssteg
  const STEPS = 5; // tidssteg per bilde
  const XVIEW = 5.5; // tegner x ∈ [−XVIEW, XVIEW]
  const VTOP = 9; // V = VTOP treffer toppen av tegneflaten

  const POT = {
    harmonisk: { V: (x) => 0.5 * x * x, F: (x) => -x },
    kvartisk: { V: (x) => (x * x * x * x) / 18, F: (x) => (-2 / 9) * x * x * x },
  };
  let pot = "harmonisk";
  let sigma = 0.7; // Δx ved start
  // Redusert bevegelse: start i pause og la brukeren spille av selv.
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── gitter, tilstand og fasefaktorer ─────────────────────────────────────
  const xs = new Float64Array(N);
  const kinRe = new Float64Array(N);
  const kinIm = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    xs[j] = -L / 2 + j * DX;
    const k = ((2 * Math.PI) / L) * (j < N / 2 ? j : j - N);
    const ph = -0.5 * k * k * DT; // e^{−ik²Δt/2}, ħ = m = 1
    kinRe[j] = Math.cos(ph);
    kinIm[j] = Math.sin(ph);
  }
  const potRe = new Float64Array(N); // e^{−iVΔt/2}: halvsteget i potensialet
  const potIm = new Float64Array(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let xc = X0; // klassisk posisjon
  let pc = 0; // klassisk impuls

  function reset() {
    const V = POT[pot].V;
    for (let j = 0; j < N; j++) {
      const ph = -0.5 * V(xs[j]) * DT;
      potRe[j] = Math.cos(ph);
      potIm[j] = Math.sin(ph);
    }
    const norm = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
    for (let j = 0; j < N; j++) {
      const d = xs[j] - X0;
      re[j] = norm * Math.exp(-(d * d) / (4 * sigma * sigma));
      im[j] = 0;
    }
    xc = X0;
    pc = 0;
  }

  // Radix-2 FFT på stedet; inv = true deler på N.
  function fft(inv) {
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = ((2 * Math.PI) / len) * (inv ? 1 : -1);
      const wr = Math.cos(ang);
      const wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < N; i += len) {
        let cr = 1;
        let ci = 0;
        for (let j = 0; j < half; j++) {
          const a = i + j;
          const b = a + half;
          const vr = re[b] * cr - im[b] * ci;
          const vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr;
          im[b] = im[a] - vi;
          re[a] += vr;
          im[a] += vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
    if (inv) {
      for (let i = 0; i < N; i++) {
        re[i] /= N;
        im[i] /= N;
      }
    }
  }
  function mul(fRe, fIm) {
    for (let j = 0; j < N; j++) {
      const a = re[j];
      const b = im[j];
      re[j] = a * fRe[j] - b * fIm[j];
      im[j] = a * fIm[j] + b * fRe[j];
    }
  }

  // Ett tidssteg: halvt V, helt T i k-rommet, halvt V. Klassisk: Verlet.
  function step() {
    mul(potRe, potIm);
    fft(false);
    mul(kinRe, kinIm);
    fft(true);
    mul(potRe, potIm);
    const F = POT[pot].F;
    const a0 = F(xc);
    xc += pc * DT + 0.5 * a0 * DT * DT;
    pc += 0.5 * (a0 + F(xc)) * DT;
  }
  function meanX() {
    let s = 0;
    let n = 0;
    for (let j = 0; j < N; j++) {
      const d = re[j] * re[j] + im[j] * im[j];
      s += xs[j] * d;
      n += d;
    }
    return s / n;
  }

  const nb = (x, n = 1) => x.toFixed(n).replace(".", ",");

  // ── kontroller ────────────────────────────────────────────────────────────
  function potBtn(text, value) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sim-btn";
    b.textContent = text;
    b.setAttribute("aria-pressed", String(pot === value));
    b.addEventListener("click", () => setPot(value), { signal });
    return b;
  }
  const harmBtn = potBtn("Harmonisk, V ∝ x²", "harmonisk");
  const kvartBtn = potBtn("Kvartisk, V ∝ x⁴", "kvartisk");
  function setPot(value) {
    pot = value;
    harmBtn.setAttribute("aria-pressed", String(value === "harmonisk"));
    kvartBtn.setAttribute("aria-pressed", String(value === "kvartisk"));
    reset();
    draw();
  }

  const sLabel = document.createElement("label");
  sLabel.append("Pakkens bredde Δx ved start ");
  const sOut = document.createElement("output");
  const sInput = document.createElement("input");
  sInput.type = "range";
  sInput.min = "0.5";
  sInput.max = "1.4";
  sInput.step = "0.1";
  sInput.value = String(sigma);
  sInput.setAttribute("aria-label", "Bølgepakkens bredde ved start");
  sLabel.append(sOut, sInput);

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  playBtn.textContent = playing ? "Pause" : "Spill av";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "sim-btn";
  resetBtn.textContent = "Fra start";

  controls.append(harmBtn, kvartBtn, sLabel, playBtn, resetBtn);

  // ── tegning ───────────────────────────────────────────────────────────────
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

  function draw() {
    const { w, h } = getSize();
    ctx.clearRect(0, 0, w, h);
    const accent = cssVar("--accent", "#9b2d6f");
    const muted = cssVar("--muted", "#6b7280");
    const border = cssVar("--border", "#d0d5dc");
    const strong = cssVar("--border-strong", "#b0b7c1");
    const fg = cssVar("--fg", "#111111");
    const bg = cssVar("--bg", "#ffffff");
    const mono = cssVar("--font-mono", "ui-monospace, monospace");

    const pad = 12;
    // Forklaringen øverst: én linje når den får plass, ellers to.
    ctx.font = `12px ${mono}`;
    const items = [
      ["⟨x⟩ for pakken", (x, y) => { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill(); }],
      ["klassisk partikkel", (x, y) => { ctx.fillStyle = bg; ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }],
    ];
    const widths = items.map(([t]) => 16 + ctx.measureText(t).width);
    const oneRow = pad + widths[0] + 18 + widths[1] <= w - pad;
    const top = oneRow ? 30 : 48; // plass til forklaringen
    const base = h - 24; // grunnlinja
    const sx = (w - 2 * pad) / (2 * XVIEW);
    const px = (x) => pad + (x + XVIEW) * sx;
    const pyV = (v) => base - (v / VTOP) * (base - top);
    const dens = (0.6 * (base - top)) / 0.85; // |Ψ|² = 0,85 → 60 % av høyden

    // Grunnlinja med merker for hver enhet.
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, base);
    ctx.lineTo(w - pad, base);
    ctx.stroke();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let x = -5; x <= 5; x++) {
      ctx.beginPath();
      ctx.moveTo(px(x), base);
      ctx.lineTo(px(x), base + (x === 0 ? 8 : 4));
      ctx.stroke();
    }

    // Alt over grunnlinja klippes til tegneflaten.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top - 2, w, base - top + 2);
    ctx.clip();

    // Potensialet.
    const V = POT[pot].V;
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const x = -XVIEW + (2 * XVIEW * i) / 220;
      const y = pyV(V(x));
      if (i === 0) ctx.moveTo(px(x), y);
      else ctx.lineTo(px(x), y);
    }
    ctx.stroke();

    // |Ψ|² som fylt flate over grunnlinja.
    ctx.beginPath();
    ctx.moveTo(px(-XVIEW), base);
    for (let j = 0; j < N; j++) {
      if (xs[j] < -XVIEW || xs[j] > XVIEW) continue;
      ctx.lineTo(px(xs[j]), base - dens * (re[j] * re[j] + im[j] * im[j]));
    }
    ctx.lineTo(px(XVIEW), base);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Markørene på grunnlinja: fylt prikk = ⟨x⟩, ring = klassisk partikkel.
    const r = 6;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(px(meanX()), base, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(xc), base, r, 0, 2 * Math.PI);
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    // Forklaringen tegnes til slutt, oppå alt annet.
    ctx.font = `12px ${mono}`;
    ctx.textBaseline = "middle";
    let lx = pad;
    items.forEach(([t, glyph], i) => {
      const ly = oneRow || i === 0 ? 14 : 32;
      glyph(lx + 5, ly);
      ctx.fillStyle = muted;
      ctx.fillText(t, lx + 16, ly);
      if (oneRow) lx += widths[i] + 18;
    });

    sOut.textContent = nb(sigma);
  }

  // ── animasjon ─────────────────────────────────────────────────────────────
  function frame() {
    if (signal?.aborted) return;
    if (playing) {
      for (let s = 0; s < STEPS; s++) step();
      draw();
    }
    requestAnimationFrame(frame);
  }

  sInput.addEventListener(
    "input",
    () => {
      sigma = Number(sInput.value);
      reset();
      draw();
    },
    { signal },
  );
  playBtn.addEventListener(
    "click",
    () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Spill av";
    },
    { signal },
  );
  resetBtn.addEventListener(
    "click",
    () => {
      reset();
      draw();
    },
    { signal },
  );

  reset();
  onResize(draw);
  draw();
  requestAnimationFrame(frame);
}
