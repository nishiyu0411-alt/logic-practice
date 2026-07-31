import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逻辑充电站｜粉蓝逻辑刷题",
  description: "170 道逻辑推理题，提交即看答案解析，自动保存刷题进度。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
