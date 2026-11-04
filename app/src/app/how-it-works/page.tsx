// How it works page (ACC-7, UX-10). Public: the four steps to a first answer, and how each link is made.
import { getAccess } from "@/lib/supabase/server";
import { Checked, em, Invite, PageHead, Shell, Steps } from "@/components/landing/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "How it works · Gaurberg", description: "From an invitation to the filing sentence behind a link, in four steps." };

export default async function HowItWorks() {
  const a = await getAccess();
  return (
    <Shell v={a.state} page="how">
      <PageHead over="How it works" title={<>Your first answer in {em("four steps.")}</>} sub="From your invitation to the sentence in the filing, in a few minutes." />
      <Steps />
      <Checked />
      <Invite v={a.state} email={a.state === "not_invited" ? a.email : undefined} />
    </Shell>
  );
}
