import type { Metadata } from "next";
import Link from "next/link";
import { REPO_URL } from "@/lib/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Standin",
  description: "Stand-in users that usability-test a website in a real browser and show you where they got stuck.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="top">
          <Link href="/" className="wordmark">
            Standin
          </Link>
          <nav aria-label="Site">
            <Link href="/#how">How it works</Link>
            <Link href="/#limits">Limits</Link>
            {REPO_URL && <a href={REPO_URL}>GitHub</a>}
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          Standin is an open-source project by Mrunali Yadav. Synthetic personas find obvious friction early. They do not replace research with real people.
        </footer>
      </body>
    </html>
  );
}
