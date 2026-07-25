import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestedHost = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(requestedHost) ? requestedHost : "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") === "http" || host.startsWith("localhost") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "리디파인 참여자 사용 설명서",
      template: "%s | 리디파인",
    },
    description: "리디파인 Discord 참여자를 위한 검색 가능한 사용 설명서",
    alternates: { canonical: "/" },
    openGraph: {
      title: "리디파인 참여자 사용 설명서",
      description: "빠른 시작, 72시간 온보딩, Discord 명령어와 문의 방법을 검색해 보세요.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "리디파인 참여자 사용 설명서" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "리디파인 참여자 사용 설명서",
      description: "빠른 시작, 72시간 온보딩, Discord 명령어와 문의 방법을 검색해 보세요.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const enableDevTools = process.env.NODE_ENV === "development"
    && process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== "1";

  return (
    <html lang="ko">
      <head>
        {enableDevTools && (
          <>
            <script defer src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
            <script defer src="https://unpkg.com/react-grab/dist/index.global.js" crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
