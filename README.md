# 제주 IP 3D

제주 콘텐츠·문화 IP를 **three.js 3차원 지도**와 **공공데이터 API 3종**, 그리고 이 API들을 도구로 쓰는 **AI 에이전트**로 보여주는 웹앱.
Vite + React + React Router + Zustand + Bootstrap + Supabase 기반이며 `jeju-ip-sample-solution` 구조를 따른다.

## 실행

```bash
npm install
cp .env.example .env.local     # 값 채우기 (없어도 화면은 뜸)
npm run dev                    # http://localhost:5173  (화면 + /api 서버 함수)
npm test                       # 자동 테스트
npm run build                  # 배포용 빌드
```

`npm run dev` 는 `vite.config.js` 의 `devApi` 플러그인이 `/api/*` 를 직접 처리하므로 `vercel dev` 없이도 서버 함수가 동작한다. 배포(Vercel)에서는 `api/` 폴더가 그대로 서버 함수가 된다.

### 환경변수 (`.env.local`)
| 이름 | 용도 | 노출 |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase 연결 | 브라우저 |
| `DATA_GO_KR_KEY` | 공공데이터포털 키 (Decoding 키) | 서버 전용 |
| `ANTHROPIC_API_KEY` | AI 에이전트 | 서버 전용 |

Supabase 에는 `favorites` 테이블(`id`, `nickname`, `source`, `item_id`, `title`, `created_at`)이 필요하다.

## 구조와 기능

```
api/        Vercel 서버 함수 (/api/이름)
server/     공공데이터 API 호출 로직 (api/ 와 에이전트가 같이 사용)
src/
  lib/        supabase.js, geo.js
  store/      useAppStore.js
  api/        client.js
  components/ Jeju3D, ItemCard, PageHeader, Status, WeatherBadge
  pages/      Home, Places, Heritage, Map3D, Agent, My, NotFound
  layouts/    RootLayout
tests/      vitest 테스트
```

### 3D (three.js / @react-three/fiber)
| 파일 | 기능 |
|---|---|
| `src/components/Jeju3D.jsx` | 3D 장면. 한라산 지형(정점 높이 + 높이별 색: 초록/갈색/회색), 일렁이는 바다, 클릭·호버 가능한 핀(관광=주황, 유산=노랑), 마우스 회전·확대(OrbitControls), 선택 핀 강조·이름표. props: `items`, `selected`, `onSelect`, `height`, `autoRotate` |
| `src/lib/geo.js` | `toXZ` 위경도→3D 좌표, `isJejuCoord` 제주 범위 좌표 판별(빈 값·0 제외), `heightAt` 한라산 높이 함수 |
| `src/pages/Map3D.jsx` (`/map3d`) | TourAPI + 국가유산청 결과를 한 3D 지도에 표시. 검색, 핀/목록 클릭 시 상세 카드, 즐겨찾기 저장. 한쪽 API가 실패해도 다른 쪽 핀은 표시하고 경고 표시 |
| `src/pages/Home.jsx` | 히어로 영역에 자동 회전하는 3D 제주 |

### 공공데이터 API 3종 (`server/`)
| 파일 | API | 설명 |
|---|---|---|
| `tour.js` | 한국관광공사 TourAPI | 키워드 있으면 `searchKeyword2`, 없으면 `areaBasedList2`, 제주(areaCode 39) |
| `weather.js` | 기상청 단기예보 | 제주시·서귀포시 격자, 가장 가까운 발표시각 계산, 6개 시간대 기온/하늘/강수 |
| `heritage.js` | 국가유산청 | 제주(ccbaCtcd 50) 국가유산 XML 검색 |

### 서버 함수 (`api/`)
| 주소 | 기능 |
|---|---|
| `GET /api/hello` | 상태 확인. 키 값은 숨기고 있는지만 반환 |
| `GET /api/tour?keyword=&type=` | 관광·문화 검색 |
| `GET /api/weather?place=` | 날씨 |
| `GET /api/heritage?keyword=` | 국가유산 검색 |
| `POST /api/agent` | Claude 에이전트 루프(최대 5턴): 도구 3개(`search_tour_places`, `get_weather`, `search_heritage`) 호출 → 결과 전달 → 최종 답, 사용한 도구 기록(`steps`) 반환. 429 는 안내 메시지 |

### 화면
| 경로 | 기능 |
|---|---|
| `/` | 소개 + 3D + 동작 체크(React / Supabase / `/api`) + 닉네임(Zustand, localStorage 저장) |
| `/places` | 관광지·문화시설·축제 검색, 카드, 즐겨찾기 |
| `/heritage` | 국가유산 검색, 카드, 즐겨찾기 |
| `/map3d` | 3D 지도 |
| `/agent` | AI 가이드 채팅, 도구 사용 내역 표시, 대화는 store 에 유지 |
| `/my` | Supabase 즐겨찾기 목록(닉네임별) |
| 그 외 | 404 |

## 테스트 결과

### 자동 (`npm test`, vitest — 20개 통과)
| 파일 | 검증 내용 |
|---|---|
| `tests/geo.test.js` | 좌표 변환 방향, 유효 좌표 판별, 한라산 최고점 |
| `tests/server.test.js` | tour(엔드포인트 선택·정규화·빈 결과·비JSON 에러), weather(슬롯 묶기·6개·격자), heritage(XML 파싱·빈 결과) — `fetch` 모킹 |
| `tests/api.test.js` | hello 키 비노출, tour/weather/heritage 인자 전달, 예외 시 500 |
| `tests/agent.test.js` | 405, 도구 호출→결과→답 루프와 steps, 429 메시지 — Anthropic SDK 모킹 |

### 브라우저 수동 확인 (dev 서버, 공공데이터 응답은 fetch 목으로 대체)
- ✅ 홈: 3D 캔버스 렌더, 동작 체크 표시(Supabase 키 없음 → 실패 표시, `/api` OK), 닉네임 입력 → 메뉴 표시 + localStorage 저장
- ✅ `/map3d`: 3D 지도 렌더, 좌표 없는 항목 제외(핀 3개), 목록 클릭·핀 클릭 → 상세 카드
- ✅ `/places`, `/heritage`: 카드 목록 표시
- ✅ `/my`: Supabase 미설정 시 빈 목록 표시
- ✅ `/agent`: 키가 없으면 서버 오류가 토스트로 표시, GET 은 405
- ✅ 404 페이지
- ✅ `npm run build` 성공

### 아직 확인하지 못한 것 (키 필요)
- 실제 공공데이터 응답(`DATA_GO_KR_KEY`), Supabase 즐겨찾기 저장·조회, 실제 Claude 에이전트 응답, Vercel 배포

## 배포 (Vercel)
`vercel.json` 이 `/api` 를 제외한 모든 경로를 `index.html` 로 보내(SPA) 라우팅이 동작한다. Vercel 프로젝트 환경변수에 위 4개 값을 등록한다.
