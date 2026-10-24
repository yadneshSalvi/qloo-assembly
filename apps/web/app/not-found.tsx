import { ArrowLeft } from "lucide-react";
import { Logo, ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <main id="main" className="not-found public-site">
      <Logo />
      <div className="eyebrow">A SMALL DETOUR</div>
      <h1>
        This room
        <br />
        <em>isn’t open.</em>
      </h1>
      <p>
        We couldn’t find that page. Let’s get you back to the night in the
        making.
      </p>
      <ButtonLink href="/studio">
        <ArrowLeft size={17} />
        Back to the studio
      </ButtonLink>
    </main>
  );
}
