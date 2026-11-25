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
npm run build      # íconos + typecheck + build de producción en dist/
npm run preview    # sirve el build de producción
npm test           # pruebas de lógica, renderizado, interacción y sincronización
npm run icons      # regenera los PNG de public/ a partir del diseño de icon.svg
npm run server     # servidor propio de sincronización (ver más abajo)
```

## Estructura

```
index.html            Shell de la app (Vite + React) + manifest PWA
public/
  manifest.webmanifest  Para instalar la app en el celular
  icon.svg              Ícono vectorial (diseño de referencia)
  icon-*.png            PNG generados a partir de ese diseño (favicon, iOS, Android)
scripts/
  generate-icons.mjs    Genera los PNG (sin dependencias: escribe el PNG a mano)
server/
  index.mjs             API de sincronización + servidor estático (sin dependencias)
src/
  main.tsx            Punto de entrada: monta <App /> e importa los estilos
  App.tsx             Estado global, guardado con debounce/flush y navegación entre pestañas
  types.ts            Tipos compartidos (AppData, DayEntry, Habit, …)
  styles.css          Todos los estilos (tema oscuro, variables CSS, diálogo)
  lib/
    dates.ts          Fechas: parseo, suma de días, formatos, ids
    storage.ts        localStorage, export/import de backups, poda de hábitos, sync entre pestañas
    sync.ts           Cliente del servidor propio: subir/descargar datos y detectar conflictos
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
    SyncPanel.tsx     Conexión con el servidor propio: URL, token, subir y descargar
    Icons.tsx         Íconos de la navegación
tests/
  smoke.test.js       Pruebas de fechas, normalización y estadísticas (vía Vite)
  render.test.js      Renderizado en servidor de las tres pestañas y del resumen
  interaction.test.js Pruebas de interacción con jsdom + Testing Library
                      (cargar peso, tildar hábitos, teclado y guardado en localStorage)
  sync.test.js        Servidor real en un puerto efímero + cliente: auth, subida,
                      descarga, conflicto 409 y subida forzada
tsconfig.json         TypeScript en modo estricto (no emite archivos)
```

## Atajos de teclado (desktop)

En la pantalla **Hoy**: `←` / `→` cambian de día y `t` vuelve a hoy (se ignoran cuando el
cursor está en un campo de texto).

## Datos y backups

Todo se guarda bajo la clave `app-data-v1` en `localStorage`. Sí se sincroniza **entre
pestañas** del mismo navegador (evento `storage`), y los cambios pendientes se guardan
igual si cerrás la pestaña o la app pasa a segundo plano. **Entre dispositivos** se
sincroniza con el servidor propio (sección siguiente) o a mano con un backup.

En la pestaña **Hábitos → Tus datos** podés:

- **Exportar backup (.json)**: descarga todo el historial.
- **Importar backup**: reemplaza los datos actuales por los de un archivo (pide confirmación).

Los archivos importados se validan y normalizan: formatos inválidos se descartan en lugar
de romper la app. Al eliminar un hábito se limpian también sus registros de cada día.

## Sincronización entre dispositivos

La app puede hablar con un servidor propio para que la compu y el celular vean los mismos
datos. No hay cuentas ni servicios de terceros: solo una URL y un token.

### Levantar el servidor

```bash
npm run build                                  # deja la app en dist/
TRACK_TOKEN=una-clave-secreta npm run server   # http://localhost:8787
```

Variables de entorno: `PORT` (8787), `TRACK_TOKEN` (si no se pasa, se genera uno y se
imprime en la consola — conviene fijarlo para que no cambie) y `STORE_FILE` (dónde se
guardan los datos). Si existe `dist/`, el mismo proceso sirve la app en `/`, así que con
un solo comando tenés app + API corriendo: basta con subirlo a cualquier hosting con
Node.

Endpoints (todos salvo `/api/health` piden `Authorization: Bearer <token>`):

| Método | Ruta           | Qué hace                                                    |
| ------ | -------------- | ----------------------------------------------------------- |
| GET    | `/api/health`  | `{ ok: true }` para comprobar que la URL está bien           |
| GET    | `/api/data`    | devuelve `{ updatedAt, data }` o 404 si todavía no hay nada  |
| PUT    | `/api/data`    | recibe `{ updatedAt, data, force? }`; 200 al guardar, 409 si hay una versión más nueva |

Los datos se guardan en un solo archivo JSON con escritura atómica, y el cuerpo está
limitado a 5 MB.

### Conectar la app

En **Hábitos → Sincronización** cargás la URL y el token, los guardás y usás dos botones:

- **Descargar del servidor**: reemplaza los datos locales por los del servidor.
- **Subir mis datos**: sube lo tuyo. Si el servidor tiene una versión más nueva (la subió
  otro dispositivo), aparece un diálogo para elegir **usar los del servidor** o **mantener
  los tuyos y subirlos encima**; nunca se pisan datos sin preguntar.

La operación es manual a propósito: así nunca se sube algo a medias ni se pierde trabajo
por una red inestable. La fecha de la última sincronización queda a la vista.

### Cómo quedan protegidos los datos

- Sin el token no se puede leer ni escribir nada (401).
- El token viaja en el header `Authorization`, no en la URL.
- El servidor no interpreta los datos: solo valida que tengan el formato de un backup y
  los guarda tal cual; la app los vuelve a normalizar al recibirlos.
- Igual que con `localStorage`, esto es para uso personal: no hay registro de usuarios ni
  cifrado en tránsito, así que conviene correrlo detrás de HTTPS (y no exponerlo en una red
  pública sin eso).
