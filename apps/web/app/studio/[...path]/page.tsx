import { notFound } from "next/navigation";
import { StudioApp } from "@/components/studio-app";
export default async function StudioSection({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (path[0] === "venues" && path[1] === "the-fold" && path.length === 2)
    return <StudioApp tab="venue" />;
  if (path[0] !== "events" || path[1] !== "blue-hour") notFound();
  if (path[2] === "changes" && path.length === 4)
    return <StudioApp tab="changes" />;
  if (
    path.length !== 3 ||
    !["brief", "concepts", "demand", "production", "results"].includes(path[2])
  )
    notFound();
  return <StudioApp tab={path[2]} />;
}
