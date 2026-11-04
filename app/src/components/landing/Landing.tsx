// Public home page (ACC-7): hero, problem, solution, features at a glance, why Gaurberg, invitation.
// Features, How it works and FAQ have their own pages (UX-10); the sections live in marketing.tsx.
import { Checked, FeatureTeaser, Hero, Invite, Problem, Shell, Solution, Why, type Visitor } from "./marketing";

export default function Landing({ state, email }: { state: Exclude<Visitor, "ok">; email?: string }) {
  return (
    <Shell v={state} page="home">
      <Hero v={state} />
      <Problem />
      <Solution />
      <FeatureTeaser />
      <Checked />
      <Why />
      <Invite v={state} email={email} />
    </Shell>
  );
}
