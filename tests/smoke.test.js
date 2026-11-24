// Pruebas de lógica: fechas, normalización, estadísticas y utilidades.
// Usa Vite para cargar los módulos TS, igual que el bundler.
import { createServer } from "vite";
import assert from "node:assert";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

try {
    const { addDays, fmtDate, pad, parseDate, monthKey, uid, todayStr } =
        await vite.ssrLoadModule("/src/lib/dates.ts");
    const { normalizeData, defaultData, emptyEntry, removeHabitFromEntries } =
        await vite.ssrLoadModule("/src/lib/storage.ts");
    const { fmtHM } = await vite.ssrLoadModule("/src/lib/fmt.ts");
    const {
        computeMonthlyStats, habitCurrentStreak, habitMonthRate, hasAnyData, weightSeries
    } = await vite.ssrLoadModule("/src/lib/stats.ts");

    // --- fechas ---
    assert.equal(pad(3), "03");
    assert.equal(fmtDate(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(monthKey("2026-10-08"), "2026-10");
    assert.ok(uid().length >= 6);
    assert.equal(parseDate("2026-10-08").getDate(), 8);

    // --- normalización de datos corruptos / de backup ---
    const junk = normalizeData({
        habits: [{ id: 1, name: "  Correr  ", type: "weird" }, null, { name: "" }],
        settings: { weightGoal: "abc", phoneGoal: -5 },
        entries: {
            "2026-10-01": { habits: { correr: 1, dormir: 0 }, weight: "70.5", phoneMinutes: 120 },
            "no-fecha": { weight: 80 },
            "2026-10-02": null
        }
    });
    assert.deepEqual(junk.habits, [{ id: "1", name: "Correr", type: "good" }]);
    assert.equal(junk.settings.weightGoal, defaultData().settings.weightGoal);
    assert.ok(junk.settings.phoneGoal >= 0);
    assert.deepEqual(Object.keys(junk.entries), ["2026-10-01"]);
    assert.equal(junk.entries["2026-10-01"].habits.correr, true);
    assert.equal(junk.entries["2026-10-01"].weight, 70.5);
    assert.deepEqual(normalizeData(null), defaultData());
    assert.deepEqual(normalizeData("hola"), defaultData());

    // un peso nulo tiene que seguir siendo null (Number(null) === 0)
    const conNulos = normalizeData({
        habits: [],
        settings: { weightGoal: 75, phoneGoal: 120 },
        entries: { "2026-10-05": { habits: {}, weight: null, phoneMinutes: null } }
    });
    assert.equal(conNulos.entries["2026-10-05"].weight, null, "weight null no puede convertirse en 0");
    assert.equal(conNulos.entries["2026-10-05"].phoneMinutes, null);

    // --- estadísticas ---
    const today = todayStr();
    const yest = addDays(today, -1);
    const data = {
        habits: [
            { id: "leer", name: "Leer", type: "good" },
            { id: "delivery", name: "Delivery", type: "bad" }
        ],
        settings: { weightGoal: 75, phoneGoal: 120 },
        entries: {
            [yest]: { habits: { leer: true, delivery: false }, weight: 78, phoneMinutes: 90 },
            [today]: { habits: { leer: true }, weight: 77.4, phoneMinutes: 60 }
        }
    };

    assert.equal(habitCurrentStreak(data, data.habits[0]), 2);   // leer: ayer + hoy
    assert.equal(habitCurrentStreak(data, data.habits[1]), 2);   // delivery: ayer y hoy sin pedir delivery
    assert.equal(habitMonthRate(data, data.habits[0]), 100); // todos los días del mes con registro tienen "leer" hecho
    assert.equal(weightSeries(data).length, 2);
    assert.ok(hasAnyData(data.entries[today]));
    assert.ok(!hasAnyData(emptyEntry()));

    const months = computeMonthlyStats({
        ...data,
        entries: {
            ...data.entries,
            "2026-08-15": { habits: {}, weight: 80, phoneMinutes: 200 },
            "2026-09-20": { habits: {}, weight: 79, phoneMinutes: 150 }
        }
    });
    assert.equal(months.length, 3);
    assert.equal(months[0].label, "Agosto");
    assert.equal(months[2].avgWeight, 77.7); // (78 + 77.4) / 2

    // --- formato de horas:minutos (promedios con decimales) ---
    assert.equal(fmtHM(131.25), "2:11");
    assert.equal(fmtHM(119.6), "2:00");   // antes podía dar "1:60"
    assert.equal(fmtHM(0), "0:00");
    assert.equal(fmtHM(45), "0:45");

    // --- racha: hoy registrado sin tildar no corta la racha del hábito bueno ---
    const hoySinTilde = {
        habits: [{ id: "leer", name: "Leer", type: "good" }],
        settings: { weightGoal: 75, phoneGoal: 120 },
        entries: {
            [yest]: { habits: { leer: true }, weight: 78, phoneMinutes: 90 },
            [today]: { habits: {}, weight: 77.4, phoneMinutes: 60 }
        }
    };
    assert.equal(habitCurrentStreak(hoySinTilde, hoySinTilde.habits[0]), 1, "hoy sin tildar: se mide desde ayer");

    const hoyTildeNo = {
        ...hoySinTilde,
        entries: { ...hoySinTilde.entries, [today]: { habits: { leer: false }, weight: 77.4, phoneMinutes: 60 } }
    };
    assert.equal(habitCurrentStreak(hoyTildeNo, hoyTildeNo.habits[0]), 0, "hoy tildado como no hecho: racha cortada");

    // --- % de cumplimiento sin datos en el mes ---
    assert.equal(
        habitMonthRate(
            { ...data, entries: { "2020-05-05": { habits: { leer: true }, weight: 70, phoneMinutes: 60 } } },
            data.habits[0]
        ),
        null,
        "sin días del mes actual debería dar null (sin datos)"
    );

    // --- al borrar un hábito se podan sus registros ---
    const podado = removeHabitFromEntries({
        "2026-10-01": { habits: { leer: true }, weight: 70, phoneMinutes: null }, // conserva peso
        "2026-10-02": { habits: { leer: true }, weight: null, phoneMinutes: null }, // queda vacío: se borra
        "2026-10-03": { habits: { leer: true, correr: true }, weight: null, phoneMinutes: null } // conserva correr
    }, "leer");
    assert.deepEqual(Object.keys(podado), ["2026-10-01", "2026-10-03"]);
    assert.deepEqual(podado["2026-10-01"].habits, {});
    assert.equal(podado["2026-10-01"].weight, 70);
    assert.deepEqual(podado["2026-10-03"].habits, { correr: true });

    console.log("✔ Todas las pruebas pasaron");
} finally {
    await vite.close();
}
