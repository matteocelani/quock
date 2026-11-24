import type { ComponentProps, ReactNode } from "react";

type IconProps = ComponentProps<"svg">;

// One stroke geometry for every glyph: 24-unit box, 1.75 stroke, round caps — drawn in-house, no icon package.
function Stroke({ children, ...props }: IconProps): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}


export const ArrowIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Stroke>
);

export const CheckIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);

export const StreamIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M4 6h16" />
    <path d="M4 11h12" />
    <path d="M4 16h7" />
    <path d="M14 18.5h.01" />
  </Stroke>
);

export const ModelsIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="m12 3-9 5 9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Stroke>
);

export const ThinkIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
  </Stroke>
);

export const GlobeIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19" />
    <path d="M12 2.5a14.5 14.5 0 0 1 0 19 14.5 14.5 0 0 1 0-19Z" />
  </Stroke>
);

export const DocumentIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7" />
    <path d="M8.5 17h4.5" />
  </Stroke>
);

export const ImageIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="1.75" />
    <path d="m21 15-4.5-4.5L5 21" />
  </Stroke>
);

export const LockIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <rect x="4.5" y="11" width="15" height="10" rx="2.5" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
  </Stroke>
);

export const MemoryIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M18 21 12 17l-6 4V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z" />
  </Stroke>
);

export const MoonIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Stroke>
);


export const PinIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M12 16v5" />
    <path d="M9 3h6l-.8 5.5L18 12v1.5H6V12l3.8-3.5Z" />
  </Stroke>
);

export const ForkIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <circle cx="6" cy="5" r="2" />
    <circle cx="18" cy="5" r="2" />
    <circle cx="12" cy="19" r="2" />
    <path d="M6 7v1.5A3.5 3.5 0 0 0 9.5 12h5A3.5 3.5 0 0 0 18 8.5V7" />
    <path d="M12 12v5" />
  </Stroke>
);

export const KeyIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <circle cx="8" cy="15" r="4.5" />
    <path d="m11.2 11.8 8.8-8.8" />
    <path d="m17 6 3 3" />
  </Stroke>
);

export const CodeIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="m8 6-6 6 6 6" />
    <path d="m16 6 6 6-6 6" />
  </Stroke>
);

export const ResumeIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M7 4.5v15l12-7.5Z" />
  </Stroke>
);

export const EyeOffIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4" />
    <path d="M6.6 6.6A16.5 16.5 0 0 0 2.5 12s3.5 7 9.5 7a9.4 9.4 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Stroke>
);

export const PhoneIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <rect x="6" y="2.5" width="12" height="19" rx="3" />
    <path d="M11 18.5h2" />
  </Stroke>
);

// GitHub's own mark, used only to label the link to the repository.
export const GithubIcon = (p: IconProps): ReactNode => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);

export const ChatBubbleIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5Z" />
    <path d="M8.5 8h7" />
    <path d="M8.5 11.5h4.5" />
  </Stroke>
);

export const NotesIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h3.5" />
  </Stroke>
);

export const DownloadIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M12 3.5v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
  </Stroke>
);

export const CursorIcon = (p: IconProps): ReactNode => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M5.2 3.4a.8.8 0 0 1 1.1-.7l13 5.6a.8.8 0 0 1-.1 1.5l-5.5 1.6-2.4 5.3a.8.8 0 0 1-1.5-.1Z" />
  </svg>
);

export const CameraIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </Stroke>
);

export const SearchIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Stroke>
);


export const SparkIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M12 3c.6 4.2 2.3 6.4 6.5 7-4.2.6-5.9 2.8-6.5 7-.6-4.2-2.3-6.4-6.5-7 4.2-.6 5.9-2.8 6.5-7Z" />
    <path d="M19 15.5c.3 1.7 1 2.4 2.5 2.7-1.5.3-2.2 1-2.5 2.8-.3-1.8-1-2.5-2.5-2.8 1.5-.3 2.2-1 2.5-2.7Z" />
  </Stroke>
);

export const ShieldIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Stroke>
);

export const HandIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5" />
    <path d="M12 10V4a1.5 1.5 0 0 1 3 0v6" />
    <path d="M15 10V6a1.5 1.5 0 0 1 3 0v7.5a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.3-2.7L3.6 15a1.6 1.6 0 0 1 2.4-2l3 2.5V11" />
  </Stroke>
);

export const CopyIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </Stroke>
);

export const SelectIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M5 4h3" />
    <path d="M5 20h3" />
    <path d="M6.5 4v16" />
    <path d="M12 8h8" />
    <path d="M12 12h8" />
    <path d="M12 16h5" />
  </Stroke>
);

export const RegenerateIcon = (p: IconProps): ReactNode => (
  <Stroke {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v5h-5" />
  </Stroke>
);

// X's own mark, used only to label the link to the maker's profile.
export const XIcon = (p: IconProps): ReactNode => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.19L2 3h6.33l4.37 5.77Zm-1.08 16.18h1.7L7.4 4.73H5.58Z" />
  </svg>
);
