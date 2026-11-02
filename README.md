# 제주 오름 길잡이

제주의 **오름**을 소개하는 웹앱. 공공데이터 API와 그 API들을 도구로 쓰는 **AI 에이전트**로 오름을 찾고, 오름 앞뒤로 들를 음식점·카페·날씨까지 안내한다.

## 기획 의도
- **주제(제주 IP)**: 오름 — 제주특별자치도 오름현황(공식 368곳, 공공데이터포털 15043497) + 관광공사 소개글.
- **누구에게**: 오름에 가 보고 싶지만 어디가 좋은지, 얼마나 걷는지, 날씨가 어떤지 한 번에 알기 어려운 여행자·도민.
- **어떤 가치**: 소개글에서 뽑은 특징(일출·일몰, 억새·꽃, 정상 전망, 분화구, 가볍게 걷기, 가족, 숲길)과 **내 위치에서 가까운 순**으로 오름을 고르고, 같은 화면에서 날씨·근처 맛집·카페·주차장·편의점·주유소까지 확인한다. 에이전트에게 "내일 서귀포 날씨 보고 일몰 보기 좋은 오름 골라줘"처럼 물으면 오름 검색 → 날씨 조회를 스스로 이어 호출해 답한다.
- **첫 화면 한 줄**: 제주의 오름을 공공데이터와 AI 가이드로 쉽고 편하게 찾아가는 탐방 길잡이.

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
| `VITE_KAKAO_JS_KEY` | 카카오 지도(JavaScript 키). 카카오 개발자 콘솔의 **JavaScript SDK 도메인**에 `http://localhost:5173`·`http://localhost:5174`·배포 주소를 등록해야 동작(등록 안 된 주소는 `domain mismatched`). 배포 시 Vercel 환경변수에 넣고 **재배포** | 브라우저(공개되는 키, 도메인 등록이 보호 장치) |
| `KAKAO_REST_KEY` | 공연장 주소→좌표 변환 스크립트. 카카오 앱에서 **카카오맵(OPEN_MAP_AND_LOCAL) 서비스 사용 설정**이 켜져 있어야 함 | 스크립트 전용 (`VITE_` 금지) |

Supabase 에는 `favorites` 테이블(`id`, `nickname`, `source`, `item_id`, `title`, `created_at`)이 필요하다.

### 가본 곳(`visits`) 테이블 + 삭제 정책 — Supabase SQL Editor 에서 한 번 실행
```sql
-- 가본 곳: favorites 와 같은 모양
create table if not exists visits (
  id bigint generated always as identity primary key,
  nickname text not null,
  source text not null,       -- 'tour' | 'heritage' | 'venue' | 'rest'
  item_id text not null,
  title text not null,
  created_at timestamptz default now()
);
alter table visits enable row level security;
create policy "visits read all"   on visits for select using (true);
create policy "visits insert all"  on visits for insert with check (true);
create policy "visits delete all"  on visits for delete using (true);
-- 가볼만한 곳 빼기에 필요한 삭제 정책 (이미 만들었다면 건너뜀)
create policy "delete all" on favorites for delete using (true);
```
※ 위 정책은 실습용(누구나 읽고 쓰고 지울 수 있음)입니다. 실제 서비스에서는 Supabase Auth 로 바꿉니다.

### 닉네임(내 목록의 주소)
- 로그인이 없어서 닉네임이 곧 내 목록(가볼만한 곳·가본 곳)의 주소입니다. 예전에는 모두 "익명" 한 목록을 같이 썼습니다.
- **닉네임 만들기**: 닉네임이 없는 채로 감귤(가볼만한 곳)·`가봤어요`를 누르면 창이 뜹니다. 이름(2~12글자)을 쓰면 뒤에 **#번호 4자리**가 자동으로 붙어 `오름러버#4821` 이 되고(같은 번호가 이미 쓰이면 다시 뽑음), 누르려던 동작이 이어서 실행됩니다. `src/lib/nickname.js`, `NicknameDialog.jsx`.
- **다른 기기에서**: 번호까지 그대로 입력(`오름러버#4821`)하면 같은 목록으로 들어옵니다. `가볼만한 곳`·`가본 곳` 탭 오른쪽 위의 `바꾸기`/`닉네임 만들기`로 바꿉니다.
- 한계: 인증이 아니라서 번호를 아는 사람은 그 목록을 볼 수 있습니다.
가볼만한 곳(즐겨찾기) **빼기**(감귤 아이콘)를 쓰려면 anon 에 delete 권한 정책도 필요하다. 없으면 오류 없이 0건만 지워지므로 앱이 "delete 정책이 필요해요" 알림을 띄운다.

```sql
create policy "anon delete" on public.favorites for delete to anon using (true);
```

## 구조와 기능

```
api/        Vercel 서버 함수 (/api/이름)
server/     공공데이터 API 호출 로직 (api/ 와 에이전트가 같이 사용)
src/
  lib/        supabase.js, geo.js, kakao.js, placeCategories.js
  store/      useAppStore.js
  api/        client.js
  components/ ItemCard, PageHeader, Status, PlaceWeather
  pages/      Home, Places, Heritage, Agent, My, NotFound
  layouts/    RootLayout
tests/      vitest 테스트
```

### 화면·기능
| 파일 | 기능 |
|---|---|
| `src/lib/geo.js` | `isJejuCoord` 제주 범위 좌표 판별 |
| `scripts/build-venues.mjs` | 일회성: 제주도내 공연장 현황 CSV(EUC-KR)를 `server/data/venues.js` 로 변환 (`node scripts/build-venues.mjs <csv>`). 이름·개관일 분리, 원본 오탈자·깨진 글자 보정, 주소 정리·지오코딩용 주소 생성 |
| `scripts/geocode-venues.mjs` | 일회성: 공연장 주소 → 좌표 (`node --env-file=.env scripts/geocode-venues.mjs`). `.env` 의 `KAKAO_REST_KEY`(카카오 REST API 키) 필요. 주소 검색 → 실패하면 장소 검색, 이미 좌표가 있으면 건너뜀 |
| `src/lib/placeCategories.js` | 분류별 데이터 소스 규칙: 음식점 = 한식(FD01)→양식(FD02)→일식·기타(FD03) (카페 FD05 제외), 카페 = FD05, 관광지 = TourAPI 관광지(12)→국가유산(합쳐서 항상 함께 나옴), 축제 = 기간 검색, 내 주변 = 위치 기반(유형별 조건), 전체 = **숙박(32)을 뺀** TourAPI 유형들(12·14·15·28·38·39)→국가유산. `advance` 가 다음 쪽/소스 위치를 계산, `subtitleOf`·`fmtDist` 가 카드 부제목(거리·기간·주소) 구성 |
| **지운 분류** | `전체`·`관광지`·`문화시설`·`축제·행사` 분류 버튼과 그 전용 화면(축제 기간 입력·진행률 칩)을 화면에서 뺐습니다. 서버 쪽(`/api/tour`·`/api/heritage`·`/api/venue` 의 관광지·유산·공연장·축제 조회)과 에이전트 도구는 그대로라 에이전트는 계속 씁니다. 예전 주소(`?cat=spot` 등)는 오름으로 열림. 저장해 둔 국가유산·공연장은 가볼만한 곳에서 계속 열림 |
| `server/restaurants.js` · `api/restaurant.js` | **행정안전부 일반음식점 조회서비스**(`apis.data.go.kr/1741000/general_restaurants/info`, 제주 영업 중 약 1만 5천 곳). 음식점 탭에서 **관광공사 음식점(사진 있음) 뒤에 이어 붙임**(사진 없는 카드는 아이콘, 배지 `음식점·횟집`, 부제목 주소·전화). 조건: 영업 상태 `01` + 도로명주소 `제주특별자치도`, 이름 `LIKE`, 업태 `EQ`(쪽당 최대 100건). 좌표는 중부원점 TM(EPSG:5174)이라 `proj4` 로 위경도 변환. 관광공사 음식점과 이름이 같고 300m 안이면 `dup` 표시해 목록에서 뺌. 상세는 관리번호로 조회(업태·전화·지번 주소·허가일·영업 상태 + 지도·날씨·근처 관광지 추천). 에이전트 도구 `search_restaurants`. 한계: 사진·소개글 없음, 테마 태그 없음(관광공사 음식점만), 내 주변(위치 검색)에는 포함 안 됨, 카페는 대상 아님 |
| `server/poi.js` · `api/poi.js` · `NearbyPoi.jsx` | **주변 편의시설**: 정보 카드 지도 아래 `주변 편의시설` 칩(**편의점 CS2 · 주차장 PK6 · 주유소 OL7**) — 누르면 이 곳 좌표 주변(500m/1km)을 가까운 순으로 목록(이름·거리·주소·전화·카카오맵 링크)과 같은 지도의 핀(편의점 하늘색·주차장 보라·공영주차장 초록·주유소 벽돌색, 핀을 누르면 카카오맵 장소 페이지)으로 보여줌. 카카오 로컬 API 카테고리 검색(`dapi.kakao.com/v2/local/search/category.json`)을 서버가 `KAKAO_REST_KEY` 로 호출 (`GET /api/poi?lat=&lng=&cat=&radius=`, 반경 100~2000m, 한 번에 최대 15곳). **주차장은 공영주차장을 먼저**(카카오 하위 분류 `공영주차장` 또는 이름의 '공영', 이름 검색+카테고리 2쪽을 합쳐 공영→민간 순, 각각 가까운 순, `공영` 배지). 영업시간·리뷰는 없음. 칩을 누를 때만 호출 |
| `src/lib/placeTags.js` · `server/tags.js` · `scripts/build-tags.mjs` | **소개글 테마 태그**: `placeTags.js` 의 규칙(탭마다 태그 → 단어 목록)으로 이름+소개글에서 태그를 뽑음. `build-tags.mjs`(`node --env-file=.env scripts/build-tags.mjs`, 이어하기 가능)가 TourAPI 목록과 소개글(detailCommon2)을 받아 `server/data/placeIndex.js`(태그만 저장, 소개글 본문은 저장 안 함)를 만듦. `server/tags.js` 가 색인에서 탭·태그(AND)·분류·이름으로 조회, `GET /api/tour?mode=tagged&tab=&tags=` (축제는 기간 검색 결과를 태그로 거름). 일일 호출 한도에 걸려 소개글을 못 받은 곳은 이름만으로 태그가 붙으니, 한도가 풀린 뒤 스크립트를 다시 돌리면 채워짐. 국가유산은 색인에 없어 태그 분류에서 빠짐 |
| **메인 오름 소개** | `OreumIntro.jsx`: 히어로 아래에 "오름이란?" 소개(공식 오름 수는 데이터에서 읽음), 형태 4종 설명과 곳 수(원추 102·원형 53·말굽 174·복합 39), 사이트 사용법 4줄, "오름 둘러보기" 버튼(아래 목록으로 스크롤) |
| **오름 탭** | 기본 분류. **제주특별자치도_오름현황(2025-12-31, 공식 368곳)** 을 `scripts/build-oreum.mjs`(odcloud 수집 → 소재지를 카카오 지오코딩으로 좌표화 → 관광공사 오름 79곳과 이름으로 연결해 `tourId`·사진 부여, 별칭 4건)가 `server/data/oreum.js` 로 저장. 외부 호출 없이 즉시 표시. 카드: 이름·행정시·**표고**·**형태**(사진 왼쪽 위에 형태별 색 표식 — 원추 주황·원형 초록·말굽 파랑·복합 보라), 필터: **형태**(원추형·원형·말굽형·복합형 — 방향 표기는 묶음), **정렬**(이름순·표고 높은 순·표고 낮은 순), **내 주변**(반경 1·3·5km 가까운 순), 이름 검색, **소개글 특징 칩**(일출·일몰 등 7개, 관광공사 등록 오름만). 정보 카드: 행정시·표고·비고(比高)·면적·형태 + 관광공사 등록 오름은 사진·소개글. **사진은 관광공사(공공데이터) 것만 사용**(76곳, 나머지는 빈 이미지) — 블로그·웹 검색 사진은 저작권 문제로 쓰지 않음. 사진 없는 카드는 **형태·표고를 반영한 일러스트**(`OreumArt.jsx`)를 보여줌. 기록 키: 관광공사 등록 오름은 예전처럼 `source=tour`+관광공사 id(기존 가본 곳·가볼만한 곳 그대로 이어짐), 그 밖은 `source=oreum`+공식 연번. `GET /api/oreum?keyword=&form=&tags=&sort=elev&lat=&lng=&radius=&page=&rows=(최대 400)` / `?id=` |
| `src/components/NearbyRecs.jsx` | 상세 모달 아래 **"이 근처 추천"**: 보는 곳 좌표 주변을 가까운 순으로(반경 3km, 비어 있으면 "10km로 넓히기"). 관광·문화 계열(관광지·국가유산·문화시설·축제·레포츠) → 근처 **음식점(카페 제외) 4곳 + 카페 4곳**, 음식점·카페 → 근처 **관광지 6곳**. 추천 카드(사진·이름·거리)를 누르면 그 곳의 상세로 이동하고 "○○(으)로 돌아가기"로 되돌아옴. 규칙은 `placeCategories.js` 의 `recommendModeOf`·`RECOMMEND_GROUPS`. 공연장도 좌표가 채워져 추천을 받음(`recommendModeOf`) |
| `src/components/DetailModal.jsx` | 상세 팝업(사진 캐러셀·이용정보·소개·지도·**카카오맵 링크**·근처 추천). 관광·국가유산·공연장이 공유. 좌표가 없으면 지도 대신 안내 문구 |
| `src/components/PlaceMap.jsx` → `KakaoMap.jsx` / `LeafletMap.jsx` | **카카오 지도가 기본**(`VITE_KAKAO_JS_KEY` 가 있을 때): 이 곳 핀 + 줌 컨트롤 + 일반/스카이뷰 전환, **근처 추천을 같은 지도에 핀으로**(음식점 감귤·카페 갈색·관광지 초록 점, 마우스를 올리면 이름 표시, 핀을 누르면 그 곳 상세로 이동) + **반경 원**(점선)과 영역 자동 맞춤. 키가 없거나 SDK 를 못 불러오면(도메인 미등록·광고 차단 등) 자동으로 Leaflet(OpenStreetMap) 지도로 대신함 |
| `src/lib/kakao.js` | 카카오 SDK 로더(`loadKakao`: 스크립트를 한 번만 붙이고 `autoload=false` → `kakao.maps.load` 로 준비 대기, 실패 시 재시도 가능), `kakaoLinks`(카카오맵 **보기·길찾기·로드뷰** 바로가기 URL — 키 없이 동작), `radiusEdges`(반경 원 영역 계산) |

### 공공데이터 API 3종 (`server/`)
| 파일 | API | 설명 |
|---|---|---|
| `tour.js` | 한국관광공사 TourAPI | 키워드 있으면 `searchKeyword2`, 없으면 `areaBasedList2`. 제주 = 법정동 코드 `lDongRegnCd=50`(옛 `areaCode=39` 는 관광지 132건·축제 0건만 잡혀 교체: 관광지 557, 문화시설 97, 축제 27, 음식점 699건). `page`·`rows` 지원, 이미지 http→https. **숙박은 모든 결과에서 제외**(`isLodging`: 유형 32 / 분류 대분류 AC). `searchNearby`(위치 기반 `locationBasedList2`, 거리순·`dist` 미터, 반경 100m~20km, 제주 밖 좌표는 에러), `searchFestivals`(기간 검색 `searchFestival2`, 기본 오늘 이후, 행사명 키워드 필터) |
| `weather.js` | 기상청 단기예보 | 제주시·서귀포시 격자, 가장 가까운 발표시각 계산, 6개 시간대 기온/하늘/강수; **장소·날짜별 예보 `getForecast`**: 좌표→기상청 격자(`toGrid`)로 단기예보(오늘~3일, 날짜별 최저·최고·하늘·강수확률), 4~10일은 중기예보(육상 `11G00000` + 기온 `11G00201`, 제주 전체 공통, 06·18시 발표 기준 `midBase`) |
| `text.js` | 응답 HTML 정리 도구: `htmlToText`(태그 제거, XSS 방지), `extractUrl`(홈페이지 주소만, http/https 만 허용), `fmtDate`, `https` | |
| `heritage.js` | 국가유산청 | 제주(ccbaCtcd 50) 국가유산 XML 검색 |
| `venues.js` + `data/venues.js` | 제주도내 공연장 현황 (**파일 데이터**, 공공데이터포털 15096065, 기준일 2021-11-30, 이용허락범위 제한 없음) | API 호출 없이 변환해 둔 34건을 조회 (이름·주소 검색, 쪽 나누기, 상세). 원본에는 좌표·전화번호가 없어 `scripts/geocode-venues.mjs` 로 카카오 주소 검색을 돌려 **34곳 모두 좌표를 채워 둠**(지도·근처 추천 표시) |

### 서버 함수 (`api/`)
| 주소 | 기능 |
|---|---|
| `GET /api/hello` | 상태 확인. 키 값은 숨기고 있는지만 반환 |
| `GET /api/tour?keyword=&type=&lcls=&page=&rows=` | 관광·문화 검색 (type 비우면 전체, lcls = 분류체계 중분류 예: `FD05` 카페, rows 최대 50) |
| `GET /api/weather?place=` | 날씨 |
| `GET /api/weather?lat=&lng=&dates=` | 장소(좌표)·날짜별 예보 (날짜 `YYYY-MM-DD` 최대 3개, 제주 밖 좌표·형식 오류는 400) |
| (상세 모달 날씨) | `PlaceWeather.jsx`: 모든 정보 카드(상세 모달, 제목 바로 밑)(음식점·카페·관광지·문화시설·축제·행사) 상세에 **오늘 + 방문할 날짜(오늘~10일, 축제는 시작일이 기본)** 날씨 표시. 칸마다 `단기예보 · 이 장소 좌표 기준` / `중기예보 · 제주 전체 공통`, 아래에 작은 글씨 안내문. 날씨 실패는 모달에 영향 없음 |
| `GET /api/tour?mode=near&lat=&lng=&radius=&type=&lcls=&xlcls=&page=&rows=` | 주변 검색(가까운 순, `dist` 는 미터). `xlcls` = 제외할 분류(음식점에서 카페 빼기) |
| `GET /api/tour?mode=festival&from=&to=&keyword=&page=&rows=` | 축제 기간 검색 (`from` 기본 오늘, YYYY-MM-DD) |
| `GET /api/tour?id=` | 관광지 상세: 소개·이용정보(유형별)·사진·좌표 (`detailCommon2`+`detailIntro2`+`detailImage2`) |
| `GET /api/heritage?keyword=&page=&rows=` | 국가유산 검색 |
| `GET /api/venue?keyword=&page=&rows=` / `?id=v1` | 공연장 목록(34건, 이름·주소 검색) / 상세. 없는 id 는 404 |
| `GET /api/heritage?kdcd=&asno=&ctcd=` | 국가유산 상세: 설명·사진·지정일·소재지 (`SearchKindOpenapiDt`) |
| `POST /api/agent` | Claude 에이전트 루프(최대 5턴(안내서 규칙)): 도구 8개(`search_oreum` 오름 검색 — 특징 태그·내 위치 반경, `search_restaurants`, `get_place_detail` 소개글 확인 포함, `search_tour_places`, `get_weather`, `search_heritage`, `search_nearby`(위치 기반·가까운 순), `search_festivals`(기간 검색)) 호출. 시스템 프롬프트에 오늘 날짜(KST)와 "숙박은 다루지 않는다" 규칙 포함 → 결과 전달 → 최종 답, 사용한 도구 기록(`steps`) 반환. 429 는 안내 메시지; `search_tour_places` 는 이름 검색에 더해 `lcls`(분류체계 코드, 예: VE02 테마공원·동물원·수족관)로도 찾음 — 이름에 '동물원'이 없는 화조원도 분류+소개글 확인으로 답함; **대화창에 에이전트가 호출한 도구를 답변 위 칩으로 표시**(`src/lib/agentSteps.js`: `장소 검색 · 해녀 → 2건 → 소개글 확인`, 마우스를 올리면 실제 함수 이름·인자) |

### 화면
| 경로 | 기능 |
|---|---|
| `/` | 소개(히어로) → **관광·문화 UI**(분류 버튼·검색·내 주변·축제 기간·상세·감귤 즐겨찾기가 모두 홈에서 동작, `Places` 를 그대로 삽입, 분류는 `/?cat=cafe` 처럼 주소에 유지) → 동작 체크(React / Supabase / `/api`, 지금은 숨김 — `Home.jsx` 의 `SHOW_CHECKS` 로 켬) + 닉네임 칸(숨김 — `Home.jsx` 의 `SHOW_NICKNAME`) |
| `/places` | **분류 버튼**(**오름(기본)**·음식점·카페·가볼만한 곳·가본 곳) + 각 분류 밑 **내 주변 반경(1·3·5km)** + **음식점 종류 칩**(전체·한식·횟집·식육·구이·분식·일식·중식·양식 — 관광공사 분류체계 코드와 일반음식점 '업태'를 합쳐서 거름, 횟집·식육은 일반음식점만, 내 주변에서는 관광공사 코드가 있는 칩만 반영) + **인기 메뉴 바로가기**(음식점: 흑돼지·해물·국수·갈치·전복·보말 / 카페: 커피·베이커리·감귤·한라봉·말차·디저트 — 누르면 그 단어로 검색, 가게 **이름**에 든 단어로 찾음) + **테마 칩**(관광지·문화시설·축제·행사·음식점·카페 탭마다, 소개글에서 뽑은 태그, 여러 개 선택 = 모두 가진 곳만, 주소 `?t=sea,family`, 내 주변과는 함께 쓰지 않음) + ·오름 제외 — 이름에 '오름'이 든 곳을 뺌, 여러 개 선택 가능한 구조). 선택은 주소(`?cat=cafe`, `?cat=spot&sub=no-oreum`, `?cat=cafe&r=5`)에 유지. **축제·행사**: 기간(시작일 기본 오늘~종료일) 입력, 카드에 행사 기간 표시. **내 주변**(분류 버튼이 아니라 각 분류 밑 반경 버튼, 다시 누르면 해제, 분류를 옮겨도 반경 유지): 브라우저 위치(제주 안이면)·아니면 제주시청 기준, 그 분류의 유형만 거리순 카드(`286m ·` 표시), 검색창·축제 기간 입력 숨김(위치 API는 검색어·기간을 받지 않음), 관광지는 TourAPI 관광지만(국가유산은 위치 검색이 없음). 숙박은 어디에도 나오지 않음. 검색어(비우면 전체), 카드, 더 보기(12건씩, 분류의 소스를 순서대로 이어 붙임), 즐겨찾기. **카드 클릭 → 상세 모달**(사진·이용정보·소개·홈페이지·2D 지도). 국가유산 카드는 `국가유산·보물` 같은 배지. (국가유산 별도 메뉴/`/heritage` 페이지는 없어짐) **공연장 34건은 문화시설(TourAPI 97건 뒤)과 전체에 합쳐짐**: `공연장·공공/민간` 배지, 상세(소재지·시설구분·공연 형태·개관일·자료 기준일), 좌표가 없으면 지도 대신 안내 문구. 내 주변에는 좌표가 생긴 뒤에 추가 가능 |
| (모든 화면) | **플로팅 AI 가이드**(`ChatWidget`): 오른쪽 아래 원형 버튼이 페이지를 옮겨도 따라다니고, 누르면 대화창이 열림(Esc·× 로 닫기, 모바일은 가로 전체). 대화가 비어 있으면 예시 질문 칩 3개, 도구 호출 내역(`search_nearby(...) → 2건`) 표시. 대화는 전역 store 에 있어 닫았다 열거나 페이지를 옮겨도 유지(새로고침하면 초기화). `ChatPanel` 을 `/agent` 페이지와 공유 |
| `/agent` | 전체 화면 AI 가이드 채팅 (메뉴에서는 빠졌고 주소로만 접속, 이 페이지에서는 플로팅 버튼을 숨김) |
| 분류 버튼 **가볼만한 곳** | 예전 "내 즐겨찾기". 홈(관광·문화) 분류 버튼 줄 맨 끝(감귤 아이콘 + 담은 개수 칩)에 들어감 — Supabase `favorites`(닉네임별)를 보여줌: 닉네임 입력, 제목 검색, 종류 배지(관광·문화/국가유산/공연장), 카드를 누르면 상세(관광지·공연장은 id 로, 국가유산은 이름으로 다시 찾아 열림), **감귤을 누르면 가볼만한 곳에서 빠짐**. 주소 `/?cat=saved` |
| 분류 버튼 **가본 곳** | 가볼만한 곳 바로 옆. 카드 오른쪽 아래 **체크 버튼(`가봤어요`)**(감귤 밑)과 정보 카드 아래 `가봤어요` 버튼으로 기록 ↔ 빼기, 기록한 곳은 이 탭에 모임(담은 개수 칩, 제목 검색, 눌러서 상세). Supabase `visits` 테이블(가볼만한 곳과 별도). 주소 `/?cat=visited`. 가본 곳 탭의 카드에서도 감귤로 가볼만한 곳에 담을 수 있음 |
| **오름 등반률 + 3D 제주 지도** (가본 곳 탭 맨 위) | `OreumProgress.jsx`: **가본 곳에 체크한 오름 수 ÷ 공식 오름 현황의 오름 수(368곳)** 를 `N / 368곳 · xx%` 와 진행 막대로 표시(`src/lib/oreumProgress.js`, 오름이 아닌 곳·중복은 세지 않음, 체크할 때마다 1씩 오름). 등반률별 등급(0% 오름 탐방 준비 중 → 1% 새내기 → 5% 산책가 → 15% 탐험가 → 35% 지킴이 → 60% 달인), 등급 배지에 마우스를 올리면 등급표(등급명·등반률·필요한 오름 수, 지금 등급 강조). 등급이 오를수록 **현무암·감귤 엠블럼**(`TierEmblem.jsx`: 돌 한 개+새싹 → 돌 더미+감귤 → 돌담+감귤나무 → 나무가 늘고 → 금빛 달인)과 배지·진행 막대 색(현무암 회색 → 초록 → 감귤 주황 → 금색, 달인은 반짝이는 막대)이 화려해짐. **three.js 3D 제주 전도**(`OreumJeju3D.jsx`, `@react-three/fiber`·`drei`): 실제 DEM 높이를 **높이별 색(바닷가 연초록 → 연두 → 갈색 → 한라산 회색·흰색)**으로 단순하게 칠한 제주 위에(위성 사진 없음 → 가벼워서 돌릴 때 부드러움), **가본 오름의 정상(좌표 근처 가장 높은 곳)에 현무암 돌탑+감귤색 깃발이 서쪽부터 하나씩 꽂히고**(바람에 흔들리고 발밑에 금빛 고리, 마크에 올리면 '정상 도착·표고')(떨어지며 튀어 오르는 애니메이션) 아직 안 간 오름은 **빈 깃대**(한 번에 그리는 InstancedMesh)로 보여 깃발로 채워 나가는 느낌, 지도 왼쪽 아래 **깃발 N / 368** 표시, **랜드마크**: 한라산(1,947m)·우도·마라도 이름표와 **성산일출봉**(분화구 있는 응회구 + 떠오르는 해 모양, 실제보다 크게), **방향 표기**: 섬 둘레 북·동·남·서 글자 + 지도를 돌리면 따라 도는 나침반, 마크에 마우스를 올리면 이름, 마우스로 돌리고 확대. 3D 코드는 이 탭을 열 때만 내려받음(`React.lazy`). 높이맵은 `node scripts/build-terrain.mjs`(AWS Terrain Tiles, `sharp`)로 `public/terrain/` 에 생성, 범위는 `geo.js` 의 `TERRAIN_BBOX`. 오름 전체 목록은 `GET /api/oreum?rows=400` |
| `/my` | 예전 주소 → `/?cat=saved` 로 이동 (`pages/My.jsx` 는 없어짐) |
| (가볼만한 곳 감귤) | 카드 오른쪽 아래 감귤 버튼(홈의 관광·문화), 상세 모달 아래: 윤곽선 = 아직 안 담음, 주황 = 담음. 누르면 담기 ↔ 빼기(`toggleFavorite`). 앱 시작·닉네임 변경 시 즐겨찾기를 불러와(0.4초 지연) 어느 화면에서나 담김 표시. 같은 종류(`source`)·id 만 같은 항목으로 취급해 중복 저장 방지 |
| 그 외 | 404 |

## 테스트 결과

### 자동 (`npm test`, vitest — 20개 통과)
| 파일 | 검증 내용 |
|---|---|
| `tests/geo.test.js` | 좌표 변환 방향, 유효 좌표 판별, 한라산 최고점 |
| `tests/server.test.js` | tour(엔드포인트 선택·정규화·빈 결과·비JSON 에러), weather(슬롯 묶기·6개·격자), heritage(XML 파싱·빈 결과) — `fetch` 모킹 |
| `tests/api.test.js` | hello 키 비노출, tour/weather/heritage 인자 전달, 예외 시 500 |
| `tests/favorites.test.js` | 즐겨찾기 스토어(가짜 Supabase): 담기·빼기·토글, 종류·id 구분, 미로딩 시 중복 방지, delete 정책 없음(0건) 안내, 닉네임 전환·익명 |
| `tests/agent.test.js` | 405, 도구 호출→결과→답 루프와 steps, 429 메시지 — Anthropic SDK 모킹 |

### 브라우저 수동 확인 (dev 서버, 공공데이터 응답은 fetch 목으로 대체)
- ✅ 홈: 동작 체크 표시(Supabase 키 없음 → 실패 표시, `/api` OK), 닉네임 입력 → 메뉴 표시 + localStorage 저장
- ✅ 내 주변(제주시청 기준·서귀포 좌표 모의 시 서귀포 기준·제주 밖 좌표는 제주시청으로 대체, 반경 1km→최대 977m, 카페 2건, 음식점에서 카페 제외), 축제 기간(오늘 이후 3건 / 1월부터 12건+더 보기 / 1~4월 8건)
- ✅ `/places`: 분류 버튼 동작, 분류별 배지(카페/음식점 분리), 축제 27건 끝까지 더 보기, 키워드 검색 시 관광지→국가유산 이어 붙임, 선택 분류가 주소에 유지, 카페·국가유산 상세 모달과 지도
- ✅ `/my`: Supabase 미설정 시 빈 목록 표시
- ✅ `/agent`: 키가 없으면 서버 오류가 토스트로 표시, GET 은 405
- ✅ 404 페이지
- ✅ 버전 2: 실제 제주 해안선·한라산 입체 지형과 위성 텍스처 렌더, 핀이 지형 높이 위에 놓임
- ✅ `npm run build` 성공

### 카카오 지도 연동
- ✅ 자동 테스트 `tests/kakao.test.js`: 로더(키 없음·주소 조립·중복 로드 방지·실패 후 재시도), 링크, 반경 끝점
- ✅ 브라우저(가짜 SDK 주입): 카카오 지도 경로로 지도·컨트롤 2개·메인 핀·반경 3km 점선 원·영역 맞춤, 추천 핀(음식점 감귤/카페 갈색/관광지 초록), 반경 10km 로 넓히면 원·핀 갱신, 핀 클릭 → 해당 장소 상세로 이동·돌아가기, 카카오맵 링크 3개
- ✅ 카카오 SDK 가 거절되면(도메인 미등록) Leaflet 지도로 자동 대체되어 화면이 깨지지 않음
- ✅ **카카오맵 서비스 사용 설정 후 REST(주소→좌표) 정상**: `제주시 동광로 69` → (126.5352, 33.5044). 공연장 34곳 좌표 변환 34/34 성공, 전부 제주 범위 안(시·군과 위치 일치, 같은 주소끼리 같은 좌표)
- ✅ 공연장 상세: 지도·카카오맵 링크 3개·근처 추천(음식점·카페)이 나옴 (`recommendModeOf`: 공연장은 좌표가 있을 때 추천)
- ✅ **실제 카카오 지도 확인**(JavaScript SDK 도메인 등록 후 `localhost:5173`·`5174` 허용, 미등록 `3000` 은 `domain mismatched` 로 거절): 국가유산·공연장 상세에서 SDK 로드, 카카오 타일, 3km 점선 원, 근처 추천 핀(음식점 감귤·카페 갈색), 줌 컨트롤, **지도/스카이뷰 전환**, 핀 클릭 → 해당 장소 이동·돌아가기, 링크 3개, 콘솔 오류 없음
- 핀은 평소 **색 점만** 보이고(시내처럼 추천이 몰려도 이름이 겹치지 않음) 마우스를 올리거나 포커스하면 이름이 펼쳐지며 맨 위로 올라옴
- 배포 시: 배포 주소(`https://….vercel.app`)를 JavaScript SDK 도메인에 등록하고 Vercel 에 `VITE_KAKAO_JS_KEY` 를 넣어 **재배포**해야 지도가 뜸 (안 되면 자동으로 Leaflet 지도로 대체됨)

### 공연장·맛집 파일 데이터
- ✅ 공연장 CSV 34건 변환(깨진 글자 0), 문화시설 97 + 공연장 34 = 131건 끝까지 더 보기, 검색('예술의전당' → 문화시설 1 + 공연장 2), 상세 모달. 자동 테스트 `tests/venues.test.js`
- ⚠ **한국국토정보공사_랜다아이_공사맛집리스트는 반영하지 않음**: 전국 2,013건 중 제주는 3건(전부 카페)이고 메뉴·영업시간·주차·제안수·댓글수 칸이 모두 비어 있어 쓸 정보가 상호·주소뿐 (TourAPI 음식점·카페가 훨씬 풍부)
- ✅ 공연장 지도: `node --env-file=.env scripts/geocode-venues.mjs` 로 좌표를 채워 상세 모달에 지도가 나옴 (이미 채워져 있어 다시 돌릴 필요 없음 — 이미 좌표가 있는 곳은 건너뜀)

### 아직 확인하지 못한 것 (키 필요)
- 실제 공공데이터 응답(`DATA_GO_KR_KEY`), Supabase 즐겨찾기 저장·조회, 실제 Claude 에이전트 응답, Vercel 배포

## 버전
- `v1` 태그 / `main`: 단색 지형 3D 지도 (이후 3D 지도 코드는 현재 작업본에서 제거됨, 이전 버전은 git 에 남아 있음)
- `v2` 브랜치: 실제 지형(DEM) + 위성 텍스처 + 관광·문화 확장(분류 버튼·상세·내 주변·축제 기간·공연장) — 파스텔 민트 UI
- `v3-design` 브랜치: v2 + **Sorrel 카드 디자인 + 제주 모티프** (아래 "디자인")
- 버전 1로 돌아가기: `git switch main` (또는 `git switch --detach v1`), 다시 버전 2: `git switch v2`, 새 디자인: `git switch v3-design`

## 디자인 (v3-design)
참고: Kombai 갤러리 "Sorrel" 카드 섹션(골든 크림 바탕 · 세이지 그린 강조 · 둥근 알약 · 은은한 그림자). 라이브 프리뷰에서 추출한 값을 `src/styles/theme.css` 의 `:root` 토큰으로 옮기고, 제주 포인트 색을 더했습니다. 색은 이 토큰만 바꾸면 전체가 바뀝니다.

| 토큰 | 값 | 제주 의미 |
|---|---|---|
| `--canvas` / `--surface` | `#f6f3ec` / `#fffdf8` | 유채꽃빛 골든 크림 |
| `--accent` / `--accent-hi` | `#2f6b52` / `#3a8266` | 오름의 초록 (세이지) |
| `--citrus` | `#e8892b` | 감귤 — 곧 시작/곧 종료 칩, 로고 |
| `--sea` | `#3f9bb0` | 제주 바다 — 파도 장식, 풍경 |
| `--ink` | `#2a200a` | 현무암처럼 짙은 갈색 글자 |

- 모양: 카드 16px · 입력·버튼 12px · 칩 알약, 그림자 `0 1px 2px …, 0 12px 28px -18px …`. 글자: 페이지 제목 24px, 카드 제목 17px, 본문 15px (서체는 Pretendard 유지).
- Bootstrap 은 기본 CSS 위에 `theme.css` 가 변수·버튼 색을 덮어씀 (`main.jsx` 가 Bootswatch minty 대신 기본 Bootstrap 을 불러옴).
- **분류 버튼 = 세그먼트 토글**(연한 트레이 위에서 선택된 버튼만 흰 알약), 하위 선택·반경은 크림 칩.
- **축제 카드**: 행사 기간 진행률 막대 + 상태 칩 — `festivalStatus()`(`placeCategories.js`): 시작 전 `D-n 시작`(7일 이내 감귤색, 이후 금색), 진행 중 `진행 중 · D-n 종료`(초록, 막대 = 경과%), 종료 회색.
- **제주 모티프(직접 그린 SVG, `JejuScene.jsx`)**: 감귤 로고, 홈 히어로의 한라산·오름·감귤 해·파도, 페이지 제목 아래 파도 선, **돌하르방 캐릭터**(`DolHareubang`: 벙거지 모자·돌에 새긴 듯 도드라진 눈·넓적한 코·미소·현무암 구멍 무늬 — AI 가이드의 얼굴).
- **상단 메뉴(Navbar)는 모두 제거**됨 (로고·홈·닉네임 표시). 페이지 주소는 그대로 동작: `/`(홈), `/places`, `/agent`, `/my` → `/?cat=saved`. 다른 페이지에서 홈으로 돌아가는 메뉴는 없음(브라우저 뒤로가기 또는 주소). 메뉴 목록은 `router.jsx` 의 `NAV_ITEMS`, 메뉴 스타일은 `theme.css` 의 `.navbar` 규칙에 남겨 둠. ("관광·문화"는 홈 화면에 들어가 있고, "내 즐겨찾기"는 홈의 분류 버튼 "가볼만한 곳"으로 들어감. 좌측 아이콘 레일은 적용하지 않음). "AI 가이드" 메뉴는 오른쪽 아래 **원형 버튼**(크림 원 + 세이지 테두리 안에 돌하르방, 마우스를 올리면 인사하듯 살짝 기울고, 열면 어두운 갈색 ×)으로 바뀜. 대화창 머리글에도 돌하르방 아바타.

## 배포 (Vercel)
`vercel.json` 이 `/api` 를 제외한 모든 경로를 `index.html` 로 보내(SPA) 라우팅이 동작한다. Vercel 프로젝트 환경변수에 위 4개 값을 등록한다.

## 데이터 출처 (3D 지형)
- 높이: AWS Terrain Tiles (오픈 DEM 모음, https://registry.opendata.aws/terrain-tiles/)
