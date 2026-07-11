import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

// Legacy type stack (src/styles.css :69-80): Manrope for headings/display numerals,
// Inter for body copy, JetBrains Mono for issue keys and JQL. All variable fonts.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
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
