import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мини-CRM для маркетингового агентства",
  description: "CRM для отдела продаж агентства"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
