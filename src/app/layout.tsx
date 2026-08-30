import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "Skill Atlas — your learning navigator",
  description:
    "An AI-powered learning navigator that maps your route from where you are to the role you want — and reroutes as you go.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme before first paint — no flash, and the system
            preference decides the very first visit until the user chooses. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("skill-atlas-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
