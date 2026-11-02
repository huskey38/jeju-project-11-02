# 관광 가이드

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
| `src/components/Jeju3D.jsx` | 3D 장면. **실제 지형**: DEM 높이맵(`public/terrain/height.png`)으로 정점을 올리고 **Sentinel-2 위성사진**(`satellite.jpg`)을 입힘(높이 약 4배 과장). 하늘(drei `Sky`), 바다 평면, 클릭·호버 가능한 핀(관광=주황, 유산=노랑), 마우스 회전·확대(OrbitControls). 높이맵을 못 불러오면 단색 대체 섬을 표시. props: `items`, `selected`, `onSelect`, `height`, `autoRotate` |
| `src/lib/geo.js` | `toXZ` 위경도→3D 좌표, `isJejuCoord` 제주 범위 좌표 판별, `heightAt` 지면 높이(높이맵 등록 전에는 종 모양 근사), `setHeightField` 높이맵 등록, `TERRAIN` 지형 크기·배율 |
| `scripts/build-terrain.mjs` | 일회성 스크립트(`node scripts/build-terrain.mjs`). AWS Terrain Tiles(Terrarium)와 EOX Sentinel-2 cloudless 2020 타일(z11)을 받아 위경도 선형 격자로 재투영해 `public/terrain/` 에 저장 (`sharp` 사용) |
| `src/lib/placeCategories.js` | 분류별 데이터 소스 규칙: 음식점 = 한식(FD01)→양식(FD02)→일식·기타(FD03) (카페 FD05 제외), 카페 = FD05, 관광지 = 일반(12)→국가유산, 축제 = 기간 검색, 내 주변 = 위치 기반(유형별 조건), 전체 = **숙박(32)을 뺀** TourAPI 유형들(12·14·15·28·38·39)→국가유산. `advance` 가 다음 쪽/소스 위치를 계산, `subtitleOf`·`fmtDist` 가 카드 부제목(거리·기간·주소) 구성 |
| `src/components/DetailModal.jsx`, `PlaceMap.jsx` | 상세 팝업(사진 캐러셀·이용정보·소개·지도)과 Leaflet 2D 지도(OpenStreetMap 타일, 핀 1개). 관광·국가유산 페이지가 공유. 좌표가 없으면 지도 대신 안내 문구 |
| `src/pages/Map3D.jsx` (`/map3d`) | TourAPI + 국가유산청 결과를 한 3D 지도에 표시. 검색, 핀/목록 클릭 시 상세 카드, 즐겨찾기 저장. 한쪽 API가 실패해도 다른 쪽 핀은 표시하고 경고 표시 |
| `src/pages/Home.jsx` | 히어로 영역에 자동 회전하는 3D 제주 |

### 공공데이터 API 3종 (`server/`)
| 파일 | API | 설명 |
|---|---|---|
| `tour.js` | 한국관광공사 TourAPI | 키워드 있으면 `searchKeyword2`, 없으면 `areaBasedList2`. 제주 = 법정동 코드 `lDongRegnCd=50`(옛 `areaCode=39` 는 관광지 132건·축제 0건만 잡혀 교체: 관광지 557, 문화시설 97, 축제 27, 음식점 699건). `page`·`rows` 지원, 이미지 http→https. **숙박은 모든 결과에서 제외**(`isLodging`: 유형 32 / 분류 대분류 AC). `searchNearby`(위치 기반 `locationBasedList2`, 거리순·`dist` 미터, 반경 100m~20km, 제주 밖 좌표는 에러), `searchFestivals`(기간 검색 `searchFestival2`, 기본 오늘 이후, 행사명 키워드 필터) |
| `weather.js` | 기상청 단기예보 | 제주시·서귀포시 격자, 가장 가까운 발표시각 계산, 6개 시간대 기온/하늘/강수 |
| `text.js` | 응답 HTML 정리 도구: `htmlToText`(태그 제거, XSS 방지), `extractUrl`(홈페이지 주소만, http/https 만 허용), `fmtDate`, `https` | |
| `heritage.js` | 국가유산청 | 제주(ccbaCtcd 50) 국가유산 XML 검색 |

### 서버 함수 (`api/`)
| 주소 | 기능 |
|---|---|
| `GET /api/hello` | 상태 확인. 키 값은 숨기고 있는지만 반환 |
| `GET /api/tour?keyword=&type=&lcls=&page=&rows=` | 관광·문화 검색 (type 비우면 전체, lcls = 분류체계 중분류 예: `FD05` 카페, rows 최대 50) |
| `GET /api/weather?place=` | 날씨 |
| `GET /api/tour?mode=near&lat=&lng=&radius=&type=&lcls=&xlcls=&page=&rows=` | 주변 검색(가까운 순, `dist` 는 미터). `xlcls` = 제외할 분류(음식점에서 카페 빼기) |
| `GET /api/tour?mode=festival&from=&to=&keyword=&page=&rows=` | 축제 기간 검색 (`from` 기본 오늘, YYYY-MM-DD) |
| `GET /api/tour?id=` | 관광지 상세: 소개·이용정보(유형별)·사진·좌표 (`detailCommon2`+`detailIntro2`+`detailImage2`) |
| `GET /api/heritage?keyword=&page=&rows=` | 국가유산 검색 |
| `GET /api/heritage?kdcd=&asno=&ctcd=` | 국가유산 상세: 설명·사진·지정일·소재지 (`SearchKindOpenapiDt`) |
| `POST /api/agent` | Claude 에이전트 루프(최대 5턴): 도구 5개(`search_tour_places`, `get_weather`, `search_heritage`, `search_nearby`(위치 기반·가까운 순), `search_festivals`(기간 검색)) 호출. 시스템 프롬프트에 오늘 날짜(KST)와 "숙박은 다루지 않는다" 규칙 포함 → 결과 전달 → 최종 답, 사용한 도구 기록(`steps`) 반환. 429 는 안내 메시지 |

### 화면
| 경로 | 기능 |
|---|---|
| `/` | 소개 + 3D + 동작 체크(React / Supabase / `/api`) + 닉네임(Zustand, localStorage 저장) |
| `/places` | **분류 버튼**(전체·관광지·문화시설·축제·행사·음식점·카페·**내 주변**) + 관광지 하위 선택(전체·일반·국가유산). 선택은 주소(`?cat=cafe`, `?cat=spot&sub=heritage`, `?cat=near&sub=cafe&r=5`)에 유지. **축제·행사**: 기간(시작일 기본 오늘~종료일) 입력, 카드에 행사 기간 표시. **내 주변**: 브라우저 위치(제주 안이면)·아니면 제주시청 기준, 반경 1/3/5/10km, 유형 선택, 거리순 카드(`286m ·` 표시), 검색창 숨김. 숙박은 어디에도 나오지 않음. 검색어(비우면 전체), 카드, 더 보기(12건씩, 분류의 소스를 순서대로 이어 붙임), 즐겨찾기. **카드 클릭 → 상세 모달**(사진·이용정보·소개·홈페이지·2D 지도). 국가유산 카드는 `국가유산·보물` 같은 배지. (국가유산 별도 메뉴/`/heritage` 페이지는 없어짐) |
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
- ✅ 내 주변(제주시청 기준·서귀포 좌표 모의 시 서귀포 기준·제주 밖 좌표는 제주시청으로 대체, 반경 1km→최대 977m, 카페 2건, 음식점에서 카페 제외), 축제 기간(오늘 이후 3건 / 1월부터 12건+더 보기 / 1~4월 8건), 3D 지도 영향 없음(핀 17개)
- ✅ `/places`: 분류 버튼·관광지 하위 선택 동작, 분류별 배지(카페/음식점 분리), 축제 27건 끝까지 더 보기, 키워드 검색 시 관광지→국가유산 이어 붙임, 선택 분류가 주소에 유지, 카페·국가유산 상세 모달과 지도
- ✅ `/my`: Supabase 미설정 시 빈 목록 표시
- ✅ `/agent`: 키가 없으면 서버 오류가 토스트로 표시, GET 은 405
- ✅ 404 페이지
- ✅ 버전 2: 실제 제주 해안선·한라산 입체 지형과 위성 텍스처 렌더, 핀이 지형 높이 위에 놓임
- ✅ `npm run build` 성공

### 아직 확인하지 못한 것 (키 필요)
- 실제 공공데이터 응답(`DATA_GO_KR_KEY`), Supabase 즐겨찾기 저장·조회, 실제 Claude 에이전트 응답, Vercel 배포

## 데이터 출처 (3D 지형)
- 높이: AWS Terrain Tiles (Mapzen 등 오픈 DEM 모음, https://registry.opendata.aws/terrain-tiles/)
- 위성: Sentinel-2 cloudless 2020 © EOX IT Services GmbH, contains modified Copernicus Sentinel data 2020 (CC BY 4.0, https://s2maps.eu)

## 버전
- `v1` 태그 / `main`: 단색 지형 3D 지도
- `v2` 브랜치: 실제 지형(DEM) + 위성 텍스처
- 버전 1로 돌아가기: `git switch main` (또는 `git switch --detach v1`), 다시 버전 2: `git switch v2`

## 배포 (Vercel)
`vercel.json` 이 `/api` 를 제외한 모든 경로를 `index.html` 로 보내(SPA) 라우팅이 동작한다. Vercel 프로젝트 환경변수에 위 4개 값을 등록한다.
