type LogoProps = {
  small?: boolean;
};

export function Logo({ small = false }: LogoProps) {
  return (
    <div className={`logo ${small ? "logo--small" : ""}`} aria-label="Link Town">
      <svg className="logo__mark" viewBox="0 0 48 48" role="img" aria-label="Link Town logo">
        <path className="logo__orange" d="M8 8h10v19c0 5.7 3.8 9.8 9.5 9.8h2.2v9.1h-3C15.2 45.9 8 38.7 8 27.2z" />
        <path className="logo__green" d="M21 8h19v10H29.7v20.1H21z" />
        <path className="logo__yellow" d="M18 8h17.5c3.1 0 5.5 2.4 5.5 5.5V18H25.4c-4.1 0-7.4 3.3-7.4 7.4z" />
      </svg>
      <span>Link Town</span>
    </div>
  );
}
