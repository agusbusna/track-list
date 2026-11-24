// Pruebas de interacción con el DOM real (jsdom + Testing Library):
// tildar hábitos, cargar peso y navegar con el teclado, verificando que
// todo termine guardado en localStorage con la fecha correcta.
import { createServer } from "vite";
import { JSDOM } from "jsdom";
import assert from "node:assert";

// --- DOM de prueba (tiene que existir antes de cargar React) ---
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true
});
const { window } = dom;

function setGlobal(key, value) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

setGlobal("window", window);
setGlobal("document", window.document);
setGlobal("navigator", window.navigator);
setGlobal("localStorage", window.localStorage);
setGlobal("HTMLElement", window.HTMLElement);
setGlobal("Element", window.Element);
setGlobal("Node", window.Node);
setGlobal("getComputedStyle", window.getComputedStyle);
setGlobal("requestAnimationFrame", window.requestAnimationFrame.bind(window));
setGlobal("cancelAnimationFrame", window.cancelAnimationFrame.bind(window));

// jsdom no trae matchMedia: la app lo necesita para el modo desktop.
window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; }
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

try {
    const React = (await import("react")).default;
    const { act } = await import("react");
    const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
    const { default: App } = await vite.ssrLoadModule("/src/App.tsx");
    const { todayStr } = await vite.ssrLoadModule("/src/lib/dates.ts");

    const today = todayStr();
    const readSaved = () => JSON.parse(window.localStorage.getItem("app-data-v1"));

    // el guardado tiene debounce (350ms): esperamos un tick dentro de act()
    const flushSave = async () => {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 450));
        });
    };

    render(React.createElement(App));

    // --- cargar el peso del día ---
    const weightInput = screen.getByLabelText("Peso");
    await act(async () => {
        fireEvent.change(weightInput, { target: { value: "78,5" } }); // coma decimal, como se escribe acá
        fireEvent.blur(weightInput);
    });
    await flushSave();

    let saved = readSaved();
    assert.equal(saved.entries[today].weight, 78.5, "el peso tendría que guardarse en el día de hoy");
    assert.equal(
        Object.keys(saved.entries).length,
        1,
        "no deberían crearse entradas con la fecha equivocada"
    );

    // --- tildar un hábito ---
    const leerButton = screen.getByRole("button", { name: "Leer" });
    await act(async () => {
        fireEvent.click(leerButton);
    });
    await flushSave();

    saved = readSaved();
    assert.equal(saved.entries[today].habits.leer, true, "el hábito tendría que quedar tildado");

    // --- abrir y cerrar el diálogo de borrado con Escape ---
    const deleteButton = screen.getByRole("button", { name: "Eliminar datos de este día" });
    await act(async () => {
        fireEvent.click(deleteButton);
    });
    assert.ok(screen.getByRole("alertdialog"), "debería abrirse el diálogo de confirmación");

    await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" });
    });
    assert.equal(screen.queryByRole("alertdialog"), null, "Escape debería cerrar el diálogo");

    // --- cambiar de día con el teclado ---
    await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    assert.ok(
        screen.queryByRole("button", { name: /Ayer/ }),
        "con ← debería mostrarse el día anterior"
    );

    await act(async () => {
        fireEvent.keyDown(window, { key: "ArrowRight" });
        fireEvent.keyDown(window, { key: "t" });
    });
    assert.ok(
        screen.queryByRole("button", { name: /Ir a hoy/ }) === null &&
        screen.queryByRole("button", { name: "Eliminar datos de este día" }),
        "con t debería volverse a hoy (el día que tiene datos)"
    );

    cleanup();
    console.log("✔ Las pruebas de interacción pasaron");
} finally {
    await vite.close();
}
