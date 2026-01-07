(() => {
  "use strict";

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const ui = {
    btnPause: document.getElementById("btnPause"),
    btnReset: document.getElementById("btnReset"),

    tabBacteria: document.getElementById("tabBacteria"),
    tabVirus: document.getElementById("tabVirus"),

    simTitle: document.getElementById("simTitle"),
    simExplain: document.getElementById("simExplain"),

    cellHealthText: document.getElementById("cellHealthText"),
    cellHealthBar: document.getElementById("cellHealthBar"),

    pressureLabel: document.getElementById("pressureLabel"),
    pressureText: document.getElementById("pressureText"),
    pressureBar: document.getElementById("pressureBar"),

    statusPill: document.getElementById("statusPill"),
    footerText: document.getElementById("footerText"),

    hintText: document.getElementById("hintText"),
    legend3: document.getElementById("legend3"),

    controlsBacteria: document.getElementById("controlsBacteria"),
    controlsVirus: document.getElementById("controlsVirus"),

    speed: document.getElementById("speed"),
    speedText: document.getElementById("speedText"),

    // Bacteria controls
    bacteriaCount: document.getElementById("bacteriaCount"),
    bacteriaCountText: document.getElementById("bacteriaCountText"),
    bacteriaGrow: document.getElementById("bacteriaGrow"),
    bacteriaGrowText: document.getElementById("bacteriaGrowText"),
    toxinRate: document.getElementById("toxinRate"),
    toxinRateText: document.getElementById("toxinRateText"),
    immune: document.getElementById("immune"),
    immuneText: document.getElementById("immuneText"),

    // Virus controls
    virusDose: document.getElementById("virusDose"),
    virusDoseText: document.getElementById("virusDoseText"),
    attachment: document.getElementById("attachment"),
    attachmentText: document.getElementById("attachmentText"),
    replication: document.getElementById("replication"),
    replicationText: document.getElementById("replicationText"),
    antiviral: document.getElementById("antiviral"),
    antiviralText: document.getElementById("antiviralText"),

    keyIdea: document.getElementById("keyIdea"),
    examLine: document.getElementById("examLine"),
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  function resizeCanvasToDisplaySize() {
    const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const displayWidth = Math.floor(canvas.clientWidth * ratio);
    const displayHeight = Math.floor((canvas.clientWidth * (520 / 980)) * ratio);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  }

  // Visual theme colors (match CSS vibe)
  const COLORS = {
    bacteria: "rgba(76,240,200,0.95)",
    toxin: "rgba(255,79,216,0.92)",
    virus: "rgba(111,107,255,0.95)",
    cell: "rgba(255,211,76,0.85)",
    cellFill: "rgba(255,211,76,0.10)",
    text: "rgba(245,247,255,0.92)",
    muted: "rgba(199,208,255,0.85)",
    stroke: "rgba(38,52,110,0.9)",
  };

  const MODE = {
    BACTERIA: "bacteria",
    VIRUS: "virus",
  };

  const state = {
    mode: MODE.BACTERIA,
    running: true,
    speed: 1,
    t: 0,

    cellHealth: 100,

    // bacteria model
    bacteria: [],
    toxins: [],

    // virus model
    viruses: [],
    infection: {
      attached: false,
      injected: false,
      hijacking: false,
      burst: false,
      stageT: 0,
      viralLoad: 0,
    },

    cellBurst: {
      active: false,
      kind: "",
      t: 0,
      cracks: [],
      debris: [],
    },

    // visuals
    seed: Math.random() * 1000,
  };

  function rng() {
    // deterministic-ish random based on time; good enough for visuals
    state.seed = (state.seed * 9301 + 49297) % 233280;
    return state.seed / 233280;
  }

  function resetCommon() {
    state.t = 0;
    state.cellHealth = 100;
    state.cellBurst = {
      active: false,
      kind: "",
      t: 0,
      cracks: [],
      debris: [],
    };
    ui.statusPill.textContent = state.running ? "Running" : "Paused";
    setPressure(0);
  }

  function triggerCellBurst(cell, kind) {
    if (state.cellBurst.active) return;
    state.cellBurst.active = true;
    state.cellBurst.kind = kind;
    state.cellBurst.t = 0;

    // pre-generate crack angles so the effect looks consistent
    const crackCount = 12;
    state.cellBurst.cracks = Array.from({ length: crackCount }, () => ({
      a: rng() * Math.PI * 2,
      w: 0.8 + rng() * 1.8,
      l: 0.7 + rng() * 0.45,
    }));

    // debris particles fly outward from the cell edge
    const w = canvas.width;
    const h = canvas.height;
    const debrisCount = 80;
    state.cellBurst.debris = [];
    for (let i = 0; i < debrisCount; i++) {
      const a = rng() * Math.PI * 2;
      const rr = cell.r * (0.85 + rng() * 0.18);
      const x = (cell.cx + Math.cos(a) * rr) / w;
      const y = (cell.cy + Math.sin(a) * rr) / h;
      const sp = 0.10 + rng() * 0.26;
      state.cellBurst.debris.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 0.003 + rng() * 0.005,
        life: 1.4 + rng() * 1.1,
      });
    }
  }

  function stepCellBurst(dt) {
    if (!state.cellBurst.active) return;
    state.cellBurst.t += dt;
    for (const p of state.cellBurst.debris) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // slight drag
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    state.cellBurst.debris = state.cellBurst.debris.filter((p) => p.life > 0);
  }

  function resetBacteria() {
    state.bacteria = [];
    state.toxins = [];

    const count = Number(ui.bacteriaCount.value);
    for (let i = 0; i < count; i++) {
      state.bacteria.push({
        x: 0.18 + rng() * 0.64,
        y: 0.18 + rng() * 0.64,
        r: 0.008 + rng() * 0.006,
        vx: (rng() - 0.5) * 0.05,
        vy: (rng() - 0.5) * 0.05,
        toxinCooldown: rng() * 0.6,
        age: rng() * 3,
      });
    }
  }

  function resetVirus() {
    state.viruses = [];
    state.toxins = [];
    state.infection = {
      attached: false,
      injected: false,
      hijacking: false,
      burst: false,
      stageT: 0,
      viralLoad: 0,
    };

    const dose = Number(ui.virusDose.value);
    for (let i = 0; i < dose; i++) {
      // start around the edges so they drift in
      const side = Math.floor(rng() * 4);
      let x = rng();
      let y = rng();
      if (side === 0) y = -0.05;
      if (side === 1) x = 1.05;
      if (side === 2) y = 1.05;
      if (side === 3) x = -0.05;

      state.viruses.push({
        x,
        y,
        r: 0.007 + rng() * 0.004,
        vx: (0.5 - rng()) * 0.08,
        vy: (0.5 - rng()) * 0.08,
        attached: false,
      });
    }
  }

  function reset() {
    resetCommon();
    if (state.mode === MODE.BACTERIA) resetBacteria();
    if (state.mode === MODE.VIRUS) resetVirus();
    updateMeters();
    updateCopyForMode();
  }

  function setMode(mode) {
    state.mode = mode;
    ui.tabBacteria.classList.toggle("tab-active", mode === MODE.BACTERIA);
    ui.tabVirus.classList.toggle("tab-active", mode === MODE.VIRUS);
    ui.tabBacteria.setAttribute("aria-selected", mode === MODE.BACTERIA ? "true" : "false");
    ui.tabVirus.setAttribute("aria-selected", mode === MODE.VIRUS ? "true" : "false");

    ui.controlsBacteria.classList.toggle("hidden", mode !== MODE.BACTERIA);
    ui.controlsVirus.classList.toggle("hidden", mode !== MODE.VIRUS);

    ui.legend3.classList.toggle("hidden", mode !== MODE.VIRUS);

    reset();
  }

  function setPressure(p) {
    const v = clamp(p, 0, 100);
    ui.pressureBar.style.width = `${v}%`;
    const track = ui.pressureBar.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(v)));

    if (v < 25) ui.pressureText.textContent = "Low";
    else if (v < 55) ui.pressureText.textContent = "Rising";
    else if (v < 80) ui.pressureText.textContent = "High";
    else ui.pressureText.textContent = "Very high";
  }

  function updateMeters() {
    const h = clamp(state.cellHealth, 0, 100);
    ui.cellHealthText.textContent = `${Math.round(h)}%`;
    ui.cellHealthBar.style.width = `${h}%`;
    const track = ui.cellHealthBar.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(h)));

    // color feel based on health
    if (h > 70) {
      ui.cellHealthBar.style.filter = "saturate(1.05)";
    } else if (h > 35) {
      ui.cellHealthBar.style.filter = "saturate(1.0) hue-rotate(-6deg)";
    } else {
      ui.cellHealthBar.style.filter = "saturate(1.0) hue-rotate(-18deg)";
    }
  }

  function updateCopyForMode() {
    if (state.mode === MODE.BACTERIA) {
      ui.simTitle.textContent = "Bacteria: toxin production";
      ui.simExplain.textContent =
        "Bacteria can release toxins. Toxins can damage cells and trigger symptoms (e.g., inflammation, diarrhoea, fever). " +
        "In this model, toxin particles spread and reduce the “cell health” bar.";

      ui.pressureLabel.textContent = "Toxin level";
      ui.hintText.textContent = "Tip: raise “toxin production” to see symptoms happen faster.";

      ui.keyIdea.textContent = "Toxins are chemicals released by bacteria that damage cells.";
      ui.examLine.textContent = "Bacteria can produce toxins that damage tissues and cause symptoms.";

      ui.footerText.innerHTML =
        "In real life, antibiotics can treat <em>bacterial</em> infections, but they do not work on <em>viruses</em>.";
    } else {
      ui.simTitle.textContent = "Virus: hijacking a cell";
      ui.simExplain.textContent =
        "Viruses must enter a host cell to reproduce. They inject genetic material and hijack the cell’s machinery " +
        "to build new viruses. In this model, the viral load rises until the cell bursts.";

      ui.pressureLabel.textContent = "Viral load";
      ui.hintText.textContent = "Tip: raise “replication speed” to reach cell bursting sooner.";

      ui.keyIdea.textContent = "Viruses reproduce by hijacking host cells (they are not cells themselves).";
      ui.examLine.textContent = "Viruses replicate inside cells by using the cell’s machinery to make copies.";

      ui.footerText.innerHTML =
        "Vaccines help prevent <em>viral</em> infections by training the immune system before you get ill.";
    }
  }

  function drawBackground(w, h) {
    ctx.clearRect(0, 0, w, h);

    // soft grid
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = COLORS.stroke;
    ctx.lineWidth = 1;

    const step = Math.max(26, Math.floor(w / 22));
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // cell area (center)
    const cx = w * 0.52;
    const cy = h * 0.52;
    const r = Math.min(w, h) * 0.26;

    ctx.save();
    ctx.fillStyle = COLORS.cellFill;
    ctx.strokeStyle = COLORS.cell;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // nucleus-like dot
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255,211,76,0.22)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy + r * 0.08, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    return { cx, cy, r };
  }

  function drawCellBurst(cell, w, h) {
    if (!state.cellBurst.active) return;

    const t = state.cellBurst.t;

    // shockwave
    const waveR = cell.r * (0.85 + t * 0.35);
    ctx.save();
    ctx.globalAlpha = clamp(0.65 - t * 0.35, 0, 0.65);
    ctx.strokeStyle = "rgba(255,74,110,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cell.cx, cell.cy, waveR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // cracks on membrane
    ctx.save();
    ctx.globalAlpha = clamp(0.95 - t * 0.25, 0, 0.95);
    ctx.strokeStyle = "rgba(255,211,76,0.75)";
    ctx.lineCap = "round";
    for (const c of state.cellBurst.cracks) {
      const inner = cell.r * 0.62;
      const outer = cell.r * clamp(c.l + t * 0.12, 0.8, 1.25);
      ctx.lineWidth = c.w;
      ctx.beginPath();
      ctx.moveTo(cell.cx + Math.cos(c.a) * inner, cell.cy + Math.sin(c.a) * inner);
      ctx.lineTo(cell.cx + Math.cos(c.a) * outer, cell.cy + Math.sin(c.a) * outer);
      ctx.stroke();
    }
    ctx.restore();

    // debris particles
    for (const p of state.cellBurst.debris) {
      const alpha = clamp(p.life / 2.0, 0, 1);
      const fill = `rgba(255,79,216,${0.15 + alpha * 0.55})`;
      drawParticle(p.x * w, p.y * h, p.r * Math.min(w, h), fill, 10);
    }
  }

  function drawText(w, h, title, lines) {
    ctx.save();
    ctx.fillStyle = COLORS.text;
    ctx.font = `${Math.round(h * 0.034)}px Inter, system-ui, sans-serif`;
    ctx.fillText(title, w * 0.04, h * 0.10);

    ctx.fillStyle = COLORS.muted;
    ctx.font = `${Math.round(h * 0.028)}px Inter, system-ui, sans-serif`;
    let y = h * 0.145;
    for (const line of lines) {
      ctx.fillText(line, w * 0.04, y);
      y += h * 0.04;
    }
    ctx.restore();
  }

  function drawParticle(x, y, r, fill, glow) {
    ctx.save();
    ctx.fillStyle = fill;
    if (glow) {
      ctx.shadowColor = fill;
      ctx.shadowBlur = glow;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function stepBacteria(dt, cell) {
    const bacteriaGrow = Number(ui.bacteriaGrow.value) / 100;
    const toxinRate = Number(ui.toxinRate.value) / 100;
    const immune = Number(ui.immune.value) / 100;

    // move bacteria + bounce in view
    for (const b of state.bacteria) {
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // gentle drift
      b.vx += (rng() - 0.5) * dt * 0.01;
      b.vy += (rng() - 0.5) * dt * 0.01;
      b.vx = clamp(b.vx, -0.08, 0.08);
      b.vy = clamp(b.vy, -0.08, 0.08);

      if (b.x < 0.05 || b.x > 0.95) b.vx *= -1;
      if (b.y < 0.08 || b.y > 0.92) b.vy *= -1;
      b.x = clamp(b.x, 0.06, 0.94);
      b.y = clamp(b.y, 0.09, 0.91);

      // toxin generation
      b.toxinCooldown -= dt;
      const baseCooldown = lerp(1.2, 0.18, toxinRate);
      if (b.toxinCooldown <= 0) {
        b.toxinCooldown = baseCooldown * (0.7 + rng() * 0.7);
        // spawn toxin near bacteria
        const angle = rng() * Math.PI * 2;
        const sp = 0.12 + rng() * 0.16;
        state.toxins.push({
          x: b.x,
          y: b.y,
          r: 0.004 + rng() * 0.003,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          life: 3.2 + rng() * 2.5,
        });
      }
    }

    // reproduction (simple: occasionally split)
    const targetMax = 70;
    const crowding = clamp(state.bacteria.length / targetMax, 0, 1);
    const splitChance = bacteriaGrow * (1 - crowding) * 0.33; // per second-ish
    if (state.bacteria.length < targetMax && rng() < splitChance * dt) {
      const parent = state.bacteria[Math.floor(rng() * state.bacteria.length)];
      if (parent) {
        state.bacteria.push({
          x: clamp(parent.x + (rng() - 0.5) * 0.03, 0.06, 0.94),
          y: clamp(parent.y + (rng() - 0.5) * 0.03, 0.09, 0.91),
          r: parent.r,
          vx: (rng() - 0.5) * 0.08,
          vy: (rng() - 0.5) * 0.08,
          toxinCooldown: rng() * 0.8,
          age: 0,
        });
      }
    }

    // toxin movement + decay + immune clearance
    let toxinInCell = 0;
    for (const t of state.toxins) {
      t.x += t.vx * dt;
      t.y += t.vy * dt;

      // light jitter
      t.vx += (rng() - 0.5) * dt * 0.03;
      t.vy += (rng() - 0.5) * dt * 0.03;
      t.vx = clamp(t.vx, -0.22, 0.22);
      t.vy = clamp(t.vy, -0.22, 0.22);

      t.life -= dt * (0.8 + immune * 1.8);

      // slight pull towards the cell so toxins tend to reach it
      const tx = (t.x * canvas.width) - cell.cx;
      const ty = (t.y * canvas.height) - cell.cy;
      const dist2 = tx * tx + ty * ty;
      const pullZone = (cell.r * 1.25) * (cell.r * 1.25);
      if (dist2 < pullZone) {
        const d = Math.sqrt(dist2) + 1e-6;
        const ax = (-tx / d) * 0.018;
        const ay = (-ty / d) * 0.018;
        t.vx += (ax * dt);
        t.vy += (ay * dt);
      }

      // count toxin inside the cell area for damage
      const dx = (t.x * canvas.width) - cell.cx;
      const dy = (t.y * canvas.height) - cell.cy;
      if ((dx * dx + dy * dy) < (cell.r * cell.r)) toxinInCell++;
    }

    // immune removes some bacteria too
    if (state.bacteria.length > 1 && rng() < immune * 0.06 * dt) {
      state.bacteria.splice(Math.floor(rng() * state.bacteria.length), 1);
    }

    // remove dead toxins
    state.toxins = state.toxins.filter((t) => t.life > 0 && t.x > -0.1 && t.x < 1.1 && t.y > -0.2 && t.y < 1.2);

    // damage to cell health
    // more toxins in cell => more damage; immune reduces net damage a bit
    const damagePerSec = toxinInCell * 0.12 * (1 - immune * 0.55);
    state.cellHealth -= damagePerSec * dt;
    state.cellHealth = clamp(state.cellHealth, 0, 100);

    // pressure meter reflects toxin count
    const toxinPressure = clamp((state.toxins.length / 140) * 100, 0, 100);
    setPressure(toxinPressure);

    if (state.cellHealth <= 0) {
      triggerCellBurst(cell, "toxin");
      ui.statusPill.textContent = "Cell burst";
      setPressure(100);
    }
  }

  function stepVirus(dt, cell) {
    const attachment = Number(ui.attachment.value) / 100;
    const replication = Number(ui.replication.value) / 100;
    const antiviral = Number(ui.antiviral.value) / 100;

    // infection stages:
    // 0: viruses drift near cell
    // 1: attach to cell surface
    // 2: inject genome
    // 3: hijack and replicate (viralLoad rises)
    // 4: burst, release more viruses

    // move viruses
    const cxN = cell.cx / canvas.width;
    const cyN = cell.cy / canvas.height;
    const rN = cell.r / Math.min(canvas.width, canvas.height);

    let attachedNow = 0;
    for (const v of state.viruses) {
      if (v.attached) {
        attachedNow++;
        continue;
      }

      // mild attraction to the cell
      const dx = cxN - v.x;
      const dy = cyN - v.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
      v.vx += (dx / d) * dt * 0.015;
      v.vy += (dy / d) * dt * 0.015;

      // clamp
      v.vx = clamp(v.vx, -0.14, 0.14);
      v.vy = clamp(v.vy, -0.14, 0.14);

      v.x += v.vx * dt;
      v.y += v.vy * dt;

      // attempt attachment near cell boundary
      const distToCenter = Math.sqrt((v.x - cxN) ** 2 + (v.y - cyN) ** 2);
      const nearSurface = distToCenter < (rN * 1.05) && distToCenter > (rN * 0.70);
      if (!state.infection.attached && nearSurface && rng() < attachment * 0.9 * dt) {
        v.attached = true;
        state.infection.attached = true;
        state.infection.stageT = 0;
      }

      // antiviral clears some free viruses
      if (!v.attached && rng() < antiviral * 0.035 * dt) {
        v._dead = true;
      }
    }

    state.viruses = state.viruses.filter((v) => !v._dead);

    // stage progression
    if (state.infection.attached && !state.infection.burst) {
      state.infection.stageT += dt;

      if (!state.infection.injected && state.infection.stageT > lerp(2.8, 0.9, attachment)) {
        state.infection.injected = true;
        state.infection.stageT = 0;
      } else if (state.infection.injected && !state.infection.hijacking && state.infection.stageT > 1.2) {
        state.infection.hijacking = true;
        state.infection.stageT = 0;
      }

      if (state.infection.hijacking) {
        // replication increases viral load
        const growth = lerp(0.6, 4.2, replication);
        const clearance = lerp(0.3, 2.6, antiviral);

        // keep the model moving towards lysis (even if immune effect is high)
        const net = Math.max(0.25, growth - clearance);
        state.infection.viralLoad += net * dt;
        state.infection.viralLoad = clamp(state.infection.viralLoad, 0, 120);

        // cell damage increases as viral load rises
        const damagePerSec = Math.max(0, state.infection.viralLoad - 10) * 0.05;
        state.cellHealth -= damagePerSec * dt;
        state.cellHealth = clamp(state.cellHealth, 0, 100);

        if (state.infection.viralLoad >= 100 || state.cellHealth <= 0) {
          state.infection.burst = true;
          triggerCellBurst(cell, "lysis");
          ui.statusPill.textContent = "Cell burst (lysis)";
          setPressure(100);

          // release new viruses
          const extra = 20 + Math.floor(replication * 35);
          for (let i = 0; i < extra; i++) {
            const angle = rng() * Math.PI * 2;
            const sp = 0.08 + rng() * 0.14;
            state.viruses.push({
              x: cxN + Math.cos(angle) * rN * 0.65,
              y: cyN + Math.sin(angle) * rN * 0.65,
              r: 0.006 + rng() * 0.004,
              vx: Math.cos(angle) * sp,
              vy: Math.sin(angle) * sp,
              attached: false,
            });
          }
        }
      }
    }

    // pressure meter shows viral load (or early stage)
    let p = 0;
    if (state.infection.hijacking) p = clamp(state.infection.viralLoad, 0, 100);
    else if (state.infection.injected) p = 40;
    else if (state.infection.attached) p = 20;
    setPressure(p);

    // status pill
    if (!state.infection.attached) ui.statusPill.textContent = state.running ? "Running" : "Paused";
    else if (state.infection.attached && !state.infection.injected) ui.statusPill.textContent = "Virus attached";
    else if (state.infection.injected && !state.infection.hijacking) ui.statusPill.textContent = "Genome injected";
    else if (state.infection.hijacking && !state.infection.burst) ui.statusPill.textContent = "Hijacking & copying";
  }

  function drawBacteria(w, h) {
    for (const b of state.bacteria) {
      drawParticle(b.x * w, b.y * h, b.r * Math.min(w, h), COLORS.bacteria, 10);
    }

    for (const t of state.toxins) {
      const alpha = clamp(t.life / 5.0, 0, 1);
      const fill = `rgba(255,79,216,${0.25 + alpha * 0.65})`;
      drawParticle(t.x * w, t.y * h, t.r * Math.min(w, h), fill, 12);
    }

    drawText(w, h, "Bacteria release toxins", [
      "Bacteria multiply on their own.",
      "Some release toxins (chemicals) that damage cells.",
      "More toxins in the cell area = health drops faster.",
    ]);
  }

  function drawVirus(w, h, cell) {
    const cx = cell.cx;
    const cy = cell.cy;
    const r = cell.r;

    // Draw a "machinery" ring when hijacking
    if (state.infection.hijacking && !state.infection.burst) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "rgba(111,107,255,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.75, state.t * 0.4, state.t * 0.4 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // little "ribosomes" dots
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + state.t * 0.15;
        drawParticle(cx + Math.cos(a) * r * 0.70, cy + Math.sin(a) * r * 0.70, r * 0.035, "rgba(255,211,76,0.35)", 0);
      }
    }

    for (const v of state.viruses) {
      const x = v.x * w;
      const y = v.y * h;
      const rr = v.r * Math.min(w, h);
      drawParticle(x, y, rr, COLORS.virus, 11);
      // spike-ish line
      ctx.save();
      ctx.strokeStyle = "rgba(111,107,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rr * 1.7, y);
      ctx.stroke();
      ctx.restore();
    }

    // Show injected genome line
    if (state.infection.injected && !state.infection.burst) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "rgba(255,79,216,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.05, cy - r * 0.62);
      ctx.bezierCurveTo(cx - r * 0.35, cy - r * 0.25, cx + r * 0.35, cy + r * 0.25, cx + r * 0.05, cy + r * 0.62);
      ctx.stroke();
      ctx.restore();
    }

    // Burst handled by shared cell-burst animation

    drawText(w, h, "Virus hijacks the cell", [
      "Virus attaches → injects genome → uses cell machinery.",
      "Cell builds new viruses instead of doing its job.",
      "When viral load gets high, the cell can burst.",
    ]);
  }

  function tick(dt) {
    resizeCanvasToDisplaySize();
    const w = canvas.width;
    const h = canvas.height;

    const cell = drawBackground(w, h);

    if (state.running) {
      const scaledDt = dt * state.speed;
      state.t += scaledDt;

      if (state.mode === MODE.BACTERIA) stepBacteria(scaledDt, cell);
      if (state.mode === MODE.VIRUS) stepVirus(scaledDt, cell);

      stepCellBurst(scaledDt);

      updateMeters();
    }

    // draw entities
    if (state.mode === MODE.BACTERIA) drawBacteria(w, h);
    if (state.mode === MODE.VIRUS) drawVirus(w, h, cell);

    // overlay burst animation on top of everything
    drawCellBurst(cell, w, h);
  }

  // UI wiring
  function bindRange(input, label, fmt = (v) => String(v)) {
    const update = () => {
      label.textContent = fmt(input.value);
    };
    input.addEventListener("input", update);
    update();
  }

  function initUI() {
    bindRange(ui.speed, ui.speedText, (v) => `${Number(v).toFixed(1)}×`);

    bindRange(ui.bacteriaCount, ui.bacteriaCountText, (v) => String(v));
    bindRange(ui.bacteriaGrow, ui.bacteriaGrowText, (v) => String(v));
    bindRange(ui.toxinRate, ui.toxinRateText, (v) => String(v));
    bindRange(ui.immune, ui.immuneText, (v) => String(v));

    bindRange(ui.virusDose, ui.virusDoseText, (v) => String(v));
    bindRange(ui.attachment, ui.attachmentText, (v) => String(v));
    bindRange(ui.replication, ui.replicationText, (v) => String(v));
    bindRange(ui.antiviral, ui.antiviralText, (v) => String(v));

    ui.speed.addEventListener("input", () => {
      state.speed = Number(ui.speed.value);
    });

    // Reset when changing starting counts so it matches controls
    ui.bacteriaCount.addEventListener("change", () => {
      if (state.mode === MODE.BACTERIA) reset();
    });
    ui.virusDose.addEventListener("change", () => {
      if (state.mode === MODE.VIRUS) reset();
    });

    ui.btnPause.addEventListener("click", () => {
      state.running = !state.running;
      ui.btnPause.textContent = state.running ? "Pause" : "Resume";
      ui.statusPill.textContent = state.running ? "Running" : "Paused";
    });

    ui.btnReset.addEventListener("click", () => {
      state.running = true;
      ui.btnPause.textContent = "Pause";
      reset();
    });

    ui.tabBacteria.addEventListener("click", () => setMode(MODE.BACTERIA));
    ui.tabVirus.addEventListener("click", () => setMode(MODE.VIRUS));

    // keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
        ui.btnPause.click();
      }
      if (e.key.toLowerCase() === "r") {
        ui.btnReset.click();
      }
      if (e.key.toLowerCase() === "b") {
        setMode(MODE.BACTERIA);
      }
      if (e.key.toLowerCase() === "v") {
        setMode(MODE.VIRUS);
      }
    });
  }

  // animation loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }

  initUI();
  reset();
  requestAnimationFrame(frame);
})();
