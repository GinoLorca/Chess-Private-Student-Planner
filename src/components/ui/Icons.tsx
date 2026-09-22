import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)
export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const Plus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const More = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
)
export const Settings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
  </svg>
)
export const Trash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
export const Pencil = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
)
export const Check = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const Close = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const Play = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 5v14l12-7z" />
  </svg>
)
export const Eye = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const Folder = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
  </svg>
)
export const Document = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5M10 13h6M10 17h6" />
  </svg>
)
export const Sun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const Moon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
)
export const Grip = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
)
export const Download = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7 10l5 5 5-5M4 19h16" />
  </svg>
)
export const Upload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15V4M7 9l5-5 5 5M4 19h16" />
  </svg>
)
export const Warning = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4.5M12 17.5v.5" />
  </svg>
)
export const Camera = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
)
export const Sparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
  </svg>
)
export const Knight = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M6.5 20h11v-1.5c0-1.2-.6-1.8-1.5-2.2 1.7-2.2 2.2-5 1.6-7.4C17 6.3 15 4.4 12 4l-.4 1.7-1.6.6c-1.7.7-2.8 2-3.2 3.5-.2.7.2 1.4.9 1.6l1.6.4.4-1.2c.3-.8 1.1-1 1.5-.6.5.5.2 1.5-.5 2.1-1.5 1.1-3.3 2.1-3.7 3.9-.3 1.3-.2 2.6-.5 4Z" />
  </svg>
)
export const Home = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-6h4v6" />
  </svg>
)
export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </svg>
)
export const Target = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)
/** Three arrows chasing round a triangle. */
export const Recycle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 13.1 10.5 7.05M7.78 8.32 10.5 7.05l.26 2.99" />
    <path d="M7 13.1 10.5 7.05M7.78 8.32 10.5 7.05l.26 2.99" transform="rotate(120 12 12)" />
    <path d="M7 13.1 10.5 7.05M7.78 8.32 10.5 7.05l.26 2.99" transform="rotate(240 12 12)" />
  </svg>
)
export const Library = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.5h5v14H4z" />
    <path d="M10 5.5h5v14h-5z" />
    <path d="m16.5 6.5 3.5-.8 3 13.6-3.5.8z" />
  </svg>
)
