#  RA2311028030045 — Affordmed Backend Assessment

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-lightgrey?style=for-the-badge)

> Backend engineering assessment submission for **Affordmed Campus Hiring Evaluation** — Vaibhav Bhardwaj | SRM Institute of Science and Technology | Roll No: RA2311028030045

---

##  Repository Structure

```RA2311028030045/
├──  logging_middleware/
│   ├── index.js               # Core logging package — Log() + getToken()
│   └── package.json
│
├──  vehicle_maintence_scheduler/
│   ├── index.js               # 0/1 Knapsack DP optimizer
│   └── package.json
│
├──  notification_app_be/
│   ├── index.js               # Min-heap priority inbox
│   └── package.json
│
├──  notification_system_design.md   # Stages 1–6 system design
├──  README.md
├──  LICENSE
└── .gitignore

---

## System Architecture┌─────────────────────────────────────────────────────────────┐
│                    Affordmed Test Server                     │
│                   http://20.207.122.201                      │
│                                                              │
│  /register  /auth  /logs  /depots  /vehicles  /notifications│
└────────────────────────┬────────────────────────────────────┘
│ HTTP/REST
┌─────────────┼──────────────┐
│             │              │
┌──────────▼───────┐ ┌───▼──────────┐ ┌▼────────────────────┐
│ logging_         │ │ vehicle_     │ │ notification_        │
│ middleware       │ │ maintence_   │ │ app_be               │
│                  │ │ scheduler    │ │                      │
│ ✓ Auto token     │ │ ✓ Knapsack   │ │ ✓ Min-heap top-N    │
│   refresh        │ │   DP per     │ │ ✓ Priority scoring  │
│ ✓ Silent fail    │ │   depot      │ │ ✓ Type + recency    │
│ ✓ Structured     │ │ ✓ Backtrack  │ │   weighted score    │
│   log shipping   │ │   selection  │ │                     │
└──────────────────┘ └──────────────┘ └─────────────────────┘
│                │                    │
└────────────────┴────────────────────┘
All modules use logging_middleware
for structured observability

---

##  Modules

###  logging_middleware

> Reusable structured logging package that ships logs to the Affordmed evaluation server with automatic token management.

**Key Design Decisions:**
- Token cached in memory with expiry check — no redundant auth calls
- Silent fail pattern — logging never crashes the calling application
- Single responsibility — one function, one job

**API:**
```jsconst { Log } = require('../logging_middleware');await Log(
'backend',    // stack: "backend" | "frontend"
'info',       // level: "debug" | "info" | "warn" | "error" | "fatal"
'controller', // package: "controller" | "service" | "db" | "middleware" | ...
'User login successful for student ID 42' // message: max 48 chars
);

---

###  vehicle_maintence_scheduler

> Solves the Vehicle Maintenance Scheduling problem as a **0/1 Knapsack** optimization — maximizes total operational impact score within each depot's mechanic-hour budget.

**Algorithm:**
- Fetch all depots and vehicles from test server
- For each depot: run 0/1 Knapsack DP with `MechanicHours` as capacity
- Backtrack DP table to identify selected tasks
- Time complexity: `O(D × N × W)` where D=depots, N=tasks, W=max budget

**Sample Output:**===== VEHICLE MAINTENANCE SCHEDULER RESULTS =====Depot 1 | Budget: 60h  | Impact: 132 | Used: 60h   | Tasks: 16
Depot 2 | Budget: 135h | Impact: 182 | Used: 134h  | Tasks: 28
Depot 3 | Budget: 188h | Impact: 188 | Used: 163h  | Tasks: 33
Depot 4 | Budget: 97h  | Impact: 182 | Used: 97h   | Tasks: 26
Depot 5 | Budget: 164h | Impact: 220 | Used: 163h  | Tasks: 37

---

###  notification_app_be

> Priority Inbox — returns the top-N most important unread notifications using a **min-heap** data structure with a composite priority scoring formula.

**Priority Formula:**score = type_weight × 10¹³ + unix_timestamp_msType weights:
Placement → 3  (highest priority)
Result    → 2
Event     → 1  (lowest priority)

**Why Min-Heap?**
| Approach | Time | Space |
|----------|------|-------|
| Sort all | O(n log n) | O(n) |
| Min-Heap (size N) | O(n log N) | O(N) |

Heap wins when N << n, especially for real-time streaming where new notifications arrive continuously.

---

##  Setup & Run

```bash1. Clone the repository
git clone https://github.com/VaibhavXBhardwaj/RA2311028030045.git
cd RA23110280300452. Install dependencies
cd logging_middleware && npm install && cd ..
cd vehicle_maintence_scheduler && npm install && cd ..
cd notification_app_be && npm install && cd ..3. Run Vehicle Maintenance Scheduler
cd vehicle_maintence_scheduler
node index.js4. Run Priority Inbox
cd ../notification_app_be
node index.js

---

## Key Engineering Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Scheduling Algorithm | 0/1 Knapsack DP | Optimal subset selection under capacity constraint |
| Priority Structure | Min-Heap | O(N) space, efficient for streaming updates |
| Token Management | In-memory cache + expiry | Avoid redundant auth round trips |
| Log Failure Handling | Silent fail | Logging must never crash business logic |
| Language | JavaScript (Node.js) | Fast I/O, async-first, matches frontend consumption |

---

##  Assessment Checklist

- Logging middleware created and integrated from first function
- All APIs called with Bearer token authentication
- Vehicle scheduler uses real depot + vehicle data from test server
- Knapsack DP maximizes impact within mechanic-hour budget per depot
- Notification priority inbox with min-heap (Stage 6)
- System design covering all 6 stages
- Production-grade code structure with meaningful log messages
- Regular commits at logical milestones
- No hardcoded test data — all data fetched from evaluation server

---

##  Author

**Vaibhav Bhardwaj**
-  B.Tech CSE — SRMIST (2027)
-  GitHub: [@VaibhavXBhardwaj](https://github.com/VaibhavXBhardwaj)
-  vb5066@srmist.edu.in

---

##  License

MIT © 2026 Vaibhav Bhardwaj — See [LICENSE](./LICENSE) for details.
