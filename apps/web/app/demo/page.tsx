import { ArrowRight, ArrowUpRight, Check, Info } from "lucide-react";
import { PublicHeader, PublicFooter, Badge, ButtonLink } from "@/components/ui";
import { Poster } from "@/components/poster";
export const metadata = { title: "A room full of possibility" };
export default function Demo() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main" className="demo-page">
        <div className="demo-copy">
          <div className="eyebrow">THE NEXT GOOD NIGHT IS YOURS TO MAKE</div>
          <h1>
            Your room.
            <br />
            <em>Your call.</em>
          </h1>
          <p>
            Step into The Fold, an independent space with an open Saturday
            evening. A few good ingredients are already on the table. What
            happens next is up to you.
          </p>
          <div className="demo-facts">
            <div>
              <strong>48</strong>
              <span>seated places</span>
            </div>
            <div>
              <strong>14 Nov</strong>
              <span>one open evening</span>
            </div>
            <div>
              <strong>£1,600</strong>
              <span>production budget</span>
            </div>
          </div>
          <div className="demo-mode">
            <div>
              <Badge tone="positive">Ready to explore</Badge>
              <h2>An isolated sample studio</h2>
              <p>
                Fictional venue and suppliers. Authored cultural concepts. Real
                application state, saved as you go.
              </p>
            </div>
            <Check size={22} />
          </div>
          <div className="demo-qloo">
            <Info size={17} />
            <p>
              Qloo is not connected yet. Every creative connection is labeled as
              an authored example. Live research requires a server-side API key.
            </p>
          </div>
          <ButtonLink href="/studio">
            Open my production desk <ArrowRight size={18} />
          </ButtonLink>
          <div className="demo-fine">
            No account. No charges. No real bookings.
            <br />
            Your sample workspace expires after 24 hours.
          </div>
        </div>
        <div className="demo-poster">
          <Poster />
          <div className="demo-poster-caption">
            <span>ONE POSSIBLE EVENING</span>
            <ArrowUpRight size={18} />
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
