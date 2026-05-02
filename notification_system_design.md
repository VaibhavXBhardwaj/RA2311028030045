# Notification System Design

> Campus Notification Platform — Backend System Design
> Vaibhav Bhardwaj | RA2311028030045

## Stage 1

### REST API Design & Contract

A frontend developer needs a clear API contract to display notifications to logged-in students. The platform supports three core notification types: **Placement**, **Result**, and **Event**.

#### Core Actions
- Fetch all notifications for the authenticated student
- Mark a single notification as read
- Mark all notifications as read
- Get unread notification count
- Real-time push via WebSockets

#### API Endpoints

**GET /api/notifications**
```
Headers:
  Authorization: Bearer <jwt_token>

Query Params:
  ?page=1&limit=20&type=Placement&isRead=false

Response 200:
{
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Placement",
      "message": "Google hiring drive on May 10",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

**PATCH /api/notifications/:id/read**
```
Headers:
  Authorization: Bearer <jwt_token>

Response 200:
{
  "success": true,
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc"
}
```

**PATCH /api/notifications/read-all**
```
Headers:
  Authorization: Bearer <jwt_token>

Response 200:
{
  "success": true,
  "updated": 42
}
```

**GET /api/notifications/unread-count**
```
Headers:
  Authorization: Bearer <jwt_token>

Response 200:
{
  "count": 7
}
```

#### Real-time Mechanism — WebSockets

```
Client connects on login:
  ws://server/notifications?token=<jwt>

Server pushes on new notification:
{
  "event": "NEW_NOTIFICATION",
  "payload": {
    "id": "uuid",
    "type": "Placement",
    "message": "Amazon hiring drive announced",
    "createdAt": "2026-04-22T18:00:00Z"
  }
}

Client sends heartbeat every 30s:
  { "event": "ping" }

Server responds:
  { "event": "pong" }
```

---

## Stage 2

### Persistent Storage

#### Database Choice: PostgreSQL 

**Reasoning:**
- Notifications have a clear relational structure (student → notifications)
- ACID compliance ensures no notification is lost or double-delivered
- Rich filtering: by type, isRead, studentID, date range
- Mature ecosystem with excellent indexing support

#### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

#### Core Queries

```sql
-- Fetch unread notifications (paginated)
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1 AND is_read = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- Mark single notification as read
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND student_id = $2;

-- Mark all as read
UPDATE notifications
SET is_read = TRUE
WHERE student_id = $1 AND is_read = FALSE;

-- Unread count
SELECT COUNT(*) FROM notifications
WHERE student_id = $1 AND is_read = FALSE;
```

#### Problems at Scale (50k students, 5M notifications)

| Problem | Impact |
|---------|--------|
| No indexes | Full table scan O(n) on every fetch |
| Unbounded table growth | Slow queries, high storage cost |
| Single DB node | Write bottleneck under high load |
| SELECT * | Unnecessary data transfer |

#### Solutions
- Composite indexes (Stage 3)
- Table partitioning by `created_at` (monthly)
- Read replicas for notification fetch queries
- Archive notifications older than 6 months to cold storage

---

## Stage 3

### Query Optimization

#### The Slow Query
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

#### Why It's Slow
- **Full table scan** on 5,000,000 rows — no index on `studentID`
- **SELECT \*** fetches all columns including large TEXT fields
- **No covering index** means the DB must do heap fetches after index lookup

#### Fix — Composite Index
```sql
CREATE INDEX idx_notif_student_read_created
ON notifications (student_id, is_read, created_at DESC);
```

This single index covers the entire query:
- `student_id` → filters rows
- `is_read` → further filters
- `created_at DESC` → satisfies ORDER BY without extra sort

**Result:** O(n) full scan → O(log n) index seek 

#### Should We Index Every Column?

**No — bad advice.** Here's why:

| Issue | Explanation |
|-------|-------------|
| Write amplification | Every INSERT/UPDATE must update ALL indexes |
| Storage bloat | Each index duplicates column data |
| Query planner confusion | Too many indexes = suboptimal plan selection |
| Maintenance overhead | Index bloat requires periodic VACUUM/REINDEX |

**Rule:** Only index columns used in WHERE, ORDER BY, or JOIN clauses.

#### Query — Placement Notifications Last 7 Days
```sql
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = $1
  AND type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Supporting index
CREATE INDEX idx_notif_student_type_created
ON notifications (student_id, type, created_at DESC);
```

---

## Stage 4

### Performance — Fetch on Every Page Load

**Problem:** 50,000 students hitting the DB on every page load = millions of queries per hour.

#### Strategy 1 — Redis Cache  Recommended
```
On fetch:
  1. Check Redis key: notifs:{student_id}
  2. Cache hit → return cached data (TTL: 60s)
  3. Cache miss → query DB → store in Redis → return

On new notification:
  1. INSERT into DB
  2. DEL notifs:{student_id} from Redis (invalidate)
  3. Push via WebSocket
```

**Tradeoffs:**
-  Eliminates repeated DB hits
-  Sub-millisecond cache reads
-  60s stale window acceptable for notifications
-  Added infrastructure complexity

#### Strategy 2 — Cursor-based Pagination
```sql
-- Instead of OFFSET (slow at large pages)
SELECT * FROM notifications
WHERE student_id = $1
  AND created_at < $2  -- cursor: last seen timestamp
ORDER BY created_at DESC
LIMIT 20;
```

**Tradeoffs:**
-  Consistent performance regardless of page depth
-  No random page access (no "jump to page 50")

#### Strategy 3 — WebSocket Push (Eliminate Poll)
- Client subscribes on login
- Server pushes on new notification
- Client increments unread badge without DB fetch
- **Tradeoffs:**  Zero polling DB hits |  Connection management at scale

#### Best Combination
```
Redis cache (60s TTL)
  + WebSocket push for real-time
  + Cursor pagination for history
  + Read replicas for fetch queries
```

---

## Stage 5

### Bulk Notification — Reliability Analysis

#### Original Pseudocode Problems
```
function notify_all(student_ids, message):
  for student_id in student_ids:          # sequential — blocks
    send_email(student_id, message)        # slow, can fail
    save_to_db(student_id, message)        # 50k round trips
    push_to_app(student_id, message)       # tight coupling
```

| Problem | Impact |
|---------|--------|
| Sequential loop | 50k iterations blocking event loop |
| Email failure at student 200 | Students 201-50000 never notified |
| No retry | Failed emails permanently lost |
| 50k individual DB inserts | Catastrophic DB load |
| Tight coupling | One failure cascades to all |

#### Should DB save and email happen together?

**No — they must be decoupled.**

- DB save is fast, reliable, the source of truth → do it first, in bulk
- Email is slow, network-dependent, frequently fails → do it async via queue
- Coupling them means an email API outage blocks DB writes

#### Revised Architecture

```
function notify_all(student_ids, message):

  // Step 1 — Bulk insert (single DB round trip)
  bulk_save_to_db(student_ids, message)

  // Step 2 — Enqueue jobs (non-blocking)
  for student_id in student_ids:
    queue.push({ type: "email",    student_id, message })
    queue.push({ type: "push_app", student_id, message })

// Independent workers with retry
email_worker.process(async (job) => {
  try:
    send_email(job.student_id, job.message)
  catch NetworkError:
    if job.attempts < 3:
      retry with exponential backoff (1s, 2s, 4s)
    else:
      move to dead_letter_queue
      alert_ops_team()
})

push_worker.process(async (job) => {
  push_to_app(job.student_id, job.message)
})
```

**Result:**
-  Email failure at student 200 → only that job retried, rest unaffected
-  Single bulk DB insert instead of 50k round trips
-  Workers scale horizontally (add more worker instances)
-  Dead letter queue captures permanent failures for ops review

---

## Stage 6

### Priority Inbox — Top-N Notifications

#### Priority Scoring Formula

```
score = type_weight × 10¹³ + unix_timestamp_ms

Type weights:
  Placement → 3   (highest — directly impacts career)
  Result    → 2   (important — academic outcomes)
  Event     → 1   (lowest — informational)
```

The multiplier `10¹³` ensures type always dominates recency:
- Any Placement always outranks any Result
- Within same type, more recent notifications rank higher

#### Data Structure — Min-Heap of Size N

```
State: min-heap of size 10

For each incoming notification:
  1. Compute score
  2. If heap.size < 10 → push directly
  3. Else if score > heap.min → pop min, push new
  4. Else → discard

Final: heap contains top 10, sort descending for display
```

#### Complexity Analysis

| Operation | Min-Heap | Sort All |
|-----------|----------|----------|
| Time | O(n log N) | O(n log n) |
| Space | O(N) | O(n) |
| Streaming updates | O(log N) per item | Re-sort entire array |

Where N=10 (top count), n=total notifications. Since N << n, heap wins significantly — especially critical for real-time streams where notifications arrive continuously.

#### Maintaining Top-10 as New Notifications Arrive

```
On new notification event (WebSocket):
  1. Compute score of new notification
  2. If score > heap.min:
     a. Pop minimum from heap
     b. Push new notification
     c. Re-render priority inbox
  3. Else: new notification goes to regular inbox only
```

This is O(log N) per update vs O(n log n) for re-sorting — critical at scale.

See implementation: [`notification_app_be/index.js`](./notification_app_be/index.js)
