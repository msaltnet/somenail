# TRD — Somenail 기술 요구사항 및 설계

- **문서 상태:** Draft / MVP 아키텍처 제안
- **작성일:** 2026-11-10
- **관련 문서:** [README](../README.md) · [PRD](PRD.md)

## 1. 아키텍처 목표 및 제약

Somenail은 **빌드된 정적 자산(HTML/CSS/JavaScript)만 배포하는 클라이언트 전용 SPA**입니다.

- 백엔드·DB·회원가입·파일 업로드 서버·서버리스 함수 없음
- 사용자 사진과 텍스트는 사용자의 브라우저 내에서 편집
- 네트워크가 필요한 것은 최초 앱 자산 로딩뿐이며, 로드된 뒤 편집/PNG 생성에 원격 호출 불필요
- MVP에서는 프로젝트 영속 저장을 제공하지 않음: 새로고침 시 편집 내용이 사라질 수 있음을 UI에 명확히 표시
- MVP에서 외부 이미지 URL, 외부 이미지 검색, 서드파티 분석/광고 SDK 미사용

**‘서버 없음’은 백엔드 미운영을 의미합니다.** 사용자가 앱에 접근하려면 GitHub Pages/Vercel 등 정적 파일 호스팅은 필요합니다.

## 2. 권장 기술

| 계층 | 기술 | 선택 이유 |
| --- | --- | --- |
| UI | React + TypeScript | 컴포넌트·타입 기반 편집기 개발 |
| 빌드 | Vite | 간단한 정적 번들 빌드 |
| 캔버스 | Konva + react-konva | 요소 드래그·변형·레이어 및 PNG 내보내기 |
| 상태 | React state/useReducer | MVP의 작은 상태 공간, 불필요한 상태관리 의존성 제거 |
| 이미지 입력 | File API, Blob/Object URL | 서버를 거치지 않는 이미지 디코딩 |
| 이미지 출력 | Konva Stage + Canvas Blob | 브라우저 내 1280×720 PNG 생성 |
| 스타일 | CSS (필요하면 CSS Modules) | 추가 UI 프레임워크 없이 시작 |
| 테스트 | Vitest + React Testing Library + Playwright | 로직/인터랙션/출력 E2E 검증 |

사용 라이브러리의 버전과 라이선스는 실제 구현 시 확인해 고정합니다. 배경 제거용 ML 모델 등은 포함하지 않습니다.

## 3. 모듈 구성

```text
src/
  app/               # App 및 화면 구성
  components/
    EditorToolbar.tsx # 배경/이미지/텍스트 작업 도구
    EditorCanvas.tsx  # 논리 크기 1280x720 캔버스
    PropertyPanel.tsx # 현재 선택 요소의 속성
  editor/
    model.ts          # Document / Element 타입
    reducer.ts        # 요소 추가/수정/삭제/순서 변경
    sizing.ts         # 화면 표시 배율과 좌표 변환
    exportPng.ts      # PNG 내보내기
  assets/
    imageLoader.ts    # 로컬 파일 검사·디코딩·URL 관리
  styles/
    app.css
```

최종 폴더명은 구현 상황에 따라 바꿀 수 있지만, **문서 상태·UI·에셋 로딩·내보내기 로직**을 분리합니다.

## 4. 편집 데이터 모델 (개념)

```ts
type ThumbnailDocument = {
  width: 1280;
  height: 720;
  backgroundColor: string; // 예: "#000000"
  elements: EditorElement[]; // 배열 순서가 뒤→앞 레이어 순서
};

type BaseElement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageElement = BaseElement & {
  type: "image";
  assetId: string; // 브라우저 메모리의 이미지 자산 참조
};

type TextElement = BaseElement & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: "left" | "center" | "right";
};

type EditorElement = ImageElement | TextElement;
```

- 문서의 모든 좌표 및 크기는 **논리 캔버스 1280×720 기준**입니다.
- UI 선택 상태(`selectedElementId`), 패널 상태는 문서 상태에서 분리합니다.
- Object URL, 디코딩된 이미지 객체는 `assetId`를 키로 하는 **런타임 전용 에셋 저장소**에서 관리합니다.
- 프로젝트 JSON 저장은 MVP 기능이 아니며, 런타임 Object URL을 영구 식별자로 사용하지 않습니다.

## 5. 주요 처리 흐름

### 5.1 이미지 추가

1. 사용자가 파일 선택/드롭으로 로컬 PNG/JPEG/WebP 파일을 전달
2. 타입·크기(초기 제안 20MB 이하) 검사; 이미지 디코딩 실패 시 오류 표시
3. `URL.createObjectURL(file)` 또는 동등한 브라우저 로컬 메커니즘으로 이미지 디코딩
4. 이미지의 자연 크기 비율을 유지하며 캔버스 중앙에 들어가도록 초기 크기 계산
5. `assetId`를 생성해 이미지 객체와 연결하고 이미지 요소를 문서에 추가
6. 요소가 삭제되어 참조가 사라지면 Object URL을 해제; 화면 이탈 시 남은 URL 모두 정리

SVG와 외부 이미지 URL 입력은 MVP에서 지원하지 않아 스크립트/외부 CORS 이미지 문제를 줄입니다. 파일 확장자만 믿지 않고 실제 디코딩 가능 여부를 확인합니다.

### 5.2 캔버스 표시/드래그

- 논리 Stage 크기는 항상 1280×720으로 유지
- 컨테이너 너비에 맞춰 **표시 스케일만 변경**(예: 640px로 보일 때 scale=0.5)
- 편집 좌표는 논리 좌표로 일관되게 저장
- 선택한 이미지에는 resize handles를 표시하고, 배경/텍스트/이미지를 서로 독립적인 요소로 렌더링
- 패널 UI, Transformer 선택 테두리·핸들은 **출력 이미지에 포함하지 않도록** 별도 비내보내기 처리
- 그림/텍스트 순서는 `elements` 배열 순서로 정의. 앞으로/뒤로 이동 시 순서 변경

### 5.3 텍스트 렌더링

- 여러 줄 문자열의 `\n`을 그대로 유지하고 렌더링
- 폰트 크기·굵기·색상·정렬·위치 변경 시 Stage를 갱신
- 한글을 지원하는 시스템 폰트 스택을 기본 제공; 웹폰트 사용 시 라이선스 확인 후 **정적 자산으로 번들링**
- 내보내기 전에 `document.fonts.ready` 등을 이용해 사용하는 폰트 로딩 완료를 확인하여 미리보기/출력 차이를 줄임

### 5.4 PNG 내보내기

1. 사용자 입력, 이미지 디코딩, 폰트 로딩 완료 확인
2. 선택 테두리 및 편집 전용 컨트롤이 출력되지 않도록 렌더 구성
3. 논리 크기 1280×720 Stage에서 `pixelRatio: 1`로 PNG Blob 생성
4. `URL.createObjectURL(blob)`으로 다운로드 링크 생성하고, 다운로드 트리거 후 URL 정리
5. 생성 실패·메모리 문제 등을 감지하면 오류 표시

**중요:** 브라우저 화면 축소 배율과 내보내기 해상도를 섞지 않습니다. 화면에 640×360으로 보여도 PNG는 정확히 1280×720으로 생성해야 합니다. Stage를 화면 크기로 직접 축소하는 방식은 피하고, 논리 크기/표시 배율을 분리합니다.

Konva 공식 문서: [Canvas to Image](https://konvajs.org/docs/posts/canvas-export-image.html), [High Quality Export](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html).

## 6. 보안/개인정보 및 안정성

- 앱 자체에서 사용자 파일·텍스트를 업로드하는 API 요청 금지
- 외부 URL에서 가져온 이미지를 임의로 Stage에 넣지 않음(CORS로 인한 tainted canvas 방지)
- 가능한 외부 스크립트, 서드파티 폰트, 분석 도구 미포함
- 이미지 객체 및 Object URL을 적절히 해제하여 누적 메모리 사용 방지
- 파일 크기 제한/디코딩 오류/PNG 생성 실패 시 안전한 오류 메시지 표시
- 자바스크립트 입력 텍스트를 임의 HTML로 렌더링하지 않음
- 사용자가 생성한 저작물의 권리와 업로드 이미지 라이선스는 사용자 책임; 제품에서 외부 소재를 자동 제공하지 않음

## 7. 배포·운영

- `npm run build`로 생성한 `dist/` 정적 디렉터리 배포(구현 후 제공)
- 기본 배포 후보: GitHub Pages 또는 Vercel의 **정적** 배포
- GitHub Pages의 `msaltnet.github.io/somenail/` 경로를 사용할 경우 Vite `base: "/somenail/"` 설정 필요
- 별도 런타임 환경 변수, 서버 API, 비밀키 불필요
- 배포 자동화(CI/Actions)는 **현재 문서 작업에 포함하지 않고**, 배포 시점에 결정
- 현재 저장소에는 실행 가능한 앱이 없으며 이 문서는 구현 사양임

Vite 배포 문서: https://vite.dev/guide/static-deploy

## 8. 테스트 계획

| 수준 | 검증 |
| --- | --- |
| 단위 | HEX 정규화/검증, 이미지 크기 및 배치 계산, 요소 추가/수정/삭제/레이어 순서 |
| UI | 배경색·텍스트 속성 입력, 이미지 업로드 실패 처리, 요소 선택/삭제 |
| E2E | 배경 변경 → PNG 업로드 → 제목 입력 → 위치/크기 조정 → 내보내기 |
| 출력 | PNG 파일 헤더/실제 픽셀 크기 1280×720, 한글 폰트 렌더링 |
| 개인정보 | 사용자 이미지 파일 업로드용 네트워크 요청 없음 |
| 브라우저 | Chrome/Edge/Safari 최신 버전, 반응형 레이아웃 점검 |

## 9. 구현 우선순위와 의사결정

1. 기본 캔버스 및 배경색
2. 로컬 이미지 업로드, 드래그/크기 변경/삭제
3. 텍스트 편집/스타일
4. 요소 순서 및 PNG 내보내기
5. 인수 시나리오, 오류 처리, 접근성 및 반응형 보완

**과도한 범용화를 피합니다.** 복잡한 템플릿 엔진, 외부 저장소, 이미지 필터, 중복 렌더링 계층은 초기 설계에 넣지 않습니다.
