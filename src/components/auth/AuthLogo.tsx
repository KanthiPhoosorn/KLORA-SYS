import Link from "next/link";

// Corta logo in the top-left corner of the farm sign-in pages (Thai Post doc 9 Oct 2026 §1) —
// over the hero on desktop; on phones the form column leaves room for it (pt-20).
export default function AuthLogo({ href = "/login" }: { href?: string }) {
  return (
    <Link href={href} aria-label="Corta" className="absolute left-6 top-5 z-10 lg:left-8 lg:top-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/corta-logo.png" alt="Corta" className="h-7 w-auto" />
    </Link>
  );
}
