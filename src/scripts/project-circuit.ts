const HOST_SELECTOR = "[data-project-circuit]";
const CANVAS_SELECTOR = "[data-project-canvas]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const FRAME_INTERVAL_MS = 1000 / 30;

interface CircuitNode { x: number; y: number; phase: number; accent: boolean; }
interface CircuitLink { from: number; to: number; verticalFirst: boolean; phase: number; accent: boolean; }
interface MountedCircuit { pause: () => void; resume: () => void; resize: () => void; destroy: () => void; }

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
  return Number.isSafeInteger(parsed) ? parsed : 5620;
}

function mountProjectCircuit(host: HTMLElement, canvas: HTMLCanvasElement, seed: number): MountedCircuit {
  const context = canvas.getContext("2d", { alpha: true })!;
  if (!context) throw new Error("Canvas2D is unavailable");

  const random = mulberry32(seed);
  const compact = host.getBoundingClientRect().width < 720;
  const columns = compact ? 7 : 10;
  const rows = compact ? 6 : 7;
  const startX = compact ? .1 : .42;
  const nodes: CircuitNode[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (random() < .18 && row > 0 && column > 0) continue;
      nodes.push({
        x: startX + (column / Math.max(1, columns - 1)) * (compact ? .8 : .54),
        y: .16 + (row / Math.max(1, rows - 1)) * .7,
        phase: random(),
        accent: random() > .84
      });
    }
  }

  const links: CircuitLink[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const candidates = nodes
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: Math.hypot(candidate.x - node.x, candidate.y - node.y)
      }))
      .filter(({ candidateIndex, distance }) => candidateIndex > index && distance > .02 && distance < .24)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, random() > .42 ? 2 : 1);

    for (const { candidateIndex } of candidates) {
      if (random() < .32) continue;
      links.push({
        from: index,
        to: candidateIndex,
        verticalFirst: random() > .5,
        phase: random(),
        accent: node.accent || nodes[candidateIndex].accent
      });
    }
  }

  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let frame = 0;
  let running = false;
  let destroyed = false;
  let lastRenderedAt = 0;
  let pointerX = compact ? .5 : .73;
  let pointerY = compact ? .48 : .5;
  let targetPointerX = pointerX;
  let targetPointerY = pointerY;
  let pointerActive = false;

  function linkPoints(link: CircuitLink): Array<{ x: number; y: number }> {
    const start = nodes[link.from];
    const end = nodes[link.to];
    const startPoint = { x: start.x * width, y: start.y * height };
    const endPoint = { x: end.x * width, y: end.y * height };
    const bend = link.verticalFirst
      ? { x: startPoint.x, y: endPoint.y }
      : { x: endPoint.x, y: startPoint.y };
    return [startPoint, bend, endPoint];
  }

  function pointAlong(points: Array<{ x: number; y: number }>, progress: number): { x: number; y: number } {
    const firstLength = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const secondLength = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
    const total = Math.max(1, firstLength + secondLength);
    const distance = progress * total;
    if (distance <= firstLength) {
      const ratio = firstLength ? distance / firstLength : 0;
      return { x: points[0].x + (points[1].x - points[0].x) * ratio, y: points[0].y + (points[1].y - points[0].y) * ratio };
    }
    const ratio = secondLength ? (distance - firstLength) / secondLength : 0;
    return { x: points[1].x + (points[2].x - points[1].x) * ratio, y: points[1].y + (points[2].y - points[1].y) * ratio };
  }

  function drawBackdrop(): void {
    context.clearRect(0, 0, width, height);
    const glow = context.createRadialGradient(pointerX * width, pointerY * height, 0, pointerX * width, pointerY * height, Math.max(width, height) * .3);
    glow.addColorStop(0, pointerActive ? "rgba(103, 32, 148, .12)" : "rgba(103, 32, 148, .07)");
    glow.addColorStop(.42, "rgba(255, 91, 69, .025)");
    glow.addColorStop(1, "rgba(5, 5, 5, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.lineWidth = 1;
    context.strokeStyle = "rgba(216, 216, 210, .045)";
    const spacing = compact ? 28 : 36;
    for (let x = 0; x < width; x += spacing) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 0; y < height; y += spacing) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  }

  function drawLink(link: CircuitLink): void {
    const points = linkPoints(link);
    const midpoint = pointAlong(points, .5);
    const proximity = Math.max(0, 1 - Math.hypot(midpoint.x - pointerX * width, midpoint.y - pointerY * height) / Math.max(150, width * .18));
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    context.lineTo(points[1].x, points[1].y);
    context.lineTo(points[2].x, points[2].y);
    context.lineWidth = .75 + proximity * .85;
    context.strokeStyle = link.accent
      ? `rgba(255, 91, 69, ${.12 + proximity * .34})`
      : `rgba(216, 216, 210, ${.08 + proximity * .2})`;
    context.stroke();
  }

  function drawPulse(link: CircuitLink, now: number, index: number): void {
    if (!link.accent && index % 4 !== 0) return;
    const progress = (now * .00008 + link.phase) % 1;
    const point = pointAlong(linkPoints(link), progress);
    const alpha = Math.sin(progress * Math.PI) * (link.accent ? .92 : .48);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.beginPath();
    context.arc(point.x, point.y, link.accent ? 2 : 1.3, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 91, 69, ${alpha})`;
    context.shadowColor = "rgba(255, 91, 69, .75)";
    context.shadowBlur = link.accent ? 14 : 8;
    context.fill();
    context.restore();
  }

  function drawNode(node: CircuitNode, now: number): void {
    const x = node.x * width;
    const y = node.y * height;
    const distance = Math.hypot(x - pointerX * width, y - pointerY * height);
    const proximity = pointerActive ? Math.max(0, 1 - distance / Math.max(120, width * .16)) : 0;
    const ambient = .5 + Math.sin(now * .001 + node.phase * Math.PI * 2) * .5;
    if (proximity > .05) {
      context.beginPath();
      context.arc(x, y, 7 + proximity * 18, 0, Math.PI * 2);
      context.strokeStyle = `rgba(103, 32, 148, ${proximity * .34})`;
      context.lineWidth = 1;
      context.stroke();
    }
    context.beginPath();
    context.arc(x, y, 1.6 + proximity * 1.2 + ambient * .25, 0, Math.PI * 2);
    context.fillStyle = "rgba(9, 10, 10, .96)";
    context.fill();
    context.strokeStyle = node.accent ? "rgba(255, 91, 69, .9)" : `rgba(244, 242, 238, ${.46 + proximity * .46})`;
    context.lineWidth = 1;
    context.stroke();
  }

  function drawPointerField(now: number): void {
    if (!pointerActive) return;
    const x = pointerX * width;
    const y = pointerY * height;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 18 + ring * 22 + Math.sin(now * .002 + ring) * 3;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.strokeStyle = ring === 0 ? "rgba(255, 91, 69, .28)" : "rgba(103, 32, 148, .2)";
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function draw(now: number): void {
    if (destroyed) return;
    pointerX += (targetPointerX - pointerX) * .085;
    pointerY += (targetPointerY - pointerY) * .085;
    drawBackdrop();
    links.forEach(drawLink);
    links.forEach((link, index) => drawPulse(link, now, index));
    nodes.forEach((node) => drawNode(node, now));
    drawPointerField(now);
  }

  function render(now: number): void {
    if (!running || destroyed) return;
    frame = window.requestAnimationFrame(render);
    if (now - lastRenderedAt < FRAME_INTERVAL_MS) return;
    lastRenderedAt = now;
    draw(now);
  }

  function resume(): void { if (!running && !destroyed) { running = true; lastRenderedAt = 0; frame = window.requestAnimationFrame(render); } }
  function pause(): void { if (running) { running = false; window.cancelAnimationFrame(frame); frame = 0; } }

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

  function onPointerMove(event: PointerEvent): void {
    if (destroyed || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    pointerActive = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!pointerActive || rect.width <= 0 || rect.height <= 0) return;
    targetPointerX = (event.clientX - rect.left) / rect.width;
    targetPointerY = (event.clientY - rect.top) / rect.height;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    pause();
    window.removeEventListener("pointermove", onPointerMove);
    context.clearRect(0, 0, width, height);
    canvas.width = 1;
    canvas.height = 1;
  }

  resize();
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  return { pause, resume, resize, destroy };
}

function setupProjectCircuit(host: HTMLElement): void {
  if (host.dataset.projectCircuitReady === "true") return;
  host.dataset.projectCircuitReady = "true";
  const canvas = host.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR)!;
  if (!canvas) return;
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const seed = numericSeed(host.dataset.projectSeed);
  let mounted: MountedCircuit | null = null;
  let intersecting = false;
  let destroyed = false;

  function canAnimate(): boolean { return intersecting && !document.hidden && !reducedMotion.matches; }
  function syncPlayback(): void { if (mounted) canAnimate() ? mounted.resume() : mounted.pause(); }
  function ensureMounted(): void {
    if (mounted || destroyed || reducedMotion.matches || !intersecting) return;
    try { mounted = mountProjectCircuit(host, canvas, seed); host.classList.add("is-enhanced"); syncPlayback(); }
    catch { mounted?.destroy(); mounted = null; host.classList.remove("is-enhanced"); }
  }
  function releaseRenderer(): void { mounted?.destroy(); mounted = null; host.classList.remove("is-enhanced"); }
  function onVisibilityChange(): void { syncPlayback(); }
  function onMotionPreferenceChange(): void { if (reducedMotion.matches) releaseRenderer(); else ensureMounted(); }

  const intersectionObserver = new IntersectionObserver((entries) => {
    intersecting = Boolean(entries[0]?.isIntersecting);
    if (intersecting) ensureMounted();
    syncPlayback();
  }, { rootMargin: "120px 0px", threshold: .01 });
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
    delete host.dataset.projectCircuitReady;
  }

  intersectionObserver.observe(host);
  resizeObserver.observe(host);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("pagehide", destroy, { once: true });
}

function bootProjectCircuits(): void {
  document.querySelectorAll<HTMLElement>(HOST_SELECTOR).forEach(setupProjectCircuit);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootProjectCircuits, { once: true });
else bootProjectCircuits();

export {};
