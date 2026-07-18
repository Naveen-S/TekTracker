import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

// Legacy type stack (src/styles.css :69-80): Manrope for headings/display numerals,
// Inter for body copy, JetBrains Mono for issue keys and JQL. Loaded as per-weight STATIC
// instances (the exact weights legacy's Google @import pulled), NOT as variable fonts:
// WebKit's canvas ignores ctx.font weights on variable fonts, so html2canvas PDF/PNG
// exports captured everything at weight 400 and text metrics drifted (2026-07-18).
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Sprint Tracker",
  description:
    "One fast, comprehensive view of an entire sprint — from roadmap to backlog. Engineering internal tool @ Tekion Corp.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
