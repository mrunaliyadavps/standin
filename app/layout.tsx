import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { REPO_URL } from "@/lib/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Standin",
  description: "Stand-in users that usability-test a website in a real browser and show you where they got stuck.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="top">
          <div className="top-inner">
            <Link href="/" className="wordmark">
              <span className="mark" aria-hidden="true" />
              Standin
            </Link>
            <nav aria-label="Site">
              <Link href="/#how">How it works</Link>
              <Link href="/#limits">Limits</Link>
              {REPO_URL && <a href={REPO_URL}>GitHub</a>}
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          <p>
            Standin is an open-source project by Mrunali Yadav. Synthetic personas find obvious friction early. They do not replace research with real people.
          </p>
        </footer>
      </body>
    </html>
  );
}
