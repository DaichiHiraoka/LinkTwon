type IconProps = {
  label?: string;
};

function Svg({ label, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role={label ? "img" : "presentation"}
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {children}
    </svg>
  );
}

export function MailIcon() {
  return (
    <Svg label="メール">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Svg>
  );
}

export function HelpIcon() {
  return (
    <Svg label="ヘルプ">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.8 2.8 0 0 1 5 1.7c0 2-2.5 2.2-2.5 4" />
      <path d="M12 18h.01" />
    </Svg>
  );
}

export function HomeIcon() {
  return (
    <Svg>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-7h6v7" />
    </Svg>
  );
}

export function EventIcon() {
  return (
    <Svg>
      <rect x="4" y="5" width="16" height="16" rx="1.5" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 14h8" />
    </Svg>
  );
}

export function QrIcon() {
  return (
    <Svg>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v6h-4v-2M14 18v2" />
    </Svg>
  );
}

export function WalletIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12M8.5 9h5.25a2.25 2.25 0 0 1 0 4.5H10a2.25 2.25 0 0 0 0 4.5h5.5" />
    </Svg>
  );
}

export function AccountIcon() {
  return (
    <Svg>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </Svg>
  );
}

export function CheckIcon() {
  return (
    <Svg>
      <path d="m5 12 5 5L20 7" />
    </Svg>
  );
}

export function ArrowIcon() {
  return (
    <Svg>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}
