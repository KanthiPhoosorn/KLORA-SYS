import type { Metadata } from "next";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, readMember } from "@/lib/thp-sso";
import MiniLanding from "./MiniLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Corta",
  referrer: "no-referrer",
  robots: { index: false },
};

// Landing page the Thai Post SuperApp opens with the one-time handoff (fragment or query).
export default async function MiniAppPage() {
  const signedIn = !!readMember((await cookies()).get(MEMBER_COOKIE)?.value);
  // Runs while the HTML is parsed, before React hydrates: the handoff is taken out of the address bar at once
  // (the client reads it from window.__cortaHandoff).
  const grab = `(function(){var h=new URLSearchParams(location.hash.replace(/^#/,"")),q=new URLSearchParams(location.search);window.__cortaHandoff=h.get("handoff")||q.get("handoffToken")||q.get("handoff")||"";history.replaceState(null,"",location.pathname)})()`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: grab }} />
      <MiniLanding signedIn={signedIn} />
    </>
  );
}
