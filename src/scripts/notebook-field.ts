const HOST_SELECTOR = "[data-notebook-field]";
const CANVAS_SELECTOR = "[data-notebook-canvas]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

interface Mark { x: number; y: number; length: number; phase: number; accent: boolean; }
interface MountedField { pause: () => void; resume: () => void; resize: () => void; destroy: () => void; }

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

function mountField(host: HTMLElement, canvas: HTMLCanvasElement, seed: number): MountedField {
  const context = canvas.getContext("2d", { alpha: true })!;
  if (!context) throw new Error("Canvas2D is unavailable");
  const random = mulberry32(seed);
  const marks: Mark[] = Array.from({ length: 23 }, (_, index) => ({
    x: random(),
    y: .16 + random() * .68,
    length: 22 + random() * 118,
    phase: random(),
    accent: index % 7 === 0
  }));

  let width = 1;
  let height = 1;
  let frame = 0;
  let running = false;
  let destroyed = false;
  let lastRenderedAt = 0;
  let compact = false;

  function draw(now: number): void {
    if (destroyed) return;
    context.clearRect(0, 0, width, height);
    const fieldCenterX = compact ? .5 : .74;
    const fieldStartX = compact ? .12 : .48;
    const fieldEndX = compact ? .88 : .94;
    const glow = context.createRadialGradient(width * fieldCenterX, height * .5, 0, width * fieldCenterX, height * .5, Math.max(width, height) * .33);
    glow.addColorStop(0, "rgba(255, 91, 69, .045)");
    glow.addColorStop(.4, "rgba(103, 32, 148, .055)");
    glow.addColorStop(1, "rgba(5, 5, 5, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    for (let row = 0; row < 8; row += 1) {
      const y = height * (.18 + row * .09);
      context.beginPath();
      context.moveTo(width * fieldStartX, y);
      context.lineTo(width * fieldEndX, y);
      context.strokeStyle = "rgba(216, 216, 210, .055)";
      context.lineWidth = 1;
      context.stroke();
    }

    marks.forEach((mark, index) => {
      const drift = Math.sin(now * .00045 + mark.phase * Math.PI * 2) * 9;
      const x = (fieldStartX + mark.x * (fieldEndX - fieldStartX)) * width + drift;
      const y = mark.y * height;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(Math.min(width * (compact ? .92 : .96), x + mark.length), y);
      context.strokeStyle = mark.accent ? "rgba(255, 91, 69, .38)" : "rgba(216, 216, 210, .14)";
      context.lineWidth = mark.accent ? 1.2 : .8;
      context.stroke();

      if (index % 3 === 0) {
        context.beginPath();
        context.arc(x - 7, y, mark.accent ? 2.2 : 1.3, 0, Math.PI * 2);
        context.fillStyle = mark.accent ? "rgba(255, 91, 69, .82)" : "rgba(244, 242, 238, .5)";
        context.fill();
      }
    });

    const progress = (now * .000075) % 1;
    const traceX = width * ((compact ? .14 : .5) + progress * (compact ? .72 : .43));
    const traceY = height * (.37 + Math.sin(progress * Math.PI * 2) * .16);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.beginPath();
    context.arc(traceX, traceY, 2.2, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 91, 69, .9)";
    context.shadowColor = "rgba(255, 91, 69, .72)";
    context.shadowBlur = 14;
    context.fill();
    context.restore();
  }

  function render(now: number): void {
    if (!running || destroyed) return;
    frame = window.requestAnimationFrame(render);
    if (now - lastRenderedAt < FRAME_INTERVAL_MS) return;
    lastRenderedAt = now;
    draw(now);
  }
  function resume(): void { if (!running && !destroyed) { running = true; frame = window.requestAnimationFrame(render); } }
  function pause(): void { if (running) { running = false; window.cancelAnimationFrame(frame); frame = 0; } }
  function resize(): void {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    compact = width < 720;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(performance.now());
  }
  function destroy(): void { destroyed = true; pause(); context.clearRect(0, 0, width, height); }
  resize();
  return { pause, resume, resize, destroy };
}

function setup(host: HTMLElement): void {
  if (host.dataset.notebookReady === "true") return;
  host.dataset.notebookReady = "true";
  const canvas = host.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR)!;
  if (!canvas) return;
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const parsedSeed = Number.parseInt(host.dataset.notebookSeed ?? "2608", 10);
  let mounted: MountedField | null = null;
  let intersecting = false;

  const sync = (): void => {
    if (!mounted) return;
    intersecting && !document.hidden && !reducedMotion.matches ? mounted.resume() : mounted.pause();
  };
  const ensure = (): void => {
    if (mounted || !intersecting || reducedMotion.matches) return;
    try { mounted = mountField(host, canvas, Number.isSafeInteger(parsedSeed) ? parsedSeed : 2608); host.classList.add("is-enhanced"); sync(); }
    catch { mounted = null; host.classList.remove("is-enhanced"); }
  };
  const release = (): void => { mounted?.destroy(); mounted = null; host.classList.remove("is-enhanced"); };
  const onVisibility = (): void => sync();
  const onMotion = (): void => { if (reducedMotion.matches) release(); else ensure(); };
  const intersectionObserver = new IntersectionObserver((entries) => { intersecting = Boolean(entries[0]?.isIntersecting); ensure(); sync(); }, { rootMargin: "120px 0px", threshold: .01 });
  const resizeObserver = new ResizeObserver(() => mounted?.resize());
  const destroy = (): void => {
    intersectionObserver.disconnect(); resizeObserver.disconnect(); release();
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotion);
    delete host.dataset.notebookReady;
  };
  intersectionObserver.observe(host);
  resizeObserver.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotion);
  window.addEventListener("pagehide", destroy, { once: true });
}

function boot(): void { document.querySelectorAll<HTMLElement>(HOST_SELECTOR).forEach(setup); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();

export {};
