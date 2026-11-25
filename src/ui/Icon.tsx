/** A stroked path, or a filled shape when `fill` is set. Every part is drawn in currentColor. */
type Part = string | { d: string; fill?: true; transform?: string };

const HEART =
  "M12 20.5 4.6 13.3C3.2 11.9 2.5 10.4 2.5 8.6A5.1 5.1 0 0 1 7.6 3.5c1.7 0 3 .6 4.4 2 1.4-1.4 2.7-2 4.4-2a5.1 5.1 0 0 1 5.1 5.1c0 1.8-.7 3.3-2.1 4.7z";
/** The image subject: a small filled heart in the middle of the icon. */
const SUBJECT: Part = { d: HEART, fill: true, transform: "translate(12 12.4) scale(0.52) translate(-12 -12)" };

const ICONS = {
  download: ["M12 4v11M7 10.5l5 5 5-5M5 20h14"],
  image: ["M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01"],
  text: ["M5 7V5h14v2M12 5v14M9 19h6"],
  trash: ["M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"],
  reset: ["M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"],
  close: ["M6 6l12 12M18 6 6 18"],
  lock: ["M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  minus: ["M6 12h12"],
  plus: ["M12 6v12M6 12h12"],
  // Layer order: the filled square is the selected element.
  "layer-forward": ["M10 14H4V4h10v6", { d: "M10 10h10v10H10z", fill: true }],
  "layer-backward": [{ d: "M4 4h10v6h-4v4H4z", fill: true }, "M10 10h10v10H10z"],
  "align-left": ["M4 6h16M4 10h10M4 14h16M4 18h10"],
  "align-center": ["M4 6h16M7 10h10M4 14h16M7 18h10"],
  "align-right": ["M4 6h16M10 10h10M4 14h16M10 18h10"],
  bold: ["M7.5 5h5.25a3.5 3.5 0 0 1 0 7H7.5zM7.5 12h6.25a3.5 3.5 0 0 1 0 7H7.5z"],
  angle: ["M4 19h16M4 19 15 6M10 19a6 6 0 0 0-2.1-4.6"],
  "stroke-width": [
    { d: "M4 5h16v1.25H4z", fill: true },
    { d: "M4 10.25h16v2.5H4z", fill: true },
    { d: "M4 16h16v4H4z", fill: true },
  ],
  // Outline styles, read left to right: subject alone · smooth border · straight scissor-cut border.
  "outline-none": [SUBJECT],
  "outline-clean": [SUBJECT, HEART],
  "outline-cutout": [SUBJECT, { d: "M12 21 3.4 13.2 2.4 7.4 5.6 3.4 9.6 3.2 12 5.6 14.6 3.1 18.6 3.6 21.6 7.6 20.4 13.4z" }],
} satisfies Record<string, readonly Part[]>;

export type IconName = keyof typeof ICONS;

type Props = { name: IconName; size?: "sm" | "md"; label?: string };

/** SVG icon drawn in currentColor. Decorative unless a label is given. */
export function Icon({ name, size = "sm", label }: Props) {
  return (
    <svg
      className={"icon" + (size === "md" ? " icon--md" : "")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {(ICONS[name] as readonly Part[]).map((part, index) =>
        typeof part === "string" ? (
          <path key={index} d={part} />
        ) : part.fill ? (
          <path key={index} d={part.d} transform={part.transform} fill="currentColor" stroke="none" />
        ) : (
          <path key={index} d={part.d} transform={part.transform} strokeLinejoin="miter" />
        ),
      )}
    </svg>
  );
}
