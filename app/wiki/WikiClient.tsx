"use client";

import { PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";

export type WikiEntry = {
  path: string;
  slug: string;
  title: string;
  type: string;
  tags: string[];
  updated: string;
  summary: string;
  lines: number;
  links: string[];
};

type GraphNode = WikiEntry & { x: number; y: number; z: number; radius: number };
type ProjectedNode = GraphNode & { screenX: number; screenY: number; scale: number; depth: number; visible: boolean };

const TYPE_STYLES: Record<string, { dot: string; ring: string }> = {
  entity: { dot: "#38bdf8", ring: "rgba(56,189,248,0.35)" },
  concept: { dot: "#a78bfa", ring: "rgba(167,139,250,0.35)" },
  session: { dot: "#f59e0b", ring: "rgba(245,158,11,0.35)" },
  query: { dot: "#22c55e", ring: "rgba(34,197,94,0.35)" },
  audit: { dot: "#fb7185", ring: "rgba(251,113,133,0.35)" },
};

function styleFor(type: string) {
  return TYPE_STYLES[type] || { dot: "#94a3b8", ring: "rgba(148,163,184,0.3)" };
}

function prettyFolder(path: string) {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "root";
}

function projectNode(node: GraphNode, rotation: { x: number; y: number }, mode: "local" | "global", zoom: number): ProjectedNode {
  const cx = 420;
  const cy = 260;
  if (mode === "local") {
    return { ...node, screenX: node.x, screenY: node.y, scale: 1, depth: 0, visible: true };
  }

  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const x1 = node.x * cosY - node.z * sinY;
  const z1 = node.x * sinY + node.z * cosY;
  const y1 = node.y * cosX - z1 * sinX;
  const z2 = node.y * sinX + z1 * cosX;
  const perspective = 700;
  const scale = (perspective / (perspective + z2 + 260)) * zoom;

  return {
    ...node,
    screenX: cx + x1 * scale,
    screenY: cy + y1 * scale,
    scale,
    depth: z2,
    visible: scale > 0.35,
  };
}

export default function WikiClient({ entries }: { entries: WikiEntry[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selectedPath, setSelectedPath] = useState(entries[0]?.path || "");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [graphMode, setGraphMode] = useState<"local" | "global">("local");
  const [graphFocus, setGraphFocus] = useState(false);
  const [rotation, setRotation] = useState({ x: -0.35, y: 0.65 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef({ active: false, x: 0, y: 0, moved: false, pointers: new Map<number, { x: number; y: number }>(), pinchDistance: 0 });
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const selected = useMemo(
    () => entries.find((entry) => entry.path === selectedPath) || entries[0],
    [entries, selectedPath],
  );

  const types = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.type || prettyFolder(entry.path)))).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (type !== "all" && entry.type !== type && prettyFolder(entry.path) !== type) return false;
      if (!q) return true;
      return [entry.title, entry.path, entry.summary, entry.type, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, query, type]);

  const linkedPaths = useMemo(() => {
    if (!selected) return new Set<string>();
    const incoming = entries.filter((entry) => entry.links.includes(selected.path)).map((entry) => entry.path);
    return new Set<string>([selected.path, ...selected.links, ...incoming]);
  }, [entries, selected]);

  const graphNodes = useMemo<GraphNode[]>(() => {
    const source = graphMode === "global"
      ? filtered
      : selected
        ? entries.filter((entry) => linkedPaths.has(entry.path))
        : filtered;
    const cx = 420;
    const cy = 260;
    const ordered = [...source].sort((a, b) => a.path.localeCompare(b.path));

    if (graphMode === "global") {
      const count = Math.max(1, ordered.length);
      return ordered.map((entry, i) => {
        const active = entry.path === selected?.path;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const y = 1 - (i / Math.max(1, count - 1)) * 2;
        const radius = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * i;
        const shell = 230 + Math.min(90, count * 0.8);
        return {
          ...entry,
          x: Math.cos(theta) * radius * shell,
          y: y * shell * 0.78,
          z: Math.sin(theta) * radius * shell,
          radius: active ? 15 : entry.links.length > 6 ? 9 : 6,
        };
      });
    }

    const center = ordered.find((entry) => entry.path === selected?.path);
    const others = ordered.filter((entry) => entry.path !== selected?.path);
    const nodes: GraphNode[] = [];
    if (center) nodes.push({ ...center, x: cx, y: cy, z: 0, radius: 16 });
    others.forEach((entry, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(1, others.length);
      const ring = i < 16 ? 155 : 220;
      nodes.push({
        ...entry,
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring,
        z: 0,
        radius: entry.links.length > 5 ? 11 : 8,
      });
    });
    return nodes;
  }, [entries, filtered, graphMode, linkedPaths, selected]);

  const projectedNodes = useMemo(() => {
    return graphNodes
      .map((node) => projectNode(node, rotation, graphMode, zoom))
      // Draw far nodes first and near nodes last, so click targets and labels
      // match what Nathan can actually see in the 3D graph.
      .sort((a, b) => b.depth - a.depth);
  }, [graphMode, graphNodes, rotation, zoom]);

  const graphByPath = useMemo(() => new Map(projectedNodes.map((node) => [node.path, node])), [projectedNodes]);

  const backlinks = useMemo(() => {
    if (!selected) return [];
    return entries.filter((entry) => entry.links.includes(selected.path)).map((entry) => entry.path);
  }, [entries, selected]);

  useEffect(() => {
    if (!selectedPath) return;
    entryButtonRefs.current.get(selectedPath)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedPath]);

  useEffect(() => {
    if (!selected?.path) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/wiki/file?path=${encodeURIComponent(selected.path)}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setContent(data.content || "");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message || "Could not load file");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selected?.path]);

  function setGlobalMode() {
    setGraphMode("global");
  }

  const graphControls = (
    <div className="flex items-center gap-2">
      <div className="flex rounded-full border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
        <button
          type="button"
          onClick={() => setGraphMode("local")}
          className={`rounded-full px-2 py-1 ${graphMode === "local" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Local
        </button>
        <button
          type="button"
          onClick={setGlobalMode}
          className={`rounded-full px-2 py-1 ${graphMode === "global" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Global 3D
        </button>
      </div>
      {graphMode === "global" ? (
        <div className="flex rounded-full border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.45, value * 0.86))} className="rounded-full px-2 py-1 text-slate-400 hover:text-white" title="Zoom out">−</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2.8, value * 1.16))} className="rounded-full px-2 py-1 text-slate-400 hover:text-white" title="Zoom in">+</button>
        </div>
      ) : null}
      {!graphFocus ? (
        <button
          type="button"
          onClick={() => { setGlobalMode(); setGraphFocus(true); }}
          className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-indigo-400 hover:text-white"
        >
          Focus
        </button>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800/80 bg-slate-950/95 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Knowledge graph</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Wiki</h1>
            <p className="mt-1 text-sm text-slate-400">Browse files, follow wikilinks, and see how the knowledge base connects.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, path, summary..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 sm:w-80"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400"
            >
              <option value="all">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-100px)] grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_420px]">
        <aside className="border-b border-slate-800 bg-slate-950 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
            <span>{filtered.length} files</span>
            <span>{entries.length} total</span>
          </div>
          <div className="scroll-pretty max-h-[42vh] overflow-y-auto px-3 pb-3 xl:max-h-[calc(100vh-156px)]">
            {filtered.map((entry) => {
              const active = entry.path === selected?.path;
              const style = styleFor(entry.type);
              return (
                <button
                  key={entry.path}
                  type="button"
                  ref={(el) => {
                    if (el) entryButtonRefs.current.set(entry.path, el);
                    else entryButtonRefs.current.delete(entry.path);
                  }}
                  onClick={() => setSelectedPath(entry.path)}
                  className={`mb-2 w-full rounded-xl border p-3 text-left transition-colors ${
                    active ? "border-indigo-500/70 bg-indigo-500/10" : "border-slate-800 bg-slate-900/45 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.dot, boxShadow: `0 0 0 4px ${style.ring}` }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{entry.title}</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">{entry.path}</div>
                    </div>
                  </div>
                  {entry.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{entry.summary}</p> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 border-b border-slate-800 xl:border-b-0 xl:border-r">
          {graphFocus ? (
            <div className="flex h-full min-h-[calc(100vh-100px)] flex-col bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Global wiki graph</h2>
                  <p className="text-xs text-slate-500">Drag to spin. Mouse wheel or pinch to zoom. Click a node to open its details and links.</p>
                </div>
                <div className="flex items-center gap-2">
                  {graphControls}
                  <button
                    type="button"
                    onClick={() => setGraphFocus(false)}
                    className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 hover:text-white"
                  >
                    Close graph
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <div className="h-full min-h-0">
                  <GraphCanvas
                    graphMode={graphMode}
                    nodes={projectedNodes}
                    byPath={graphByPath}
                    selectedPath={selected?.path || ""}
                    rotation={rotation}
                    setRotation={setRotation}
                    zoom={zoom}
                    setZoom={setZoom}
                    dragRef={dragRef}
                    onSelect={setSelectedPath}
                    className="h-[52vh] min-h-[420px] xl:h-[calc(100vh-190px)] xl:min-h-[560px]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-700 px-2 py-1">{selected?.type || "wiki"}</span>
                  {selected?.updated ? <span>Updated {selected.updated}</span> : null}
                  {selected?.lines ? <span>{selected.lines} lines</span> : null}
                  <span>{selected?.links.length || 0} links out</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">{selected?.title}</h2>
                <p className="mt-1 break-all text-xs text-slate-500">{selected?.path}</p>
              </div>

              <div className="scroll-pretty max-h-[52vh] overflow-y-auto p-4 xl:max-h-[calc(100vh-194px)]">
                {error ? <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}
                {loading ? <div className="text-sm text-slate-500">Loading file...</div> : null}
                {!loading && !error ? (
                  <pre className="whitespace-pre-wrap break-words rounded-2xl border border-slate-800 bg-slate-900/50 p-4 font-mono text-xs leading-6 text-slate-200">
                    {content}
                  </pre>
                ) : null}
              </div>
            </>
          )}
        </section>

        <aside className="bg-slate-950">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Connection map</h3>
              {graphControls}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {graphMode === "global" ? "Full wiki graph. Wheel/pinch or +/- to zoom; click a node for details and links." : "Centres on the selected file. Click a node to jump."}
            </p>
          </div>
          <div className="p-3">
            <GraphCanvas
              graphMode={graphMode}
              nodes={projectedNodes}
              byPath={graphByPath}
              selectedPath={selected?.path || ""}
              rotation={rotation}
              setRotation={setRotation}
              zoom={zoom}
              setZoom={setZoom}
              dragRef={dragRef}
              onSelect={setSelectedPath}
              className="h-[300px] xl:h-[360px]"
            />
          </div>

          <div className="grid gap-3 px-3 pb-4">
            <NodeInfo selected={selected} entries={entries} backlinks={backlinks} onSelect={setSelectedPath} compact />
          </div>
        </aside>
      </div>
    </main>
  );
}

function GraphCanvas({
  graphMode,
  nodes,
  byPath,
  selectedPath,
  setRotation,
  zoom,
  setZoom,
  dragRef,
  onSelect,
  className,
}: {
  graphMode: "local" | "global";
  nodes: ProjectedNode[];
  byPath: Map<string, ProjectedNode>;
  selectedPath: string;
  rotation: { x: number; y: number };
  setRotation: (updater: (value: { x: number; y: number }) => { x: number; y: number }) => void;
  zoom: number;
  setZoom: (updater: (value: number) => number) => void;
  dragRef: React.MutableRefObject<{ active: boolean; x: number; y: number; moved: boolean; pointers: Map<number, { x: number; y: number }>; pinchDistance: number }>;
  onSelect: (path: string) => void;
  className: string;
}) {
  function clampZoom(value: number) {
    return Math.max(0.45, Math.min(2.8, value));
  }

  function pointerDistance() {
    const points = Array.from(dragRef.current.pointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function startDrag(e: PointerEvent<SVGSVGElement>) {
    if (graphMode !== "global") return;
    dragRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragRef.current.pointers.size >= 2) {
      dragRef.current.active = false;
      dragRef.current.pinchDistance = pointerDistance();
    } else {
      dragRef.current.active = true;
      dragRef.current.x = e.clientX;
      dragRef.current.y = e.clientY;
      dragRef.current.moved = false;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent<SVGSVGElement>) {
    if (graphMode !== "global") return;
    dragRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (dragRef.current.pointers.size >= 2) {
      const nextDistance = pointerDistance();
      if (dragRef.current.pinchDistance && nextDistance) {
        const ratio = nextDistance / dragRef.current.pinchDistance;
        if (Math.abs(ratio - 1) > 0.01) {
          dragRef.current.moved = true;
          setZoom((value) => clampZoom(value * ratio));
        }
      }
      dragRef.current.pinchDistance = nextDistance;
      return;
    }

    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    // Give taps a little tolerance, especially on mobile. The old 2px
    // threshold made normal finger/mouse jitter count as a drag, so node taps
    // were ignored in the 3D graph.
    if (Math.abs(dx) + Math.abs(dy) > 8) dragRef.current.moved = true;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    setRotation((value) => ({
      x: Math.max(-1.35, Math.min(1.35, value.x + dy * 0.01)),
      y: value.y + dx * 0.01,
    }));
  }

  function selectNodeAtPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 840;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 520;
    let best: ProjectedNode | undefined;
    let bestDistance = Infinity;

    // visibleNodes are rendered far -> near. Hit-test from the end so the
    // frontmost visible node wins when nodes overlap in 3D.
    for (let i = visibleNodes.length - 1; i >= 0; i -= 1) {
      const node = visibleNodes[i];
      const hitRadius = Math.max(22, node.radius * node.scale + 16);
      const distance = Math.hypot(x - node.screenX, y - node.screenY);
      if (distance <= hitRadius && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }

    if (best) onSelect(best.path);
  }

  function endDrag(e: PointerEvent<SVGSVGElement>) {
    if (graphMode !== "global") return;
    const wasTap = !dragRef.current.moved && dragRef.current.pointers.size <= 1;
    if (wasTap) selectNodeAtPointer(e);
    dragRef.current.pointers.delete(e.pointerId);
    dragRef.current.active = false;
    dragRef.current.pinchDistance = 0;
    dragRef.current.moved = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture was already released by the browser.
    }
  }

  function zoomWheel(e: WheelEvent<SVGSVGElement>) {
    if (graphMode !== "global") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((value) => clampZoom(value * delta));
  }

  const visibleNodes = nodes.filter((node) => node.visible);

  return (
    <svg
      viewBox="0 0 840 520"
      onWheel={zoomWheel}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      className={`${className} w-full touch-none select-none rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.16),rgba(15,23,42,0.55)_45%,rgba(2,6,23,0.85))] ${graphMode === "global" ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {graphMode === "global" ? (
        <>
          <circle cx="420" cy="260" r="245" fill="none" stroke="rgba(148,163,184,0.16)" strokeDasharray="4 10" />
          <text x="22" y="34" fill="#94a3b8" fontSize="13">Zoom {Math.round(zoom * 100)}%</text>
        </>
      ) : null}
      {nodes.flatMap((node) =>
        node.links
          .map((target) => [node, byPath.get(target)] as const)
          .filter((pair): pair is readonly [ProjectedNode, ProjectedNode] => Boolean(pair[1]))
          .map(([from, to]) => {
            const depthOpacity = graphMode === "global" ? Math.max(0.08, Math.min(0.34, 0.2 + ((from.depth + to.depth) / 2) / 1800)) : 0.22;
            return (
              <line
                key={`${from.path}->${to.path}`}
                x1={from.screenX}
                y1={from.screenY}
                x2={to.screenX}
                y2={to.screenY}
                stroke={`rgba(148,163,184,${depthOpacity})`}
                strokeWidth={graphMode === "global" ? Math.max(0.6, (from.scale + to.scale) / 2) : 1}
              />
            );
          }),
      )}
      {visibleNodes.map((node) => {
        const active = node.path === selectedPath;
        const s = styleFor(node.type);
        const nodeRadius = node.radius * node.scale;
        const labelSize = graphMode === "global" ? Math.max(8, 12 * node.scale) : 18;
        const labelLimit = graphMode === "global" ? 14 : 18;
        return (
          <g
            key={node.path}
            onClick={() => {
              // Direct node click should work in both local and global modes.
              // Canvas pointer-up hit-testing remains as a backup for SVG tap
              // targets, but the node itself should not suppress selection.
              onSelect(node.path);
            }}
            className="cursor-pointer"
          >
            <circle cx={node.screenX} cy={node.screenY} r={nodeRadius + (active ? 7 : 4)} fill={active ? s.ring : "rgba(15,23,42,0.78)"} />
            <circle cx={node.screenX} cy={node.screenY} r={nodeRadius} fill={s.dot} />
            <text
              x={node.screenX}
              y={node.screenY + nodeRadius + 16}
              textAnchor="middle"
              fill={active ? "#e0e7ff" : "#cbd5e1"}
              fontSize={labelSize}
              fontWeight={active ? 700 : 500}
              opacity={graphMode === "global" ? Math.max(0.35, Math.min(1, node.scale * 1.2)) : 1}
            >
              {node.slug.length > labelLimit ? `${node.slug.slice(0, labelLimit - 1)}...` : node.slug}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NodeInfo({ selected, entries, backlinks, onSelect, compact = false }: { selected?: WikiEntry; entries: WikiEntry[]; backlinks: string[]; onSelect: (path: string) => void; compact?: boolean }) {
  if (!selected) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-3 text-xs text-slate-500">Select a node to see details.</div>;
  }

  return (
    <div className="scroll-pretty max-h-full overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: styleFor(selected.type).dot, boxShadow: `0 0 0 4px ${styleFor(selected.type).ring}` }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{selected.title}</div>
          <div className="mt-0.5 break-all text-[11px] text-slate-500">{selected.path}</div>
        </div>
      </div>
      {selected.summary ? <p className="mt-3 text-xs leading-5 text-slate-300">{selected.summary}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
        <span className="rounded-full border border-slate-700 px-2 py-1">{selected.type || prettyFolder(selected.path)}</span>
        <span className="rounded-full border border-slate-700 px-2 py-1">{prettyFolder(selected.path)}</span>
        {selected.updated ? <span className="rounded-full border border-slate-700 px-2 py-1">Updated {selected.updated}</span> : null}
        {selected.lines ? <span className="rounded-full border border-slate-700 px-2 py-1">{selected.lines} lines</span> : null}
        <span className="rounded-full border border-slate-700 px-2 py-1">{selected.links.length} links out</span>
        <span className="rounded-full border border-slate-700 px-2 py-1">{backlinks.length} backlinks</span>
      </div>
      {selected.tags.length && !compact ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selected.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-400">#{tag}</span>)}
        </div>
      ) : null}
      <div className="mt-3 grid gap-3">
        <RelationList title="Links out" paths={selected.links} entries={entries} onSelect={onSelect} />
        <RelationList title="Backlinks" paths={backlinks} entries={entries} onSelect={onSelect} />
      </div>
    </div>
  );
}

function RelationList({ title, paths, entries, onSelect }: { title: string; paths: string[]; entries: WikiEntry[]; onSelect: (path: string) => void }) {
  const byPath = useMemo(() => new Map(entries.map((entry) => [entry.path, entry])), [entries]);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      {paths.length ? (
        <div className="space-y-1.5">
          <div className="mb-1 text-[11px] text-slate-600">{paths.length} connection{paths.length === 1 ? "" : "s"}</div>
          {paths.slice(0, 40).map((path) => {
            const entry = byPath.get(path);
            return (
              <button key={path} type="button" onClick={() => entry && onSelect(entry.path)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800">
                {entry?.title || path}
              </button>
            );
          })}
          {paths.length > 40 ? <div className="pt-1 text-[11px] text-slate-600">Showing first 40</div> : null}
        </div>
      ) : <p className="text-xs text-slate-600">None yet.</p>}
    </div>
  );
}
