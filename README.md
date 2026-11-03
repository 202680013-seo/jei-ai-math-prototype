# JEI Math · 최종 프로토타입

V5 디자인 스튜디오 최종 작업본(d6da76c). 이 브랜치는 해당 프로토타입의 소스, 실행에 필요한 자산과 테스트만 포함합니다.

## 바로 실행

[▶ 최종 프로토타입 실행하기](https://jei-math-color-studio.hyesuchae.chatgpt.site)

현재 배포된 최종 작업본입니다. 사이트 접근 권한에 따라 ChatGPT 로그인이 필요할 수 있습니다. GitHub 코드 변경은 이 실행 링크에 자동 배포되지 않습니다.

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
