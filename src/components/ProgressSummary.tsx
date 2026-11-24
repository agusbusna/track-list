import { useMemo } from "react";
import { monthKey, todayStr } from "../lib/dates.js";
import { computeMonthlyStats } from "../lib/stats.js";
import { diffClass, fmtHM } from "../lib/fmt.js";
import type { AppData } from "../types.js";
import WeightChart from "./WeightChart.jsx";

interface ProgressSummaryProps {
    data: AppData;
}

/**
 * Resumen del mes (tarjetas de peso y celular) + gráfico de evolución del peso.
 * Se muestra en la pestaña Progreso y, en pantallas anchas, en el panel lateral de "Hoy".
 */
export default function ProgressSummary({ data }: ProgressSummaryProps) {
    const months = useMemo(() => computeMonthlyStats(data), [data]);
    const currentMonth = months.find((m) => m.key === monthKey(todayStr()));
    const thisMonth = currentMonth || (months.length ? months[months.length - 1] : null);

    const goalW = data.settings.weightGoal;
    const goalP = data.settings.phoneGoal;

    const weightDiff = thisMonth && thisMonth.avgWeight != null
        ? Number((thisMonth.avgWeight - goalW).toFixed(1))
        : null;
    const phoneDiff = thisMonth && thisMonth.avgPhone != null
        ? Math.round(thisMonth.avgPhone - goalP)
        : null;

    return (
        <>
            <div className="stat-row">
                <div className="stat-card">
                    <div className="lbl">Peso prom. este mes</div>
                    <div className="big num">
                        {thisMonth && thisMonth.avgWeight != null ? `${thisMonth.avgWeight.toFixed(1)} kg` : "—"}
                    </div>
                    {weightDiff != null && (
                        <div className={`diff ${diffClass(weightDiff, 0.05)}`}>
                            {weightDiff > 0 ? "+" : ""}{weightDiff} kg vs objetivo
                        </div>
                    )}
                </div>
                <div className="stat-card">
                    <div className="lbl">Celular prom. este mes</div>
                    <div className="big num">
                        {thisMonth && thisMonth.avgPhone != null ? fmtHM(thisMonth.avgPhone) : "—"}
                    </div>
                    {phoneDiff != null && (
                        <div className={`diff ${diffClass(phoneDiff, 1)}`}>
                            {phoneDiff > 0 ? "+" : ""}{phoneDiff} min vs objetivo
                        </div>
                    )}
                </div>
            </div>

            <div className="chart-wrap">
                <div className="chart-title">Evolución del peso</div>
                <WeightChart data={data} />
            </div>
        </>
    );
}
