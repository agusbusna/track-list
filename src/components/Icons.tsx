import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
};

export function IconHoy() {
    return (
        <svg {...base}>
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18" />
            <path d="M8 3v4M16 3v4" />
            <path d="m9 15 2 2 4-4" />
        </svg>
    );
}

export function IconProgreso() {
    return (
        <svg {...base}>
            <path d="M4 19V9M11 19V4M18 19v-7" />
            <path d="M3 19h18" />
        </svg>
    );
}

export function IconHabitos() {
    return (
        <svg {...base}>
            <path d="M9 6h11M9 12h11M9 18h11" />
            <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
    );
}
