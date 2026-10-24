import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CircleDot,
  MoveUpRight,
  Sparkles,
  Utensils,
  Users,
} from "lucide-react";
import { PublicHeader, PublicFooter, ButtonLink, Badge } from "@/components/ui";
import { Poster } from "@/components/poster";
export default function Home() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main id="main">
        <section className="landing-hero" id="the-idea">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="small-line" />A CULTURAL PRODUCTION STUDIO
            </div>
            <h1>
              Good nights
              <br />
              don’t happen
              <br />
              <em>by chance.</em>
            </h1>
            <p>
              One open evening. A room full of possibility.
              <br />
              Bring the right people, tastes, and ideas together
              <br className="desktop-break" /> — then make it happen.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/demo">
                Make a night of it <ArrowUpRight size={18} />
              </ButtonLink>
              <Link className="text-link" href="#a-night">
                See what comes together <ArrowDown size={16} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span className="sample-ring" />
              An interactive sample studio. No account needed.
            </div>
          </div>
          <div className="hero-visual">
            <div className="poster-label">
              <span>IN THE MAKING / NO. 001</span>
              <MoveUpRight size={21} />
            </div>
            <Poster />
            <div className="hero-caption">
              <span>A little jazz. A shared table. A new connection.</span>
              <span>01 / 03</span>
            </div>
            <div className="side-note">
              SOMETHING GOOD HAPPENS WHEN WE GATHER.
            </div>
          </div>
        </section>
        <div className="editorial-band">
          <span>A room becomes a reason.</span>
          <i>✳</i>
          <span>Taste becomes a shared experience.</span>
          <i>✳</i>
          <span>An idea becomes a night.</span>
          <i>✳</i>
        </div>
        <section id="a-night" className="story-section">
          <div className="story-heading">
            <div>
              <div className="eyebrow">A NIGHT IN THE MAKING</div>
              <h2>
                Not just another event.
                <br />
                <em>A reason to be there.</em>
              </h2>
            </div>
            <p>
              Start with what you love. Find the unexpected connections. Build
              something only your space could host.
            </p>
          </div>
          <div className="story-board">
            <div className="story-details">
              <Badge tone="coral">Authored sample concept</Badge>
              <h3>
                Blue hour,
                <br />
                shared table.
              </h3>
              <p>
                The warmth of a vinyl listening room meets the generosity of a
                long-table supper. Soulful grooves, seasonal plates, and
                conversations that linger.
              </p>
              <div className="story-ingredients">
                <span>
                  <AudioLines size={18} />
                  An intimate live set
                </span>
                <span>
                  <Utensils size={18} />A seasonal sharing menu
                </span>
                <span>
                  <Users size={18} />
                  48 people, one table
                </span>
              </div>
              <ButtonLink href="/events/blue-hour" variant="secondary">
                Step inside the night <ArrowUpRight size={17} />
              </ButtonLink>
            </div>
            <div
              className="taste-map"
              aria-label="Authored cultural influences for the sample concept"
            >
              <div className="map-caption">
                THE CONNECTIONS BEHIND THE CONCEPT
              </div>
              <div className="anchor-card anchor-music">
                <AudioLines size={20} />
                <small>THE SOUND</small>
                <strong>Khruangbin</strong>
                <span>Warm, expansive grooves</span>
              </div>
              <div className="anchor-card anchor-film">
                <CircleDot size={20} />
                <small>THE MOOD</small>
                <strong>Wong Kar-wai</strong>
                <span>Everyday intimacy</span>
              </div>
              <div className="anchor-card anchor-food">
                <Utensils size={20} />
                <small>THE TABLE</small>
                <strong>Ottolenghi</strong>
                <span>Generous, colorful plates</span>
              </div>
              <div className="map-center">
                <Sparkles size={22} />
                <span>
                  A shared
                  <br />
                  <em>feeling.</em>
                </span>
              </div>
              <svg viewBox="0 0 580 420" aria-hidden="true">
                <path d="M160 115C230 115 245 200 290 210M415 110C340 110 340 175 290 210M370 340C315 340 330 245 290 210" />
              </svg>
              <div className="map-note">
                Editorial connections · Qloo evidence is not connected
              </div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="eyebrow">FROM POSSIBLE TO HAPPENING</div>
          <h2>
            Culture brings the spark.
            <br />
            <em>You make the call.</em>
          </h2>
          <div className="how-grid">
            {[
              {
                n: "01",
                t: "Start with your space.",
                d: "An open date, a real capacity, a few cultural anchors. Give your evening its starting point.",
              },
              {
                n: "02",
                t: "Find its character.",
                d: "Explore three distinct concepts, see the thinking, and choose the one that feels right.",
              },
              {
                n: "03",
                t: "Bring it to life.",
                d: "Test interest, confirm the people, and keep the production moving — even when plans change.",
              },
            ].map((s) => (
              <div key={s.n}>
                <span className="how-number">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
          <ButtonLink href="/demo">
            Your next good night starts here <ArrowRight size={18} />
          </ButtonLink>
        </section>
        <section className="landing-note">
          <span className="sample-ring" />
          <p>
            This is a working sample experience with fictional inventory. Your
            choices are saved in an isolated workspace. No real reservations,
            payments, or messages are sent.
          </p>
          <Link href="/demo">
            Explore the studio <ArrowUpRight size={16} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
