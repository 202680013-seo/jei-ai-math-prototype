# JEI Math · 최종 프로토타입

`main` 브랜치에는 공동 작업한 프로토타입의 소스와 실행에 필요한 자산 및 테스트가 포함되어 있습니다.

## 최신 작업 미리보기 (의정)

[▶ AI 수학 프로토타입 미리보기 열기](https://jei-ai-math-main-preview.lushfinch2.chatgpt.site)

의정이 공유한 ChatGPT Work 미리보기 링크입니다. 현재 미리보기는 소유자 전용입니다. **GitHub `main` 브랜치의 코드 변경사항은 이 링크에 자동 반영되지 않습니다.**

## 이전 디자인 스튜디오 미리보기 (혜수 V5)

[▶ V5 디자인 스튜디오 실행하기](https://jei-math-color-studio.hyesuchae.chatgpt.site)

기존 V5 디자인 스튜디오 작업본(d6da76c)의 배포 링크입니다. 최신 `main` 코드와 화면이 다를 수 있습니다.

## 내 PC에서 실행

저장소 루트에서 실행합니다.

```sh
python3 -m http.server 8080 --directory dist
```

브라우저에서 http://localhost:8080 을 엽니다. 원본의 절대 경로가 동작하도록 dist를 서버 루트로 사용하세요.

## 기능

- 시나리오 / 디자인 패널
- 요소 선택과 학습 인터랙션 분리
- 역할별 테마, HEX 즉시 반영, 불투명도 0~100%, 테두리 두께(px)
- AI 추천·말풍선·카드 SVG 색상 연동
- 나눔스퀘어 / 나눔스퀘어라운드 / Pretendard
- 실행 취소·다시 실행, 시안 저장 및 JSON 입출력

디자인 설정은 브라우저에 저장됩니다. 공유할 설정은 JSON으로 내보내 함께 보관하세요.

## 검증

```sh
node --test tests/*.test.cjs
```

상세 구현: IMPLEMENTATION.md

`dist/versions/`는 최종 화면이 참조하는 필수 공통 파일입니다. 개별 과거 시안 실행 화면은 포함하지 않았습니다.
