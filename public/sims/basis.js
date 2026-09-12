/**
 * Én tilstand, tre basiser. En gaussisk pakke i en harmonisk oscillator
 * (ħ = m = ω = 1), forskjøvet til x₀ og gitt impulsen p₀, tegnes som
 * komponentene ⟨x|ψ⟩, ⟨p|ψ⟩ og ⟨n|ψ⟩ i tre rader: fylt flate = |komponent|²,
 * tynn linje = realdelen, prikk på grunnlinja = forventningsverdien.
 *
 * Pakken er en koherent tilstand med α = (x₀ + ip₀)/√2, så
 *   ⟨x|ψ⟩ = π^(-1/4) e^(-(x-x₀)²/2) e^(ip₀(x-x₀)),
 *   ⟨p|ψ⟩ = π^(-1/4) e^(-(p-p₀)²/2) e^(-ix₀(p-p₀)),
 *   |⟨n|ψ⟩|² = e^(-λ) λⁿ/n!  med λ = |α|² = (x₀² + p₀²)/2.
 * Globale faser er valgt så realdelen er symmetrisk om toppen.
 *
 * Kontrakt: default-eksportert init(api), api = { ctx, controls, getSize,
 * onResize, signal }. Fargene er sidens egne CSS-variabler.
 */
export default function init({ ctx, controls, getSize, onResize, signal }) {
  const RANGE = 5; // x og p tegnes i [−RANGE, RANGE]
  const NMAX = 20; // energinivåer n = 0 … NMAX
  let x0 = 1.5;
  let p0 = 0;

  const nb = (v) => v.toFixed(1).replace("-", "−").replace(".", ",");

  // ── kontroller ────────────────────────────────────────────────────────────
  function slider(text, aria, value, onInput) {
    const label = document.createElement("label");
    label.append(text + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = "-3";
    input.max = "3";
    input.step = "0.1";
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    input.addEventListener(
      "input",
      () => {
        onInput(Number(input.value));
        draw();
      },
      { signal },
    );
    return { label, out };
  }
  const sx = slider("Posisjon x₀", "Pakkens posisjon", x0, (v) => (x0 = v));
  const sp = slider("Impuls p₀", "Pakkens impuls", p0, (v) => (p0 = v));
  controls.append(sx.label, sp.label);

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
    const fg = cssVar("--fg", "#111111");
    const mono = cssVar("--font-mono", "ui-monospace, monospace");

    const pad = 12;
    ctx.font = `12px ${mono}`;
    ctx.textBaseline = "middle";

    // Forklaringen øverst: én linje når den får plass, ellers to.
    const items = [
      ["|⟨·|ψ⟩|²", (x, y) => { ctx.fillStyle = accent; ctx.globalAlpha = 0.35; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.globalAlpha = 1; }],
      ["Re ⟨·|ψ⟩", (x, y) => { ctx.strokeStyle = fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); }],
      ["forventningsverdi", (x, y) => { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill(); }],
    ];
    const widths = items.map(([t]) => 16 + ctx.measureText(t).width);
    const total = widths.reduce((a, b) => a + b, 0) + 18 * (items.length - 1);
    const oneRow = pad + total <= w - pad;
    let lx = pad;
    items.forEach(([t, glyph], i) => {
      const ly = oneRow || i < 2 ? 14 : 32;
      if (!oneRow && i === 2) lx = pad;
      glyph(lx + 5, ly);
      ctx.fillStyle = muted;
      ctx.fillText(t, lx + 16, ly);
      lx += widths[i] + 18;
    });
    const top = oneRow ? 30 : 48;

    const rowH = (h - top - 4) / 3;
    const plotW = w - 2 * pad;
    const px = (v) => pad + ((v + RANGE) / (2 * RANGE)) * plotW;

    // Én rad med grunnlinje, merker, radetikett og forventningsverdi-prikk.
    function row(i, name, ticks, tickX) {
      const y0 = top + i * rowH;
      const base = y0 + 0.58 * rowH;
      ctx.strokeStyle = strong;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad, base);
      ctx.lineTo(w - pad, base);
      ctx.stroke();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.fillStyle = muted;
      ctx.font = `11px ${mono}`;
      ctx.textAlign = "center";
      for (const t of ticks) {
        const x = tickX(t);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, base + 4);
        ctx.stroke();
        ctx.fillText(String(t).replace("-", "−"), x, y0 + rowH - 8);
      }
      ctx.textAlign = "left";
      ctx.font = `12px ${mono}`;
      ctx.fillStyle = muted;
      ctx.fillText(name, pad, y0 + 10);
      return { base, above: base - y0 - 20 };
    }

    // Kurverader: |ψ|² som fylt flate, Re ψ som tynn linje.
    function curveRow(i, name, centre, phaseRate) {
      const { base, above } = row(i, name, [-4, -2, 0, 2, 4], px);
      const peak = 0.85 * above; // |ψ|²-toppen π^(-1/2)
      const amp = 0.6 * peak; // realdelens amplitude, kvalitativ skala
      const n = 240;
      ctx.beginPath();
      ctx.moveTo(px(-RANGE), base);
      for (let k = 0; k <= n; k++) {
        const v = -RANGE + (2 * RANGE * k) / n;
        const d = v - centre;
        ctx.lineTo(px(v), base - peak * Math.exp(-d * d));
      }
      ctx.lineTo(px(RANGE), base);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const v = -RANGE + (2 * RANGE * k) / n;
        const d = v - centre;
        const y = base - peak * Math.exp(-d * d);
        if (k === 0) ctx.moveTo(px(v), y);
        else ctx.lineTo(px(v), y);
      }
      ctx.stroke();
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const v = -RANGE + (2 * RANGE * k) / n;
        const d = v - centre;
        const y = base - amp * Math.exp(-(d * d) / 2) * Math.cos(phaseRate * d);
        if (k === 0) ctx.moveTo(px(v), y);
        else ctx.lineTo(px(v), y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px(centre), base, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Energirad: Poisson-søyler for |c_n|², skalert til høyeste søyle.
    function barRow(i, name) {
      const slot = plotW / (NMAX + 1);
      const bx = (n) => pad + (n + 0.5) * slot;
      const { base, above } = row(i, name, [0, 5, 10, 15, 20], bx);
      const lambda = (x0 * x0 + p0 * p0) / 2;
      const probs = [];
      let t = Math.exp(-lambda);
      for (let n = 0; n <= NMAX; n++) {
        probs.push(t);
        t *= lambda / (n + 1);
      }
      const max = Math.max(...probs);
      const scale = (0.85 * above) / max;
      ctx.fillStyle = accent;
      for (let n = 0; n <= NMAX; n++) {
        const bh = probs[n] * scale;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(bx(n) - 0.35 * slot, base - bh, 0.7 * slot, bh);
        ctx.globalAlpha = 1;
        ctx.fillRect(bx(n) - 0.35 * slot, base - bh, 0.7 * slot, Math.min(2, bh));
      }
      ctx.beginPath();
      ctx.arc(bx(lambda), base, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    curveRow(0, "⟨x|ψ⟩  posisjon", x0, p0);
    curveRow(1, "⟨p|ψ⟩  impuls", p0, -x0);
    barRow(2, "⟨n|ψ⟩  energi");

    sx.out.textContent = nb(x0);
    sp.out.textContent = nb(p0);
  }

  onResize(draw);
  draw();
}
