import {
  assertVisualDataV1,
  theaterDemo,
  type PulseKind,
  type VisualLinkV1,
  type VisualNodeV1
} from "../data/visuals/demo";

const MAP_SELECTOR = "[data-theater-map]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const STEP_DURATION_MS = 1650;
const BACKDROP_POINT_COUNT = 118;

interface Point {
  x: number;
  y: number;
}

interface ResolvedLink {
  link: VisualLinkV1;
  from: VisualNodeV1;
  to: VisualNodeV1;
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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function curveControl(link: ResolvedLink, width: number, height: number): { start: Point; control: Point; end: Point } {
  const start = { x: link.from.x * width, y: link.from.y * height };
  const end = { x: link.to.x * width, y: link.to.y * height };
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.max(1, Math.hypot(deltaX, deltaY));
  const direction = stableHash(link.link.id) % 2 === 0 ? 1 : -1;
  const bend = Math.min(66, length * 0.14) * direction;

  return {
    start,
    end,
    control: {
      x: (start.x + end.x) / 2 - (deltaY / length) * bend,
      y: (start.y + end.y) / 2 + (deltaX / length) * bend
    }
  };
}

function pointOnQuadratic(start: Point, control: Point, end: Point, progress: number): Point {
  const clamped = Math.max(0, Math.min(1, progress));
  const inverse = 1 - clamped;
  return {
    x: inverse * inverse * start.x + 2 * inverse * clamped * control.x + clamped * clamped * end.x,
    y: inverse * inverse * start.y + 2 * inverse * clamped * control.y + clamped * clamped * end.y
  };
}

function pulseColor(kind: PulseKind): string {
  if (kind === "attempt") return "#ff5b45";
  if (kind === "intervention") return "#f4f2ee";
  return "#d8d8d2";
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function setupTheaterMap(host: HTMLElement): void {
  if (host.dataset.theaterReady === "true") return;
  host.dataset.theaterReady = "true";

  assertVisualDataV1(theaterDemo);

  const canvas = host.querySelector<HTMLCanvasElement>("[data-theater-canvas]")!;
  const viewport = host.querySelector<HTMLElement>("[data-theater-viewport]")!;
  const toggleButton = host.querySelector<HTMLButtonElement>("[data-theater-toggle]")!;
  const restartButton = host.querySelector<HTMLButtonElement>("[data-theater-restart]")!;
  const stepButton = host.querySelector<HTMLButtonElement>("[data-theater-step]")!;
  const currentOutput = host.querySelector<HTMLOutputElement>("[data-theater-current]")!;
  const status = host.querySelector<HTMLElement>("[data-theater-status]")!;
  if (!canvas || !viewport || !toggleButton || !restartButton || !stepButton || !currentOutput || !status) return;

  const context = canvas.getContext("2d", { alpha: true })!;
  if (!context) return;

  const nodeById = new Map(theaterDemo.scene.nodes.map((node) => [node.id, node]));
  const resolvedLinks: ResolvedLink[] = theaterDemo.scene.links.flatMap((link) => {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    return from && to ? [{ link, from, to }] : [];
  });
  const linkById = new Map(resolvedLinks.map((link) => [link.link.id, link]));
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const random = mulberry32(theaterDemo.scene.seed);
  const backdrop = Array.from({ length: BACKDROP_POINT_COUNT }, () => ({
    x: random(),
    y: random(),
    radius: 0.35 + random() * 0.9,
    opacity: 0.06 + random() * 0.23
  }));
  const regions = Array.from({ length: 5 }, (_, regionIndex) => {
    const centerX = 0.16 + regionIndex * 0.18 + (random() - 0.5) * 0.05;
    const centerY = 0.25 + (regionIndex % 2) * 0.42 + (random() - 0.5) * 0.08;
    return Array.from({ length: 7 }, (_, pointIndex) => {
      const angle = (pointIndex / 7) * Math.PI * 2;
      const radiusX = 0.08 + random() * 0.05;
      const radiusY = 0.09 + random() * 0.06;
      return {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY
      };
    });
  });

  let width = 1;
  let height = 1;
  let step = 0;
  let progress = reducedMotion.matches ? 0.72 : 0;
  let playing = false;
  let userPaused = false;
  let intersecting = false;
  let destroyed = false;
  let animationFrame = 0;
  let lastFrameAt = 0;

  function drawBackdrop(): void {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#070808";
    context.fillRect(0, 0, width, height);

    const grid = Math.max(34, Math.min(52, width / 22));
    context.save();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(146, 153, 154, 0.065)";
    context.beginPath();
    for (let x = grid; x < width; x += grid) {
      context.moveTo(Math.round(x) + 0.5, 0);
      context.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = grid; y < height; y += grid) {
      context.moveTo(0, Math.round(y) + 0.5);
      context.lineTo(width, Math.round(y) + 0.5);
    }
    context.stroke();

    for (const region of regions) {
      context.beginPath();
      region.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fillStyle = "rgba(216, 216, 210, 0.012)";
      context.strokeStyle = "rgba(146, 153, 154, 0.09)";
      context.fill();
      context.stroke();
    }

    for (const point of backdrop) {
      context.beginPath();
      context.arc(point.x * width, point.y * height, point.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(216, 216, 210, ${point.opacity})`;
      context.fill();
    }
    context.restore();
  }

  function drawLink(resolved: ResolvedLink): void {
    const curve = curveControl(resolved, width, height);
    const isAttempt = resolved.link.kind === "attempt";
    context.save();
    context.beginPath();
    context.moveTo(curve.start.x, curve.start.y);
    context.quadraticCurveTo(curve.control.x, curve.control.y, curve.end.x, curve.end.y);
    context.strokeStyle = isAttempt ? "rgba(255, 91, 69, 0.16)" : "rgba(146, 153, 154, 0.22)";
    context.lineWidth = 1;
    context.setLineDash(isAttempt ? [2, 8] : [1, 6]);
    context.stroke();
    context.restore();
  }

  function drawTrail(curve: ReturnType<typeof curveControl>, fromProgress: number, toProgress: number, color: string): void {
    const start = Math.max(0, fromProgress);
    const end = Math.min(1, toProgress);
    if (end <= start) return;

    context.beginPath();
    const segments = 11;
    for (let index = 0; index <= segments; index += 1) {
      const amount = start + ((end - start) * index) / segments;
      const point = pointOnQuadratic(curve.start, curve.control, curve.end, amount);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = color;
    context.lineWidth = 1.3;
    context.shadowColor = color;
    context.shadowBlur = 11;
    context.stroke();
  }

  function drawPulse(resolved: ResolvedLink, kind: PulseKind, intensity: number, pulseProgress: number): void {
    const curve = curveControl(resolved, width, height);
    const color = pulseColor(kind);
    const head = pointOnQuadratic(curve.start, curve.control, curve.end, pulseProgress);
    const trailLength = 0.12 + intensity * 0.08;

    context.save();
    context.globalCompositeOperation = "lighter";
    drawTrail(curve, pulseProgress - trailLength, pulseProgress, color);

    context.beginPath();
    context.arc(head.x, head.y, 1.8 + intensity * 2.1, 0, Math.PI * 2);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 16 + intensity * 12;
    context.fill();

    if (pulseProgress > 0.86) {
      const arrival = Math.max(0, Math.min(1, (pulseProgress - 0.86) / 0.14));
      context.beginPath();
      context.arc(curve.end.x, curve.end.y, 5 + arrival * 17, 0, Math.PI * 2);
      context.strokeStyle = color;
      context.globalAlpha = 1 - arrival;
      context.lineWidth = 1.1;
      context.stroke();
    }
    context.restore();
  }

  function drawNode(node: VisualNodeV1, activeNodeIds: ReadonlySet<string>): void {
    const x = node.x * width;
    const y = node.y * height;
    const active = activeNodeIds.has(node.id);
    const compact = width < 620;

    context.save();
    context.translate(x, y);
    if (active) {
      context.beginPath();
      context.arc(0, 0, node.role === "defender" ? 24 : 17, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255, 91, 69, 0.52)";
      context.lineWidth = 1;
      context.shadowColor = "#ff5b45";
      context.shadowBlur = 14;
      context.stroke();
    }

    if (node.role === "principal") {
      context.beginPath();
      context.moveTo(0, -5);
      context.lineTo(5, 5);
      context.lineTo(-5, 5);
      context.closePath();
      context.fillStyle = "#ff5b45";
      context.fill();
    } else if (node.role === "objective") {
      context.rotate(Math.PI / 4);
      context.fillStyle = "#080909";
      context.strokeStyle = "#d8d8d2";
      context.lineWidth = 1.2;
      context.fillRect(-5.5, -5.5, 11, 11);
      context.strokeRect(-5.5, -5.5, 11, 11);
      context.rotate(-Math.PI / 4);
    } else if (node.role === "defender") {
      context.beginPath();
      context.arc(0, 0, 8, 0, Math.PI * 2);
      context.fillStyle = "#f4f2ee";
      context.fill();
      context.beginPath();
      context.arc(0, 0, 19, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255, 91, 69, 0.85)";
      context.lineWidth = 1.2;
      context.stroke();
    } else {
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fillStyle = "#92999a";
      context.fill();
    }

    context.fillStyle = active ? "rgba(244, 242, 238, 0.94)" : "rgba(216, 216, 210, 0.62)";
    context.font = `${active ? 700 : 600} ${compact ? 8 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.textBaseline = "middle";
    context.fillText(node.label, 12, -12);
    context.restore();
  }

  function render(renderProgress = progress): void {
    if (destroyed) return;
    drawBackdrop();
    resolvedLinks.forEach(drawLink);

    const pulses = theaterDemo.scene.pulses.filter((pulse) => pulse.step === step);
    const activeNodeIds = new Set<string>();
    pulses.forEach((pulse, index) => {
      const resolved = linkById.get(pulse.linkId);
      if (!resolved) return;
      activeNodeIds.add(resolved.from.id);
      activeNodeIds.add(resolved.to.id);

      const stagger = index * 0.16;
      const pulseProgress = Math.max(0, Math.min(1, renderProgress * 1.18 - stagger));
      if (pulseProgress > 0) drawPulse(resolved, pulse.kind, pulse.intensity, pulseProgress);
    });

    theaterDemo.scene.nodes.forEach((node) => drawNode(node, activeNodeIds));

    const vignette = context.createRadialGradient(width * 0.5, height * 0.48, height * 0.18, width * 0.5, height * 0.48, width * 0.68);
    vignette.addColorStop(0, "rgba(5, 5, 5, 0)");
    vignette.addColorStop(1, "rgba(5, 5, 5, 0.58)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }

  function pulseSummary(): string {
    const pulses = theaterDemo.scene.pulses.filter((pulse) => pulse.step === step);
    const attempts = pulses.filter((pulse) => pulse.kind === "attempt").length;
    const decisions = pulses.filter((pulse) => pulse.kind === "decision").length;
    const interventions = pulses.filter((pulse) => pulse.kind === "intervention").length;
    const fragments = [
      attempts ? pluralize(attempts, "attempt") : "",
      decisions ? pluralize(decisions, "decision") : "",
      interventions ? pluralize(interventions, "intervention") : ""
    ].filter(Boolean);
    return fragments.join(", ") || "no pulse events";
  }

  function updateControls(message?: string): void {
    currentOutput.value = String(step + 1);
    toggleButton.textContent = reducedMotion.matches ? "Motion off" : playing ? "Pause" : "Play";
    toggleButton.disabled = reducedMotion.matches;
    restartButton.disabled = false;
    stepButton.disabled = false;
    toggleButton.setAttribute("aria-pressed", playing ? "true" : "false");

    if (message) {
      status.textContent = message;
      return;
    }

    const state = playing ? "Playing" : "Paused";
    status.textContent = `${state}. Step ${step + 1} of ${theaterDemo.scene.steps}: ${pulseSummary()}. Symbolic, not live.`;
  }

  function stopLoop(): void {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameAt = 0;
  }

  function shouldRun(): boolean {
    return playing && intersecting && !document.hidden && !reducedMotion.matches && !destroyed;
  }

  function frame(now: number): void {
    if (!shouldRun()) {
      stopLoop();
      return;
    }

    const delta = lastFrameAt === 0 ? 0 : Math.min(80, now - lastFrameAt);
    lastFrameAt = now;
    progress += delta / STEP_DURATION_MS;

    if (progress >= 1) {
      if (step >= theaterDemo.scene.steps - 1) {
        progress = 1;
        playing = false;
        userPaused = true;
        render(1);
        updateControls(`Replay complete. Step ${theaterDemo.scene.steps} of ${theaterDemo.scene.steps}. Symbolic, not live.`);
        stopLoop();
        return;
      }

      step += 1;
      progress -= 1;
      updateControls();
    }

    render(progress);
    animationFrame = window.requestAnimationFrame(frame);
  }

  function syncLoop(): void {
    if (shouldRun()) {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(frame);
    } else {
      stopLoop();
      render(reducedMotion.matches ? 0.72 : progress);
    }
  }

  function resize(): void {
    if (destroyed) return;
    const rect = viewport.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    render(reducedMotion.matches ? 0.72 : progress);
  }

  function onToggle(): void {
    if (reducedMotion.matches) return;
    if (playing) {
      playing = false;
      userPaused = true;
      updateControls();
      syncLoop();
      return;
    }

    if (step === theaterDemo.scene.steps - 1 && progress >= 1) {
      step = 0;
      progress = 0;
    }
    playing = true;
    userPaused = false;
    updateControls();
    syncLoop();
  }

  function onRestart(): void {
    step = 0;
    progress = reducedMotion.matches ? 0.72 : 0;
    userPaused = reducedMotion.matches;
    playing = !reducedMotion.matches;
    updateControls(reducedMotion.matches
      ? `Restarted at step 1 of ${theaterDemo.scene.steps}. Motion preference is reduced; use Step for manual replay.`
      : `Restarted. Playing step 1 of ${theaterDemo.scene.steps}. Symbolic, not live.`);
    render(progress);
    syncLoop();
  }

  function onStep(): void {
    playing = false;
    userPaused = true;
    step = (step + 1) % theaterDemo.scene.steps;
    progress = 0.72;
    updateControls(`Manual step ${step + 1} of ${theaterDemo.scene.steps}: ${pulseSummary()}. Symbolic, not live.`);
    syncLoop();
  }

  function onVisibilityChange(): void {
    syncLoop();
  }

  function onMotionPreferenceChange(): void {
    playing = false;
    userPaused = true;
    progress = 0.72;
    updateControls(reducedMotion.matches
      ? `Reduced motion active. Manual step ${step + 1} of ${theaterDemo.scene.steps}.`
      : `Motion enabled. Paused at step ${step + 1} of ${theaterDemo.scene.steps}.`);
    syncLoop();
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      intersecting = Boolean(entry?.isIntersecting);
      if (intersecting && !reducedMotion.matches && !userPaused && !playing) {
        playing = true;
        updateControls();
      }
      syncLoop();
    },
    { rootMargin: "80px 0px", threshold: 0.08 }
  );

  const resizeObserver = new ResizeObserver(resize);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    playing = false;
    stopLoop();
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    toggleButton.removeEventListener("click", onToggle);
    restartButton.removeEventListener("click", onRestart);
    stepButton.removeEventListener("click", onStep);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener("change", onMotionPreferenceChange);
    window.removeEventListener("pagehide", destroy);
    toggleButton.disabled = true;
    restartButton.disabled = true;
    stepButton.disabled = true;
    context.clearRect(0, 0, width, height);
    host.classList.remove("is-enhanced");
    delete host.dataset.theaterReady;
  }

  resize();
  host.classList.add("is-enhanced");
  updateControls(reducedMotion.matches
    ? `Reduced motion active. Manual step 1 of ${theaterDemo.scene.steps}.`
    : `Ready. Step 1 of ${theaterDemo.scene.steps}. Replay starts when visible.`);
  toggleButton.addEventListener("click", onToggle);
  restartButton.addEventListener("click", onRestart);
  stepButton.addEventListener("click", onStep);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("pagehide", destroy, { once: true });
  intersectionObserver.observe(host);
  resizeObserver.observe(viewport);
}

function bootTheaterMaps(): void {
  document.querySelectorAll<HTMLElement>(MAP_SELECTOR).forEach(setupTheaterMap);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTheaterMaps, { once: true });
} else {
  bootTheaterMaps();
}
