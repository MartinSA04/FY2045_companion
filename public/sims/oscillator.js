/**
 * Tilstander i oscillatorpotensialet (ħ = m = ω = 1). Fire valg: de
 * stasjonære tilstandene |0⟩ og |1⟩, blandingen (3|0⟩ + 4|1⟩)/5 og en
 * koherent tilstand |α⟩ med reell α. Potensialet tegnes med trinnene
 * E_n = n + ½; trinnene som inngår i tilstanden får aksentfarge med
 * styrke |c_n|². |Ψ(x,t)|² animeres, med ⟨x⟩ som prikk på grunnlinja.
 *
 * Alt er lukkede uttrykk:
 *   |0⟩ og |1⟩: |ψ₀|² og |ψ₁|², tidsuavhengige,
 *   blanding:   [9ψ₀² + 16ψ₁² + 24 ψ₀ψ₁ cos ωt]/25, ⟨x⟩ = (24/25)·2^(−½) cos ωt,
 *   koherent:   π^(−½) e^(−(x−x_c)²) med x_c = √2 α cos ωt, Poisson-vekter e^(−α²)α^(2n)/n!.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler, så figuren
 * bytter tema av seg selv.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const XVIEW = 4; // tegner x ∈ [−XVIEW, XVIEW]
  const VTOP = 6.5; // V = VTOP treffer toppen av tegneflaten
  const NRUNG = 6; // trinnene n = 0 … NRUNG−1
  const DT = 0.03; // tidssteg per bilde

  let mode = "n0"; // "n0" | "n1" | "mix" | "koherent"
  let alpha = 1.0;
  let t = 0;
  // Redusert bevegelse: start i pause og la brukeren spille av selv.
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ISQPI = Math.PI ** -0.5; // 1/√π
  const psi0 = (x) => Math.PI ** -0.25 * Math.exp((-x * x) / 2);
  const psi1 = (x) => Math.SQRT2 * x * psi0(x);

  // |Ψ(x,t)|² for hvert valg.
  function density(x) {
    if (mode === "n0") return psi0(x) ** 2;
    if (mode === "n1") return psi1(x) ** 2;
    if (mode === "mix") {
      const a = psi0(x);
      const b = psi1(x);
      return (9 * a * a + 16 * b * b + 24 * a * b * Math.cos(t)) / 25;
    }
    const d = x - Math.SQRT2 * alpha * Math.cos(t);
    return ISQPI * Math.exp(-d * d);
  }
  function meanX() {
    if (mode === "mix") return ((24 / 25) * Math.cos(t)) / Math.SQRT2;
    if (mode === "koherent") return Math.SQRT2 * alpha * Math.cos(t);
    return 0;
  }
  // |c_n|² for trinnmarkeringen.
  function weights() {
    if (mode === "n0") return [1];
    if (mode === "n1") return [0, 1];
    if (mode === "mix") return [9 / 25, 16 / 25];
    const out = [];
    let w = Math.exp(-alpha * alpha);
    for (let n = 0; n < NRUNG; n++) {
      out.push(w);
      w *= (alpha * alpha) / (n + 1);
    }
    return out;
  }

  const nb = (v) => v.toFixed(1).replace(".", ",");

  // ── kontroller ────────────────────────────────────────────────────────────
  const stateBtns = [];
  function stateBtn(text, value, aria) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sim-btn";
    b.textContent = text;
    b.setAttribute("aria-label", aria);
    b.setAttribute("aria-pressed", String(mode === value));
    b.addEventListener("click", () => setMode(value), { signal });
    stateBtns.push([b, value]);
    return b;
  }
  function setMode(value) {
    mode = value;
    for (const [b, v] of stateBtns) b.setAttribute("aria-pressed", String(v === mode));
    t = 0;
    draw();
  }
  const b0 = stateBtn("|0⟩", "n0", "Grunntilstanden");
  const b1 = stateBtn("|1⟩", "n1", "Første eksiterte tilstand");
  const bMix = stateBtn("(3|0⟩ + 4|1⟩)/5", "mix", "Blanding av de to nederste nivåene");
  const bKoh = stateBtn("koherent |α⟩", "koherent", "Koherent tilstand");

  const sLabel = document.createElement("label");
  sLabel.append("Amplitude α ");
  const sOut = document.createElement("output");
  const sInput = document.createElement("input");
  sInput.type = "range";
  sInput.min = "0";
  sInput.max = "1.4";
  sInput.step = "0.1";
  sInput.value = String(alpha);
  sInput.setAttribute("aria-label", "Den koherente tilstandens amplitude");
  sLabel.append(sOut, sInput);
  sInput.addEventListener(
    "input",
    () => {
      alpha = Number(sInput.value);
      if (mode !== "koherent") setMode("koherent");
      else draw();
    },
    { signal },
  );

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  playBtn.textContent = playing ? "Pause" : "Spill av";
  playBtn.addEventListener(
    "click",
    () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Spill av";
    },
    { signal },
  );

  controls.append(b0, b1, bMix, bKoh, sLabel, playBtn);

  // ── tegning ───────────────────────────────────────────────────────────────
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

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
    // Forklaringen øverst: én linje når den får plass, ellers to.
    ctx.font = `12px ${mono}`;
    ctx.textBaseline = "middle";
    const items = [
      ["|Ψ(x,t)|²", (x, y) => { ctx.fillStyle = accent; ctx.globalAlpha = 0.35; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.globalAlpha = 1; }],
      ["⟨x⟩", (x, y) => { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill(); }],
      ["nivåene E_n", (x, y) => { ctx.strokeStyle = strong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); }],
    ];
    const widths = items.map(([s]) => 16 + ctx.measureText(s).width);
    const total = widths.reduce((a, b) => a + b, 0) + 18 * (items.length - 1);
    const oneRow = pad + total <= w - pad;
    let lx = pad;
    items.forEach(([s, glyph], i) => {
      const ly = oneRow || i < 2 ? 14 : 32;
      if (!oneRow && i === 2) lx = pad;
      glyph(lx + 5, ly);
      ctx.fillStyle = muted;
      ctx.fillText(s, lx + 16, ly);
      lx += widths[i] + 18;
    });
    const top = oneRow ? 30 : 48;

    const base = h - 16; // grunnlinja
    const sx = (w - 2 * pad) / (2 * XVIEW);
    const px = (x) => pad + (x + XVIEW) * sx;
    const pyV = (v) => base - (v / VTOP) * (base - top);
    const dens = (0.55 * (base - top)) / ISQPI; // toppen π^(−½) → 55 % av høyden

    // Grunnlinja med merker for hver enhet.
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, base);
    ctx.lineTo(w - pad, base);
    ctx.stroke();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let x = -XVIEW; x <= XVIEW; x++) {
      ctx.beginPath();
      ctx.moveTo(px(x), base);
      ctx.lineTo(px(x), base + (x === 0 ? 8 : 4));
      ctx.stroke();
    }

    // Trinnene E_n = n + ½, tegnet mellom veggene i potensialet.
    const cn = weights();
    ctx.font = `11px ${mono}`;
    for (let n = 0; n < NRUNG; n++) {
      const E = n + 0.5;
      const xe = Math.sqrt(2 * E);
      const y = pyV(E);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(-xe), y);
      ctx.lineTo(px(xe), y);
      ctx.stroke();
      const wn = cn[n] || 0;
      if (wn > 0.005) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = Math.max(0.2, wn);
        ctx.beginPath();
        ctx.moveTo(px(-xe), y);
        ctx.lineTo(px(xe), y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (n < 2) {
        ctx.fillStyle = muted;
        ctx.fillText(`n = ${n}`, px(xe) + 8, y);
      }
    }

    // Potensialet V = x²/2.
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 220; i++) {
      const x = -XVIEW + (2 * XVIEW * i) / 220;
      const V = (x * x) / 2;
      if (V > VTOP) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(px(x), pyV(V));
      else ctx.moveTo(px(x), pyV(V));
      pen = true;
    }
    ctx.stroke();

    // |Ψ(x,t)|² som fylt flate over grunnlinja.
    const NPTS = 240;
    ctx.beginPath();
    ctx.moveTo(px(-XVIEW), base);
    for (let i = 0; i <= NPTS; i++) {
      const x = -XVIEW + (2 * XVIEW * i) / NPTS;
      ctx.lineTo(px(x), base - dens * density(x));
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

    // ⟨x⟩ på grunnlinja.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(px(meanX()), base, 6, 0, 2 * Math.PI);
    ctx.fill();

    sOut.textContent = nb(alpha);
  }

  // ── animasjon ─────────────────────────────────────────────────────────────
  function frame() {
    if (signal?.aborted) return;
    if (playing) {
      t += DT;
      draw();
    }
    requestAnimationFrame(frame);
  }

  onResize(draw);
  draw();
  requestAnimationFrame(frame);
}
