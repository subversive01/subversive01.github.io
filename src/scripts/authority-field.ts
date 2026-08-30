const FIELD_SELECTOR = "[data-authority-field]";
const CANVAS_SELECTOR = "[data-authority-canvas]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const TRAIL_CAPACITY = 42;
const TRAIL_LIFETIME_MS = 940;

interface FieldParticle {
  x: number;
  y: number;
  depth: number;
  radius: number;
  phase: number;
  drift: number;
  tier: number;
}

interface FieldLane {
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  endX: number;
  endY: number;
  opacity: number;
}

interface TrailPoint {
  x: number;
  y: number;
  bornAt: number;
}

interface MountedField {
  pause: () => void;
  resume: () => void;
  resize: () => void;
  destroy: () => void;
}

function mulberry32(initialSeed: number): () => number {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function numericSeed(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) ? parsed : 562;
}

function mountCanvasField(host: HTMLElement, canvas: HTMLCanvasElement, seed: number): MountedField {
  const context = canvas.getContext("2d", { alpha: true })!;
  if (!context) throw new Error("Canvas2D is unavailable");

  const initialBounds = host.getBoundingClientRect();
  const initialWidth = Math.max(1, initialBounds.width);
  const compact = initialWidth < 720;
  const particleCount = compact ? 880 : initialWidth < 1180 ? 1500 : 2100;
  const random = mulberry32(seed);
  const particles: FieldParticle[] = Array.from({ length: particleCount }, (_, index) => {
    const cluster = index % 7;
    const angle = random() * Math.PI * 2 + cluster * 0.61;
    const distance = Math.pow(random(), 0.64);
    const centerX = cluster < 4 ? 0.67 : 0.49;
    const centerY = cluster % 3 === 0 ? 0.43 : cluster % 3 === 1 ? 0.59 : 0.51;
    const spreadX = 0.22 + cluster * 0.024;
    const spreadY = 0.3 - Math.min(cluster, 5) * 0.018;
    const depth = random();

    return {
      x: Math.max(0.02, Math.min(0.985, centerX + Math.cos(angle) * distance * spreadX)),
      y: Math.max(0.035, Math.min(0.97, centerY + Math.sin(angle) * distance * spreadY)),
      depth,
      radius: 0.38 + depth * 0.88,
      phase: random() * Math.PI * 2,
      drift: 0.5 + random() * 0.9,
      tier: Math.min(3, Math.floor(random() * 4))
    };
  });

  const lanes: FieldLane[] = Array.from({ length: compact ? 5 : 8 }, (_, index) => {
    const startX = 0.29 + random() * 0.35;
    const startY = 0.18 + random() * 0.65;
    const endX = Math.min(0.96, startX + 0.16 + random() * 0.22);
    const endY = Math.max(0.08, Math.min(0.92, startY + (random() - 0.5) * 0.4));
    return {
      startX,
      startY,
      controlX: (startX + endX) / 2 + (random() - 0.5) * 0.09,
      controlY: (startY + endY) / 2 + (random() - 0.5) * 0.13,
      endX,
      endY,
      opacity: 0.035 + (index % 3) * 0.018
    };
  });

  const trail: TrailPoint[] = [];
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let animationFrame = 0;
  let running = false;
  let destroyed = false;
  let lastRenderedAt = 0;
  let previousPointerX = Number.NaN;
  let previousPointerY = Number.NaN;

  function resize(): void {
    if (destroyed) return;
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw(performance.now());
  }

  function drawAmbientField(): void {
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(
      width * 0.69,
      height * 0.5,
      0,
      width * 0.69,
      height * 0.5,
      Math.max(width, height) * 0.42
    );
    glow.addColorStop(0, "rgba(255, 91, 69, 0.045)");
    glow.addColorStop(0.42, "rgba(216, 216, 210, 0.018)");
    glow.addColorStop(1, "rgba(5, 5, 5, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.lineWidth = 1;
    for (const lane of lanes) {
      context.beginPath();
      context.moveTo(lane.startX * width, lane.startY * height);
      context.quadraticCurveTo(
        lane.controlX * width,
        lane.controlY * height,
        lane.endX * width,
        lane.endY * height
      );
      context.strokeStyle = `rgba(216, 216, 210, ${lane.opacity})`;
      context.stroke();
    }
    context.restore();
  }

  function drawParticles(now: number): void {
    const time = now * 0.00012;
    const tierOpacity = compact ? [0.16, 0.28, 0.42, 0.62] : [0.18, 0.32, 0.49, 0.72];

    context.save();
    context.globalCompositeOperation = "lighter";
    for (let tier = 0; tier < tierOpacity.length; tier += 1) {
      context.beginPath();
      for (const particle of particles) {
        if (particle.tier !== tier) continue;
        const parallax = 0.3 + particle.depth * 0.7;
        const driftX = Math.sin(time * particle.drift + particle.phase) * 2.7 * parallax;
        const driftY = Math.cos(time * particle.drift * 0.73 + particle.phase) * 2.05 * parallax;
        const x = particle.x * width + driftX;
        const y = particle.y * height + driftY;
        context.moveTo(x + particle.radius, y);
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
      }
      context.fillStyle = `rgba(244, 242, 238, ${tierOpacity[tier]})`;
      context.fill();
    }
    context.restore();
  }

  function discardExpiredTrail(now: number): void {
    while (trail.length > 0) {
      const oldest = trail[trail.length - 1];
      if (now - oldest.bornAt <= TRAIL_LIFETIME_MS) break;
      trail.pop();
    }
  }

  function drawTrail(now: number): void {
    discardExpiredTrail(now);
    if (trail.length < 2) return;

    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "rgba(255, 91, 69, 0.72)";
    context.shadowBlur = 12;

    for (let index = trail.length - 1; index > 0; index -= 1) {
      const older = trail[index];
      const newer = trail[index - 1];
      const age = Math.max(0, Math.min(1, (now - newer.bornAt) / TRAIL_LIFETIME_MS));
      const positionFade = 1 - index / Math.max(1, trail.length);
      const alpha = Math.max(0, (1 - age) * (0.18 + positionFade * 0.7));

      context.beginPath();
      context.moveTo(older.x * width, older.y * height);
      context.lineTo(newer.x * width, newer.y * height);
      context.strokeStyle = `rgba(255, 91, 69, ${alpha})`;
      context.lineWidth = 0.75 + positionFade * 0.8;
      context.stroke();
    }

    const head = trail[0];
    const headAge = Math.max(0, Math.min(1, (now - head.bornAt) / TRAIL_LIFETIME_MS));
    context.beginPath();
    context.arc(head.x * width, head.y * height, 1.9, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 91, 69, ${(1 - headAge) * 0.92})`;
    context.shadowBlur = 18;
    context.fill();
    context.restore();
  }

  function draw(now: number): void {
    if (destroyed) return;
    drawAmbientField();
    drawParticles(now);
    drawTrail(now);
  }

  function render(now: number): void {
    if (!running || destroyed) return;
    animationFrame = window.requestAnimationFrame(render);

    const minimumFrameInterval = compact ? 1000 / 30 : 1000 / 60;
    if (now - lastRenderedAt < minimumFrameInterval) return;
    lastRenderedAt = now;
    draw(now);
  }

  function resume(): void {
    if (running || destroyed) return;
    running = true;
    lastRenderedAt = 0;
    animationFrame = window.requestAnimationFrame(render);
  }

  function pause(): void {
    if (!running) return;
    running = false;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function onPointerMove(event: PointerEvent): void {
    if (destroyed || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      previousPointerX = Number.NaN;
      previousPointerY = Number.NaN;
      return;
    }

    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const movedFarEnough = Number.isNaN(previousPointerX)
      || Math.hypot(normalizedX - previousPointerX, normalizedY - previousPointerY) > 0.008;
    if (!movedFarEnough) return;

    previousPointerX = normalizedX;
    previousPointerY = normalizedY;
    trail.unshift({ x: normalizedX, y: normalizedY, bornAt: performance.now() });
    if (trail.length > TRAIL_CAPACITY) trail.length = TRAIL_CAPACITY;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    pause();
    window.removeEventListener("pointermove", onPointerMove);
    trail.length = 0;
    context.clearRect(0, 0, width, height);
    canvas.width = 1;
    canvas.height = 1;
  }

  resize();
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  return { pause, resume, resize, destroy };
}

function setupAuthorityField(host: HTMLElement): void {
  if (host.dataset.authorityReady === "true") return;
  host.dataset.authorityReady = "true";

  const canvas = host.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR)!;
  if (!canvas) return;

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const seed = numericSeed(host.dataset.authoritySeed);
  let mounted: MountedField | null = null;
  let intersecting = false;
  let destroyed = false;

  function canAnimate(): boolean {
    return intersecting && !document.hidden && !reducedMotion.matches;
  }

  function syncPlayback(): void {
    if (!mounted) return;
    if (canAnimate()) mounted.resume();
    else mounted.pause();
  }

  function ensureMounted(): void {
    if (mounted || destroyed || reducedMotion.matches || !intersecting) return;
    try {
      mounted = mountCanvasField(host, canvas, seed);
      host.classList.add("is-enhanced");
      syncPlayback();
    } catch {
      mounted?.destroy();
      mounted = null;
      host.classList.remove("is-enhanced");
    }
  }

  function releaseRenderer(): void {
    mounted?.destroy();
    mounted = null;
    host.classList.remove("is-enhanced");
  }

  function onVisibilityChange(): void {
    syncPlayback();
  }

  function onMotionPreferenceChange(): void {
    if (reducedMotion.matches) releaseRenderer();
    else ensureMounted();
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      intersecting = Boolean(entry?.isIntersecting);
      if (intersecting) ensureMounted();
      syncPlayback();
    },
    { rootMargin: "120px 0px", threshold: 0.01 }
  );

  const resizeObserver = new ResizeObserver(() => mounted?.resize());

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener("change", onMotionPreferenceChange);
    window.removeEventListener("pagehide", destroy);
    releaseRenderer();
    delete host.dataset.authorityReady;
  }

  intersectionObserver.observe(host);
  resizeObserver.observe(host);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("pagehide", destroy, { once: true });
}

function bootAuthorityFields(): void {
  document.querySelectorAll<HTMLElement>(FIELD_SELECTOR).forEach(setupAuthorityField);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthorityFields, { once: true });
} else {
  bootAuthorityFields();
}
