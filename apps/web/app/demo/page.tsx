import { ArrowUpRight, Info } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/ui";
import { Poster } from "@/components/poster";
import { WorkspaceStart } from "@/components/workspace-start";
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
            An unused evening can become something people choose. Start with our
            fictional room, or bring the one you know. What happens next is up
            to you.
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
          <WorkspaceStart />
          <div className="demo-qloo">
            <Info size={17} />
            <p>
              Qloo connects cultural references. The AI producer composes the
              possibilities. Availability, costs, rights and every consequential
              decision stay with people.
            </p>
          </div>
          <div className="demo-fine">
            No account. No charges. Your desk is private to this browser.
            <br />
            Rehearsals expire after 24 hours. Save your participant links
            separately.
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
