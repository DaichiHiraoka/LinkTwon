type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </Svg>
);

export const CalendarIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </Svg>
);

export const StoreIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M5 9v11h14V9" />
    <path d="M3 9c0 2 2 3 4 3s4-1 4-3M11 9c0 2 2 3 4 3s4-1 4-3" />
  </Svg>
);

export const ServiceIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l3 5 5 1-3.5 4 1 5L12 16l-5.5 2 1-5L4 9l5-1z" />
  </Svg>
);

export const UserIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 5-6 8-6s7 2 8 6" />
  </Svg>
);

export const BellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 3H4z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const FilterIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </Svg>
);

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const PencilIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20h4l11-11-4-4L4 16z" />
    <path d="m14 5 4 4" />
  </Svg>
);

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const HelpIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .7-1 1.7" />
    <path d="M12 17h.01" />
  </Svg>
);

export const SettingsIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m6 6 12 12M6 18 18 6" />
  </Svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);
