import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyPulse | Your study, in rhythm",
  description: "A focused home for study sessions, learning games, exams, and your progress.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
