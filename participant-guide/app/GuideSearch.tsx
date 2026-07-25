"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchIndex } from "./guide-data";
import { normalizeGuideQuery, searchGuideItems } from "./guide-search";

export function GuideSearch() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalizeGuideQuery(query);
  const results = useMemo(() => searchGuideItems(searchIndex, query), [query]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <search className="guide-search">
      <label htmlFor="guide-search-input">가이드 검색</label>
      <div className="search-control">
        <input
          ref={inputRef}
          id="guide-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="명령어나 궁금한 내용을 검색해 보세요"
          autoComplete="off"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <p className="search-hint">예: 포인트, 미션 인증, 채널이 안 보여요, DM</p>
      <div className="search-feedback" aria-live="polite">
        {normalizedQuery && (
          <>
            <p className="result-count">검색 결과 {results.length}개</p>
            {results.length > 0 ? (
              <ul className="search-results">
                {results.map((item, index) => (
                  <li key={`${item.id}-${item.label}`}>
                    <a href={`#${item.id}`} onClick={() => setQuery("")}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{item.label}</strong><p>{item.summary}</p></div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-results">찾는 내용이 없습니다. 표현을 짧게 바꾸거나 <a href="#help">운영진 문의 방법</a>을 확인해{"\u00a0"}주세요.</p>
            )}
          </>
        )}
      </div>
    </search>
  );
}
