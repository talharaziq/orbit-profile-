import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit — GitHub Profile Studio",
  description: "A modern, interactive view of your GitHub work. Explore contributions, repositories, languages, and open-source activity without static stats images.",
  applicationName: "Orbit Profile Studio",
  keywords: ["GitHub", "developer profile", "GitHub analytics", "open source", "profile dashboard"],
  openGraph: {
    title: "Orbit — GitHub Profile Studio",
    description: "Your work, in motion. An interactive developer dashboard built from GitHub data.",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e13"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
