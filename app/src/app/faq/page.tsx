// FAQ page (ACC-7, UX-10). Public.
import { getAccess } from "@/lib/supabase/server";
import { em, Faq, Invite, PageHead, Shell } from "@/components/landing/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQ · Gaurberg", description: "Where the information comes from, what it costs and how invitations work." };

export default async function FaqPage() {
  const a = await getAccess();
  return (
    <Shell v={a.state} page="faq">
      <PageHead over="Questions" title={<>Frequently {em("asked.")}</>} sub="Still curious? Email oppoverseai@gmail.com and a person will reply." />
      <Faq />
      <Invite v={a.state} email={a.state === "not_invited" ? a.email : undefined} />
    </Shell>
  );
}
