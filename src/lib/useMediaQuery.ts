import { useSyncExternalStore } from "react";

const mqlCache = new Map<string, MediaQueryList>();

function getMql(query: string): MediaQueryList {
    let mql = mqlCache.get(query);
    if (!mql) {
        mql = window.matchMedia(query);
        mqlCache.set(query, mql);
    }
    return mql;
}

/**
 * `true` cuando la ventana cumple el media query.
 * En el servidor (render de pruebas) devuelve `false`, así el panel
 * desktop solo se monta en el navegador.
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mql = getMql(query);
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        },
        () => getMql(query).matches,
        () => false
    );
}
