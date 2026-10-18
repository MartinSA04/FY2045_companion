/**
 * To partikler uten vekselvirkning i en uendelig dyp brønn med bredde L = 1,
 * i énpartikkeltilstandene ψ_a og ψ_b, ψ_n(x) = √2 sin(nπx). Kvadratet er
 * alle plasseringene (x₁, x₂), med x₁ mot høyre og x₂ oppover, og fargen er
 * |ψ(x₁, x₂)|² for
 *   skjelnbare: ψ_a(x₁)ψ_b(x₂),
 *   bosoner:    [ψ_a(x₁)ψ_b(x₂) + ψ_b(x₁)ψ_a(x₂)]/√2  (ψ_a(x₁)ψ_a(x₂) når a = b),
 *   fermioner:  [ψ_a(x₁)ψ_b(x₂) − ψ_b(x₁)ψ_a(x₂)]/√2  (null når a = b).
 * Fargestyrken er delt på den største tettheten blant de tre valgene for det
 * samme paret (a, b), så valgene kan sammenlignes direkte.
 *
 * Linjene parallelt med diagonalen er |x₁ − x₂| = √⟨(x₁ − x₂)²⟩, regnet
 * lukket: ⟨x⟩_n = ½, ⟨x²⟩_n = ⅓ − 1/(2n²π²),
 *   ⟨(x₁ − x₂)²⟩_skj = ⟨x²⟩_a + ⟨x²⟩_b − 2⟨x⟩_a⟨x⟩_b,
 *   ⟨(x₁ − x₂)²⟩_±   = ⟨(x₁ − x₂)²⟩_skj ∓ 2⟨x⟩_ab²,
 * med ⟨x⟩_ab = −8ab/(π²(a² − b²)²) når a + b er odde og 0 ellers.
 * Prikkede linjer viser verdien for skjelnbare partikler.
 *
 * Et bytte av valg glir over et halvt sekund, så tettheten flytter seg mot
 * eller bort fra diagonalen. Med redusert bevegelse bytter figuren direkte.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler, så figuren
 * bytter tema av seg selv.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const G = 120; // rutenett for tettheten, G × G celler
  const TRANS = 0.5; // sekunder for en overgang
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PAIRS = [
    { a: 1, b: 2, text: "a, b = 1, 2", aria: "Énpartikkeltilstandene 1 og 2" },
    { a: 2, b: 3, text: "a, b = 2, 3", aria: "Énpartikkeltilstandene 2 og 3" },
    { a: 1, b: 1, text: "a = b = 1", aria: "Begge i énpartikkeltilstanden 1" },
  ];
  const MODES = [
    { key: "skj", text: "Skjelnbare", aria: "Skjelnbare partikler" },
    { key: "bos", text: "Bosoner", aria: "Identiske bosoner" },
    { key: "fer", text: "Fermioner", aria: "Identiske fermioner" },
  ];
  let mode = "fer";
  let pair = PAIRS[0];

  // ── fysikken ──────────────────────────────────────────────────────────────
  const psi = (n, x) => Math.SQRT2 * Math.sin(n * Math.PI * x);
  function density(m, a, b, x1, x2) {
    const p = psi(a, x1) * psi(b, x2);
    if (m === "skj" || (m === "bos" && a === b)) return p * p;
    if (a === b) return 0; // fermioner i samme tilstand
    const q = psi(b, x1) * psi(a, x2);
    const s = m === "bos" ? (p + q) / Math.SQRT2 : (p - q) / Math.SQRT2;
    return s * s;
  }
  const x2mean = (n) => 1 / 3 - 1 / (2 * n * n * Math.PI * Math.PI);
  function xab(a, b) {
    if (a === b || (a + b) % 2 === 0) return 0;
    return (-8 * a * b) / (Math.PI ** 2 * (a * a - b * b) ** 2);
  }
  // √⟨(x₁ − x₂)²⟩, eller null når tilstanden ikke finnes.
  function spread(m, a, b) {
    const skj = x2mean(a) + x2mean(b) - 0.5;
    if (m === "skj" || a === b) return m === "fer" && a === b ? null : Math.sqrt(skj);
    const ex = 2 * xab(a, b) ** 2;
    return Math.sqrt(m === "bos" ? skj - ex : skj + ex);
  }

  // Tettheten i rutenettet, delt på den største verdien blant de tre valgene.
  function grid(m, p) {
    const out = new Float32Array(G * G);
    let peak = 0;
    for (const mm of ["skj", "bos", "fer"]) {
      for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
          const v = density(mm, p.a, p.b, (i + 0.5) / G, 1 - (j + 0.5) / G);
          if (v > peak) peak = v;
          if (mm === m) out[j * G + i] = v;
        }
      }
    }
    for (let k = 0; k < out.length; k++) out[k] /= peak;
    return out;
  }

  // ── tilstand for overgangen ───────────────────────────────────────────────
  let shown = grid(mode, pair); // det som tegnes nå
  let from = shown;
  let to = shown;
  let dShown = spread(mode, pair.a, pair.b);
  let dFrom = dShown;
  let dTo = dShown;
  let tTrans = 1;

  // ── kontroller ────────────────────────────────────────────────────────────
  function button(text, aria) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sim-btn";
    b.textContent = text;
    b.setAttribute("aria-label", aria);
    return b;
  }
  const modeBtns = MODES.map((m) => {
    const b = button(m.text, m.aria);
    b.addEventListener("click", () => select(m.key, pair), { signal });
    return [b, m.key];
  });
  const pairBtns = PAIRS.map((p) => {
    const b = button(p.text, p.aria);
    b.addEventListener("click", () => select(mode, p), { signal });
    return [b, p];
  });
  function syncButtons() {
    for (const [b, k] of modeBtns) b.setAttribute("aria-pressed", String(k === mode));
    for (const [b, p] of pairBtns) b.setAttribute("aria-pressed", String(p === pair));
  }
  controls.append(...modeBtns.map(([b]) => b), ...pairBtns.map(([b]) => b));

  function select(m, p) {
    if (m === mode && p === pair) return;
    mode = m;
    pair = p;
    syncButtons();
    from = shown;
    to = grid(mode, pair);
    dFrom = dShown;
    dTo = spread(mode, pair.a, pair.b);
    if (reduce) {
      tTrans = 1;
      shown = to;
      dShown = dTo;
      draw();
      return;
    }
    tTrans = 0;
    start();
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const cssVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;

  // Fargen til et CSS-token som tall: lerretet skriver om enhver farge det
  // forstår til #rrggbb eller rgba(...).
  function rgbOf(color) {
    ctx.fillStyle = "#000000";
    ctx.fillStyle = color;
    const s = ctx.fillStyle;
    if (s.startsWith("#")) {
      return [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
    }
    const m = s.match(/[\d.]+/g) || ["0", "0", "0"];
    return m.slice(0, 3).map(Number);
  }

  const off = document.createElement("canvas");
  off.width = G;
  off.height = G;
  const offCtx = off.getContext("2d");
  const img = offCtx.createImageData(G, G);

  // Tekst med senket indeks: "x_1" tegnes som x med 1 senket i mindre skrift.
  const subFont = (i, size, family) =>
    `${i % 2 ? Math.round(size * 0.75) : size}px ${family}`;
  function subWidth(text, size, family) {
    let width = 0;
    text.split(/_(\S)/).forEach((p, i) => {
      ctx.font = subFont(i, size, family);
      width += ctx.measureText(p).width;
    });
    ctx.font = subFont(0, size, family);
    return width;
  }
  function subText(text, x, y, size, family) {
    let cx = x;
    text.split(/_(\S)/).forEach((p, i) => {
      ctx.font = subFont(i, size, family);
      ctx.fillText(p, cx, i % 2 ? y + 0.3 * size : y);
      cx += ctx.measureText(p).width;
    });
    ctx.font = subFont(0, size, family);
  }

  function draw() {
    const { w, h } = getSize();
    if (w < 120 || h < 120) return;
    ctx.clearRect(0, 0, w, h);
    const accent = cssVar("--accent", "#9b2d6f");
    const muted = cssVar("--muted", "#6b7280");
    const strong = cssVar("--border-strong", "#b0b7c1");
    const fg = cssVar("--fg", "#111111");
    const mono = cssVar("--font-mono", "ui-monospace, monospace");
    const canvasBg = cssVar("--canvas-bg", cssVar("--bg-elevated", "#ffffff"));

    const pad = 12;
    ctx.textBaseline = "middle";
    ctx.lineCap = "butt";

    // Forklaringen øverst: én linje når den får plass, ellers to. Plassen
    // regnes for alle tre, så kvadratet står stille når valget byttes, men
    // bare merkene som er tegnet, får en forklaring: linjene mangler når
    // tilstanden er null, og de prikkede mangler for skjelnbare partikler.
    const shownItems = [true, dShown !== null, dShown !== null && mode !== "skj"];
    const items = [
      ["|ψ(x_1,x_2)|²", (x, y) => { ctx.fillStyle = accent; ctx.globalAlpha = 0.7; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.globalAlpha = 1; }],
      ["√⟨(x_1−x_2)²⟩", (x, y) => { ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); }],
      ["skjelnbare", (x, y) => { ctx.strokeStyle = muted; ctx.lineWidth = 2; ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); ctx.setLineDash([]); }],
    ];
    const widths = items.map(([s]) => 16 + subWidth(s, 12, mono));
    const total = widths.reduce((a, b) => a + b, 0) + 18 * (items.length - 1);
    const oneRow = pad + total <= w - pad;
    let lx = pad;
    items.forEach(([s, glyph], i) => {
      const ly = oneRow || i < 2 ? 14 : 32;
      if (!oneRow && i === 2) lx = pad;
      if (shownItems[i]) {
        glyph(lx + 5, ly);
        ctx.fillStyle = muted;
        subText(s, lx + 16, ly, 12, mono);
      }
      lx += widths[i] + 18;
    });
    const top = (oneRow ? 30 : 48) + 6;

    // Kvadratet, så stort som plassen tillater, med aksene til venstre og under.
    const left = 34;
    const bottom = 30;
    const S = Math.max(60, Math.min(w - left - pad, h - top - bottom));
    const X0 = left + Math.max(0, (w - left - pad - S) / 2);
    const Y0 = top;
    const px = (x) => X0 + x * S;
    const py = (y) => Y0 + (1 - y) * S;

    // Tettheten som bilde, skalert opp med glatting.
    const [r, g, b] = rgbOf(accent);
    const data = img.data;
    for (let k = 0; k < G * G; k++) {
      data[4 * k] = r;
      data[4 * k + 1] = g;
      data[4 * k + 2] = b;
      data[4 * k + 3] = Math.round(235 * Math.min(1, shown[k]));
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, X0, Y0, S, S);

    // Veggene: kanten av kvadratet er der en av partiklene står ved en vegg.
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X0, Y0, S, S);

    // Diagonalen x₁ = x₂.
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(1), py(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // Linjene |x₁ − x₂| = d, klippet til kvadratet.
    function band(d) {
      if (d === null || d <= 0 || d >= 1) return;
      ctx.beginPath();
      ctx.moveTo(px(0), py(d));
      ctx.lineTo(px(1 - d), py(1));
      ctx.moveTo(px(d), py(0));
      ctx.lineTo(px(1), py(1 - d));
      ctx.stroke();
    }
    const dRef = spread("skj", pair.a, pair.b);
    if (mode !== "skj" && dShown !== null) {
      ctx.strokeStyle = muted;
      ctx.lineWidth = 2;
      ctx.setLineDash([1, 4]);
      ctx.lineCap = "round";
      band(dRef);
      ctx.setLineDash([]);
      ctx.lineCap = "butt";
    }
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    band(dShown);

    // Merkelappen på diagonalen, langs linja oppe til høyre, med en halo i
    // lerretsfargen så den leses over fargen.
    ctx.save();
    ctx.translate(px(0.8), py(0.8));
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "left";
    const diagLabel = "x_1 = x_2";
    const dw = subWidth(diagLabel, 12, mono);
    ctx.fillStyle = canvasBg;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-dw / 2 - 3, -17, dw + 6, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = muted;
    subText(diagLabel, -dw / 2, -10, 12, mono);
    ctx.restore();

    // Fermioner i samme tilstand: tilstanden er null overalt.
    if (dShown === null && tTrans >= 1) {
      const msg = "ψ_− = 0";
      const mw = subWidth(msg, 14, mono);
      ctx.textAlign = "left";
      ctx.fillStyle = fg;
      subText(msg, px(0.5) - mw / 2, py(0.3), 14, mono);
    }

    // Aksene: x₁ under kvadratet, x₂ til venstre, 0 og L i hjørnene.
    ctx.fillStyle = muted;
    ctx.font = `12px ${mono}`;
    ctx.textAlign = "center";
    ctx.fillText("0", px(0), Y0 + S + 10);
    ctx.fillText("L", px(1), Y0 + S + 10);
    ctx.textAlign = "left";
    const x1w = subWidth("x_1", 12, mono);
    subText("x_1", px(0.5) - x1w / 2, Y0 + S + 18, 12, mono);
    ctx.textAlign = "right";
    ctx.fillText("0", X0 - 6, py(0));
    ctx.fillText("L", X0 - 6, py(1));
    ctx.textAlign = "left";
    const x2w = subWidth("x_2", 12, mono);
    subText("x_2", X0 - 10 - x2w, py(0.5), 12, mono);
  }

  // ── animasjon ─────────────────────────────────────────────────────────────
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
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
    if (signal?.aborted) return;
    // Første bilde etter start har ingen gyldig forrige tid; klem dt ≥ 0.
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0), 0.05) : 0;
    last = now;
    tTrans = Math.min(1, tTrans + dt / TRANS);
    const u = ease(tTrans);
    const mix = new Float32Array(G * G);
    for (let k = 0; k < mix.length; k++) mix[k] = from[k] + (to[k] - from[k]) * u;
    shown = tTrans >= 1 ? to : mix;
    // Avstanden glir mellom verdiene; en tilstand som ikke finnes, krymper mot
    // diagonalen og forsvinner.
    const a0 = dFrom === null ? 0 : dFrom;
    const a1 = dTo === null ? 0 : dTo;
    dShown = tTrans >= 1 ? dTo : a0 + (a1 - a0) * u;
    if (tTrans < 1 && dTo === null && dShown < 0.01) dShown = null;
    draw();
    if (tTrans < 1) raf = requestAnimationFrame(frame);
  }

  syncButtons();
  onResize(draw);
  draw();
}
