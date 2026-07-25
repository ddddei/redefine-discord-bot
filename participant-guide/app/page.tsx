import type { Metadata } from "next";
import { GuideSearch } from "./GuideSearch";
import { ScrollableCommandTable } from "./ScrollableCommandTable";
import { commands, faqs, guideNav, quickSteps, timeline } from "./guide-data";

export const metadata: Metadata = {
  title: "리디파인 참여자 가이드",
  description: "리디파인 Discord 참여자가 시작 순서, 주요 명령어, 미션과 포인트, 문의 방법을 검색하고 확인하는 공개 가이드입니다.",
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <header id="top" className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top"><span>RE:DEFINE</span> 참여자 도움말</a>
          <span className="document-status">공개 가이드 · 2026. 07</span>
        </div>
      </header>

      <main id="main-content">
        <section className="document-intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="section-kicker">🌱 함께 보는 안내서</p>
            <h1 id="page-title">리디파인<br />참여자 가이드</h1>
            <p>Discord에 처음 들어온 순간부터 미션 인증, <span className="no-break">포인트 확인</span>, <span className="no-break">운영진 문의까지</span> 필요한 내용을 순서대로 <span className="no-break">찾을 수 있습니다.</span> 처음부터 전부 읽지 않아도 괜찮아요. 막히는 부분이 생겼을 때 그 부분만 <span className="no-break">찾아봐도 충분합니다.</span></p>
            <dl className="document-meta">
              <div><dt>먼저 기억할 것</dt><dd><code>/안내</code></dd></div>
              <div><dt>권장 읽기 시간</dt><dd>약 5분</dd></div>
              <div><dt>마지막 확인</dt><dd>2026. 07</dd></div>
            </dl>
          </div>
          <GuideSearch />
        </section>

        <div className="manual-layout">
          <aside className="table-of-contents" aria-label="참여자 가이드 목차">
            <p>목차</p>
            <nav>
              {guideNav.map((item, index) => (
                <a key={item.id} href={`#${item.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</a>
              ))}
            </nav>
            <div className="toc-note"><strong>도움이 급한가요?</strong><p>개인정보나 긴급한 상황은 봇보다 운영진에게 <span className="no-break">직접 알려 주세요.</span></p></div>
          </aside>

          <article className="manual-content">
            <section id="quick-start" className="manual-section" aria-labelledby="quick-start-title">
              <header className="section-heading"><p>01 · 처음 10분</p><h2 id="quick-start-title">🌱 빠른 시작</h2><span>여기부터 시작해요</span></header>
              <div className="instruction-note"><strong>처음이라면 여기부터</strong><p>아래 세 단계만 <span className="no-break">마치면 됩니다.</span> 미션, 포인트, 미니게임과 상점은 모두 선택 활동입니다.</p></div>
              <ol className="procedure">
                {quickSteps.map((step, index) => (
                  <li key={step.title}><span>{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p><small>{step.complete}</small></div></li>
                ))}
              </ol>
            </section>

            <section id="first-72-hours" className="manual-section" aria-labelledby="timeline-title">
              <header className="section-heading"><p>02 · 적응 기간</p><h2 id="timeline-title">🌤️ 처음 72시간</h2><span>천천히 가도 괜찮아요</span></header>
              <p className="section-lead">처음부터 모든 채널을 한꺼번에 <span className="no-break">익힐 필요는 없습니다.</span> 필요한 공간부터 천천히 <span className="no-break">확인해 주세요.</span></p>
              <ol className="timeline">
                {timeline.map((item) => <li key={item.time}><span>{item.time}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></li>)}
              </ol>
              <div className="information-box"><strong>알아두기</strong><p>보이는 채널 수나 역할 변화는 참여자를 평가하거나 등급을 매기는 과정이 아닙니다.</p></div>
            </section>

            <section id="commands" className="manual-section" aria-labelledby="commands-title">
              <header className="section-heading"><p>03 · 명령어 모음</p><h2 id="commands-title">💬 Discord 명령어</h2><span>외우지 않아도 돼요</span></header>
              <p className="section-lead">채팅창에 슬래시(`/`)를 입력하면 <span className="no-break">사용할 수 있는</span> 명령어가 나타납니다. <span className="no-break">명령어는 외우지 않아도 됩니다.</span></p>
              <p className="table-scroll-hint">표를 좌우로 밀어 전체 내용을 확인하세요.</p>
              <ScrollableCommandTable>
                <table className="command-table">
                  <thead><tr><th>명령어</th><th>이럴 때 사용</th><th>실행 결과</th><th>공개 범위</th></tr></thead>
                  <tbody>{commands.map((item) => <tr key={item.command}><th scope="row"><code>{item.command}</code></th><td>{item.when}</td><td>{item.result}</td><td><span>{item.visibility}</span></td></tr>)}</tbody>
                </table>
              </ScrollableCommandTable>
            </section>

            <section id="missions" className="manual-section" aria-labelledby="missions-title">
              <header className="section-heading"><p>04 · 활동과 보상</p><h2 id="missions-title">🎯 미션과 포인트</h2><span>가능한 만큼만</span></header>
              <div className="two-column-guide">
                <div><h3>미션 인증하기</h3><ol><li><code>/미션</code>에서 활동을 고릅니다.</li><li>안내된 채널에 글, 사진 또는 영상을 남깁니다.</li><li>운영진의 승인 반응을 기다립니다.</li><li><code>/포인트</code>에서 기록을 확인합니다.</li></ol></div>
                <div><h3>포인트 사용하기</h3><ol><li><code>/상점</code>에서 항목을 확인합니다.</li><li>필요 포인트와 유의사항을 읽습니다.</li><li>신청 전 내용을 한 번 더 확인합니다.</li><li>신청하면 포인트가 차감됩니다.</li></ol></div>
              </div>
              <div className="warning-box"><strong>신청 전 확인</strong><p>단순 변심에 따른 취소나 <span className="no-break">환불이 어려울 수 있습니다.</span> 교환 항목과 차감 포인트를 꼭 <span className="no-break">확인해 주세요.</span></p></div>
            </section>

            <section id="help" className="manual-section" aria-labelledby="help-title">
              <header className="section-heading"><p>05 · 도움받기</p><h2 id="help-title">🤝 문의와 봇 DM</h2><span>언제든 물어보세요</span></header>
              <div className="help-grid">
                <div><h3>가벼운 질문</h3><p><code>/질문</code>으로 프로그램과 규칙을 물어보세요. <span className="no-break">답을 찾지 못하면</span> 운영진 문의로 이어집니다.</p></div>
                <div><h3>개인적인 문의</h3><p>역할, 채널, 개인 상황은 운영진 문의 채널을 이용하세요. 공개 채널에 개인정보를 <span className="no-break">남기지 않습니다.</span></p></div>
                <div><h3>봇과 DM 대화</h3><p>운영진이 기능을 열어 둔 경우에만 <span className="no-break">사용할 수 있습니다.</span> 첫 DM의 <span className="no-break">기록·보존 안내를 먼저 확인하세요.</span></p></div>
                <div><h3>긴급한 상황</h3><p>봇은 상담, 진단 또는 긴급 대응을 <span className="no-break">대신하지 않습니다.</span> 운영진이나 도움을 줄 수 있는 사람에게 <span className="no-break">직접 알려 주세요.</span></p></div>
                <div><h3>전화 문의</h3><p>광명시 청년동 대표번호 <a className="no-break" href="tel:0220668134">02-2066-8134</a> <span className="no-break">(평일 09:00~18:00)</span>로 문의할 수 있어요. 청년동 홈페이지 채널톡도 이용할 수 <span className="no-break">있습니다.</span></p></div>
              </div>
            </section>

            <section id="faq" className="manual-section" aria-labelledby="faq-title">
              <header className="section-heading"><p>06 · 궁금할 때</p><h2 id="faq-title">🧭 문제 해결</h2><span>자주 묻는 질문</span></header>
              <div className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
            </section>
          </article>
        </div>
      </main>

      <footer className="site-footer"><p><strong>RE:DEFINE 참여자 가이드</strong><span>읽기만 해도, 이모지 반응만 눌러도 참여예요. 각자의 속도로 함께 가면 됩니다 🌱</span></p><a href="#top">문서 처음으로</a></footer>
    </>
  );
}
