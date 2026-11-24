import { useMemo } from "react";
import { computeMonthlyStats, habitCurrentStreak, habitMonthRate } from "../lib/stats.js";
import { diffClass, fmtHM } from "../lib/fmt.js";
import type { AppData } from "../types.js";
import ProgressSummary from "./ProgressSummary.jsx";

interface DiffBadgeProps {
    diff: number | null;
    decimals: number;
    unit: string;
}

function DiffBadge({ diff, decimals, unit }: DiffBadgeProps) {
    if (diff == null) return <span className="badge zero">–</span>;
    const cls = diffClass(diff, decimals === 1 ? 0.05 : 1);
    return (
        <span className={`badge ${cls}`}>
            {diff > 0 ? "+" : ""}{diff.toFixed(decimals)} {unit}
        </span>
    );
}

interface ProgresoTabProps {
    data: AppData;
}

export default function ProgresoTab({ data }: ProgresoTabProps) {
    const months = useMemo(() => computeMonthlyStats(data), [data]);
    const goalW = data.settings.weightGoal;

    return (
        <>
            <ProgressSummary data={data} />

            {months.length > 0 && (
                <div className="chart-wrap">
                    <table className="month-table">
                        <thead>
                            <tr>
                                <th>Mes</th>
                                <th>Peso prom.</th>
                                <th>Dif.</th>
                                <th>Celu prom.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {months.slice().reverse().map((m) => (
                                <tr key={m.key}>
                                    <td>{m.label}</td>
                                    <td className="num">{m.avgWeight != null ? `${m.avgWeight.toFixed(1)} kg` : "—"}</td>
                                    <td>
                                        <DiffBadge
                                            diff={m.avgWeight != null ? Number((m.avgWeight - goalW).toFixed(1)) : null}
                                            decimals={1}
                                            unit="kg"
                                        />
                                    </td>
                                    <td className="num">{m.avgPhone != null ? fmtHM(m.avgPhone) : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data.habits.length > 0 && (
                <>
                    <div className="section-label">Hábitos — este mes</div>
                    {data.habits.map((habit) => {
                        const rate = habitMonthRate(data, habit);
                        const streak = habitCurrentStreak(data, habit);
                        const streakLabel = habit.type === "good"
                            ? `${streak} día${streak === 1 ? "" : "s"} seguidos`
                            : `${streak} día${streak === 1 ? "" : "s"} sin`;
                        return (
                            <div className="habit-stat" key={habit.id}>
                                <div className="habit-stat-top">
                                    <div className="habit-stat-name">
                                        <span className={`habit-dot ${habit.type}`} />
                                        {habit.name}
                                    </div>
                                    <div className="habit-stat-streak">{streakLabel}</div>
                                </div>
                                <div
                                    className="bar-track"
                                    role="progressbar"
                                    aria-valuenow={rate ?? 0}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={`Cumplimiento de ${habit.name} este mes`}
                                >
                                    <div className={`bar-fill ${habit.type}`} style={{ width: `${rate ?? 0}%` }} />
                                </div>
                                <div className="habit-stat-note">
                                    {rate == null ? "Sin datos este mes" : `${rate}% de cumplimiento`}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </>
    );
}
