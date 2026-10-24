import { CommitmentPage } from "@/components/commitment-page";
export const metadata = {
  title: "Your choice",
  robots: { index: false, follow: false },
};
export default async function Commitment({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CommitmentPage token={token} />;
}
