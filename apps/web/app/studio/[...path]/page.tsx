import { notFound } from "next/navigation";
import { StudioApp } from "@/components/studio-app";
export default async function StudioSection({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (path.length === 1 && ["venue", "suppliers"].includes(path[0]))
    return <StudioApp tab={path[0]} />;
  if (path[0] === "venues" && path[1] === "the-fold" && path.length === 2)
    return <StudioApp tab="venue" />;
  if (path[0] !== "events" || !["current", "blue-hour"].includes(path[1]))
    notFound();
  if (path[2] === "changes" && path.length === 4)
    return <StudioApp tab="changes" />;
  if (
    path.length !== 3 ||
    !["brief", "concepts", "demand", "production", "results"].includes(path[2])
  )
    notFound();
  return <StudioApp tab={path[2]} />;
}
