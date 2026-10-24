import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const manrope = localFont({
  src: "../public/fonts/manrope.woff2",
  variable: "--font-manrope",
  display: "swap",
});
const fraunces = localFont({
  src: [
    { path: "../public/fonts/fraunces.woff2", style: "normal" },
    { path: "../public/fonts/fraunces-italic.woff2", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "ASSEMBLY — Make a night of it.",
    template: "%s · ASSEMBLY",
  },
  description:
    "Turn an open evening into a night worth coming together for. A cultural production desk for independent spaces.",
  metadataBase: new URL(process.env.APP_ORIGIN || "http://127.0.0.1:3102"),
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${fraunces.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
