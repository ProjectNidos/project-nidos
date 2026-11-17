"use client";

/*
 * Squeeze carousel (21st.dev), adapted for this site:
 * - No Geist from the 21st.dev CDN: the CSP allows fonts from 'self' only, and a
 *   third-party font would send every visitor's IP elsewhere. The site font is used.
 * - shadcn theme classes swapped for the site palette; the copy takes the
 *   surrounding text colour, so it reads on the dark hero as well as on paper.
 * - Arrow labels are props, so they can be translated.
 * - Copy set at the Daiļrades body sizes (14 / 16px).
 * - Runs in a line from the first slide to the last instead of looping: slides
 *   already passed stay as slats on the left, arrows stop at either end.
 */

import {
    type ComponentProps,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useId,
    useState,
} from "react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   slides                                   */
/* -------------------------------------------------------------------------- */

export type SqueezeSlide = {
    /** Stable key. Falls back to the position in the array. */
    id?: string | number;
    /** The dark opening line under the panels. */
    title: string;
    /** The grey sentence that runs on from the title. */
    description?: string;
    /** Picture for the panel. It crops from the middle as the panel narrows. */
    image?: string;
    /** Alt text for that picture. Leave it out and the picture reads as decoration. */
    imageAlt?: string;
    /** Any CSS background — a gradient, a colour, layers. Used when there is no picture. */
    background?: string;
    /** Sits in the corner of the open panel: a wordmark, a logo, a caption. */
    overlay?: ReactNode;
    /** Text on the button. No text, no button. */
    action?: string;
    /** Where the button goes. */
    href?: string;
    /** Opens the link in a new tab. */
    target?: string;
    /** Runs instead of following `href`. */
    onAction?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                  geometry                                  */
/* -------------------------------------------------------------------------- */

/** A number is read as pixels; a string goes through as written, `2rem` and all. */
type Size = number | string;

const size = (value: Size) => (typeof value === "number" ? `${value}px` : value);

const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));

/**
 * The row is four columns and a tail of slats, and it is a strip that slides
 * rather than a ring that turns.
 *
 * Four columns share out whatever is left once the open card, the slats and the
 * gaps are paid for. The open card starts from a 16:9 block and then gives a
 * little back — hence the negative first share. Column −1 and anything past
 * column 3 is a slat, so a card leaving the front simply narrows to a slat and
 * carries on out of the left edge.
 */
const SHARES = [-0.06, 0.61, 0.3, 0.15];

/** The hovered column takes more room. */
const STRETCHED = [0, 0.71, 0.4, 0.25];

/** Its neighbours give a little up to pay for it. */
const SQUEEZED = [-0.12, 0.59, 0.28, 0.13];

/* -------------------------------------------------------------------------- */
/*                                    hooks                                   */
/* -------------------------------------------------------------------------- */

/** True while the reader asks for less movement. */
function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const read = () => setReduced(query.matches);
        read();
        query.addEventListener("change", read);
        return () => query.removeEventListener("change", read);
    }, []);

    return reduced;
}

/* -------------------------------------------------------------------------- */
/*                                 component                                  */
/* -------------------------------------------------------------------------- */

export type SqueezeCarouselProps = {
    /** The panels, in the order they are read. */
    slides: SqueezeSlide[];
    /** Height of the row. Default `clamp(180px, 32cqi, 340px)`. */
    height?: Size;
    /** Width of a slat in the tail. Default `8`. */
    slatWidth?: Size;
    /** Space between slats. Default `8`. */
    slatGap?: Size;
    /** Space between the four columns. Default `16`. */
    gap?: Size;
    /** Corner rounding on a panel. Default `6`. */
    radius?: Size;
    /** Milliseconds the slide takes. Default `1000`. */
    duration?: number;
    /** Widen the panel under the pointer. Default `true`. */
    hoverGrow?: boolean;
    /** Show the two arrow buttons. Default `true`. */
    controls?: boolean;
    /** Fill behind the button, the arrows and the focus ring. Defaults to the site ink. */
    accent?: string;
    /** What sits on top of that fill — the label and the arrow heads. */
    accentForeground?: string;
    /** What a screen reader calls the carousel. Default `"Featured"`. */
    label?: string;
    /** Screen-reader names of the arrow buttons. */
    previousLabel?: string;
    nextLabel?: string;
} & Omit<ComponentProps<"div">, "onSelect">;

/**
 * A carousel that gives one panel the room and squeezes the rest into slats
 * down the right-hand side. Opening a slat widens it and slides the row along;
 * the copy and the button underneath cross-fade to match.
 */
export function SqueezeCarousel({
    slides,
    height = "clamp(180px, 32cqi, 340px)",
    slatWidth = 8,
    slatGap = 8,
    gap = 16,
    radius = 6,
    duration = 1000,
    hoverGrow = true,
    controls = true,
    accent = "var(--sq-accent, var(--color-ink))",
    accentForeground = "var(--sq-accent-foreground, var(--color-paper))",
    label = "Featured",
    previousLabel = "Previous",
    nextLabel = "Next",
    className,
    style,
    ...props
}: SqueezeCarouselProps) {
    const count = slides.length;
    const [open, setOpen] = useState(0);
    const [hover, setHover] = useState(-1);
    const reduced = useReducedMotion();
    const ms = reduced ? 0 : duration;
    const ids = useId();

    const go = (to: number) => setOpen(clamp(to, 0, count - 1));

    /* --- keyboard --------------------------------------------------------- */

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const moves: Record<string, number | undefined> = {
            ArrowRight: open + 1,
            ArrowLeft: open - 1,
            Home: 0,
            End: count - 1,
        };
        const to = moves[event.key];
        if (to === undefined) return;
        event.preventDefault();
        const next = clamp(to, 0, count - 1);
        setOpen(next);
        document.getElementById(`${ids}-tab-${next}`)?.focus();
    };

    if (!count) return null;

    /* --- geometry --------------------------------------------------------- */

    // Slides already passed sit as slats on the left; from the open one on, up
    // to four columns share the row; anything further right is a slat in the tail.
    const left = open;
    const columns = Math.min(4, count - open);
    const tail = Math.max(0, count - open - 4);

    const slat = size(slatWidth);
    const shares = hoverGrow && hover >= 0 && hover < columns && !reduced ? null : SHARES;

    /** The share a column takes, once the pointer has had its say. */
    const shareOf = (col: number) => {
        if (shares) return SHARES[col];
        return hover === col ? STRETCHED[col] : SQUEEZED[col];
    };

    /** A column's width, worked out in CSS so nothing needs measuring. */
    const widthOf = (col: number) => {
        if (col < 0 || col >= columns) return slat;
        if (col > 0) return `calc(var(--sq-room) * ${shareOf(col)})`;
        // The open card takes whatever the other columns leave, so the row is
        // always full — even at the end, where it is the only column.
        let rest = 1;
        for (let c = 1; c < columns; c++) rest -= shareOf(c);
        return `calc(var(--sq-hero) + var(--sq-room) * ${rest.toFixed(4)})`;
    };

    /** Space before a card: a column gap around the columns, a slat gap between slats. */
    const gapBefore = (place: number) => {
        if (place === 0) return "0px";
        const col = place - open;
        return col >= 0 && col < columns ? "var(--sq-gap)" : "var(--sq-slat-gap)";
    };

    const vars = {
        "--sq-h": size(height),
        "--sq-gap": size(gap),
        "--sq-slat-gap": size(slatGap),
        "--sq-radius": size(radius),
        "--sq-ms": `${ms}ms`,
        // easeOutExpo, the curve the original slides on
        "--sq-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
        "--sq-fill": accent,
        "--sq-on-fill": accentForeground,
        // A 16:9 block sets both the open card and the size every picture is
        // drawn at, so a picture keeps one scale however narrow its card gets.
        "--sq-hero": "calc(var(--sq-h) * 16 / 9)",
        // What the columns share: the row, less the open card's 16:9 block,
        // every slat and every gap.
        "--sq-room": `calc(100cqi - var(--sq-hero) - ${left + tail} * ${slat} - ${slides
            .map((_, place) => gapBefore(place))
            .join(" - ")})`,
    } as CSSProperties;

    return (
        <div
            className={cn("flex w-full flex-col", className)}
            // The breakpoints and widths below read the width this carousel is
            // given, not the width of the window.
            style={{
                containerType: "inline-size",
                ...vars,
                ...style,
            }}
            onMouseLeave={() => setHover(-1)}
            {...props}
        >
            {controls && count > 1 && (
                <div className="mb-4 flex justify-end gap-2">
                    <Arrow back label={previousLabel} disabled={open === 0} onClick={() => go(open - 1)} />
                    <Arrow label={nextLabel} disabled={open === count - 1} onClick={() => go(open + 1)} />
                </div>
            )}

            <div className="w-full overflow-hidden" style={{ height: "var(--sq-h)" }}>
                <div
                    role="tablist"
                    aria-label={label}
                    aria-orientation="horizontal"
                    onKeyDown={onKeyDown}
                    className="flex h-full w-max"
                >
                    {slides.map((slide, place) => {
                        const col = place - open;
                        const front = col === 0;

                        return (
                            <button
                                key={slide.id ?? place}
                                type="button"
                                role="tab"
                                id={`${ids}-tab-${place}`}
                                aria-selected={front}
                                aria-controls={`${ids}-panel`}
                                aria-label={slide.title}
                                tabIndex={front ? 0 : -1}
                                onMouseMove={() => hoverGrow && setHover(col)}
                                onClick={() => go(place)}
                                className={cn(
                                    "relative isolate h-full shrink-0 cursor-pointer overflow-hidden bg-paper-2 p-0",
                                    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                    "focus-visible:ring-[var(--sq-fill)] focus-visible:ring-offset-paper",
                                )}
                                style={{
                                    width: widthOf(col),
                                    marginLeft: gapBefore(place),
                                    borderRadius: `min(var(--sq-radius), calc(${widthOf(col)} / 2))`,
                                    transitionProperty: "width, margin-left",
                                    transitionDuration: "var(--sq-ms)",
                                    transitionTimingFunction: "var(--sq-ease)",
                                }}
                            >
                                <Picture slide={slide} />

                                {slide.overlay && (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-4 pt-16 @lg:p-6 @lg:pt-20"
                                        style={{
                                            opacity: front ? 1 : 0,
                                            transition: `opacity var(--sq-ms) var(--sq-ease)`,
                                            backgroundImage:
                                                "linear-gradient(to top, rgb(0 0 0 / 0.55), transparent)",
                                        }}
                                    >
                                        {slide.overlay}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div id={`${ids}-panel`} role="tabpanel" aria-live="polite" className="mt-6 grid @xl:mt-7">
                {slides.map((slide, i) => {
                    const shown = i === open;

                    return (
                        <div
                            key={slide.id ?? i}
                            aria-hidden={!shown}
                            className={cn(
                                "col-start-1 row-start-1 flex flex-col gap-4",
                                "@xl:flex-row @xl:items-start @xl:justify-between @xl:gap-10",
                            )}
                            style={{
                                opacity: shown ? 1 : 0,
                                visibility: shown ? "visible" : "hidden",
                                pointerEvents: shown ? "auto" : "none",
                                transition: `opacity var(--sq-ms) var(--sq-ease), visibility var(--sq-ms)`,
                            }}
                        >
                            <p className="max-w-[46rem] text-[16px] leading-[1.75] text-balance @lg:text-[18px]">
                                <span>{slide.title}</span>{" "}
                                {slide.description && (
                                    <span className="opacity-70">{slide.description}</span>
                                )}
                            </p>

                            {slide.action && <Action slide={slide} shown={shown} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   pieces                                   */
/* -------------------------------------------------------------------------- */

/**
 * Drawn at a fixed 16:9 block and centred, never at the width of its card.
 * Left to itself `object-fit: cover` reads whichever edge binds — height while
 * the card is a slat, width once it opens — so the picture would rescale
 * mid-slide and be resampled every frame. One block means one scale: the card
 * only ever changes how much of it you can see.
 */
function Picture({ slide }: { slide: SqueezeSlide }) {
    const box = {
        width: "var(--sq-hero)",
        minWidth: "100%",
    } as const;

    if (slide.image) {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- sized and cropped by the carousel itself
            <img
                src={slide.image}
                alt={slide.imageAlt ?? ""}
                draggable={false}
                className="absolute inset-y-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover"
                style={box}
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{ background: slide.background, ...box }}
        />
    );
}

function Arrow({
    back = false,
    label,
    disabled,
    onClick,
}: {
    back?: boolean;
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "grid size-9 cursor-pointer place-items-center rounded-md disabled:cursor-default disabled:opacity-30",
                "bg-[var(--sq-fill)] text-[var(--sq-on-fill)]",
                "transition-opacity enabled:hover:opacity-85 outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            )}
        >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path
                    d={
                        back
                            ? "M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z"
                            : "M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z"
                    }
                />
            </svg>
        </button>
    );
}

/** The button under the copy. A link when it has an `href`, a button otherwise. */
function Action({ slide, shown }: { slide: SqueezeSlide; shown: boolean }) {
    const inside = (
        <>
            {slide.action}
            <svg
                width="6"
                height="9"
                viewBox="0 0 6 9"
                fill="none"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover/sq-action:translate-x-0.5"
            >
                <path
                    d="M1.2 1 4.7 4.5 1.2 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </>
    );

    const dress = cn(
        "group/sq-action inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md",
        "bg-[var(--sq-fill)] px-10 py-5 text-[13px] font-bold uppercase tracking-[0.15em] text-[var(--sq-on-fill)]",
        "transition-opacity hover:opacity-85 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
    );

    if (slide.href) {
        return (
            <a
                href={slide.href}
                target={slide.target}
                rel={slide.target === "_blank" ? "noreferrer" : undefined}
                tabIndex={shown ? 0 : -1}
                onClick={slide.onAction}
                className={dress}
            >
                {inside}
            </a>
        );
    }

    return (
        <button type="button" tabIndex={shown ? 0 : -1} onClick={slide.onAction} className={dress}>
            {inside}
        </button>
    );
}

export default SqueezeCarousel;
