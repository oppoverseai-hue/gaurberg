// Privacy notice for the waitlist and sign-in (ACC-5). Public page, warm-paper style like the landing page.
import "@/components/landing/landing.css";
import Logo from "@/components/Logo";

export const metadata = { title: "Privacy · Gaurberg" };

export default function Privacy() {
  return (
    <div className="paper">
      <div className="pp-doc">
        <p style={{ margin: "0 0 32px" }}><a href="/" aria-label="Gaurberg home"><Logo /></a></p>
        <h1>Privacy</h1>
        <p>Last updated 4 November 2026. Gaurberg is an early-access research tool run by Abhishek. This page says what we keep about you and why.</p>
        <h2>What we keep</h2>
        <ul>
          <li>From Google sign-in: your name, email address and profile picture. We use them only to manage your access.</li>
          <li>If you request an invitation: your answers (what describes you, the tools you use, the company you want mapped, whether you are open to a call), the date, and your country as reported by our hosting provider.</li>
          <li>Where you first came from: campaign tags in the link you clicked and the website that sent you, kept in a first-party cookie for 30 days and saved with your request.</li>
          <li>Which company pages you open while signed in, so the Screener can show what you viewed.</li>
        </ul>
        <h2>What we don&apos;t do</h2>
        <p>We don&apos;t sell or share your details, we don&apos;t use advertising trackers, and we don&apos;t read your Google data beyond your name, email and picture.</p>
        <h2>Emails</h2>
        <p>We email you to confirm your request, when your invitation is ready, and occasionally about the product. Every email can be answered; reply &quot;remove&quot; and we delete your details.</p>
        <h2>Where it is stored</h2>
        <p>On Supabase (database and sign-in) and Vercel (hosting). Emails are sent from a Gmail account.</p>
        <h2>Contact</h2>
        <p>Email <a href="mailto:oppoverseai@gmail.com">oppoverseai@gmail.com</a> to see, correct or delete what we hold about you.</p>
      </div>
    </div>
  );
}
