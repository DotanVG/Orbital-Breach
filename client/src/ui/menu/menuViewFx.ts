import { isTouchDevice } from "../../platform";

function initMenuFx(container: HTMLElement): void {
  const root = container.querySelector<HTMLElement>("#menu-root");
  if (!root) return;

  const touch = isTouchDevice();

  // ── 1. Starfield ──
  const starsEl = root.querySelector<HTMLElement>("#ob-stars");
  if (starsEl) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 180; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "vw";
      s.style.top  = Math.random() * 100 + "vh";
      const sz = Math.random() < 0.15 ? 2 : 1;
      s.style.width = sz + "px"; s.style.height = sz + "px";
      s.style.setProperty("--o", (0.2 + Math.random() * 0.8).toFixed(2));
      s.style.setProperty("--t", (3 + Math.random() * 7).toFixed(1) + "s");
      s.style.setProperty("--d", (Math.random() * 6).toFixed(1) + "s");
      frag.appendChild(s);
    }
    starsEl.appendChild(frag);
  }

  // ── 2. Ring ticks ──
  const outerTickG = root.querySelector<SVGGElement>(".ob-ring-1 .ob-ring-ticks");
  if (outerTickG) {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const inner = i % 6 === 0 ? 190 : 194;
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", String(Math.cos(a) * inner));
      ln.setAttribute("y1", String(Math.sin(a) * inner));
      ln.setAttribute("x2", String(Math.cos(a) * 200));
      ln.setAttribute("y2", String(Math.sin(a) * 200));
      ln.setAttribute("class", i % 6 === 0 ? "ob-tick-major" : "ob-tick");
      outerTickG.appendChild(ln);
    }
  }
  const innerTickG = root.querySelector<SVGGElement>("#ob-inner-ticks");
  if (innerTickG) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", String(Math.cos(a) * 172));
      ln.setAttribute("y1", String(Math.sin(a) * 172));
      ln.setAttribute("x2", String(Math.cos(a) * 180));
      ln.setAttribute("y2", String(Math.sin(a) * 180));
      ln.setAttribute("stroke", "rgba(210,220,240,0.28)");
      ln.setAttribute("stroke-width", "1");
      innerTickG.appendChild(ln);
    }
  }

  // ── 3. Per-letter title wrap ──
  const titleEl  = root.querySelector<HTMLElement>("#ob-title");
  const wavesCvs = root.querySelector<HTMLCanvasElement>("#ob-title-waves");
  if (titleEl && wavesCvs) {
    wavesCvs.remove();
    titleEl.innerHTML = "";
    titleEl.appendChild(wavesCvs);
    for (const ch of "ORBITAL BREACH") {
      if (ch === " ") { titleEl.appendChild(document.createTextNode(" ")); continue; }
      const s = document.createElement("span");
      s.className = "ob-letter";
      s.textContent = ch;
      titleEl.appendChild(s);
    }
  }

  // ── 4. Sine wave canvas on title hover ──
  if (titleEl && wavesCvs) {
    const ctx = wavesCvs.getContext("2d");
    if (ctx) {
      let W = 0, H = 0, rafWave = 0, waveRunning = false;
      const DPR = Math.min(window.devicePixelRatio || 1, 2);

      const resizeWave = () => {
        const r = wavesCvs.getBoundingClientRect();
        W = Math.max(1, Math.floor(r.width));
        H = Math.max(1, Math.floor(r.height));
        wavesCvs.width  = W * DPR;
        wavesCvs.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      };
      requestAnimationFrame(() => requestAnimationFrame(resizeWave));
      const ro = new ResizeObserver(resizeWave);
      ro.observe(titleEl);

      const drawWave = (t: number, color: string, phase: number, amp: number, freq: number, speed: number, offset: number) => {
        const mid = H / 2;
        const passes = [
          { dOff: -6, a: 0.06, w: 14 }, { dOff: -3, a: 0.10, w: 8 },
          { dOff:  0, a: 0.28, w:  3 }, { dOff:  3, a: 0.10, w: 8 },
          { dOff:  6, a: 0.06, w: 14 },
        ];
        for (const p of passes) {
          ctx.beginPath(); ctx.strokeStyle = color;
          ctx.globalAlpha = p.a; ctx.lineWidth = p.w; ctx.lineCap = "round";
          for (let x = 0; x <= W; x += 4) {
            const nx = x / W;
            const y = mid
              + Math.sin(nx * freq + t * speed + phase) * amp
              + Math.sin(nx * (freq * 0.47) - t * speed * 0.6 + phase * 1.3) * (amp * 0.45)
              + offset + p.dOff;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };

      let waveStart = performance.now();
      const frameWave = (now: number) => {
        if (!waveRunning) return;
        const t = (now - waveStart) / 1000;
        ctx.clearRect(0, 0, W, H);
        const cs = getComputedStyle(document.documentElement);
        const c  = cs.getPropertyValue("--ob-cyan").trim()    || "#5ccfff";
        const m  = cs.getPropertyValue("--ob-magenta").trim() || "#ff5cd0";
        const amp = Math.min(H * 0.18, 42);
        drawWave(t, c, 0,          amp,       7,  1.6, -amp * 0.4);
        drawWave(t, m, Math.PI,    amp,       7, -1.6,  amp * 0.4);
        drawWave(t, c, Math.PI * 0.5, amp * 0.55, 11, -1.1, 0);
        drawWave(t, m, Math.PI * 1.5, amp * 0.55, 11,  1.1, 0);
        rafWave = requestAnimationFrame(frameWave);
      };
      titleEl.addEventListener("mouseenter", () => {
        waveRunning = true; waveStart = performance.now();
        rafWave = requestAnimationFrame(frameWave);
      });
      titleEl.addEventListener("mouseleave", () => {
        waveRunning = false;
        setTimeout(() => { if (!waveRunning) ctx.clearRect(0, 0, W, H); }, 500);
      });
    }
  }

  // ── 5. Orbit tilt + letter parallax loop ──
  const orbitEl = root.querySelector<HTMLElement>("#ob-orbit-tilt");
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rafMain = 0;

  const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
  window.addEventListener("mousemove", onMove);

  const mainLoop = () => {
    if (!root.isConnected) return;
    if (orbitEl && !touch) {
      const nx = (mx / window.innerWidth  - 0.5) * 2;
      const ny = (my / window.innerHeight - 0.5) * 2;
      orbitEl.style.transform = `rotateX(${62 + ny * 5}deg) rotateZ(${-nx * 13}deg)`;
    }
    if (titleEl && !touch) {
      titleEl.querySelectorAll<HTMLElement>(".ob-letter").forEach((l) => {
        const r = l.getBoundingClientRect();
        const dx = mx - (r.left + r.width  / 2);
        const dy = my - (r.top  + r.height / 2);
        const d  = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - d / 340);
        l.style.transform = `translate(${-(dx / 340) * 12 * pull}px, ${-(dy / 340) * 6 * pull}px)`;
      });
    }
    rafMain = requestAnimationFrame(mainLoop);
  };
  rafMain = requestAnimationFrame(mainLoop);

  // ── 5b. Touch/Windows orbit: auto-animation (no gyro) ──
  if (touch && orbitEl) {
    let autoT = 0;
    let rafMobile = 0;

    const applyOrbit = (nx: number, ny: number) => {
      orbitEl!.style.transform = `rotateX(${62 + ny * 5}deg) rotateZ(${-nx * 13}deg)`;
    };

    const mobileOrbitLoop = () => {
      if (!root.isConnected) return;
      autoT += 0.008;
      applyOrbit(Math.sin(autoT * 0.7), Math.sin(autoT * 0.4) * 0.4);
      rafMobile = requestAnimationFrame(mobileOrbitLoop);
    };

    const reducedMotionMq = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const startLoop = () => { if (!rafMobile) rafMobile = requestAnimationFrame(mobileOrbitLoop); };
    const stopLoop  = () => { cancelAnimationFrame(rafMobile); rafMobile = 0; };

    if (!reducedMotionMq?.matches) startLoop();

    // Keep a named reference so cleanup removes the SAME listener that was
    // added — the media query object outlives every menu mount, so a
    // mismatched removeEventListener leaks one listener per menu show.
    const onReducedMotionChange = (e: MediaQueryListEvent) => { e.matches ? stopLoop() : startLoop(); };
    reducedMotionMq?.addEventListener("change", onReducedMotionChange);

    const mobMo = new MutationObserver(() => {
      if (!root.isConnected) {
        stopLoop();
        reducedMotionMq?.removeEventListener("change", onReducedMotionChange);
        mobMo.disconnect();
      }
    });
    mobMo.observe(document.body, { childList: true });
  }

  // Cleanup once container leaves the DOM
  const mo = new MutationObserver(() => {
    if (!root.isConnected) {
      cancelAnimationFrame(rafMain);
      window.removeEventListener("mousemove", onMove);
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true });

  // ── 6. Button radial hover ──
  root.querySelectorAll<HTMLElement>(".ob-btn, .ob-match-card, .ob-tutorial-btn").forEach((el) => {
    el.addEventListener("mousemove", (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((e.clientX - r.left) / r.width  * 100) + "%");
      el.style.setProperty("--my", ((e.clientY - r.top)  / r.height * 100) + "%");
    });
  });
  // ── 7. UTC clock ──
  const clockEl = root.querySelector<HTMLElement>("#ob-clock");
  if (clockEl) {
    const tick = () => {
      if (!root.isConnected) return;
      const d = new Date();
      clockEl.textContent = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
        .map((n) => String(n).padStart(2, "0")).join(":") + " UTC";
      setTimeout(tick, 1000);
    };
    tick();
  }
}

/* ─────────────────────────────────────────────
   UTIL
───────────────────────────────────────────── */
function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":  return "&amp;";
      case "<":  return "&lt;";
      case ">":  return "&gt;";
      case '"':  return "&quot;";
      case "'":  return "&#39;";
      default:   return ch;
    }
  });
}


export { initMenuFx };
