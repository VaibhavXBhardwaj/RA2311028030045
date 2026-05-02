const axios = require("axios");
const { Log, getToken } = require("../logging_middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function knapsack(tasks, budget) {
  const n = tasks.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(budget + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= budget; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }
  const selected = [];
  let w = budget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }
  return { selected, totalImpact: dp[n][budget] };
}

async function fetchDepots(token) {
  await Log("backend", "info", "service", "Fetching depots");
  const res = await axios.get(`${BASE_URL}/depots`, authHeaders(token));
  await Log("backend", "info", "service", `Got ${res.data.depots.length} depots`);
  return res.data.depots;
}

async function fetchVehicles(token) {
  await Log("backend", "info", "service", "Fetching vehicles");
  const res = await axios.get(`${BASE_URL}/vehicles`, authHeaders(token));
  await Log("backend", "info", "service", `Got ${res.data.vehicles.length} vehicles`);
  return res.data.vehicles;
}

async function run() {
  try {
    await Log("backend", "info", "controller", "Scheduler started");
    const token = await getToken();
    const depots = await fetchDepots(token);
    const vehicles = await fetchVehicles(token);
    await Log("backend", "debug", "domain", "Running knapsack per depot");

    const results = [];
    for (const depot of depots) {
      await Log("backend", "debug", "domain", `Depot ${depot.ID} budget ${depot.MechanicHours}h`);
      const { selected, totalImpact } = knapsack(vehicles, depot.MechanicHours);
      await Log("backend", "info", "domain", `Depot ${depot.ID} impact ${totalImpact}`);
      results.push({
        depotID: depot.ID,
        mechanicHourBudget: depot.MechanicHours,
        selectedTasks: selected.map((t) => t.TaskID),
        totalImpact,
        totalDuration: selected.reduce((s, t) => s + t.Duration, 0),
      });
    }

    console.log("\n===== VEHICLE MAINTENANCE SCHEDULER RESULTS =====\n");
    results.forEach((r) => {
      console.log(`Depot ${r.depotID} | Budget: ${r.mechanicHourBudget}h | Impact: ${r.totalImpact} | Used: ${r.totalDuration}h`);
      console.log(`  Tasks (${r.selectedTasks.length}): ${r.selectedTasks.slice(0,3).join(", ")}...`);
      console.log("");
    });

    await Log("backend", "info", "controller", "Scheduler completed");
    return results;
  } catch (err) {
    await Log("backend", "fatal", "controller", `Scheduler error: ${err.message}`.slice(0, 48));
    console.error("Error:", err.response?.data || err.message);
    process.exit(1);
  }
}

run();