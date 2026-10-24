import { notFound } from "next/navigation";
import { EventPage } from "@/components/event-page";
export const metadata = {
  title: "Blue hour, shared table",
  description:
    "A listening supper at The Fold. An interactive authored sample from ASSEMBLY.",
};
export default async function Event({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== "blue-hour") notFound();
  return <EventPage />;
}
