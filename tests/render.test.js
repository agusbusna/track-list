// Renderiza cada pestaña en el servidor para detectar errores en tiempo de ejecución.
// Usa Vite para transformar los JSX, igual que el bundler.
import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import React from "react";
import assert from "node:assert";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

function render(el) {
    return renderToString(el);
}

try {
    const { default: App } = await vite.ssrLoadModule("/src/App.tsx");
    const { default: ProgresoTab } = await vite.ssrLoadModule("/src/components/ProgresoTab.tsx");
    const { default: ProgressSummary } = await vite.ssrLoadModule("/src/components/ProgressSummary.tsx");
    const { default: HabitosTab } = await vite.ssrLoadModule("/src/components/HabitosTab.tsx");
    const { addDays, todayStr } = await vite.ssrLoadModule("/src/lib/dates.ts");

    const html = render(React.createElement(App));
    assert.ok(html.includes("Seguimiento"), "falta el título");
    assert.ok(html.includes("Hoy") && html.includes("Progreso") && html.includes("Hábitos"), "faltan las pestañas");
    assert.ok(html.includes("Quiero hacer") && html.includes("Quiero evitar"), "faltan las secciones de hábitos");
    assert.ok(html.includes("Ejercicio") && html.includes("Delivery"), "faltan los hábitos por defecto");
    assert.ok(html.includes("Peso y pantalla"), "falta la tarjeta de métricas");
    assert.ok(html.includes('id="weight-input"'), "falta el input de peso");
    assert.ok(html.includes('class="hoy-layout"'), "falta el contenedor de dos columnas de \"Hoy\"");
    assert.ok(!html.includes("Eliminar datos de este día"), "no debería ofrecer borrar un día vacío");
    // En el servidor no hay pantalla: el panel lateral desktop no debe montarse.
    assert.ok(!html.includes('class="hoy-side"'), "el panel desktop no debería renderizarse sin pantalla");

    // Progreso con datos: necesita ≥2 pesos para dibujar la curva.
    const today = todayStr();
    const data = {
        habits: [
            { id: "leer", name: "Leer", type: "good" },
            { id: "delivery", name: "Delivery", type: "bad" }
        ],
        settings: { weightGoal: 75, phoneGoal: 120 },
        entries: {
            [addDays(today, -3)]: { habits: { leer: true }, weight: 79.2, phoneMinutes: 150 },
            [addDays(today, -2)]: { habits: { leer: true, delivery: true }, weight: 78.6, phoneMinutes: 210 },
            [addDays(today, -1)]: { habits: { leer: false }, weight: 78.1, phoneMinutes: 95 },
            [today]: { habits: { leer: true }, weight: 77.6, phoneMinutes: 70 }
        }
    };

    const progreso = render(React.createElement(ProgresoTab, { data }));
    assert.ok(progreso.includes("Evolución del peso"), "falta el gráfico");
    assert.ok(progreso.includes("<svg"), "no se dibujó el SVG");
    assert.ok(progreso.includes("objetivo 75 kg"), "falta la línea de objetivo");
    assert.ok(progreso.includes("month-table"), "falta la tabla de meses");
    assert.ok(progreso.includes("seguidos") || progreso.includes("sin"), "faltan las rachas");
    assert.ok(!progreso.includes("Cargá el peso"), "no debería mostrar el estado vacío con 4 pesos");

    // Progreso sin datos: estado vacío.
    const vacio = render(React.createElement(ProgresoTab, {
        data: { habits: [], settings: { weightGoal: 75, phoneGoal: 120 }, entries: {} }
    }));
    assert.ok(vacio.includes("Cargá el peso de al menos dos días"), "falta el estado vacío del gráfico");

    // El resumen del panel lateral desktop (tarjetas + gráfico).
    const resumen = render(React.createElement(ProgressSummary, { data }));
    assert.ok(resumen.includes("Evolución del peso"), "falta el gráfico en el resumen");
    assert.ok(resumen.includes("Peso prom. este mes") && resumen.includes("Celular prom. este mes"),
        "faltan las tarjetas del resumen");
    assert.ok(resumen.includes("78.4 kg"), "no se calculó el promedio del mes (78.4 kg)");

    const habitos = render(React.createElement(HabitosTab, {
        data,
        onAddHabit() {}, onDeleteHabit() {}, onSetGoal() {}, onExport() {}, onImport() {}
    }));
    assert.ok(habitos.includes("Agregar hábito"), "falta el formulario");
    assert.ok(habitos.includes("Tus datos"), "falta la sección de backup");
    assert.ok(habitos.includes("Exportar backup"), "falta el botón de exportar");
    assert.ok(habitos.includes("Importar backup"), "falta el botón de importar");
    assert.ok(habitos.includes('value="75"'), "no se cargó el peso objetivo");

    console.log("✔ App y las tres pestañas se renderizan sin errores");
} finally {
    await vite.close();
}
