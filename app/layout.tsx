import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

import { IslandProvider } from "@/components/island/island-provider";
import { SiteNavbar } from "@/components/site-navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";

// globals.css maps --color-* onto --font-sans / --font-geist-mono, so the CSS
// variable names here have to match what @theme inline expects.
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

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
    "A collection of tools to make the fiddly stuff less, well fiddly. All tools are available in the Browser or via an API. No account needed.",
  openGraph: {
    title: "trutools — in the browser or via an AP",
    description:
      "A collection of tools to make the fiddly stuff less, well fiddly. All tools are available in the Browser or via an API. No account needed.",
    url: SITE_URL,
    siteName: "trutools",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes writes the class on <html> before
    // React hydrates, which the server render cannot know about.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {/* delay so the tooltip does not flash when the cursor merely
              crosses the island on its way somewhere else. */}
          <TooltipProvider delay={250}>
            <IslandProvider>
              <SiteNavbar />
              <main className="flex-1">{children}</main>
            </IslandProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
