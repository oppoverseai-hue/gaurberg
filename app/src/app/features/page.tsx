// Features page (ACC-7, UX-10). Public.
import { getAccess } from "@/lib/supabase/server";
import { em, FeatureRows, Invite, PageHead, Shell } from "@/components/landing/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Features · Gaurberg", description: "Ecosystem maps, the filing sentence behind every link, who is exposed, and what is happening around a company." };

export default async function Features() {
  const a = await getAccess();
  return (
    <Shell v={a.state} page="features">
      <PageHead over="Features" title={<>What you can {em("do.")}</>} sub="Four ways to see the businesses around a stock, each one backed by what the companies themselves filed." />
      <FeatureRows />
      <Invite v={a.state} email={a.state === "not_invited" ? a.email : undefined} />
    </Shell>
  );
}
