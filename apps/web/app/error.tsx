"use client";
import { Button, ButtonLink } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="not-found public-site">
      <div className="eyebrow">SOMETHING INTERRUPTED THE EVENING</div>
      <h1>
        Let’s pick
        <br />
        <em>this back up.</em>
      </h1>
      <p>
        Your saved production is still in the database. Try reloading this view.
      </p>
      <div className="hero-actions">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      </div>
    </main>
  );
}
