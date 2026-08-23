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
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
