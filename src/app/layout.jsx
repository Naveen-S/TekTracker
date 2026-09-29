import { Instrument_Serif, Inter, JetBrains_Mono, Manrope } from "next/font/google";
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
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Brand tagline face (brand-logo-tagline.md): italic-only, used for "Every piece. One picture."
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["italic"],
});

export const metadata = {
  title: "StoryBoard",
  description:
    "Every piece. One picture. One fast, comprehensive view of an entire sprint — from roadmap to backlog. Engineering internal tool @ Tekion Corp.",
};

// No-FOUC theme boot (modern-theme.md): apply the saved theme class to <html>
// BEFORE first paint, so a Modern user never sees a Tekion → Modern flash. Runs
// synchronously; `suppressHydrationWarning` silences the expected <html> class
// diff (the server can't know a client-only localStorage value).
const THEME_INIT = `(function(){try{if(localStorage.getItem("theme")==="modern"){document.documentElement.classList.add("theme-modern")}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
