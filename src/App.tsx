import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { addDays, todayStr, uid } from "./lib/dates.js";
import {
    downloadJson,
    emptyEntry,
    loadData,
    removeHabitFromEntries,
    saveData,
    subscribeToExternalChanges
} from "./lib/storage.js";
import HoyTab from "./components/HoyTab.jsx";
import ProgresoTab from "./components/ProgresoTab.jsx";
import HabitosTab from "./components/HabitosTab.jsx";
import ProgressSummary from "./components/ProgressSummary.jsx";
import { IconHabitos, IconHoy, IconProgreso } from "./components/Icons.jsx";
import { useMediaQuery } from "./lib/useMediaQuery.js";
import type { AppData, DayEntry, HabitType, Settings, TabId } from "./types.js";

interface TabDef {
    id: TabId;
    label: string;
    Icon: ComponentType;
}

const TABS: TabDef[] = [
    { id: "hoy", label: "Hoy", Icon: IconHoy },
    { id: "progreso", label: "Progreso", Icon: IconProgreso },
    { id: "habitos", label: "Hábitos", Icon: IconHabitos }
];

/** Pantallas de compu: "Hoy" pasa a dos columnas con el resumen de progreso al lado. */
const WIDE_QUERY = "(min-width: 900px)";

export default function App() {
    const [data, setData] = useState<AppData>(loadData);
    const [tab, setTab] = useState<TabId>("hoy");
    const [currentDate, setCurrentDate] = useState<string>(todayStr);
    const [saveError, setSaveError] = useState(false);

    const isWide = useMediaQuery(WIDE_QUERY);

    const contentRef = useRef<HTMLElement>(null);
    const isFirstRender = useRef(true);

    // Últimos datos, para poder guardarlos de inmediato al cerrar la pestaña.
    const dataRef = useRef<AppData>(data);
    dataRef.current = data;

    const persist = () => setSaveError(!saveData(dataRef.current));

    // Guardado con debounce: solo después del primer render.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return undefined;
        }
        const timer = setTimeout(persist, 350);
        return () => clearTimeout(timer);
    }, [data]);

    // Si se cierra o se pone en segundo plano la pestaña, no se pierde lo pendiente.
    useEffect(() => {
        const flush = () => saveData(dataRef.current);
        const onVisibility = () => {
            if (document.visibilityState === "hidden") flush();
        };
        window.addEventListener("pagehide", flush);
        window.addEventListener("beforeunload", flush);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("pagehide", flush);
            window.removeEventListener("beforeunload", flush);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    // Otros cambios hechos desde otra pestaña del mismo navegador.
    useEffect(() => subscribeToExternalChanges(() => setData(loadData())), []);

    // Al cambiar de pestaña, el contenido arranca scrolleado arriba.
    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [tab]);

    const updateEntry = (date: string, patch: Partial<DayEntry>) => {
        setData((prev) => {
            const current = prev.entries[date] || emptyEntry();
            return { ...prev, entries: { ...prev.entries, [date]: { ...current, ...patch } } };
        });
    };

    const navigate = useCallback((delta: number | "today") => {
        setCurrentDate((d) => (delta === "today" ? todayStr() : addDays(d, Number(delta))));
    }, []);

    const handlers = {
        toggleHabit: (date: string, habitId: string) => {
            setData((prev) => {
                const current = prev.entries[date] || emptyEntry();
                const habits = { ...current.habits };
                habits[habitId] = !habits[habitId];
                return { ...prev, entries: { ...prev.entries, [date]: { ...current, habits } } };
            });
        },
        setWeight: (date: string, weight: number | null) => updateEntry(date, { weight }),
        setPhoneMinutes: (date: string, phoneMinutes: number | null) => updateEntry(date, { phoneMinutes }),
        deleteDay: (date: string) => {
            setData((prev) => {
                const entries = { ...prev.entries };
                delete entries[date];
                return { ...prev, entries };
            });
        },
        addHabit: (name: string, type: HabitType) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            setData((prev) => ({
                ...prev,
                habits: [...prev.habits, { id: uid(), name: trimmed, type }]
            }));
        },
        deleteHabit: (habitId: string) => {
            setData((prev) => ({
                ...prev,
                habits: prev.habits.filter((h) => h.id !== habitId),
                entries: removeHabitFromEntries(prev.entries, habitId)
            }));
        },
        setGoal: (key: keyof Settings, value: number) => {
            setData((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
        },
        importData: (nextData: AppData) => setData(nextData),
        exportData: () => downloadJson(data)
    };

    const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

    return (
        <div id="app">
            <header className="topbar">
                <h1>Seguimiento</h1>
                <span className="tag">{activeTab.label}</span>
            </header>

            <main id="app-content" ref={contentRef}>
                {saveError && (
                    <div className="form-error" role="alert">
                        No se pudieron guardar los datos: el almacenamiento del navegador está lleno o bloqueado.{" "}
                        <button type="button" className="text-btn" onClick={persist}>
                            Intentar guardar de nuevo
                        </button>
                    </div>
                )}
                {tab === "hoy" && (
                    <div className="hoy-layout">
                        <div className="hoy-main">
                            <HoyTab
                                data={data}
                                date={currentDate}
                                onNavigate={navigate}
                                onToggleHabit={handlers.toggleHabit}
                                onWeight={handlers.setWeight}
                                onPhoneMinutes={handlers.setPhoneMinutes}
                                onDeleteDay={handlers.deleteDay}
                                onGoToHabits={() => setTab("habitos")}
                            />
                        </div>
                        {isWide && (
                            <aside className="hoy-side" aria-label="Resumen de progreso">
                                <div className="section-label">Progreso</div>
                                <ProgressSummary data={data} />
                            </aside>
                        )}
                    </div>
                )}
                {tab === "progreso" && <ProgresoTab data={data} />}
                {tab === "habitos" && (
                    <HabitosTab
                        data={data}
                        onAddHabit={handlers.addHabit}
                        onDeleteHabit={handlers.deleteHabit}
                        onSetGoal={handlers.setGoal}
                        onExport={handlers.exportData}
                        onImport={handlers.importData}
                    />
                )}
            </main>

            <nav className="bottom-nav" aria-label="Secciones">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        className={tab === id ? "active" : ""}
                        aria-current={tab === id ? "page" : undefined}
                        onClick={() => setTab(id)}
                    >
                        <Icon />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}
