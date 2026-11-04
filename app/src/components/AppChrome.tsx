"use client";
// Shows the app's top bar or footer only on app pages (UX-10). Marketing and account pages (paper design) bring their own
// header and footer, so they are left alone even when an invited person opens them.
import { usePathname } from "next/navigation";

const PAPER = ["/features", "/how-it-works", "/faq", "/privacy", "/request-access"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  return PAPER.some((p) => path === p || path.startsWith(`${p}/`)) ? null : <>{children}</>;
}
