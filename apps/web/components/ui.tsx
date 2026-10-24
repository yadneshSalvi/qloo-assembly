import Link from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={clsx("brand", light && "brand-light")}
      aria-label="Assembly home"
    >
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      ASSEMBLY<span className="brand-period">.</span>
    </Link>
  );
}
export function Button({
  children,
  variant = "primary",
  busy = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={clsx("button", `button-${variant}`, className)}
    >
      {busy ? (
        <LoaderCircle size={17} className="spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx("button", `button-${variant}`, className)}
    >
      {children}
    </Link>
  );
}
export function Badge({
  children,
  tone = "neutral",
  dot = true,
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "coral";
  dot?: boolean;
}) {
  return (
    <span className={clsx("badge", `badge-${tone}`)}>
      {dot ? <span className="status-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PublicHeader() {
  return (
    <header className="public-header">
      <Logo />
      <nav aria-label="Main navigation">
        <Link href="/#the-idea">The idea</Link>
        <Link href="/#a-night">A night in the making</Link>
        <Link href="/#how-it-works">How it works</Link>
      </nav>
      <ButtonLink href="/demo">
        Enter the studio <ArrowUpRight size={17} />
      </ButtonLink>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Logo />
      <p>For the spaces that bring us together.</p>
      <span>Independent nights. Shared culture.</span>
    </footer>
  );
}
