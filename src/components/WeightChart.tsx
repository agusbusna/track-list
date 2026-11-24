import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shortDateLabel } from "../lib/dates.js";
import { weightSeries } from "../lib/stats.js";
import type { AppData } from "../types.js";

const H = 210;
const DEFAULT_W = 340;
const MIN_W = 260;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 24;

interface Tip {
    x: number;
    y: number;
    text: string;
}

interface WeightChartProps {
    data: AppData;
}

// En el servidor no existe window: se usa el efecto común para no avisar en las pruebas.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function WeightChart({ data }: WeightChartProps) {
    const [tip, setTip] = useState<Tip | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(DEFAULT_W);

    // El SVG se dibuja en píxeles reales (sin escalar) para que el texto quede legible
    // tanto en el celular como en el panel ancho del desktop.
    useIsoLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const setFromWidth = (w: number) => {
            const next = Math.round(w);
            if (next > 0) setWidth(next);
        };
        const ro = new ResizeObserver((entries) => setFromWidth(entries[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // últimos ~3 meses de registros con peso
    const pts = useMemo(() => weightSeries(data).slice(-90), [data]);
    const goal = data.settings.weightGoal;

    // al cambiar los datos, el tooltip viejo ya no corresponde
    useEffect(() => {
        setTip(null);
    }, [pts]);

    if (pts.length < 2) {
        return <div className="chart-empty">Cargá el peso de al menos dos días para ver la curva.</div>;
    }

    const W = Math.max(MIN_W, width);
    const vals = pts.map((p) => p.w);
    let min = Math.min(...vals, goal);
    let max = Math.max(...vals, goal);
    if (max - min < 1) {
        min -= 1;
        max += 1;
    }
    const rangePad = (max - min) * 0.15;
    min -= rangePad;
    max += rangePad;

    const x = (i: number) => PAD_L + (W - PAD_L - PAD_R) * (i / (pts.length - 1));
    const y = (v: number) => H - PAD_B - (H - PAD_T - PAD_B) * ((v - min) / (max - min));

    const TICKS = 4;
    const grid = Array.from({ length: TICKS + 1 }, (_, i) => {
        const v = min + (max - min) * (i / TICKS);
        return { v, ty: y(v) };
    });

    const labelIdxs = pts.length > 2
        ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1]
        : [0, pts.length - 1];

    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${x(pts.length - 1).toFixed(1)},${H - PAD_B} L${x(0).toFixed(1)},${H - PAD_B} Z`;

    const first = pts[0];
    const last = pts[pts.length - 1];
    const trendDiff = Number((last.w - first.w).toFixed(1));

    const showTip = (i: number) => {
        const p = pts[i];
        setTip({ x: x(i), y: Math.max(12, y(p.w) - 12), text: `${p.w.toFixed(1)} kg · ${shortDateLabel(p.date)}` });
    };

    return (
        <div ref={wrapRef}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                role="img"
                aria-label="Gráfico de evolución del peso"
                style={{ display: "block", touchAction: "manipulation" }}
            >
                <defs>
                    <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8fbfe0" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#8fbfe0" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {grid.map(({ v, ty }) => (
                    <g key={v}>
                        <line
                            x1={PAD_L} y1={ty.toFixed(1)} x2={W - PAD_R} y2={ty.toFixed(1)}
                            stroke="#2e3440" strokeWidth="1"
                        />
                        <text
                            x={PAD_L - 6} y={(ty + 3).toFixed(1)} textAnchor="end"
                            fontSize="10" fill="#576174"
                        >
                            {v.toFixed(1)}
                        </text>
                    </g>
                ))}

                <line
                    x1={PAD_L} y1={y(goal).toFixed(1)} x2={W - PAD_R} y2={y(goal).toFixed(1)}
                    stroke="var(--gold)" strokeWidth="1" strokeDasharray="3 4" opacity="0.8"
                />
                <text
                    x={W - PAD_R} y={(y(goal) - 4).toFixed(1)} textAnchor="end"
                    fontSize="10" fill="#e3b341"
                >
                    {`objetivo ${goal} kg`}
                </text>

                <path d={areaPath} fill="url(#wgrad)" stroke="none" />
                <path d={linePath} fill="none" stroke="#8fbfe0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(pts.length - 1).toFixed(1)} cy={y(last.w).toFixed(1)} r="3.5" fill="var(--gold)" />

                {labelIdxs.map((i) => (
                    <text
                        key={i}
                        x={x(i).toFixed(1)}
                        y={H - 6}
                        textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
                        fontSize="10"
                        fill="#576174"
                    >
                        {shortDateLabel(pts[i].date)}
                    </text>
                ))}

                {pts.map((p, i) => (
                    <circle
                        key={p.date}
                        className="chart-pt"
                        cx={x(i).toFixed(1)}
                        cy={y(p.w).toFixed(1)}
                        r="9"
                        fill="transparent"
                        onMouseEnter={() => showTip(i)}
                        onMouseLeave={() => setTip(null)}
                        onClick={() => showTip(i)}
                    />
                ))}

                {tip && (
                    <text
                        x={tip.x.toFixed(1)} y={tip.y.toFixed(1)}
                        fontSize="11" fontWeight="700" fill="var(--text)" textAnchor="middle"
                        style={{ pointerEvents: "none" }}
                    >
                        {tip.text}
                    </text>
                )}
            </svg>
            <div className="chart-trend">
                {trendDiff === 0 ? "Sin cambios" : `${trendDiff > 0 ? "+" : ""}${trendDiff} kg`}
                {" desde "}{shortDateLabel(first.date)} · tocá un punto (o pasá el cursor) para ver el valor
            </div>
        </div>
    );
}
