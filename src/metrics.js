const config = require("./config.js");
const os = require("os");

const requests = {};
function requestTracker(req, res, next) {
  const endpoint = `${req.method}:${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
}

let activeUsers = 0;
function addActiveUser() {
  activeUsers++;
}
function removeActiveUser() {
  if (activeUsers > 0) {
    activeUsers--;
  }
}

const authRequests = { success: 0, failure: 0 };
function trackAuthRequest(req, res, next) {
  const originalEnd = res.end;

  res.end = function (...args) {
    originalEnd.apply(this, args);

    if (res.statusCode === 200) {
      authRequests.success++;
    } else {
      authRequests.failure++;
    }
  };

  next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

async function sendMetricsToGrafana() {
  const metrics = {
    resourceMetrics: [{ scopeMetrics: [{ metrics: [] }] }],
  };

  // HTTP requests
  Object.keys(requests).forEach((endpoint) => {
    metrics.resourceMetrics[0].scopeMetrics[0].metrics.push({
      name: "requests",
      unit: "1",
      sum: {
        dataPoints: [
          {
            asInt: requests[endpoint],
            timeUnixNano: Date.now() * 1000000,
            attributes: [
              { key: "endpoint", value: { stringValue: endpoint } },
              { key: "source", value: { stringValue: config.metrics.source } },
            ],
          },
        ],
        aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
        isMonotonic: true,
      },
    });
  });

  // Active users
  metrics.resourceMetrics[0].scopeMetrics[0].metrics.push({
    name: "active_users",
    unit: "1",
    sum: {
      dataPoints: [
        {
          asInt: activeUsers,
          timeUnixNano: Date.now() * 1000000,
          attributes: [{ key: "source", value: { stringValue: config.metrics.source } }],
        },
      ],
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: false,
    },
  });

  // Auth attempts
  metrics.resourceMetrics[0].scopeMetrics[0].metrics.push({
    name: "auth_attempts",
    unit: "1",
    sum: {
      dataPoints: [
        {
          asInt: authRequests.success,
          timeUnixNano: Date.now() * 1000000,
          attributes: [
            { key: "source", value: { stringValue: config.metrics.source } },
            { key: "status", value: { stringValue: "success" } },
          ],
        },
        {
          asInt: authRequests.failure,
          timeUnixNano: Date.now() * 1000000,
          attributes: [
            { key: "source", value: { stringValue: config.metrics.source } },
            { key: "status", value: { stringValue: "failure" } },
          ],
        },
      ],
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: false,
    },
  });

  // CPU usage
  metrics.resourceMetrics[0].scopeMetrics[0].metrics.push({
    name: "cpu_usage",
    unit: "%",
    gauge: {
      dataPoints: [
        {
          asInt: getCpuUsagePercentage(),
          timeUnixNano: Date.now() * 1000000,
          attributes: [{ key: "source", value: { stringValue: config.metrics.source } }],
        },
      ],
    },
  });

  // Memory usage
  metrics.resourceMetrics[0].scopeMetrics[0].metrics.push({
    name: "memory_usage",
    unit: "%",
    gauge: {
      dataPoints: [
        {
          asDouble: getMemoryUsagePercentage(),
          timeUnixNano: Date.now() * 1000000,
          attributes: [{ key: "source", value: { stringValue: config.metrics.source } }],
        },
      ],
    },
  });

  try {
    const res = await fetch(`${config.metrics.url}`, {
      method: "POST",
      body: JSON.stringify(metrics),
      headers: { Authorization: `Bearer ${config.metrics.apiKey}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.error("Failed to push metrics data to Grafana", res.status, await res.text());
    } else {
      console.log(`Pushed metrics`);
    }
  } catch (error) {
    console.error("Error pushing metrics:", error);
  }
}

const timer = setInterval(async () => await sendMetricsToGrafana(), 10000);

module.exports = {
  requestTracker,
  addActiveUser,
  removeActiveUser,
  trackAuthRequest,
};
