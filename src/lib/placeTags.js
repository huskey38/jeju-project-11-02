// 장소 소개글(과 이름)에서 '테마 태그'를 뽑는 규칙 — 색인 생성 스크립트(scripts/build-tags.mjs)와 화면이 같이 씁니다.
// TourAPI 는 이름만 검색해 주므로, 소개글에 든 단어로 분류를 만들어 이름에 없는 종류("가족과 가기 좋은 곳")로도 찾게 합니다.
// 규칙: 한 태그의 words 중 하나라도 (이름 + 소개글)에 들어 있으면 그 태그를 붙임. 한 장소에 여러 태그가 붙을 수 있음.

export const TAG_RULES = {
  // 오름 탭: 관광공사 분류 '자연경관(산·오름)'(NA010100) 관광지 — 오름과 봉우리(산굼부리·도두봉·사라봉 등)
  oreum: [
    { key: 'sunrise', label: '일출·일몰', words: ['일출', '일몰', '석양', '노을', '해돋이'] },
    { key: 'grass', label: '억새·꽃', words: ['억새', '유채', '야생화', '진달래', '철쭉', '수국', '꽃'] },
    { key: 'view', label: '정상 전망', words: ['정상에서', '정상 전망', '전망대', '조망', '360도', '파노라마', '한눈에'] },
    { key: 'crater', label: '분화구·굼부리', words: ['분화구', '굼부리', '화구', '말굽형'] },
    { key: 'easy', label: '가볍게 걷기', words: ['산책', '탐방로', '계단', '데크', '가볍게', '쉽게', '30분', '20분', '완만'] },
    { key: 'family', label: '가족·아이', words: ['가족', '아이', '어린이', '유모차'] },
    { key: 'forest', label: '숲길·자연', words: ['삼나무', '곶자왈', '숲길', '숲속', '생태', '자연휴양'] },
  ],
  spot: [
    { key: 'sea', label: '바다·해안', words: ['해변', '해수욕장', '해안', '포구', '갯바위', '해녀', '바닷가', '바다를', '바다가', '바다에'] },
    { key: 'forest', label: '오름·숲·트레킹', words: ['오름', '곶자왈', '숲길', '트레킹', '산책로', '둘레길', '올레길'] },
    { key: 'water', label: '폭포·계곡', words: ['폭포', '계곡', '용천수', '하천', '연못'] },
    { key: 'photo', label: '전망·포토', words: ['포토', '인생샷', '야경', '전망대', '사진 명소', '사진 촬영', '포토존'] },
    { key: 'family', label: '가족·아이', words: ['아이', '어린이', '가족', '키즈'] },
    { key: 'activity', label: '체험·액티비티', words: ['체험', '만들기', '수확', '승마', '카트', '서핑', '낚시', '레저'] },
    { key: 'history', label: '역사·전통', words: ['역사', '유적', '유물', '문화재', '사찰', '사당', '성곽', '전통', '4·3', '4.3', '민속'] },
    { key: 'theme', label: '테마파크·정원', words: ['테마파크', '정원', '수목원', '공원', '식물원', '화원', '동물'] },
  ],
  culture: [
    { key: 'museum', label: '박물관·전시', words: ['박물관', '미술관', '전시', '갤러리', '기념관'] },
    { key: 'show', label: '공연·예술', words: ['공연', '극장', '콘서트', '음악', '예술', '연극', '뮤지컬'] },
    { key: 'kids', label: '아이와 함께', words: ['아이', '어린이', '가족', '키즈'] },
    { key: 'learn', label: '체험·교육', words: ['체험', '교육', '만들기', '학습'] },
    { key: 'history', label: '역사·전통', words: ['역사', '전통', '민속', '유물', '해녀', '4·3', '4.3'] },
  ],
  festival: [
    { key: 'music', label: '음악·공연', words: ['음악', '공연', '콘서트', '버스킹', '무대'] },
    { key: 'food', label: '먹거리', words: ['먹거리', '음식', '푸드', '맛', '시식'] },
    { key: 'flower', label: '꽃·자연', words: ['꽃', '유채', '벚꽃', '동백', '억새', '수국', '자연', '오름', '바다'] },
    { key: 'culture', label: '전통·문화', words: ['전통', '문화', '민속', '역사', '해녀', '신화'] },
    { key: 'family', label: '가족·체험', words: ['가족', '아이', '어린이', '체험'] },
    { key: 'night', label: '불꽃·야간', words: ['불꽃', '야간', '빛', '별', '야경', '축제의 밤'] },
  ],
  food: [
    { key: 'blackpork', label: '흑돼지', words: ['흑돼지'] },
    { key: 'seafood', label: '해산물', words: ['해산물', '횟집', '물회', '활어', '갈치', '전복', '고등어', '해물', '성게', '보말', '옥돔'] },
    { key: 'noodle', label: '국수·면', words: ['국수', '라면', '칼국수', '짬뽕', '우동', '냉면', '면 요리'] },
    { key: 'meat', label: '고기·구이', words: ['돼지', '소고기', '구이', '갈비', '삼겹', '고기', '한우', '통닭'] },
    { key: 'local', label: '향토음식', words: ['향토', '몸국', '고사리', '해장국', '국밥', '전통음식', '제주 전통'] },
    { key: 'view', label: '뷰·분위기', words: ['오션뷰', '바다 전망', '바다가 보이', '바다를 볼', '뷰 맛집', '전망 좋은'] },
    { key: 'family', label: '가족·단체', words: ['가족', '단체', '아이', '룸'] },
  ],
  cafe: [
    { key: 'oceanview', label: '오션뷰', words: ['오션뷰', '바다뷰', '바다 전망', '바다가 보이', '바다를 볼', '해안'] },
    { key: 'dessert', label: '디저트·베이커리', words: ['디저트', '베이커리', '케이크', '빵', '마카롱', '빙수', '쿠키', '와플', '스콘'] },
    { key: 'citrus', label: '감귤·한라봉', words: ['감귤', '한라봉', '귤', '천혜향', '레드향', '한라산'] },
    { key: 'roaster', label: '로스터리·핸드드립', words: ['로스터', '원두', '핸드드립', '스페셜티', '로스팅'] },
    { key: 'mood', label: '감성·포토', words: ['감성', '인테리어', '포토존', '인생샷', '정원'] },
    { key: 'pet', label: '반려동물 동반', words: ['반려', '애견', '강아지', '펫'] },
  ],
}

// 오름 탭에 들어가는 곳: 관광지(12) 중 분류체계 소분류가 NA010100(자연경관-산·오름)
export const isOreum = (item) => String(item.type) === '12' && (item.lcls3 ?? item.lclsSystm3) === 'NA010100'

// 색인·화면에서 쓰는 탭 키: TourAPI 유형 12 관광지 / 14 문화시설 / 15 축제 / 39 음식점(카페는 분류 FD05)
export function tabOfItem(item) {
  const type = String(item.type)
  if (type === '12') return 'spot'
  if (type === '14') return 'culture'
  if (type === '15') return 'festival'
  if (type === '39') return item.lcls === 'FD05' || String(item.lcls).startsWith('FD05') ? 'cafe' : 'food'
  return null
}

// 이름 + 소개글 → 해당 탭의 태그 키 목록
export function tagsOf(tab, text) {
  const t = String(text ?? '')
  return (TAG_RULES[tab] ?? []).filter((r) => r.words.some((w) => t.includes(w))).map((r) => r.key)
}

export const tagLabelsOf = (tab) => TAG_RULES[tab] ?? []
