"use client";
import { WorkspaceProvider } from "./workspace-context";
import { StudioShell } from "./studio-shell";
import { Overview } from "./studio/overview";
import { BriefView } from "./studio/brief";
import { ConceptsView } from "./studio/concepts";
import { DemandView } from "./studio/demand";
import { ProductionView } from "./studio/production";
import { ChangesView } from "./studio/changes";
import { ResultsView } from "./studio/results";
import { VenueView } from "./studio/venue";
export function StudioApp({ tab }: { tab: string }) {
  return (
    <WorkspaceProvider>
      <StudioShell tab={tab}>
        {tab === "overview" ? (
          <Overview />
        ) : tab === "venue" ? (
          <VenueView />
        ) : tab === "brief" ? (
          <BriefView />
        ) : tab === "concepts" ? (
          <ConceptsView />
        ) : tab === "demand" ? (
          <DemandView />
        ) : tab === "changes" ? (
          <ChangesView />
        ) : tab === "results" ? (
          <ResultsView />
        ) : (
          <ProductionView />
        )}
      </StudioShell>
    </WorkspaceProvider>
  );
}
