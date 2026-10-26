"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  CircleHelp,
  ClipboardList,
  DoorOpen,
  ExternalLink,
  FileText,
  LayoutDashboard,
  MapPin,
  Menu,
  Plus,
  RotateCcw,
  ShieldCheck,
  Users,
  X,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { eventDate } from "@/lib/format";
import { Logo, Button, ButtonLink, Badge } from "./ui";
import { useWorkspace } from "./workspace-context";
import { EvidenceDrawer } from "./evidence-drawer";
import { WorkspaceMenu } from "./workspace-menu";
const links = [
  { tab: "brief", label: "The brief", icon: FileText },
  { tab: "concepts", label: "Concepts", icon: AudioLines },
  { tab: "demand", label: "Audience", icon: Users },
  { tab: "production", label: "Production", icon: ClipboardList },
  { tab: "results", label: "The outcome", icon: CheckCircle2 },
];
export function StudioShell({
  tab,
  children,
}: {
  tab: string;
  children: ReactNode;
}) {
  const {
    workspace: w,
    loading,
    error,
    notice,
    busy,
    reset,
    refresh,
    clearError,
  } = useWorkspace();
  const [evidence, setEvidence] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => {
      if (!query.matches) setMobile(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (mobile)
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>(
          'button[aria-label="Close navigation"]',
        )
        ?.focus();
    else if (wasOpen.current) mobileTriggerRef.current?.focus();
    wasOpen.current = mobile;
  }, [mobile]);
  function trapNavigation(event: KeyboardEvent<HTMLElement>) {
    if (!mobile) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMobile(false);
    }
    if (event.key === "Tab") {
      const items = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) || [],
      ).filter((el) => el.offsetWidth > 0);
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  const progress =
    w?.event.lifecycle === "DRAFT"
      ? 0
      : w?.event.lifecycle === "RESEARCHING"
        ? 0
        : w?.event.lifecycle === "CONCEPT_READY"
          ? 1
          : w?.event.lifecycle === "VALIDATION_OPEN"
            ? 2
            : w?.event.lifecycle === "COMPLETED"
              ? 4
              : 3;
  return (
    <div className="studio">
      <aside
        ref={sidebarRef}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label={mobile ? "Production navigation" : undefined}
        onKeyDown={trapNavigation}
        className={clsx("studio-sidebar", mobile && "sidebar-open")}
      >
        <div className="sidebar-brand">
          <Logo light />
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <DoorOpen size={18} />
          </span>
          <div>
            <strong>{w?.venue.name || "Your venue"}</strong>
            <small>{w?.venue.neighborhood || "A room with possibility"}</small>
          </div>
          <Badge dot={false}>{w?.mode === "REAL" ? "OWN" : "SAMPLE"}</Badge>
        </div>
        <div className="nav-heading">YOUR SPACE</div>
        <nav aria-label="Studio navigation">
          <WorkspaceMenu />
          <Link
            className={clsx("nav-link", tab === "overview" && "active")}
            href="/studio"
            onClick={() => setMobile(false)}
          >
            <LayoutDashboard size={17} />
            Overview
          </Link>
          <Link
            className={clsx("nav-link", tab === "venue" && "active")}
            href="/studio/venue"
            onClick={() => setMobile(false)}
          >
            <CalendarDays size={17} />
            Venue & availability
          </Link>
        </nav>
        <Link
          className={clsx("nav-link", tab === "suppliers" && "active")}
          href="/studio/suppliers"
          onClick={() => setMobile(false)}
        >
          <Users size={17} />
          People & offers
        </Link>
        <div className="nav-heading production-nav-heading">
          IN PRODUCTION<span>01</span>
        </div>
        <Link
          className="sidebar-event"
          href="/studio/events/current/brief"
          onClick={() => setMobile(false)}
        >
          <div className="mini-poster">
            <span>
              {(w?.event.title.split(/\s+/)[0]?.[0] || "a").toLowerCase()}
              <em>
                {(w?.event.title.split(/\s+/)[1]?.[0] || "s").toLowerCase()}
              </em>
            </span>
          </div>
          <div>
            <strong>
              {w?.event.title.replace(/,.*/, "").replace(/\.$/, "") ||
                "Your evening"}
            </strong>
            <small>
              {w ? eventDate(w.terms.date, true) : "Date to choose"} ·{" "}
              {w?.venue.capacity || 48} places
            </small>
          </div>
        </Link>
        <nav className="event-nav" aria-label="Production steps">
          {links.map((l, i) => (
            <Link
              className={clsx("nav-link", tab === l.tab && "active")}
              href={`/studio/events/current/${l.tab}`}
              key={l.tab}
              onClick={() => setMobile(false)}
            >
              <l.icon size={16} />
              {l.label}
              {i < progress ? <Check size={12} className="nav-done" /> : null}
            </Link>
          ))}
        </nav>
        <Link
          className="sidebar-create"
          href="/studio/events/current/brief"
          onClick={() => setMobile(false)}
        >
          <Plus size={15} />
          Shape your production
        </Link>
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={() => setEvidence(true)}>
            <BookOpen size={16} />
            Evidence & sources
            <ArrowUpRight size={13} />
          </button>
          {w?.mode === "SAMPLE" ? (
            <button className="nav-link" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} />
              Reset sample
            </button>
          ) : null}
          <Link className="nav-link" href="/">
            <ArrowDownLeft size={16} />
            Back to Assembly
          </Link>
          <div className="sidebar-user">
            <span className="avatar">A</span>
            <div>
              <strong>Your private desk</strong>
              <small>Owner access · this browser</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      {mobile ? (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <div className="studio-body" inert={mobile || undefined}>
        <header className="studio-topbar">
          <div className="studio-breadcrumb">
            <button
              ref={mobileTriggerRef}
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
              aria-expanded={mobile}
            >
              <Menu size={20} />
            </button>
            <span>{w?.venue.name || "The Fold"}</span>
            <span className="breadcrumb-slash">/</span>
            <span>
              {tab === "overview"
                ? "Production desk"
                : tab === "venue"
                  ? "Venue & availability"
                  : w?.event.title.replace(/,.*/, "") || "Your evening"}
            </span>
          </div>
          <div className="topbar-status">
            <span className="saved-status">
              <span className="status-dot" />
              {busy
                ? "Saving…"
                : loading
                  ? "Opening studio…"
                  : "Saved to your workspace"}
            </span>
            <Badge tone={w?.mode === "REAL" ? "neutral" : "warning"}>
              {w?.mode === "REAL"
                ? "Operator-owned production"
                : "Sample operations"}
            </Badge>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="studio-main">
          {error ? (
            <div className="feedback feedback-error" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>That needs another look.</strong>
                <p>{error}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  clearError();
                  void refresh();
                }}
              >
                Refresh
              </Button>
              <button
                className="icon-button"
                onClick={clearError}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="feedback feedback-success" role="status">
              <CheckCircle2 size={17} />
              <p>{notice}</p>
            </div>
          ) : null}
          {loading ? (
            <StudioSkeleton />
          ) : !w ? (
            <div className="connection-error">
              <CircleHelp size={30} />
              <h1>The studio is taking a moment.</h1>
              <p>
                We couldn’t reach the saved workspace. Check that the database
                is running, then try again.
              </p>
              <Button onClick={() => void refresh()}>
                Try again <RotateCcw size={16} />
              </Button>
            </div>
          ) : (
            <>
              {!["overview", "venue", "suppliers"].includes(tab) ? (
                <>
                  <div className="event-heading">
                    <div>
                      <div className="eyebrow">
                        PRODUCTION 001<span className="heading-dot">·</span>
                        {w.venue.name.toUpperCase()}
                      </div>
                      <h1>{w.event.title}</h1>
                      <div className="event-subtitle">
                        <span>
                          <CalendarDays size={13} />
                          {eventDate(w.terms.date)}
                        </span>
                        <span>
                          <MapPin size={13} />
                          {w.venue.neighborhood}
                        </span>
                        <Badge
                          tone={
                            w.event.bookingPaused
                              ? "warning"
                              : progress >= 3
                                ? "positive"
                                : "neutral"
                          }
                        >
                          {w.event.bookingPaused
                            ? "Booking paused"
                            : w.event.lifecycle
                                .replaceAll("_", " ")
                                .toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="event-heading-actions">
                      <button
                        className="evidence-trigger"
                        onClick={() => setEvidence(true)}
                      >
                        <BookOpen size={15} />
                        See the thinking
                      </button>
                      <ButtonLink
                        href={
                          w.event.publishedAt
                            ? `/events/${w.event.slug}`
                            : "/studio/events/current/demand"
                        }
                        variant="secondary"
                      >
                        {w.event.publishedAt
                          ? "Public page"
                          : "Proposal preview"}{" "}
                        <ExternalLink size={14} />
                      </ButtonLink>
                    </div>
                  </div>
                  <nav className="production-steps" aria-label="Event journey">
                    {links.map((l, i) => (
                      <Link
                        key={l.tab}
                        href={`/studio/events/current/${l.tab}`}
                        className={clsx(
                          tab === l.tab && "current",
                          i < progress && "complete",
                        )}
                        aria-current={tab === l.tab ? "step" : undefined}
                      >
                        <span className="step-number">
                          {i < progress ? (
                            <Check size={11} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        {l.label}
                        {i < 4 ? <ArrowRight size={13} /> : null}
                      </Link>
                    ))}
                  </nav>
                </>
              ) : null}
              {children}
              <div className="studio-footnote">
                <span>
                  <Circle size={7} />
                  {w.mode === "SAMPLE"
                    ? "Fictional rehearsal · sample operations"
                    : "Operator-owned production · free places"}{" "}
                  ·{" "}
                  {w.qloo.status === "LIVE"
                    ? "Live Qloo evidence"
                    : "Evidence labelled by source"}
                </span>
                <button onClick={() => setEvidence(true)}>
                  About this evidence <ArrowUpRight size={12} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
      <EvidenceDrawer open={evidence} onOpenChange={setEvidence} />
      <Dialog.Root open={resetOpen} onOpenChange={setResetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal dark-modal">
            <Dialog.Close
              className="icon-button modal-close"
              aria-label="Close"
            >
              <X size={18} />
            </Dialog.Close>
            <div className="eyebrow">
              <RotateCcw size={15} />A FRESH START
            </div>
            <Dialog.Title>
              Another night,
              <br />
              <em>another possibility.</em>
            </Dialog.Title>
            <Dialog.Description>
              This clears this browser’s sample choices, approvals, guest list,
              and production tasks. Other workspaces are unaffected.
            </Dialog.Description>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setResetOpen(false)}>
                Keep this production
              </Button>
              <Button
                busy={busy === "RESET"}
                onClick={async () => {
                  if (await reset()) {
                    setResetOpen(false);
                    router.push("/studio");
                  }
                }}
              >
                Reset my sample
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
export function StudioSkeleton() {
  return (
    <div
      className="studio-skeleton"
      aria-label="Loading saved studio"
      role="status"
    >
      <div />
      <div />
      <div className="skeleton-columns">
        <i />
        <i />
      </div>
      <span className="sr-only">Loading your saved production…</span>
    </div>
  );
}
