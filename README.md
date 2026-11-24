# Seguimiento

App para llevar el seguimiento personal de **hábitos**, **peso** y **tiempo de pantalla**.
Interfaz pensada para el celular (una sola columna, navegación abajo), con datos guardados
en `localStorage` del navegador. Hecha con **Vite + React + TypeScript**.

En pantallas de compu (ancho ≥ 900px) la app se ensancha y la pantalla **Hoy** pasa a dos
columnas: a la izquierda el registro del día y a la derecha el resumen de progreso con el
gráfico de peso, que así queda visible sin cambiar de pestaña.

## Requisitos

- Node.js 20 o superior

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # desarrollo con hot reload (http://localhost:5173)
npm run typecheck  # revisión de tipos con TypeScript (sin emitir nada)
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve el build de producción
npm test           # pruebas de lógica, renderizado e interacción
```

## Estructura

```
index.html            Shell de la app (Vite + React) + manifest PWA
public/
  manifest.webmanifest  Para instalar la app en el celular
  icon.svg              Ícono de la app
src/
  main.tsx            Punto de entrada: monta <App /> e importa los estilos
  App.tsx             Estado global, guardado con debounce/flush y navegación entre pestañas
  types.ts            Tipos compartidos (AppData, DayEntry, Habit, …)
  styles.css          Todos los estilos (tema oscuro, variables CSS, diálogo)
  lib/
    dates.ts          Fechas: parseo, suma de días, formatos, ids
    storage.ts        localStorage, export/import de backups, poda de hábitos, sync entre pestañas
    stats.ts          Promedios mensuales, rachas y % de cumplimiento
    fmt.ts            Formatos compartidos (horas:minutos, clases de diferencia)
    useMediaQuery.ts  Detecta pantalla ancha (modo desktop) en el navegador
  components/
    HoyTab.tsx        Registro del día: peso, celular, hábitos y atajos de teclado
    ProgresoTab.tsx   Tabla de meses y cumplimiento de hábitos
    ProgressSummary.tsx  Tarjetas del mes + gráfico (compartido con el panel desktop)
    HabitosTab.tsx    Alta/baja de hábitos, objetivos y backup de datos
    WeightChart.tsx   Curva de peso en SVG (medido al ancho real, con línea de objetivo)
    ConfirmDialog.tsx Diálogo de confirmación accesible (reemplaza a window.confirm)
    Icons.tsx         Íconos de la navegación
tests/
  smoke.test.js       Pruebas de fechas, normalización y estadísticas (vía Vite)
  render.test.js      Renderizado en servidor de las tres pestañas y del resumen
  interaction.test.js Pruebas de interacción con jsdom + Testing Library
                      (cargar peso, tildar hábitos, teclado y guardado en localStorage)
tsconfig.json         TypeScript en modo estricto (no emite archivos)
```

## Atajos de teclado (desktop)

En la pantalla **Hoy**: `←` / `→` cambian de día y `t` vuelve a hoy (se ignoran cuando el
cursor está en un campo de texto).

## Datos y backups

Todo se guarda bajo la clave `app-data-v1` en `localStorage`, así que **no se sincroniza
entre dispositivos**. Sí se sincroniza **entre pestañas** del mismo navegador (evento
`storage`), y los cambios pendientes se guardan igual si cerrás la pestaña o la app pasa
a segundo plano.

En la pestaña **Hábitos → Tus datos** podés:

- **Exportar backup (.json)**: descarga todo el historial.
- **Importar backup**: reemplaza los datos actuales por los de un archivo (pide confirmación).

Los archivos importados se validan y normalizan: formatos inválidos se descartan en lugar
de romper la app. Al eliminar un hábito se limpian también sus registros de cada día.
