(function () {
    "use strict";
    var STORAGE_KEY = "app-data-v1";
    var MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    var WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    var storage = {
    get: function (key) {
        var v = localStorage.getItem(key);
        return Promise.resolve(v != null ? { key: key, value: v } : null);
    },
    set: function (key, value) {
        localStorage.setItem(key, value);
        return Promise.resolve({ key: key, value: value });
    }
};;

    var state = {
        tab: "hoy",
        currentDate: fmtDate(new Date()),
        data: null,
        typeChoice: "good"
    };

    function uid() { return Math.random().toString(36).slice(2, 9); }
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function parseDate(s) { var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
    function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
    function todayStr() { return fmtDate(new Date()); }

    function defaultData() {
        return {
            habits: [
                { id: "ejercicio", name: "Ejercicio", type: "good" },
                { id: "tesis", name: "Tesis", type: "good" },
                { id: "leer", name: "Leer", type: "good" },
                { id: "escribir", name: "Escribir", type: "good" },
                { id: "dibujar", name: "Dibujar", type: "good" },
                { id: "delivery", name: "Delivery", type: "bad" },
                { id: "alcohol", name: "Alcohol", type: "bad" }
            ],
            settings: { weightGoal: 100, phoneGoal: 180 },
            entries: {}
        };
    }

    function getEntry(date, create) {
        var e = state.data.entries[date];
        if (!e && create) {
            e = { habits: {}, weight: null, phoneMinutes: null };
            state.data.entries[date] = e;
        }
        return e || { habits: {}, weight: null, phoneMinutes: null };
    }

    var saveTimer = null;
    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            storage.set(STORAGE_KEY, JSON.stringify(state.data)).catch(function (err) {
                console.error("No se pudo guardar:", err);
            });
        }, 350);
    }

    async function loadData() {
        try {
            var res = await storage.get(STORAGE_KEY);
            state.data = res && res.value ? JSON.parse(res.value) : defaultData();
        } catch (e) {
            state.data = defaultData();
        }
        render();
    }

    // ---------- render dispatch ----------
    var contentEl = document.getElementById("app-content");
    var topbarTag = document.getElementById("topbar-tag");

    function render() {
        if (!state.data) return;
        topbarTag.textContent = state.tab;
        document.querySelectorAll("nav.bottom-nav button").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-tab") === state.tab);
        });
        if (state.tab === "hoy") contentEl.innerHTML = renderHoy();
        else if (state.tab === "progreso") contentEl.innerHTML = renderProgreso();
        else contentEl.innerHTML = renderHabitos();
        contentEl.scrollTop = 0;
    }

    // ---------- HOY ----------
    function renderHoy() {
        var date = state.currentDate;
        var entry = getEntry(date, false);
        var d = parseDate(date);
        var isToday = date === todayStr();
        var relabel = isToday ? "Hoy" : (date === addDays(todayStr(), -1) ? "Ayer" : (date === addDays(todayStr(), 1) ? "Mañana" : ""));

        var goodHabits = state.data.habits.filter(function (h) { return h.type === "good"; });
        var badHabits = state.data.habits.filter(function (h) { return h.type === "bad"; });

        function habitRow(h) {
            var on = !!entry.habits[h.id];
            return '<div class="habit-row ' + h.type + (on ? " on" : "") + '" data-toggle-habit="' + h.id + '">' +
                '<div class="habit-check">' + (on ? "✓" : "") + '</div>' +
                '<div class="habit-name">' + escapeHtml(h.name) + '</div>' +
                '</div>';
        }

        var habitsHtml = "";
        if (state.data.habits.length === 0) {
            habitsHtml = '<div class="empty-note">Todavía no cargaste hábitos. Andá a la pestaña "Hábitos" para sumar los tuyos.</div>';
        } else {
            if (goodHabits.length) {
                habitsHtml += '<div class="section-label"><span style="color:var(--good)">●</span> Quiero hacer</div><div class="habit-grid">' + goodHabits.map(habitRow).join("") + '</div>';
            }
            if (badHabits.length) {
                habitsHtml += '<div class="section-label"><span style="color:var(--bad)">●</span> Quiero evitar</div><div class="habit-grid">' + badHabits.map(habitRow).join("") + '</div>';
            }
        }

        var w = entry.weight;
        var pm = entry.phoneMinutes;
        var ph = pm == null ? "" : Math.floor(pm / 60);
        var pmm = pm == null ? "" : pad(pm % 60);

        return '' +
            '<div class="day-card">' +
            '<div class="day-nav">' +
            '<button data-nav="-1" aria-label="Día anterior">‹</button>' +
            '<div class="day-main">' +
            '<div class="day-weekday">' + WEEKDAY_NAMES[d.getDay()] + '</div>' +
            '<div class="day-date num">' + pad(d.getDate()) + ' ' + MONTH_NAMES[d.getMonth()].slice(0, 3) + '</div>' +
            (relabel ? '<div class="day-relabel"><button class="pill-btn" data-nav="today">' + relabel + (isToday ? "" : " · ir a hoy") + '</button></div>' : '<div class="day-relabel"><button class="pill-btn" data-nav="today">Ir a hoy</button></div>') +
            '</div>' +
            '<button data-nav="1" aria-label="Día siguiente">›</button>' +
            '</div>' +
            '</div>' +

            '<div class="section-label">Peso y pantalla</div>' +
            '<div class="metric-grid">' +
            '<div class="metric-card"><label>Peso</label><div class="metric-inputs">' +
            '<input class="metric-w num" type="text" inputmode="decimal" id="weight-input" value="' + (w == null ? "" : w) + '" placeholder="—">' +
            '<span class="unit">kg</span>' +
            '</div></div>' +
            '<div class="metric-card"><label>Tiempo de celular</label><div class="metric-inputs">' +
            '<input class="metric-hm num" type="number" min="0" inputmode="numeric" id="phone-h-input" value="' + ph + '" placeholder="0">' +
            '<span class="colon">:</span>' +
            '<input class="metric-hm num" type="number" min="0" max="59" inputmode="numeric" id="phone-m-input" value="' + pmm + '" placeholder="00">' +
            '</div></div>' +
            '</div>' +

            habitsHtml;
    }

    // ---------- PROGRESO ----------
    function monthKey(dateStr) { return dateStr.slice(0, 7); }

    function computeMonthlyStats() {
        var byMonth = {};
        Object.keys(state.data.entries).sort().forEach(function (date) {
            var e = state.data.entries[date];
            var mk = monthKey(date);
            if (!byMonth[mk]) byMonth[mk] = { weights: [], phones: [] };
            if (e.weight != null) byMonth[mk].weights.push(e.weight);
            if (e.phoneMinutes != null) byMonth[mk].phones.push(e.phoneMinutes);
        });
        var keys = Object.keys(byMonth).sort();
        return keys.slice(-6).map(function (mk) {
            var b = byMonth[mk];
            var avgW = b.weights.length ? b.weights.reduce(function (a, c) { return a + c; }, 0) / b.weights.length : null;
            var avgP = b.phones.length ? b.phones.reduce(function (a, c) { return a + c; }, 0) / b.phones.length : null;
            var parts = mk.split("-");
            var label = MONTH_NAMES[parseInt(parts[1], 10) - 1];
            label = label.charAt(0).toUpperCase() + label.slice(1);
            return { key: mk, label: label, avgWeight: avgW, avgPhone: avgP };
        });
    }

    function weightSeries() {
        return Object.keys(state.data.entries).sort().map(function (date) {
            return { date: date, w: state.data.entries[date].weight };
        }).filter(function (p) { return p.w != null; });
    }

    function renderWeightChartSvg() {
        var all = weightSeries();
        var pts = all.slice(-90); // últimos ~3 meses de datos cargados
        var goal = state.data.settings.weightGoal;
        if (pts.length < 2) {
            return '<div class="chart-empty">Cargá el peso de al menos dos días para ver la curva.</div>';
        }
        var W = 340, H = 210, padL = 36, padR = 12, padT = 16, padB = 24;
        var vals = pts.map(function (p) { return p.w; });
        var min = Math.min.apply(null, vals.concat([goal]));
        var max = Math.max.apply(null, vals.concat([goal]));
        if (max - min < 1) { min -= 1; max += 1; }
        var rangePad = (max - min) * 0.15;
        min -= rangePad; max += rangePad;

        function x(i) { return padL + (W - padL - padR) * (pts.length === 1 ? 0 : (i / (pts.length - 1))); }
        function y(v) { return H - padB - (H - padT - padB) * ((v - min) / (max - min)); }

        // --- y-axis gridlines (4 ticks) ---
        var ticks = 4;
        var gridHtml = "";
        for (var i = 0; i <= ticks; i++) {
            var v = min + (max - min) * (i / ticks);
            var ty = y(v);
            gridHtml += '<line x1="' + padL + '" y1="' + ty.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + ty.toFixed(1) + '" stroke="#2e3440" stroke-width="1"/>';
            gridHtml += '<text x="' + (padL - 6) + '" y="' + (ty + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#576174">' + v.toFixed(1) + '</text>';
        }

        // --- x-axis date labels (start, mid, end) ---
        var xLabelIdxs = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : [0, pts.length - 1];
        var xLabelsHtml = xLabelIdxs.map(function (i) {
            var anchor = i === 0 ? "start" : (i === pts.length - 1 ? "end" : "middle");
            return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '" font-size="9" fill="#576174">' + shortDateLabel(pts[i].date) + '</text>';
        }).join("");

        var linePath = pts.map(function (p, i) { return (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(p.w).toFixed(1); }).join(" ");
        var areaPath = linePath + ' L' + x(pts.length - 1).toFixed(1) + ',' + (H - padB) + ' L' + x(0).toFixed(1) + ',' + (H - padB) + ' Z';
        var goalY = y(goal).toFixed(1);
        var last = pts[pts.length - 1];
        var first = pts[0];
        var trendDiff = +(last.w - first.w).toFixed(1);

        var dots = pts.map(function (p, i) {
            return '<circle class="chart-pt" data-date="' + p.date + '" data-w="' + p.w.toFixed(1) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(p.w).toFixed(1) + '" r="9" fill="transparent"/>';
        }).join("");

        return '' +
            '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;touch-action:manipulation" id="weight-chart-svg">' +
            '<defs><linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#8fbfe0" stop-opacity="0.35"/>' +
            '<stop offset="100%" stop-color="#8fbfe0" stop-opacity="0"/>' +
            '</linearGradient></defs>' +
            gridHtml +
            '<line x1="' + padL + '" y1="' + goalY + '" x2="' + (W - padR) + '" y2="' + goalY + '" stroke="var(--gold)" stroke-width="1" stroke-dasharray="3 4" opacity="0.8"/>' +
            '<text x="' + (W - padR) + '" y="' + (parseFloat(goalY) - 4) + '" text-anchor="end" font-size="9" fill="#e3b341">objetivo ' + goal + ' kg</text>' +
            '<path d="' + areaPath + '" fill="url(#wgrad)" stroke="none"/>' +
            '<path d="' + linePath + '" fill="none" stroke="#8fbfe0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle cx="' + x(pts.length - 1).toFixed(1) + '" cy="' + y(last.w).toFixed(1) + '" r="3.5" fill="var(--gold)"/>' +
            xLabelsHtml +
            dots +
            '<text id="chart-tooltip" font-size="10" font-weight="700" fill="var(--text)" text-anchor="middle" style="pointer-events:none"></text>' +
            '</svg>' +
            '<div class="chart-trend">' + (trendDiff === 0 ? "Sin cambios" : (trendDiff > 0 ? "+" : "") + trendDiff + " kg") + ' desde ' + shortDateLabel(first.date) + ' · tocá un punto para ver el valor</div>';
    }

    function diffBadge(diff, decimals, unit) {
        if (diff == null) return '<span class="badge zero">–</span>';
        var cls = Math.abs(diff) < 0.05 ? "zero" : (diff > 0 ? "pos" : "neg");
        var sign = diff > 0 ? "+" : "";
        return '<span class="badge ' + cls + '">' + sign + diff.toFixed(decimals) + ' ' + unit + '</span>';
    }

    function habitCurrentStreak(h) {
        var count = 0;
        var d = todayStr();
        // if today has no entry yet, start counting from yesterday
        if (!state.data.entries[d]) d = addDays(d, -1);
        while (true) {
            var e = state.data.entries[d];
            if (!e) break;
            var done = !!e.habits[h.id];
            var ok = h.type === "good" ? done : !done;
            if (!ok) break;
            count++;
            d = addDays(d, -1);
        }
        return count;
    }

    function habitMonthRate(h) {
        var mk = monthKey(todayStr());
        var total = 0, hit = 0;
        Object.keys(state.data.entries).forEach(function (date) {
            if (monthKey(date) !== mk) return;
            var e = state.data.entries[date];
            var hasHabitData = Object.prototype.hasOwnProperty.call(e.habits, h.id);
            if (!hasHabitData && !e.weight && !e.phoneMinutes) return;
            total++;
            var done = !!e.habits[h.id];
            if (h.type === "good" ? done : !done) hit++;
        });
        return total ? Math.round((hit / total) * 100) : null;
    }

    function renderProgreso() {
        var months = computeMonthlyStats();
        var thisMonth = months.length ? months[months.length - 1] : null;
        var goalW = state.data.settings.weightGoal;
        var goalP = state.data.settings.phoneGoal;

        var weightNowDiff = thisMonth && thisMonth.avgWeight != null ? +(thisMonth.avgWeight - goalW).toFixed(1) : null;
        var phoneNowDiff = thisMonth && thisMonth.avgPhone != null ? Math.round(thisMonth.avgPhone - goalP) : null;

        var statCards = '' +
            '<div class="stat-row">' +
            '<div class="stat-card"><div class="lbl">Peso prom. este mes</div><div class="big num">' + (thisMonth && thisMonth.avgWeight != null ? thisMonth.avgWeight.toFixed(1) + " kg" : "—") + '</div>' +
            (weightNowDiff != null ? '<div class="diff ' + (Math.abs(weightNowDiff) < 0.05 ? "zero" : (weightNowDiff > 0 ? "pos" : "neg")) + '">' + (weightNowDiff > 0 ? "+" : "") + weightNowDiff + ' kg vs objetivo</div>' : '') +
            '</div>' +
            '<div class="stat-card"><div class="lbl">Celular prom. este mes</div><div class="big num">' + (thisMonth && thisMonth.avgPhone != null ? Math.floor(thisMonth.avgPhone / 60) + ":" + pad(Math.round(thisMonth.avgPhone % 60)) : "—") + '</div>' +
            (phoneNowDiff != null ? '<div class="diff ' + (Math.abs(phoneNowDiff) < 1 ? "zero" : (phoneNowDiff > 0 ? "pos" : "neg")) + '">' + (phoneNowDiff > 0 ? "+" : "") + phoneNowDiff + ' min vs objetivo</div>' : '') +
            '</div>' +
            '</div>';

        var chart = '<div class="chart-wrap"><div class="chart-title">Evolución del peso</div>' + renderWeightChartSvg() + '</div>';

        var monthTable = '';
        if (months.length) {
            monthTable = '<div class="chart-wrap"><table class="month-table"><thead><tr><th>Mes</th><th>Peso prom.</th><th>Dif.</th><th>Celu prom.</th></tr></thead><tbody>' +
                months.slice().reverse().map(function (m) {
                    var dW = m.avgWeight != null ? +(m.avgWeight - goalW).toFixed(1) : null;
                    return '<tr><td>' + m.label + '</td>' +
                        '<td class="num">' + (m.avgWeight != null ? m.avgWeight.toFixed(1) + " kg" : "—") + '</td>' +
                        '<td>' + diffBadge(dW, 1, "kg") + '</td>' +
                        '<td class="num">' + (m.avgPhone != null ? Math.floor(m.avgPhone / 60) + ":" + pad(Math.round(m.avgPhone % 60)) : "—") + '</td>' +
                        '</tr>';
                }).join("") +
                '</tbody></table></div>';
        }

        var habitsHtml = '';
        if (state.data.habits.length) {
            habitsHtml = '<div class="section-label">Hábitos — este mes</div>' +
                state.data.habits.map(function (h) {
                    var rate = habitMonthRate(h);
                    var streak = habitCurrentStreak(h);
                    var streakLabel = h.type === "good" ? (streak + " día" + (streak === 1 ? "" : "s") + " seguidos") : (streak + " día" + (streak === 1 ? "" : "s") + " sin");
                    return '<div class="habit-stat">' +
                        '<div class="habit-stat-top">' +
                        '<div class="habit-stat-name"><span class="habit-dot ' + h.type + '"></span>' + escapeHtml(h.name) + '</div>' +
                        '<div class="habit-stat-streak">' + streakLabel + '</div>' +
                        '</div>' +
                        '<div class="bar-track"><div class="bar-fill ' + h.type + '" style="width:' + (rate == null ? 0 : rate) + '%"></div></div>' +
                        '</div>';
                }).join("");
        }

        return statCards + chart + monthTable + habitsHtml;
    }

    // ---------- HABITOS ----------
    function renderHabitos() {
        var s = state.data.settings;
        var ph = Math.floor(s.phoneGoal / 60), pm = pad(s.phoneGoal % 60);

        var listHtml = state.data.habits.length ? state.data.habits.map(function (h) {
            return '<div class="habit-manage-row">' +
                '<span class="habit-dot ' + h.type + '"></span>' +
                '<div class="habit-name" style="flex:1">' + escapeHtml(h.name) + '</div>' +
                '<button class="del-btn" data-delete-habit="' + h.id + '" aria-label="Eliminar">✕</button>' +
                '</div>';
        }).join("") : '<div class="empty-note">Todavía no agregaste hábitos.</div>';

        return '' +
            '<div class="section-label">Agregar hábito</div>' +
            '<div class="form-card">' +
            '<div class="form-row">' +
            '<input type="text" id="new-habit-name" placeholder="Nombre del hábito" maxlength="30">' +
            '<div class="type-toggle">' +
            '<button data-t="good" class="' + (state.typeChoice === "good" ? "active" : "") + '" type="button">Bien</button>' +
            '<button data-t="bad" class="' + (state.typeChoice === "bad" ? "active" : "") + '" type="button">Evitar</button>' +
            '</div>' +
            '</div>' +
            '<button class="add-btn" id="add-habit-btn" type="button">Agregar hábito</button>' +
            '</div>' +

            '<div class="section-label">Tus hábitos</div>' +
            listHtml +

            '<div class="section-label">Objetivos</div>' +
            '<div class="form-card">' +
            '<h3>Peso objetivo</h3>' +
            '<div class="metric-grid" style="margin-bottom:14px">' +
            '<div class="metric-card"><div class="metric-inputs"><input class="metric-w num" type="text" id="goal-weight-input" value="' + s.weightGoal + '"><span class="unit">kg</span></div></div>' +
            '</div>' +
            '<h3>Objetivo de tiempo de celular por día</h3>' +
            '<div class="metric-grid">' +
            '<div class="metric-card"><div class="metric-inputs">' +
            '<input class="metric-hm num" type="number" min="0" id="goal-phone-h" value="' + ph + '">' +
            '<span class="colon">:</span>' +
            '<input class="metric-hm num" type="number" min="0" max="59" id="goal-phone-m" value="' + pm + '">' +
            '</div></div>' +
            '</div>' +
            '</div>';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // ---------- events ----------
    document.querySelector("nav.bottom-nav").addEventListener("click", function (ev) {
        var btn = ev.target.closest("button[data-tab]");
        if (!btn) return;
        state.tab = btn.getAttribute("data-tab");
        render();
    });

    contentEl.addEventListener("click", function (ev) {
        var chartPt = ev.target.closest(".chart-pt");
        if (chartPt) {
            var svg = chartPt.closest("svg");
            var tip = svg.querySelector("#chart-tooltip");
            var cx = chartPt.getAttribute("cx"), cy = chartPt.getAttribute("cy");
            var w = chartPt.getAttribute("data-w"), d = chartPt.getAttribute("data-date");
            var ty = Math.max(10, parseFloat(cy) - 12);
            tip.setAttribute("x", cx);
            tip.setAttribute("y", ty);
            tip.textContent = w + " kg · " + shortDateLabel(d);
            return;
        }
        var navBtn = ev.target.closest("button[data-nav]");
        if (navBtn) {
            var n = navBtn.getAttribute("data-nav");
            state.currentDate = n === "today" ? todayStr() : addDays(state.currentDate, parseInt(n, 10));
            render();
            return;
        }
        var toggleEl = ev.target.closest("[data-toggle-habit]");
        if (toggleEl) {
            var hid = toggleEl.getAttribute("data-toggle-habit");
            var entry = getEntry(state.currentDate, true);
            entry.habits[hid] = !entry.habits[hid];
            scheduleSave();
            render();
            return;
        }
        var typeBtn = ev.target.closest(".type-toggle button");
        if (typeBtn) {
            state.typeChoice = typeBtn.getAttribute("data-t");
            render();
            return;
        }
        var addBtn = ev.target.closest("#add-habit-btn");
        if (addBtn) {
            var nameInput = document.getElementById("new-habit-name");
            var name = nameInput.value.trim();
            if (!name) return;
            state.data.habits.push({ id: uid(), name: name, type: state.typeChoice });
            scheduleSave();
            render();
            return;
        }
        var delBtn = ev.target.closest("[data-delete-habit]");
        if (delBtn) {
            var did = delBtn.getAttribute("data-delete-habit");
            state.data.habits = state.data.habits.filter(function (h) { return h.id !== did; });
            scheduleSave();
            render();
            return;
        }
    });

    contentEl.addEventListener("change", function (ev) {
        var t = ev.target;
        if (t.id === "weight-input") {
            var entry = getEntry(state.currentDate, true);
            var raw = t.value.trim().replace(",", ".");
            var parsed = raw === "" ? null : parseFloat(raw);
            entry.weight = (parsed == null || isNaN(parsed)) ? null : parsed;
            t.value = entry.weight == null ? "" : entry.weight;
            scheduleSave();
            return;
        }
        if (t.id === "phone-h-input" || t.id === "phone-m-input") {
            var entry2 = getEntry(state.currentDate, true);
            var h = document.getElementById("phone-h-input").value;
            var m = document.getElementById("phone-m-input").value;
            if (h === "" && m === "") { entry2.phoneMinutes = null; }
            else { entry2.phoneMinutes = (parseInt(h || "0", 10) * 60) + parseInt(m || "0", 10); }
            scheduleSave();
            return;
        }
        if (t.id === "goal-weight-input") {
            var rawG = t.value.trim().replace(",", ".");
            var parsedG = rawG === "" ? NaN : parseFloat(rawG);
            if (!isNaN(parsedG)) state.data.settings.weightGoal = parsedG;
            t.value = state.data.settings.weightGoal;
            scheduleSave();
            return;
        }
        if (t.id === "goal-phone-h" || t.id === "goal-phone-m") {
            var gh = document.getElementById("goal-phone-h").value || "0";
            var gm = document.getElementById("goal-phone-m").value || "0";
            state.data.settings.phoneGoal = (parseInt(gh, 10) * 60) + parseInt(gm, 10);
            scheduleSave();
            return;
        }
    });

    loadData();
})();