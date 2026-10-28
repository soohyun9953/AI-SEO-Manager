import os
import sqlite3
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

# DB 경로 설정 (로컬: backend/data/seo_manager.db, Vercel 서버리스: /tmp/seo_manager.db)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("VERCEL"):
    DATA_DIR = "/tmp"
else:
    DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "seo_manager.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 콘텐츠 메인 테이블
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        keyword TEXT NOT NULL,
        related_keywords TEXT DEFAULT '',
        category TEXT DEFAULT '일반',
        content TEXT NOT NULL,
        content_html TEXT DEFAULT '',
        meta_description TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        thumbnail_url TEXT DEFAULT '',
        body_images TEXT DEFAULT '[]',
        reference_urls TEXT DEFAULT '[]',
        internal_links TEXT DEFAULT '[]',
        ai_model TEXT DEFAULT 'gemini-2.5-flash',
        status TEXT DEFAULT 'DRAFT',
        scheduled_at TEXT DEFAULT '',
        published_at TEXT DEFAULT '',
        tistory_url TEXT DEFAULT '',
        queue_order INTEGER DEFAULT 0,
        seo_score INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # 2. 콘텐츠 수정 이력 테이블
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS content_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id TEXT NOT NULL,
        title TEXT,
        content TEXT,
        change_summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE CASCADE
    )
    """)

    # 3. 발행 이력 테이블
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS publish_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id TEXT NOT NULL,
        publish_type TEXT NOT NULL,
        status TEXT NOT NULL,
        post_url TEXT DEFAULT '',
        message TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE CASCADE
    )
    """)

    conn.commit()
    conn.close()

# 데이터베이스 자동 초기화
init_db()

VALID_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"]

def calculate_seo_score(content: str, keyword: str, title: str) -> int:
    """기본 SEO 점수 산정 (0~100점)"""
    score = 0
    if not content:
        return 0
    
    # 1. 글자수 (1000자 이상 30점, 500자 이상 15점)
    length = len(content)
    if length >= 1000:
        score += 30
    elif length >= 500:
        score += 15

    # 2. 키워드 본문 포함 (20점)
    if keyword and keyword.lower() in content.lower():
        score += 20

    # 3. 키워드 제목 포함 (20점)
    if keyword and keyword.lower() in title.lower():
        score += 20

    # 4. 소제목(H2, H3) 구조 (15점)
    if "## " in content or "### " in content:
        score += 15

    # 5. 리스트 항목(-, *) 포함 (15점)
    if "\n- " in content or "\n* " in content or "\n1. " in content:
        score += 15

    return min(100, score)

def get_contents_stats() -> Dict[str, int]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    stats = {
        "total": 0,
        "DRAFT": 0,
        "REVIEW": 0,
        "APPROVED": 0,
        "SCHEDULED": 0,
        "PUBLISHING": 0,
        "PUBLISHED": 0,
        "FAILED": 0
    }
    
    cursor.execute("SELECT status, COUNT(*) as cnt FROM contents GROUP BY status")
    rows = cursor.fetchall()
    total = 0
    for row in rows:
        st = row["status"]
        cnt = row["cnt"]
        total += cnt
        if st in stats:
            stats[st] = cnt
            
    stats["total"] = total
    # 대시보드 요약용 편의 필드
    stats["pending_review"] = stats["REVIEW"]
    stats["queue_ready"] = stats["APPROVED"] + stats["SCHEDULED"]
    
    conn.close()
    return stats

def list_contents(
    status: Optional[str] = None,
    keyword_query: Optional[str] = None,
    sort_by: str = "created_at_desc",
    page: int = 1,
    limit: int = 20
) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    conditions = []
    params = []

    if status and status != "ALL":
        if status == "QUEUE": # 발행 대기열 (APPROVED, SCHEDULED)
            conditions.append("status IN ('APPROVED', 'SCHEDULED')")
        else:
            conditions.append("status = ?")
            params.append(status)

    if keyword_query:
        conditions.append("(title LIKE ? OR keyword LIKE ? OR tags LIKE ?)")
        q = f"%{keyword_query}%"
        params.extend([q, q, q])

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    # 정렬
    order_clause = "ORDER BY created_at DESC"
    if sort_by == "created_at_asc":
        order_clause = "ORDER BY created_at ASC"
    elif sort_by == "updated_at_desc":
        order_clause = "ORDER BY updated_at DESC"
    elif sort_by == "title_asc":
        order_clause = "ORDER BY title ASC"
    elif sort_by == "queue_order":
        order_clause = "ORDER BY queue_order ASC, created_at DESC"

    # 전체 카운트
    cursor.execute(f"SELECT COUNT(*) FROM contents {where_clause}", params)
    total_count = cursor.fetchone()[0]

    # 페이지네이션 쿼리
    offset = max(0, (page - 1) * limit)
    cursor.execute(
        f"SELECT * FROM contents {where_clause} {order_clause} LIMIT ? OFFSET ?",
        params + [limit, offset]
    )
    rows = cursor.fetchall()

    items = []
    for row in rows:
        item = dict(row)
        # JSON 파싱
        for json_field in ["body_images", "reference_urls", "internal_links"]:
            try:
                item[json_field] = json.loads(item.get(json_field) or "[]")
            except:
                item[json_field] = []
        items.append(item)

    conn.close()

    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

def get_content_by_id(content_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contents WHERE id = ?", (content_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    item = dict(row)
    for json_field in ["body_images", "reference_urls", "internal_links"]:
        try:
            item[json_field] = json.loads(item.get(json_field) or "[]")
        except:
            item[json_field] = []
    return item

def create_content(data: Dict[str, Any], check_duplicate: bool = True) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    title = data.get("title", "").strip()
    keyword = data.get("keyword", "").strip()
    if not title:
        raise ValueError("콘텐츠 제목은 필수입니다.")

    # 중복 체크 (동일 제목 또는 핵심 키워드 중복 검사)
    if check_duplicate:
        cursor.execute("SELECT id, title FROM contents WHERE title = ?", (title,))
        dup = cursor.fetchone()
        if dup:
            conn.close()
            raise ValueError(f"동일한 제목의 콘텐츠가 이미 존재합니다 (ID: {dup['id']}).")

    content_id = data.get("id") or str(uuid.uuid4())
    now = datetime.now().isoformat()

    content_raw = data.get("content", "")
    seo_score = calculate_seo_score(content_raw, keyword, title)

    body_images = data.get("body_images", [])
    if isinstance(body_images, list):
        body_images_str = json.dumps(body_images, ensure_ascii=False)
    else:
        body_images_str = str(body_images)

    ref_urls = data.get("reference_urls", [])
    ref_urls_str = json.dumps(ref_urls, ensure_ascii=False) if isinstance(ref_urls, list) else str(ref_urls)

    internal_links = data.get("internal_links", [])
    internal_links_str = json.dumps(internal_links, ensure_ascii=False) if isinstance(internal_links, list) else str(internal_links)

    status = data.get("status", "DRAFT")
    if status not in VALID_STATUSES:
        status = "DRAFT"

    cursor.execute("""
    INSERT INTO contents (
        id, title, keyword, related_keywords, category, content, content_html,
        meta_description, tags, thumbnail_url, body_images, reference_urls,
        internal_links, ai_model, status, scheduled_at, published_at,
        tistory_url, queue_order, seo_score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        content_id,
        title,
        keyword,
        data.get("related_keywords", ""),
        data.get("category", "일반"),
        content_raw,
        data.get("content_html", ""),
        data.get("meta_description", ""),
        data.get("tags", ""),
        data.get("thumbnail_url", ""),
        body_images_str,
        ref_urls_str,
        internal_links_str,
        data.get("ai_model", "gemini-2.5-flash"),
        status,
        data.get("scheduled_at", ""),
        data.get("published_at", ""),
        data.get("tistory_url", ""),
        data.get("queue_order", 0),
        seo_score,
        now,
        now
    ))

    # 생성 초기 이력 기록
    cursor.execute("""
    INSERT INTO content_history (content_id, title, content, change_summary, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (content_id, title, content_raw, "최초 생성", now))

    conn.commit()
    conn.close()

    return get_content_by_id(content_id)

def update_content(content_id: str, data: Dict[str, Any], change_summary: str = "내용 수정") -> Dict[str, Any]:
    current = get_content_by_id(content_id)
    if not current:
        raise ValueError("수정할 콘텐츠를 찾을 수 없습니다.")

    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    title = data.get("title", current["title"]).strip()
    keyword = data.get("keyword", current["keyword"]).strip()
    content_raw = data.get("content", current["content"])
    seo_score = calculate_seo_score(content_raw, keyword, title)

    body_images = data.get("body_images", current["body_images"])
    body_images_str = json.dumps(body_images, ensure_ascii=False) if isinstance(body_images, list) else str(body_images)

    ref_urls = data.get("reference_urls", current["reference_urls"])
    ref_urls_str = json.dumps(ref_urls, ensure_ascii=False) if isinstance(ref_urls, list) else str(ref_urls)

    internal_links = data.get("internal_links", current["internal_links"])
    internal_links_str = json.dumps(internal_links, ensure_ascii=False) if isinstance(internal_links, list) else str(internal_links)

    status = data.get("status", current["status"])
    if status not in VALID_STATUSES:
        status = current["status"]

    cursor.execute("""
    UPDATE contents SET
        title = ?,
        keyword = ?,
        related_keywords = ?,
        category = ?,
        content = ?,
        content_html = ?,
        meta_description = ?,
        tags = ?,
        thumbnail_url = ?,
        body_images = ?,
        reference_urls = ?,
        internal_links = ?,
        status = ?,
        scheduled_at = ?,
        published_at = ?,
        tistory_url = ?,
        queue_order = ?,
        seo_score = ?,
        updated_at = ?
    WHERE id = ?
    """, (
        title,
        keyword,
        data.get("related_keywords", current["related_keywords"]),
        data.get("category", current["category"]),
        content_raw,
        data.get("content_html", current["content_html"]),
        data.get("meta_description", current["meta_description"]),
        data.get("tags", current["tags"]),
        data.get("thumbnail_url", current["thumbnail_url"]),
        body_images_str,
        ref_urls_str,
        internal_links_str,
        status,
        data.get("scheduled_at", current["scheduled_at"]),
        data.get("published_at", current["published_at"]),
        data.get("tistory_url", current["tistory_url"]),
        data.get("queue_order", current.get("queue_order", 0)),
        seo_score,
        now,
        content_id
    ))

    # 수정 이력 기록 (본문이나 제목 변경 시)
    if title != current["title"] or content_raw != current["content"]:
        cursor.execute("""
        INSERT INTO content_history (content_id, title, content, change_summary, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (content_id, title, content_raw, change_summary, now))

    conn.commit()
    conn.close()

    return get_content_by_id(content_id)

def update_content_status(content_id: str, new_status: str) -> Dict[str, Any]:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"유효하지 않은 상태입니다. ({new_status})")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute("UPDATE contents SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, content_id))
    conn.commit()
    conn.close()

    return get_content_by_id(content_id)

def batch_update_status(content_ids: List[str], new_status: str) -> int:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"유효하지 않은 상태입니다. ({new_status})")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute(
        f"UPDATE contents SET status = ?, updated_at = ? WHERE id IN ({','.join(['?']*len(content_ids))})",
        [new_status, now] + content_ids
    )
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count

def delete_content(content_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contents WHERE id = ?", (content_id,))
    deleted = cursor.rowcount > 0
    cursor.execute("DELETE FROM content_history WHERE content_id = ?", (content_id,))
    cursor.execute("DELETE FROM publish_history WHERE content_id = ?", (content_id,))
    conn.commit()
    conn.close()
    return deleted

def record_publish_result(
    content_id: str,
    publish_type: str,
    status: str,
    post_url: str = "",
    message: str = ""
) -> Dict[str, Any]:
    """발행 결과 기록 및 실제 발행 완료 처리"""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute("""
    INSERT INTO publish_history (content_id, publish_type, status, post_url, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (content_id, publish_type, status, post_url, message, now))

    # 실제 발행 성공(SUCCESS)이고 post_url이 있는 경우에만 상태를 PUBLISHED로 전환
    if status == "SUCCESS" and post_url:
        cursor.execute("""
        UPDATE contents SET
            status = 'PUBLISHED',
            tistory_url = ?,
            published_at = ?,
            updated_at = ?
        WHERE id = ?
        """, (post_url, now, now, content_id))
    elif status == "FAILED":
        cursor.execute("""
        UPDATE contents SET
            status = 'FAILED',
            updated_at = ?
        WHERE id = ?
        """, (now, content_id))

    conn.commit()
    conn.close()

    return get_content_by_id(content_id)

def get_content_history(content_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM content_history WHERE content_id = ? ORDER BY created_at DESC",
        (content_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_publish_history(content_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if content_id:
        cursor.execute(
            "SELECT * FROM publish_history WHERE content_id = ? ORDER BY created_at DESC",
            (content_id,)
        )
    else:
        cursor.execute("SELECT * FROM publish_history ORDER BY created_at DESC LIMIT 100")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def find_similar_contents(keyword: str, limit: int = 5) -> List[Dict[str, Any]]:
    """같은 장소/키워드로 이미 만들어진 글 조회 (공백 무시 비교)"""
    kw = (keyword or "").replace(" ", "").strip()
    if not kw:
        return []
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, title, status, created_at FROM contents
        WHERE REPLACE(keyword, ' ', '') = ? OR REPLACE(title, ' ', '') LIKE ?
        ORDER BY created_at DESC LIMIT ?
        """,
        (kw, f"%{kw}%", limit)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
