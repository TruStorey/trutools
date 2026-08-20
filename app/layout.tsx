import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { IslandProvider } from "@/components/island/island-provider";
import { SiteNavbar } from "@/components/site-navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";

// globals.css maps --color-* onto --font-sans / --font-geist-mono, so the CSS
// variable names here have to match what @theme inline expects.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "trutools — in the browser or via an API",
    template: "%s · trutools",
  },
  description:
    "A collection of tools to make the fiddly stuff less, well fiddly. All tools are available via an API or in the Browser. No account needed.",
  openGraph: {
    title: "trutools — in the browser or via an API",
    description:
      "A collection of tools to make the fiddly stuff less, well fiddly. All tools are available via an API or in the Browser. No account needed.",
    url: SITE_URL,
    siteName: "trutools",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `dark` is pinned here rather than toggled: the site has one palette, and
    // the class still has to be present for Tailwind's dark: variant to apply.
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* delay so the tooltip does not flash when the cursor merely
            crosses the island on its way somewhere else. */}
        <TooltipProvider delay={250}>
          <IslandProvider>
            <SiteNavbar />
            <main className="flex-1">{children}</main>
          </IslandProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
