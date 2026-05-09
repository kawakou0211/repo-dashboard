import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "repo-dashboard",
  description: "Personal GitHub project tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
