"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CalculatorConfig, CalculatorProvider } from "@/lib/calculator-config";
import type { GraphArtifact } from "@/lib/question-graph";
import { MathContent } from "@/components/math-content";

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: new (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => {
        setExpressions(expressions: { id: string; latex: string; sliderBounds?: Record<string, string> }[]): void;
        destroy?: () => void;
      };
    };
    GGBApplet?: new (params: Record<string, unknown>, useBrowserForJS?: boolean) => {
      inject: (elementId: string) => void;
    };
  }
}

interface MathToolPanelProps {
  config: CalculatorConfig;
  context: "practice-set" | "full-test";
  graphArtifacts?: GraphArtifact[];
  enabled?: boolean;
  className?: string;
}

type DesmosExpression = { id: string; latex: string; sliderBounds?: Record<string, string> };

function scriptAlreadyLoaded(src: string) {
  return Boolean(document.querySelector(`script[src="${src}"]`));
}

function loadScript(src: string) {
  if (scriptAlreadyLoaded(src)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.appendChild(script);
  });
}

function effectiveProvider(config: CalculatorConfig): CalculatorProvider {
  if (config.provider === "desmos_api" && !config.desmosApiKey) return "desmos_sat";
  return config.provider;
}

function desmosExpressions(artifacts: GraphArtifact[]) {
  return artifacts.map((artifact, index) => ({
    id: `${artifact.kind}-${index + 1}`,
    latex: artifact.latex,
  }));
}

function geogebraCommand(artifact: GraphArtifact, index: number) {
  const name = artifact.kind === "point" ? `P_${index + 1}` : `g_${index + 1}`;
  const expression = artifact.latex.replace(/\\cdot/g, "*");
  return artifact.kind === "point" ? `${name} = ${expression}` : `${name}: ${expression}`;
}

export function MathToolPanel({ config, context, graphArtifacts = [], enabled = true, className = "" }: MathToolPanelProps) {
  const allowed =
    enabled &&
    config.provider !== "none" &&
    (context === "practice-set" ? config.enabledInPracticeSets : config.enabledInFullTests);
  const provider = effectiveProvider(config);
  const artifacts = graphArtifacts;
  const needsQuestionGraphData = provider === "desmos_api" || provider === "geogebra_api" || provider === "local_2d";

  if (!allowed) return null;
  if (needsQuestionGraphData && artifacts.length === 0) return null;

  return (
    <div className={className || "mb-4"}>
      {graphArtifacts.length > 0 && <GraphArtifactList artifacts={graphArtifacts} />}
      {provider === "desmos_api" && <DesmosApiPanel config={config} artifacts={artifacts} />}
      {provider === "desmos_sat" && <IframePanel title="Graphing calculator" src={config.desmosSatUrl} />}
      {provider === "geogebra" && <IframePanel title="GeoGebra calculator" src={config.geogebraUrl} />}
      {provider === "geogebra_api" && <GeoGebraApiPanel config={config} artifacts={artifacts} />}
      {provider === "local_2d" && <Local2DPanel artifacts={artifacts} />}
      {provider === "local_3d" && <Local3DPanel />}
    </div>
  );
}

function GraphArtifactList({ artifacts }: { artifacts: GraphArtifact[] }) {
  return (
    <div className="mb-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
      <p className="mb-1 text-xs font-medium uppercase text-blue-700">Question graph data</p>
      <div className="flex flex-wrap gap-2">
        {artifacts.map((artifact) => (
          <span key={`${artifact.kind}-${artifact.label}-${artifact.latex}`} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-gray-700">
            <span className="font-medium text-gray-500">{artifact.label}:</span>
            <MathContent content={`$${artifact.latex}$`} />
          </span>
        ))}
      </div>
    </div>
  );
}

function IframePanel({ title, src }: { title: string; src: string }) {
  return (
    <iframe
      title={title}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerPolicy="no-referrer"
      className="h-64 w-full rounded border border-gray-200 bg-white"
    />
  );
}

function DesmosApiPanel({ config, artifacts }: { config: CalculatorConfig; artifacts: GraphArtifact[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const scriptUrl = `${config.desmosApiUrl}?apiKey=${encodeURIComponent(config.desmosApiKey ?? "")}`;

  useEffect(() => {
    let calculator: { setExpressions?: (expressions: DesmosExpression[]) => void; destroy?: () => void } | null = null;
    let cancelled = false;

    loadScript(scriptUrl)
      .then(() => {
        if (cancelled || !hostRef.current || !window.Desmos) return;
        calculator = new window.Desmos.GraphingCalculator(hostRef.current, {
          expressions: true,
          keypad: true,
          settingsMenu: false,
        });
        calculator.setExpressions?.(desmosExpressions(artifacts));
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      calculator?.destroy?.();
    };
  }, [artifacts, scriptUrl]);

  if (failed) return <Local2DPanel artifacts={artifacts} />;
  return <div ref={hostRef} className="h-64 w-full rounded border border-gray-200 bg-white" />;
}

function GeoGebraApiPanel({ config, artifacts }: { config: CalculatorConfig; artifacts: GraphArtifact[] }) {
  const id = useId().replace(/:/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadScript(config.geogebraDeployUrl)
      .then(() => {
        if (cancelled || !window.GGBApplet) return;
        const applet = new window.GGBApplet(
          {
            appName: config.geogebraAppName,
            width: 760,
            height: 256,
            showToolBar: false,
            showAlgebraInput: true,
            showMenuBar: false,
            appletOnLoad(api: { evalCommand?: (command: string) => void }) {
              artifacts.forEach((artifact, index) => api.evalCommand?.(geogebraCommand(artifact, index)));
            },
          },
          true
        );
        applet.inject(id);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [artifacts, config.geogebraAppName, config.geogebraDeployUrl, id]);

  if (failed) return <Local2DPanel artifacts={artifacts} />;
  return <div id={id} className="h-64 w-full overflow-hidden rounded border border-gray-200 bg-white" />;
}

function parsePoint(latex: string) {
  const match = latex.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function parseLine(latex: string) {
  const match = latex.replace(/\s+/g, "").match(/^y=([+-]?\d*(?:\.\d+)?)?x([+-]\d+(?:\.\d+)?)?$/);
  if (!match) return null;
  const rawSlope = match[1];
  const slope = rawSlope === "" || rawSlope === "+" || rawSlope === undefined ? 1 : rawSlope === "-" ? -1 : Number(rawSlope);
  return { m: slope, b: Number(match[2] ?? 0) };
}

function Local2DPanel({ artifacts }: { artifacts: GraphArtifact[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    const scale = 24;
    const artifactLines = artifacts.map((artifact) => parseLine(artifact.latex)).filter((line): line is { m: number; b: number } => Boolean(line));
    const artifactPoints = artifacts.map((artifact) => parsePoint(artifact.latex)).filter((point): point is { x: number; y: number } => Boolean(point));

    const colors = ["#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#ea580c"];
    artifactLines.forEach((line, index) => {
      ctx.strokeStyle = colors[index % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = 0; px < width; px += 1) {
        const x = (px - width / 2) / scale;
        const yValue = line.m * x + line.b;
        const y = height / 2 - yValue * scale;
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    });
    artifactPoints.forEach((point) => {
      const px = width / 2 + point.x * scale;
      const py = height / 2 - point.y * scale;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [artifacts]);

  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <canvas ref={canvasRef} width={760} height={210} className="h-52 w-full rounded bg-white" />
    </div>
  );
}

function Local3DPanel() {
  const points = useMemo(() => {
    const items: { x: number; y: number; z: number }[] = [];
    for (let ix = -6; ix <= 6; ix += 1) {
      for (let iy = -6; iy <= 6; iy += 1) {
        const x = ix / 6;
        const y = iy / 6;
        const z = Math.sin(ix * 0.8) * Math.cos(iy * 0.8);
        items.push({ x, y, z });
      }
    }
    return items;
  }, []);

  return (
    <div className="relative h-64 overflow-hidden rounded border border-gray-200 bg-white [perspective:720px]">
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d] [transform:rotateX(62deg)_rotateZ(42deg)]">
        {points.map((point, index) => (
          <span
            key={`${point.x}-${point.y}-${index}`}
            className="absolute h-1.5 w-1.5 rounded-full bg-blue-600"
            style={{
              left: `${50 + point.x * 42}%`,
              top: `${50 + point.y * 42}%`,
              transform: `translateZ(${point.z * 52}px)`,
              opacity: 0.45 + (point.z + 1) * 0.25,
            }}
          />
        ))}
      </div>
    </div>
  );
}
