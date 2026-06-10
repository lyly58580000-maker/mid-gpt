import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BetaFeedbackMount } from "@/features/beta-feedback/components/BetaFeedbackMount";

export const metadata: Metadata = {
  title: "设研AI",
  description: "极简 AI 聊天与生图平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
          <BetaFeedbackMount />
        </Providers>
      </body>
    </html>
  );
}
