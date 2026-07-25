"use client";

import type { KeyboardEvent, ReactNode } from "react";

interface ScrollableCommandTableProps {
  children: ReactNode;
}

export function ScrollableCommandTable({ children }: ScrollableCommandTableProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    const container = event.currentTarget;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (maxScroll <= 0) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextPosition = Math.min(
      maxScroll,
      Math.max(0, container.scrollLeft + direction * container.clientWidth * 0.75),
    );

    container.scrollTo({ left: nextPosition, behavior: "auto" });
  }

  return (
    <div
      className="command-table-wrap"
      tabIndex={0}
      aria-label="Discord 명령어 표. 좌우 방향키로 전체 내용을 확인할 수 있습니다."
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
