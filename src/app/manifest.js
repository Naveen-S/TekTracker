/**
 * Web app manifest (ask-storyboard.md (f)) — makes StoryBoard installable to a phone's home
 * screen, with an "Ask StoryBoard" shortcut (long-press the icon on Android) straight to the
 * voice page. A Next metadata route with no request-time API, so it builds STATIC (not an ƒ route).
 * start_url stays "/" — installing StoryBoard should open the board, as it always has; the voice
 * entry is the shortcut (and the iOS Shortcuts recipe on /ask).
 */
export default function manifest() {
  return {
    name: "StoryBoard",
    short_name: "StoryBoard",
    description: "Every piece. One picture. Sprint health, risks and bugs — and Ask StoryBoard by voice.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1620",
    theme_color: "#0b1620",
    icons: [
      { src: "/app-icon.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Ask StoryBoard",
        short_name: "Ask",
        description: "Ask about your sprint by voice",
        url: "/ask",
        icons: [{ src: "/app-icon.png", sizes: "256x256", type: "image/png" }],
      },
    ],
  };
}
