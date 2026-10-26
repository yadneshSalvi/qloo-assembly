import { CollaboratorPage } from "@/components/collaborator-page";
export const metadata = {
  title: "Your part in the evening",
  robots: { index: false, follow: false },
};
export default async function Collaborator({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CollaboratorPage key={token} token={token} />;
}
