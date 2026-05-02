const axios = require("axios");
const { Log, getToken } = require("../logging_middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function priorityScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] || 0;
  const timestamp = new Date(notification.Timestamp).getTime();
  return { ...notification, weight, timestamp, score: weight * 1e13 + timestamp };
}

class MinHeap {
  constructor(n) {
    this.n = n;
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this.heap.sort((a, b) => a.score - b.score);
    if (this.heap.length > this.n) this.heap.shift();
  }

  getTop() {
    return [...this.heap].sort((a, b) => b.score - a.score);
  }
}

async function fetchNotifications(token) {
  await Log("backend", "info", "service", "Fetching notifications");
  const res = await axios.get(`${BASE_URL}/notifications`, authHeaders(token));
  await Log("backend", "info", "service", `Got ${res.data.notifications.length} notifications`);
  return res.data.notifications;
}

async function getTopN(n = 10) {
  try {
    await Log("backend", "info", "controller", "Priority inbox started");
    const token = await getToken();
    const notifications = await fetchNotifications(token);

    await Log("backend", "debug", "domain", "Scoring notifications");
    const heap = new MinHeap(n);

    for (const notif of notifications) {
      const scored = priorityScore(notif);
      heap.push(scored);
    }

    const top = heap.getTop();
    await Log("backend", "info", "domain", `Top ${n} notifications selected`);

    console.log(`\n===== TOP ${n} PRIORITY NOTIFICATIONS =====\n`);
    top.forEach((n, i) => {
      console.log(`${i + 1}. [${n.Type}] ${n.Message} | ${n.Timestamp}`);
    });

    await Log("backend", "info", "controller", "Priority inbox completed");
    return top;
  } catch (err) {
    await Log("backend", "fatal", "controller", `Priority inbox error`.slice(0, 48));
    console.error("Error:", err.response?.data || err.message);
    process.exit(1);
  }
}

getTopN(10);