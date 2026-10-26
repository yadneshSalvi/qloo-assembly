import { EventPage } from "@/components/event-page";
export const metadata = {
  title: "An evening, made together",
  description:
    "Read the exact proposal and make your choice. An independent production on ASSEMBLY.",
  robots: { index: false, follow: false },
};
export default async function Event({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventPage key={slug} slug={slug} />;
}
