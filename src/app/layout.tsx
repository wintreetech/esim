import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { brand } from "@/lib/brand";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: `${brand.name} — Go somewhere. Stay connected.`,
    template: `%s | ${brand.name}`,
  },
  description:
    "Travel data for your next adventure. Explore flexible eSIM plans, check your phone, and get your connection delivered digitally.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} — A world of possibility`,
    description: "Your next adventure. Already connected.",
    type: "website",
    siteName: brand.name,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
