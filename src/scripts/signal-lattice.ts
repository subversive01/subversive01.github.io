const LATTICE_SELECTOR = "[data-signal-lattice]";
const CANVAS_SELECTOR = "[data-signal-canvas]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const FRAME_INTERVAL_MS = 1000 / 30;

interface LatticeNode {
  angle: number;
  distance: number;
  radius: number;
  phase: number;
  accent: boolean;
}

interface LatticePoint {
  x: number;
  y: number;
}

interface LatticeLink {
  from: number;
  to: number;
  bend: number;
  phase: number;
  accent: boolean;
}

interface MountedLattice {
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
  return Number.isSafeInteger(parsed) ? parsed : 1108;
}

function quadraticPoint(
  start: LatticePoint,
  end: LatticePoint,
  bend: number,
  progress: number
): { x: number; y: number } {
  const startX = start.x;
  const startY = start.y;
  const endX = end.x;
  const endY = end.y;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const length = Math.max(1, Math.hypot(deltaX, deltaY));
  const controlX = (startX + endX) / 2 - (deltaY / length) * bend;
  const controlY = (startY + endY) / 2 + (deltaX / length) * bend;
  const inverse = 1 - progress;

  return {
    x: inverse * inverse * startX + 2 * inverse * progress * controlX + progress * progress * endX,
    y: inverse * inverse * startY + 2 * inverse * progress * controlY + progress * progress * endY
  };
}

function mountSignalLattice(host: HTMLElement, canvas: HTMLCanvasElement, seed: number): MountedLattice {
  const context = canvas.getContext("2d", { alpha: true })!;
  if (!context) throw new Error("Canvas2D is unavailable");

  const random = mulberry32(seed);
  const pairedNodePhases = Array.from({ length: 4 }, () => random());
  const pairedNodeRadii = [2.4, 2.1, 2.5, 2.2];
  const nodes: LatticeNode[] = [
    { angle: 0, distance: 0, radius: 3.1, phase: random(), accent: true },
    ...Array.from({ length: 8 }, (_, index) => ({
      angle: -Math.PI / 2 + index * Math.PI / 4,
      distance: 1,
      radius: pairedNodeRadii[index % 4],
      phase: pairedNodePhases[index % 4],
      accent: false
    }))
  ];
  const pairedRingPhases = Array.from({ length: 4 }, () => random());
  const pairedSpokePhases = Array.from({ length: 4 }, () => random());
  const links: LatticeLink[] = [
    ...Array.from({ length: 8 }, (_, index) => ({
      from: index + 1,
      to: ((index + 1) % 8) + 1,
      bend: 18,
      accent: index % 2 === 0,
      phase: pairedRingPhases[index % 4]
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      from: 0,
      to: index + 1,
      bend: 0,
      accent: index % 2 === 1,
      phase: pairedSpokePhases[index % 4]
    }))
  ];

  let width = 1;
  let height = 1;
  let latticeCenterX = 1;
  let latticeCenterY = 1;
  let latticeRadius = 1;
  let nodePoints: LatticePoint[] = nodes.map(() => ({ x: 1, y: 1 }));
  let animationFrame = 0;
  let running = false;
  let destroyed = false;
  let lastRenderedAt = 0;

  function drawBackdrop(now: number): void {
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(
      latticeCenterX,
      latticeCenterY,
      0,
      latticeCenterX,
      latticeCenterY,
      Math.max(width, height) * 0.36
    );
    glow.addColorStop(0, "rgba(255, 91, 69, 0.045)");
    glow.addColorStop(0.46, "rgba(216, 216, 210, 0.018)");
    glow.addColorStop(1, "rgba(5, 5, 5, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.lineWidth = 1;
    const outerRingRadius = Math.max(
      latticeRadius,
      Math.min(
        latticeRadius * 1.35,
        width - latticeCenterX - 18,
        latticeCenterX - 18,
        latticeCenterY - 18,
        height - latticeCenterY - 18
      )
    );
    const ringRadii = [latticeRadius * 0.65, latticeRadius, outerRingRadius];
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = ringRadii[ring];
      context.beginPath();
      context.arc(latticeCenterX, latticeCenterY, radius, 0, Math.PI * 2);
      context.strokeStyle = ring === 1 ? "rgba(255, 91, 69, 0.11)" : "rgba(216, 216, 210, 0.075)";
      context.stroke();
    }
    context.restore();

    const sweepOffset = Math.sin(now * 0.00022) * latticeRadius * 0.94;
    for (const sweepX of [latticeCenterX - sweepOffset, latticeCenterX + sweepOffset]) {
      const sweep = context.createLinearGradient(sweepX - 28, 0, sweepX + 28, 0);
      sweep.addColorStop(0, "rgba(255, 91, 69, 0)");
      sweep.addColorStop(0.5, "rgba(255, 91, 69, 0.03)");
      sweep.addColorStop(1, "rgba(255, 91, 69, 0)");
      context.fillStyle = sweep;
      context.fillRect(sweepX - 28, latticeCenterY - latticeRadius * 1.35, 56, latticeRadius * 2.7);
    }
  }

  function drawLink(link: LatticeLink): void {
    const start = nodePoints[link.from];
    const end = nodePoints[link.to];
    const startPoint = quadraticPoint(start, end, link.bend, 0);
    const midpoint = quadraticPoint(start, end, link.bend, 0.5);
    const endPoint = quadraticPoint(start, end, link.bend, 1);

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.quadraticCurveTo(
      2 * midpoint.x - (startPoint.x + endPoint.x) / 2,
      2 * midpoint.y - (startPoint.y + endPoint.y) / 2,
      endPoint.x,
      endPoint.y
    );
    context.lineWidth = 1;
    context.strokeStyle = link.accent
      ? "rgba(255, 91, 69, 0.12)"
      : "rgba(216, 216, 210, 0.105)";
    context.stroke();
  }

  function drawPulse(link: LatticeLink, now: number, index: number): void {
    const progress = (now * 0.000115 + link.phase + index * 0.071) % 1;
    if (!link.accent && progress > 0.72) return;

    const point = quadraticPoint(nodePoints[link.from], nodePoints[link.to], link.bend, progress);
    const tail = quadraticPoint(
      nodePoints[link.from],
      nodePoints[link.to],
      link.bend,
      Math.max(0, progress - 0.075)
    );
    const alpha = Math.sin(progress * Math.PI) * (link.accent ? 0.92 : 0.42);

    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(point.x, point.y);
    context.lineWidth = link.accent ? 1.4 : 0.8;
    context.strokeStyle = `rgba(255, 91, 69, ${alpha * 0.72})`;
    context.shadowColor = "rgba(255, 91, 69, 0.72)";
    context.shadowBlur = link.accent ? 13 : 7;
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, link.accent ? 2.15 : 1.35, 0, Math.PI * 2);
    context.fillStyle = `rgba(255, 91, 69, ${alpha})`;
    context.fill();
    context.restore();
  }

  function drawNode(node: LatticeNode, point: LatticePoint, now: number): void {
    const { x, y } = point;
    const pulse = 0.5 + Math.sin(now * 0.0012 + node.phase * Math.PI * 2) * 0.5;

    if (node.accent) {
      context.beginPath();
      context.arc(x, y, 10 + pulse * 7, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255, 91, 69, ${0.08 + pulse * 0.12})`;
      context.lineWidth = 1;
      context.stroke();
    }

    context.beginPath();
    context.arc(x, y, node.radius + pulse * 0.45, 0, Math.PI * 2);
    context.fillStyle = "rgba(9, 10, 10, 0.96)";
    context.fill();
    context.strokeStyle = node.accent
      ? "rgba(255, 91, 69, 0.92)"
      : "rgba(244, 242, 238, 0.68)";
    context.lineWidth = 1;
    context.stroke();
  }

  function draw(now: number): void {
    if (destroyed) return;
    drawBackdrop(now);
    links.forEach(drawLink);
    links.forEach((link, index) => drawPulse(link, now, index));
    nodes.forEach((node, index) => drawNode(node, nodePoints[index], now));
  }

  function render(now: number): void {
    if (!running || destroyed) return;
    animationFrame = window.requestAnimationFrame(render);
    if (now - lastRenderedAt < FRAME_INTERVAL_MS) return;
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

  function resize(): void {
    if (destroyed) return;
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    latticeCenterX = width * (width < 720 ? 0.7 : 0.72);
    latticeCenterY = height * 0.5;
    latticeRadius = Math.max(1, Math.min(width * 0.22, height * 0.29, 250));
    nodePoints = nodes.map((node) => ({
      x: latticeCenterX + Math.cos(node.angle) * node.distance * latticeRadius,
      y: latticeCenterY + Math.sin(node.angle) * node.distance * latticeRadius
    }));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw(performance.now());
  }

  function destroy(): void {
    if (destroyed) return;
    pause();
    destroyed = true;
    context.clearRect(0, 0, width, height);
    canvas.width = 1;
    canvas.height = 1;
  }

  resize();
  return { pause, resume, resize, destroy };
}

function setupSignalLattice(host: HTMLElement): void {
  if (host.dataset.signalReady === "true") return;
  host.dataset.signalReady = "true";

  const canvas = host.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR)!;
  if (!canvas) return;

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const seed = numericSeed(host.dataset.signalSeed);
  let mounted: MountedLattice | null = null;
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
      mounted = mountSignalLattice(host, canvas, seed);
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
      intersecting = Boolean(entries[0]?.isIntersecting);
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
    delete host.dataset.signalReady;
  }

  intersectionObserver.observe(host);
  resizeObserver.observe(host);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("pagehide", destroy, { once: true });
}

function bootSignalLattices(): void {
  document.querySelectorAll<HTMLElement>(LATTICE_SELECTOR).forEach(setupSignalLattice);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSignalLattices, { once: true });
} else {
  bootSignalLattices();
}

export {};
