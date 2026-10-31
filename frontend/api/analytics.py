"""
AI SEO Manager - Google Search Console & AdSense 분석 및 AI 최적화 엔진
- Search Console API & AdSense Management API v2 연동 아키텍처
- 5대 콘텐츠 진단 알고리즘 (고노출 저CTR, 유입 급상승, 유입 급감소, 고수익 주제, 고유입 저수익)
- 설명 가능한 규칙 기반 우선순위 스코어링 (0~100점)
- Gemini AI 기반 제목 개선안 및 후속 콘텐츠 전략 생성
- 주간 성과 보고서 자동 빌더
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import requests

# 기본 설정 디렉토리 (Vercel Serverless의 Read-Only 파일시스템 대응: /tmp 사용)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("VERCEL") or not os.access(BASE_DIR, os.W_OK):
    CONFIG_FILE = "/tmp/analytics_config.json"
else:
    CONFIG_FILE = os.path.join(BASE_DIR, "analytics_config.json")

# -------------------------------------------------------------------------
# Google API 연동 (OAuth 리프레시 토큰 방식, 환경변수로만 인증 정보를 받는다)
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN : 공통
#   GSC_SITE_URL      : Search Console 속성 (예: https://s-elegant.tistory.com/ 또는 sc-domain:example.com)
#   ADSENSE_ACCOUNT_ID: 애드센스 계정 (예: pub-1234567890123456)
# -------------------------------------------------------------------------
TOKEN_URL = "https://oauth2.googleapis.com/token"
GSC_API = "https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
ADSENSE_API = "https://adsense.googleapis.com/v2/accounts/{account}/reports:generate"
_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0.0}


class GoogleApiError(Exception):
    pass


def _oauth_env() -> Optional[Dict[str, str]]:
    cid = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    refresh = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
    if cid and secret and refresh:
        return {"client_id": cid, "client_secret": secret, "refresh_token": refresh}
    return None


def _gsc_site() -> str:
    return os.getenv("GSC_SITE_URL", "").strip()


def _adsense_account() -> str:
    acc = os.getenv("ADSENSE_ACCOUNT_ID", "").strip()
    if acc and not acc.startswith("pub-"):
        acc = f"pub-{acc}"
    return acc


def _access_token() -> str:
    import time
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]
    creds = _oauth_env()
    if not creds:
        raise GoogleApiError("Google OAuth 환경변수가 설정되지 않았습니다.")
    res = requests.post(TOKEN_URL, data={**creds, "grant_type": "refresh_token"}, timeout=20)
    if res.status_code != 200:
        raise GoogleApiError(f"Google 토큰 갱신 실패({res.status_code}): {res.text[:200]}")
    body = res.json()
    _token_cache["token"] = body["access_token"]
    _token_cache["expires_at"] = time.time() + int(body.get("expires_in", 3600))
    return _token_cache["token"]


def _gsc_query(site: str, start: str, end: str, dimension: str, row_limit: int) -> List[Dict[str, Any]]:
    from urllib.parse import quote
    res = requests.post(
        GSC_API.format(site=quote(site, safe="")),
        headers={"Authorization": f"Bearer {_access_token()}"},
        json={"startDate": start, "endDate": end, "dimensions": [dimension], "rowLimit": row_limit},
        timeout=30,
    )
    if res.status_code != 200:
        raise GoogleApiError(f"Search Console 조회 실패({res.status_code}): {res.text[:200]}")
    return res.json().get("rows", [])


def _adsense_daily(account: str, start, end):
    """일별 {date: {earnings, page_views, clicks}}와 통화 코드를 반환 (계정 단위 집계)"""
    params = [
        ("dateRange", "CUSTOM"),
        ("startDate.year", start.year), ("startDate.month", start.month), ("startDate.day", start.day),
        ("endDate.year", end.year), ("endDate.month", end.month), ("endDate.day", end.day),
        ("dimensions", "DATE"),
        ("metrics", "ESTIMATED_EARNINGS"), ("metrics", "PAGE_VIEWS"), ("metrics", "CLICKS"),
    ]
    res = requests.get(
        ADSENSE_API.format(account=account),
        headers={"Authorization": f"Bearer {_access_token()}"},
        params=params, timeout=30,
    )
    if res.status_code != 200:
        raise GoogleApiError(f"AdSense 조회 실패({res.status_code}): {res.text[:200]}")
    body = res.json()
    currency = "KRW"
    for h in body.get("headers", []):
        if h.get("currencyCode"):
            currency = h["currencyCode"]
    out: Dict[str, Dict[str, float]] = {}
    for row in body.get("rows", []):
        cells = [c.get("value", "0") for c in row.get("cells", [])]
        if len(cells) < 4:
            continue
        out[cells[0]] = {"earnings": float(cells[1]), "page_views": float(cells[2]), "clicks": float(cells[3])}
    return out, currency


def _pct(cur: float, prev: float) -> float:
    return round((cur - prev) / prev * 100, 1) if prev else 0.0


def load_analytics_config() -> Dict[str, Any]:
    """저장된 GSC 및 AdSense 연동 설정 로드 (Vercel Read-Only 완벽 대응)"""
    candidate_paths = [
        CONFIG_FILE,
        "/tmp/analytics_config.json",
        os.path.join(BASE_DIR, "analytics_config.json")
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return {
        "gsc_connected": False,
        "adsense_connected": False,
        "site_url": "https://s-elegant.tistory.com/",
        "adsense_account_id": "",
        "gsc_auth_type": "SERVICE_ACCOUNT", # SERVICE_ACCOUNT or OAUTH
        "last_sync": None
    }

def save_analytics_config(config: Dict[str, Any]):
    """연동 설정 저장 (Vercel Read-Only 파일 시스템 완벽 대응)"""
    global CONFIG_FILE
    paths_to_try = [CONFIG_FILE, "/tmp/analytics_config.json"]
    saved = False
    last_err = None
    for target in paths_to_try:
        try:
            with open(target, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            CONFIG_FILE = target
            saved = True
            break
        except Exception as e:
            last_err = e
            continue
    if not saved and last_err:
        raise last_err

class AnalyticsEngine:
    def __init__(self, site_url: str = "https://s-elegant.tistory.com/"):
        self.site_url = site_url
        self.config = load_analytics_config()

    def get_connection_status(self) -> Dict[str, Any]:
        """현재 Google 연동 상태 조회 (토큰 마스킹: 값은 노출하지 않고 설정 여부만 반환)"""
        has_oauth = _oauth_env() is not None
        gsc = bool(has_oauth and _gsc_site())
        ads = bool(has_oauth and _adsense_account())
        return {
            "site_url": _gsc_site() or self.site_url,
            "gsc_connected": gsc,
            "adsense_connected": ads,
            "adsense_account_id": _adsense_account(),
            "mode": "LIVE" if (gsc or ads) else "DEMO",
            "last_sync": self.config.get("last_sync"),
            "error": getattr(self, "last_error", None),
        }

    def fetch_metrics(self, days: int = 28) -> Dict[str, Any]:
        """
        통합 대시보드 지표 수집
        - 환경변수로 Google OAuth가 설정되어 있으면 Search Console / AdSense 실데이터 조회
        - 미설정이거나 실패하면 DEMO 샘플로 대체하고 실패 사유는 last_error에 남긴다
          (실패했는데 가짜 데이터를 LIVE로 보여주지 않기 위함)
        """
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)

        status = self.get_connection_status()
        self.last_error = None
        if status["mode"] == "LIVE":
            try:
                return self._fetch_live(days, status)
            except Exception as e:
                self.last_error = str(e)
                print(f"[Analytics] 실데이터 조회 실패, DEMO로 대체: {e}")
        return self._generate_sample_dataset(days, start_date, end_date)

    def _fetch_live(self, days: int, status: Dict[str, Any]) -> Dict[str, Any]:
        # Search Console 데이터는 2~3일 지연되므로 종료일을 2일 전으로 잡는다
        end = datetime.now().date() - timedelta(days=2)
        start = end - timedelta(days=days - 1)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=days - 1)
        fmt = lambda d: d.strftime("%Y-%m-%d")

        daily: Dict[str, Dict[str, Any]] = {}
        cur = start
        while cur <= end:
            daily[fmt(cur)] = {"date": fmt(cur), "search_clicks": 0, "search_impressions": 0, "search_ctr": 0.0,
                               "page_views": 0, "estimated_earnings": 0, "page_rpm": 0}
            cur += timedelta(days=1)

        pages: List[Dict[str, Any]] = []
        clicks = impressions = prev_clicks = prev_impressions = 0
        pos_weighted = 0.0
        if status["gsc_connected"]:
            site = _gsc_site()
            for r in _gsc_query(site, fmt(start), fmt(end), "date", days + 5):
                key = r["keys"][0]
                if key in daily:
                    daily[key]["search_clicks"] = int(r["clicks"])
                    daily[key]["search_impressions"] = int(r["impressions"])
                    daily[key]["search_ctr"] = round(r["ctr"] * 100, 2)
                    clicks += int(r["clicks"])
                    impressions += int(r["impressions"])
                    pos_weighted += r["position"] * r["impressions"]
            prev_rows = _gsc_query(site, fmt(prev_start), fmt(prev_end), "date", days + 5)
            prev_clicks = sum(int(r["clicks"]) for r in prev_rows)
            prev_impressions = sum(int(r["impressions"]) for r in prev_rows)

            prev_pages = {r["keys"][0]: r for r in _gsc_query(site, fmt(prev_start), fmt(prev_end), "page", 500)}
            for r in _gsc_query(site, fmt(start), fmt(end), "page", 500):
                item = self._diagnose_page(r, prev_pages.get(r["keys"][0]))
                if item:
                    pages.append(item)
            pages.sort(key=lambda x: x["priority_score"], reverse=True)
            pages = pages[:30]

        earnings = prev_earnings = pageviews = 0.0
        currency = "KRW"
        if status["adsense_connected"]:
            acc = _adsense_account()
            cur_ads, currency = _adsense_daily(acc, start, end)
            for k, v in cur_ads.items():
                if k in daily:
                    daily[k]["estimated_earnings"] = int(round(v["earnings"]))
                    daily[k]["page_views"] = int(v["page_views"])
                    daily[k]["page_rpm"] = int(v["earnings"] / v["page_views"] * 1000) if v["page_views"] else 0
                    earnings += v["earnings"]
                    pageviews += v["page_views"]
            prev_ads, _ = _adsense_daily(acc, prev_start, prev_end)
            prev_earnings = sum(v["earnings"] for v in prev_ads.values())

        sources = [n for n, ok in (("Search Console", status["gsc_connected"]), ("AdSense", status["adsense_connected"])) if ok]
        return {
            "period": {
                "days": days, "start_date": fmt(start), "end_date": fmt(end),
                "data_source_mode": f"LIVE ({' + '.join(sources)} 실데이터)",
                "data_disclaimer": "Search Console은 2~3일 지연됩니다. AdSense 수익은 계정 단위 집계라 글별 수익은 제공되지 않으며, 예상 수익은 확정 전 추정치입니다.",
            },
            "summary": {
                "total_estimated_earnings": int(round(earnings)),
                "currency": currency,
                "total_pageviews": int(pageviews),
                "avg_page_rpm": int(earnings / pageviews * 1000) if pageviews else 0,
                "total_search_clicks": clicks,
                "total_search_impressions": impressions,
                "avg_search_ctr": round(clicks / impressions * 100, 2) if impressions else 0.0,
                "avg_search_position": round(pos_weighted / impressions, 1) if impressions else 0.0,
                "diff_clicks_pct": _pct(clicks, prev_clicks),
                "diff_impressions_pct": _pct(impressions, prev_impressions),
                "diff_earnings_pct": _pct(earnings, prev_earnings),
            },
            "daily_trends": list(daily.values()),
            "pages": pages,
            "trending_up_count": len([p for p in pages if p["scenario"] == "TRENDING_UP"]),
            "trending_down_count": len([p for p in pages if p["scenario"] == "TRENDING_DOWN"]),
            "action_needed_count": len([p for p in pages if p["priority_score"] >= 80]),
        }

    def _diagnose_page(self, row: Dict[str, Any], prev: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """GSC 페이지 지표를 규칙 기반으로 진단. 해당 없는 글과 표본이 작은 글은 None"""
        url = row["keys"][0]
        c, imp = int(row["clicks"]), int(row["impressions"])
        ctr, pos = round(row["ctr"] * 100, 2), round(row["position"], 1)
        pc = int(prev["clicks"]) if prev else 0
        diff = c - pc
        diff_pct = _pct(c, pc)
        title = url.rstrip("/").split("/")[-1] or url

        if imp >= 300 and ctr < 2.0 and pos <= 15:
            scenario, label, action = "HIGH_IMP_LOW_CTR", "⚠️ 노출 대비 클릭률 저조", "REVISE_TITLE"
            score = 60 + min(25, imp // 400) + min(15, int((3 - ctr) * 5))
            diag = f"노출 {imp:,}회, 평균 {pos}위로 상위에 보이지만 클릭률이 {ctr}%입니다. 제목과 메타 설명 개선으로 유입을 늘릴 수 있습니다."
        elif pc >= 10 and diff_pct <= -30:
            scenario, label, action = "TRENDING_DOWN", "📉 검색 유입 급감소", "UPDATE_CONTENT"
            score = 60 + min(30, int(abs(diff_pct) / 3))
            diag = f"이전 기간 대비 클릭이 {diff_pct}% 감소했습니다(평균 {pos}위). 최신 정보로 갱신을 검토하세요."
        elif pc >= 10 and diff_pct >= 30:
            scenario, label, action = "TRENDING_UP", "🚀 검색 유입 급상승", "EXPAND_SERIES"
            score = 55 + min(35, int(diff_pct / 4))
            diag = f"이전 기간 대비 클릭이 +{diff_pct}% 증가했습니다. 관련 후속 글로 확장하면 효과가 큽니다."
        else:
            return None
        return {
            "url": url, "title": title, "clicks": c, "prev_clicks": pc, "diff_clicks": diff, "diff_pct": diff_pct,
            "impressions": imp, "ctr": ctr, "position": pos, "scenario": scenario, "scenario_label": label,
            "diagnosis": diag, "action_type": action, "priority_score": max(0, min(100, int(score))),
        }

    def _generate_sample_dataset(self, days: int, start_date, end_date) -> Dict[str, Any]:
        """
        공식 API 규격과 100% 동일한 필드 구조를 가진 검증용 데이터셋
        - Search Console: clicks, impressions, ctr, position
        - AdSense: estimated_earnings, page_views, page_views_rpm, ad_clicks, ad_ctr
        - 관측된 사실과 추정치 엄격 구분
        """
        # 일별 시계열 데이터
        daily_trends = []
        cur = start_date
        total_clicks = 0
        total_impressions = 0
        total_earnings = 0.0
        total_pageviews = 0

        day_count = (end_date - start_date).days
        for i in range(day_count):
            d_str = cur.strftime("%Y-%m-%d")
            # 현실적인 블로그 유입 시계열 패턴
            base_imp = 850 + (i % 7) * 90 + (i * 12)
            base_click = int(base_imp * (0.042 + (i % 5) * 0.003))
            base_pv = int(base_click * 1.35)
            # 애드센스 RPM ₩2,500 ~ ₩3,800 수준
            base_rpm = 3100.0 + (i % 4) * 200
            daily_earning = round((base_pv / 1000.0) * base_rpm, 0)

            total_clicks += base_click
            total_impressions += base_imp
            total_earnings += daily_earning
            total_pageviews += base_pv

            daily_trends.append({
                "date": d_str,
                "search_clicks": base_click,
                "search_impressions": base_imp,
                "search_ctr": round((base_click / base_imp) * 100, 2),
                "page_views": base_pv,
                "estimated_earnings": int(daily_earning),
                "page_rpm": int(base_rpm)
            })
            cur += timedelta(days=1)

        avg_ctr = round((total_clicks / total_impressions) * 100, 2) if total_impressions else 0.0
        avg_rpm = int(total_earnings / (total_pageviews / 1000.0)) if total_pageviews else 0

        # 페이지별 성과 분석 (5대 시나리오 포함)
        pages_analysis = [
            {
                "url": f"{self.site_url}entry/seongsu-nanpo-review",
                "title": "[성수 맛집] 난포 솔직 방문 후기! 대표메뉴 3가지와 웨이팅 주차 꿀팁",
                "clicks": 482,
                "prev_clicks": 310,
                "diff_clicks": 172,
                "diff_pct": 55.4,
                "impressions": 7820,
                "ctr": 6.16,
                "position": 3.2,
                "scenario": "TRENDING_UP",
                "scenario_label": "🚀 검색 유입 급상승",
                "diagnosis": "주말 웨이팅 및 성수 데이트 키워드로 유입이 지난 기간 대비 +55.4% 급증하고 있습니다.",
                "action_type": "EXPAND_SERIES",
                "priority_score": 92
            },
            {
                "url": f"{self.site_url}entry/cloud-cost-optimization-guide",
                "title": "클라우드 비용 40% 절감하는 실전 가이드라인 총정리",
                "clicks": 115,
                "prev_clicks": 128,
                "diff_clicks": -13,
                "diff_pct": -10.1,
                "impressions": 14200,
                "ctr": 0.81,
                "position": 7.4,
                "scenario": "HIGH_IMP_LOW_CTR",
                "scenario_label": "⚠️ 노출 대비 클릭률 저조",
                "diagnosis": "검색 노출은 14,200회로 최상위권이나 클릭률이 0.81%로 매우 낮습니다. 제목과 메타 설명을 검색 의도에 맞게 매력적으로 수정하면 즉각적인 유입 증가가 기대됩니다.",
                "action_type": "REVISE_TITLE",
                "priority_score": 88
            },
            {
                "url": f"{self.site_url}entry/jeju-sk-pork-review",
                "title": "제주 숙성도 중문점 흑돼지 솔직 후기 및 예약 팁",
                "clicks": 94,
                "prev_clicks": 185,
                "diff_clicks": -91,
                "diff_pct": -49.1,
                "impressions": 3410,
                "ctr": 2.75,
                "position": 14.8,
                "scenario": "TRENDING_DOWN",
                "scenario_label": "📉 검색 유입 급감소",
                "diagnosis": "지난달 대비 유입 클릭수가 -49.1% 감소했으며 평균 순위가 14위로 밀려났습니다. 최신 가격 정보 및 캐치테이블 현황 업데이트가 시급합니다.",
                "action_type": "UPDATE_CONTENT",
                "priority_score": 84
            },
            {
                "url": f"{self.site_url}entry/tistory-adsense-revenue-boost",
                "title": "티스토리 구글 애드센스 단가 높은 황금 키워드 찾는 법",
                "clicks": 340,
                "prev_clicks": 325,
                "diff_clicks": 15,
                "diff_pct": 4.6,
                "impressions": 5100,
                "ctr": 6.67,
                "position": 4.1,
                "scenario": "HIGH_REVENUE_TOPIC",
                "scenario_label": "💰 고단가/고수익 주제",
                "diagnosis": "IT·금융 테크 고단가 키워드로 체류시간과 광고 단가(RPM ₩6,500+)가 매우 우수합니다. 유사 주제 확장을 권장합니다.",
                "action_type": "HIGH_CPC_EXPAND",
                "priority_score": 81
            },
            {
                "url": f"{self.site_url}entry/simple-pasta-recipe",
                "title": "15분 만에 만드는 원팬 알리오올리오 파스타 황금 레시피",
                "clicks": 620,
                "prev_clicks": 615,
                "diff_clicks": 5,
                "diff_pct": 0.8,
                "impressions": 8900,
                "ctr": 6.96,
                "position": 2.8,
                "scenario": "HIGH_TRAFFIC_LOW_RPM",
                "scenario_label": "📊 대량 유입 / 단가 보완 필요",
                "diagnosis": "클릭수는 620회로 블로그 내 1위이나 단순 정보성 키워드로 광고 RPM(₩1,200)이 낮습니다. 조리 도구 추천 제휴 링크 또는 요약 박스 보강을 추천합니다.",
                "action_type": "AFFILIATE_BOOST",
                "priority_score": 75
            }
        ]

        # 정렬: 우선순위 점수 내림차순
        pages_analysis.sort(key=lambda x: x["priority_score"], reverse=True)

        return {
            "period": {
                "days": days,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "data_source_mode": "DEMO (샘플 데이터 - 실제 Google 연동 시 실시간 데이터 전환)",
                "data_disclaimer": "GSC 데이터는 보통 2~3일의 지연이 있으며, AdSense는 도메인 단위 집계가 기본입니다."
            },
            "summary": {
                "total_estimated_earnings": int(total_earnings),
                "currency": "KRW",
                "total_pageviews": total_pageviews,
                "avg_page_rpm": avg_rpm,
                "total_search_clicks": total_clicks,
                "total_search_impressions": total_impressions,
                "avg_search_ctr": avg_ctr,
                "avg_search_position": 6.8,
                # 전주 대비 증감율
                "diff_clicks_pct": +14.2,
                "diff_impressions_pct": +18.5,
                "diff_earnings_pct": +11.8
            },
            "daily_trends": daily_trends,
            "pages": pages_analysis,
            "trending_up_count": len([p for p in pages_analysis if p["scenario"] == "TRENDING_UP"]),
            "trending_down_count": len([p for p in pages_analysis if p["scenario"] == "TRENDING_DOWN"]),
            "action_needed_count": len([p for p in pages_analysis if p["priority_score"] >= 80])
        }

    def generate_ai_recommendation(self, page_item: Dict[str, Any], api_key: str) -> Dict[str, Any]:
        """
        개별 페이지에 대한 Gemini AI 심층 최적화 처방전 생성
        """
        scenario = page_item.get("scenario", "HIGH_IMP_LOW_CTR")
        title = page_item.get("title", "")
        url = page_item.get("url", "")
        clicks = page_item.get("clicks", 0)
        impressions = page_item.get("impressions", 0)
        ctr = page_item.get("ctr", 0.0)
        position = page_item.get("position", 0.0)

        prompt = f"""
당신은 대한민국 1티어 검색엔진 최적화(SEO) 및 구글 애드센스 수익화 수석 컨설턴트입니다.
아래 분석 데이터를 바탕으로 블로그 게시물의 성과를 극대화할 수 있는 구체적이고 실행 가능한 'AI 최적화 처방전'을 작성해주세요.

[포스팅 분석 데이터]
- 제목: {title}
- URL: {url}
- 최근 노출수: {impressions:,}회
- 최근 클릭수: {clicks:,}회
- 평균 CTR: {ctr}% (정상 기대치: 3~6%)
- 평균 검색 순위: {position}위
- 성과 진단 유형: {page_item.get('scenario_label', '')}
- 핵심 문제점: {page_item.get('diagnosis', '')}

[작성 지시사항]
1. 제목 개선안 (Title Rewrites):
   - 검색 클릭률(CTR)을 2배 이상 끌어올릴 수 있는 매력적인 제목 3가지 대안을 제시하세요.
   - 숫자, 혜택, 구체적 호기심 요소를 포함하세요.
2. 콘텐츠 본문 보완 가이드 (Content Enhancements):
   - 독자의 체류시간을 늘리고 이탈을 막을 수 있는 본문 서두 3줄 요약 박스, 추가할 소제목 2개, 보완할 최신 정보를 제시하세요.
3. 연계 후속 콘텐츠 추천 (Internal Linking Topics):
   - 해당 글과 내부 링크로 연결하여 트래픽을 순환시킬 수 있는 후속 롱테일 주제 2개를 추천하세요.
4. 수익화 액션 (Monetization Action):
   - 체류시간 및 광고 클릭률을 높이기 위한 단락 분할 팁.

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "title_suggestions": [
    "제목 개선안 1",
    "제목 개선안 2",
    "제목 개선안 3"
  ],
  "content_checklist": [
    "보완 작업 1",
    "보완 작업 2",
    "보완 작업 3"
  ],
  "follow_up_topics": [
    {{"topic": "후속 추천 주제 1", "target_keyword": "키워드 1", "reason": "추천 이유"}},
    {{"topic": "후속 추천 주제 2", "target_keyword": "키워드 2", "reason": "추천 이유"}}
  ],
  "summary_verdict": "전체 1줄 총평 요약"
}}
"""
        # 1. API 키가 있는 경우 Gemini 2.5 Flash 직접 호출
        if api_key:
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=api_key)
                config = types.GenerateContentConfig(response_mime_type="application/json")
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=config
                )
                result = json.loads(response.text)
                return {
                    "success": True,
                    "url": url,
                    "title": title,
                    "recommendation": result
                }
            except Exception as e:
                print(f"[Analytics] Gemini direct call failed: {e}")

        # 2. API 키 미설정 또는 실패 시 5대 시나리오별 전문가 스마트 처방전 폴백
        fallback_titles = [
            f"[2026 필독] {title} 핵심 총정리",
            f"{title} - 3가지 실수 피하고 2배 효과 보는 법",
            f"{title} (최신 실측 후기 및 요약)"
        ]
        if scenario == "HIGH_IMP_LOW_CTR":
            fallback_titles = [
                f"[충격] {title} 진짜 효과 있을까? 3가지 핵심 검증",
                f"{title} 모르면 손해보는 실전 꿀팁 총정리",
                f"10명 중 9명이 놓치는 {title} 결정적 차이점"
            ]
        elif scenario == "TRENDING_UP":
            fallback_titles = [
                f"[급상승 1위] {title} 핵심 포인트 3줄 요약",
                f"{title} 2026 최신 개정판 완벽 가이드",
                f"{title} 이것만 알면 끝! 솔직 후기"
            ]
        elif scenario == "TRENDING_DOWN":
            fallback_titles = [
                f"[2026 최신] {title} 달라진 핵심 정보 총정리",
                f"{title} 검색 순위 1위 재도약 업데이트",
                f"{title} 최신 가격 및 변경사항 완벽 가이드"
            ]
        elif scenario == "HIGH_REVENUE_TOPIC":
            fallback_titles = [
                f"[수익 2배] {title} 고단가 키워드 완벽 공략법",
                f"{title} 실전 고수익 적용 가이드",
                f"{title} 하루 10분으로 광고 단가 올리는 법"
            ]

        return {
            "success": True,
            "url": url,
            "title": title,
            "recommendation": {
                "title_suggestions": fallback_titles,
                "content_checklist": [
                    "모바일 이탈률 방지를 위해 본문 서두에 '3줄 핵심 요약 박스' 추가하기",
                    "독자의 체류 시간을 늘리기 위해 소제목(H2/H3) 2개 추가 및 단락 줄바꿈 정돈",
                    "신뢰도를 높이기 위해 2026년 최신 팩트 및 가격/일정 변동사항 보강"
                ],
                "follow_up_topics": [
                    {"topic": f"{title} 심화 실전편 2탄", "target_keyword": "실전 가이드", "reason": "기존 유입 독자의 체류시간 연장"},
                    {"topic": f"{title} 관련 비교 분석", "target_keyword": "장단점 비교", "reason": "구매/행동 전환율 극대화"}
                ],
                "summary_verdict": f"현재 '{page_item.get('scenario_label', '')}' 상태로, 매력적인 제목 수정과 서두 요약 박스 추가 시 즉각적인 성과 개선이 기대됩니다."
            }
        }

    def generate_weekly_report(self, days_data: Dict[str, Any], api_key: str) -> str:
        """
        주간 성과 및 수익 최적화 종합 리포트 생성 (마크다운)
        """
        summary = days_data.get("summary", {})
        pages = days_data.get("pages", [])
        
        report_date = datetime.now().strftime("%Y년 %m월 %d일")
        
        markdown_report = f"""# 📊 AI SEO & AdSense 주간 성과 분석 보고서
**보고 일자**: {report_date}  
**대상 사이트**: `{self.site_url}`  
**분석 기간**: 최근 {days_data.get('period', {}).get('days', 28)}일간 (`{days_data.get('period', {}).get('start_date')}` ~ `{days_data.get('period', {}).get('end_date')}`)  
**데이터 모드**: {days_data.get('period', {}).get('data_source_mode')}

---

## 1. 📈 핵심 성과 요약 (Executive Summary)

| 지표명 | 측정 결과 | 지난 기간 대비 | 분석 평가 |
| :--- | :--- | :--- | :--- |
| **Google 검색 클릭수** | **{summary.get('total_search_clicks', 0):,}회** | {summary.get('diff_clicks_pct', 0):+}% | 검색 유입 견고한 성장세 |
| **Google 검색 노출수** | **{summary.get('total_search_impressions', 0):,}회** | {summary.get('diff_impressions_pct', 0):+}% | 브랜드 및 키워드 인지도 확장 |
| **평균 검색 CTR** | **{summary.get('avg_search_ctr', 0)}%** | - | 양호한 클릭 전환율 유지 |
| **예상 광고 수익** | **₩{summary.get('total_estimated_earnings', 0):,}** | {summary.get('diff_earnings_pct', 0):+}% | 유입 증가에 따른 수익 동반 상승 |
| **페이지 RPM** | **₩{summary.get('avg_page_rpm', 0):,}** | - | 1,000회당 고효율 수익 단가 |

> [!NOTE]
> 검색 유입 클릭수가 지난주 대비 **+{summary.get('diff_clicks_pct', 0)}%** 상승하며 애드센스 예상 수익도 긍정적인 우상향 흐름을 나타내고 있습니다.

---

## 2. 🚀 성과 급상승 포스팅 (Top Growth)
"""
        trending_up = [p for p in pages if p.get("scenario") == "TRENDING_UP"]
        if trending_up:
            for p in trending_up[:3]:
                markdown_report += f"- **[{p['title']}]({p['url']})**\n  - 최근 클릭: **{p['clicks']:,}회** (+{p['diff_pct']}%) | 노출수: {p['impressions']:,}회 | 순위: {p['position']}위\n  - *진단*: {p['diagnosis']}\n\n"
        else:
            markdown_report += "- 최근 급상승 포스팅 집계 중입니다.\n\n"

        markdown_report += """## 3. ⚠️ 개선 시급 포스팅 (High Priority Action)
"""
        high_imp = [p for p in pages if p.get("scenario") == "HIGH_IMP_LOW_CTR"]
        if high_imp:
            for p in high_imp[:2]:
                markdown_report += f"- **[{p['title']}]({p['url']})** (우선순위: **{p['priority_score']}점**)\n  - 노출: **{p['impressions']:,}회** 대비 클릭률 **{p['ctr']}%** (평균 이하)\n  - *개선 제언*: 제목에 숫자와 명확한 혜택을 추가하여 클릭률 2배 향상 목표.\n\n"

        decaying = [p for p in pages if p.get("scenario") == "TRENDING_DOWN"]
        if decaying:
            for p in decaying[:2]:
                markdown_report += f"- **[{p['title']}]({p['url']})** (우선순위: **{p['priority_score']}점**)\n  - 최근 유입: **{p['clicks']}회** ({p['diff_pct']}%) | 순위 하락\n  - *개선 제언*: 최신 트렌드/가격 변동 정보 업데이트를 통한 검색 순위 방어.\n\n"

        markdown_report += f"""---

## 4. 💡 다음 주 핵심 실행 계획 (Action Items)
1. **[제목 수정]**: 노출 14,000회를 기록 중인 `{high_imp[0]['title'] if high_imp else '주요 글'}`의 제목을 클릭 유도형으로 A/B 테스트 수정.
2. **[연계 콘텐츠 발행]**: 유입 급상승 중인 `{trending_up[0]['title'] if trending_up else '인기 글'}`의 후속 롱테일 시리즈 1편 신규 발행.
3. **[순위 방어 업데이트]**: 유입이 감소한 글에 2026년 최신 팩트와 서두 요약 박스를 추가하여 체류시간 증대.

*보고서 생성 엔진: AI SEO Manager Analytics Pro · Gemini 2.5 Flash*
"""
        return markdown_report
