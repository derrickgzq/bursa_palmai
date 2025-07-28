const BACKEND_URL = "http://localhost:8000";
//const BACKEND_URL = "https://bursa-palmai.onrender.com";

// MAINPAGE INITIALIZATION
async function loadNewsSentiment() {
  try {
    const response = await fetch(BACKEND_URL + "/the-edge/news-sentiment-summary");
    const sentimentData = await response.json();

    const card = document.getElementById("newsSentimentCard");
    const valueEl = document.getElementById("newsSentimentValue");
    const labelEl = document.getElementById("newsSentimentLabel");

    const { positive = 0, neutral = 0, negative = 0, total_news = 0 } = sentimentData;

    // Compute net sentiment score
    const netScore = (positive * 1 + neutral * 0 + negative * -1);
    const normalizedScore = total_news ? netScore / total_news : 0;

    // Determine sentiment based on weighted score
    let dominant = "neutral";
    let color = "#f9ab00";

    if (normalizedScore >= 0.2) {
      dominant = "positive";
      color = "#34a853"; // green
    } else if (normalizedScore <= -0.2) {
      dominant = "negative";
      color = "#ea4335"; // red
    }

    // Update UI
    valueEl.textContent = dominant.charAt(0).toUpperCase() + dominant.slice(1);
    valueEl.style.color = color;
    labelEl.textContent = `Based on latest ${total_news} headlines`;
    labelEl.style.color = color;
    card.style.backgroundColor = color === "#34a853" ? "#e6f4ea" : color === "#ea4335" ? "#fbeaea" : "#fef7e0";

  } catch (error) {
    console.error("Failed to load sentiment:", error);
    document.getElementById("newsSentimentValue").textContent = "N/A";
    document.getElementById("newsSentimentLabel").textContent = "Unable to fetch data";
  }
}

loadNewsSentiment();

async function loadPriceMomentum() {
  try {
    const response = await fetch("http://127.0.0.1:8000/yf/share-prices");
    const prices = await response.json();

    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    prices.forEach(stock => {
      if (stock.percent >= 5) bullish++;
      else if (stock.percent <= -5) bearish++;
      else neutral++;
    });

    const card = document.getElementById("priceMomentumCard");
    const label = document.getElementById("priceMomentumLabel");

    let sentiment = "Neutral";
    let color = "#e6f4ea"; // greenish

    if (bullish > bearish && bullish > neutral) {
      sentiment = "Bullish";
      color = "#e6f4ea"; // greenish
      label.style.color = "#34a853";
    } else if (bearish > bullish && bearish > neutral) {
      sentiment = "Bearish";
      color = "#fce8e6"; // reddish
      label.style.color = "#d93025";
    } else {
      sentiment = "Neutral";
      color = "#fef7e0"; // yellowish
      label.style.color = "#f9ab00";
    }

    card.style.backgroundColor = color;
    label.textContent = sentiment;

  } catch (err) {
    console.error("Failed to load price momentum:", err);
  }
}

loadPriceMomentum();

async function loadWeatherSummary() {
  try {
    const res = await fetch(BACKEND_URL + "/opendosm/weather-forecast-summary");
    const data = await res.json();

    // Initialize counts
    const totals = {
      "Tiada Hujan": 0,
      "Hujan": 0,
      "Ribut Petir": 0
    };

    data.forEach(day => {
      totals["Tiada Hujan"] += day["Tiada Hujan"] || 0;
      totals["Hujan"] += day["Hujan"] || 0;
      totals["Ribut Petir"] += day["Ribut Petir"] || 0;
    });

    // Determine dominant weather
    const dominantWeather = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];

    // Set colors
    const colors = {
      "Tiada Hujan": { bg: "#e6f4ea", text: "#34a853" },
      "Hujan": { bg: "#fef7e0", text: "#f9ab00" },
      "Ribut Petir": { bg: "#fce8e6", text: "#d93025" }
    };

    const card = document.getElementById("weatherRiskCard");
    const typeEl = document.getElementById("weatherRiskType");
    const labelEl = document.getElementById("weatherRiskLabel");

    card.style.backgroundColor = colors[dominantWeather].bg;
    typeEl.textContent = dominantWeather;
    typeEl.style.color = colors[dominantWeather].text;
    labelEl.style.color = colors[dominantWeather].text;

  } catch (err) {
    console.error("Failed to fetch weather summary:", err);
  }
}

loadWeatherSummary();

function initMainpage() {
  anychart.onDocumentReady(function () {
    fetch(BACKEND_URL + "/yf/marketcap-data")
      .then((response) => response.json())
      .then((apiData) => {
        const data = [
          {
            id: "root",
            name: "Market Cap",
            children: apiData.map((company) => ({
              id: company.company,
              name: company.company,
              value: company.market_cap_billion,
            })),
          },
        ];

        const total = data[0].children.reduce(
          (sum, company) => sum + company.value,
          0
        );

        const chart = anychart.treeMap(data);
        chart.colorScale().ranges([
          { less: 1, color: "#bcb98a" },
          { from: 1, to: 5, color: "#899a5c" },
          { from: 5, to: 20, color: "#5a7e67" },
          { greater: 20, color: "#4a6854" },
        ]);

        const title = chart.title();
        title.enabled(true);
        title.text(
          `Plantation Sector Market Cap (RM ${total.toFixed(2)} Billion)`
        );
        title.fontSize(14);
        title.padding(10);
        title.fontColor("#00321f");
        title.fontWeight("bold");
        title.fontFamily("Inter");
        title.hAlign("left");

        chart
          .tooltip()
          .format("{%name}: RM {%value} Billion")
          .fontSize(12)
          .fontFamily("Inter");

        chart.labels().fontFamily("Inter").fontSize(12).fontColor("#00321f");

        chart.container("treemap");
        chart.draw();
      })
      .catch((error) =>
        console.error("Error fetching market cap data:", error)
      );
  });

  // KLCI chart
  fetch(BACKEND_URL + "/yf/klci-data")
    .then((response) => response.json())
    .then((data) => {
      const ctx = document.getElementById("klciChart")?.getContext("2d");
      if (!ctx) throw new Error("KLCI chart canvas context not found");

      // Plugin to show latest value label above last point
      const showLatestLabelPlugin = {
        id: "showLatestLabel",
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const lastPoint = meta.data[dataset.data.length - 1];

          if (lastPoint) {
            const value = dataset.data[dataset.data.length - 1];
            const roundedValue = parseFloat(value).toFixed(2);

            // Draw KLCI latest value label above line
            ctx.save();
            ctx.font = "bold 12px Inter";
            ctx.fillStyle = "#014422";
            ctx.textAlign = "right";
            ctx.fillText(roundedValue, lastPoint.x - 8, lastPoint.y - 8);
            ctx.restore();

            // Draw percentage change inside area under the line
            const firstValue = dataset.data[0];
            const percentChange = ((value - firstValue) / firstValue) * 100;
            const percentText = `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}% since start`;

            ctx.save();
            ctx.font = "bold 16px Inter";
            ctx.fillStyle = percentChange >= 0 ? "#065f46" : "#b91c1c";
            ctx.textAlign = "center";
            ctx.fillText(percentText, lastPoint.x - 120, chart.chartArea.bottom - 30);
            ctx.restore();
          }
        },
      };

      new Chart(ctx, {
        type: "line",
        data: {
          labels: data.dates,
          datasets: [
            {
              label: "KLCI Index",
              data: data.prices,
              borderColor: "#014422",
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: true,
              backgroundColor: "rgba(1, 68, 34, 0.08)",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "nearest",
            intersect: false,
            axis: "x",
          },
          plugins: {
            legend: {
              display: false,
              labels: {
                font: { family: "Inter", size: 12 },
                color: "#00321f",
              },
            },
            title: {
              display: true,
              text: "Kuala Lumpur Composite Index (KLCI), Last 7 days",
              color: "#00321f",
              font: { family: "Inter", size: 16, weight: "bold" },
              padding: { top: 10, bottom: 20 },
            },
            tooltip: {
              enabled: true,
              mode: "index",
              intersect: false,
              bodyFont: { family: "Inter", size: 13 },
              titleFont: { family: "Inter", size: 14, weight: "bold" },
              callbacks: {
                label: function (context) {
                  return `KLCI: ${context.parsed.y}`;
                },
              },
              displayColors: false,
              backgroundColor: "#fff",
              borderColor: "#014422",
              borderWidth: 1,
              titleColor: "#014422",
              bodyColor: "#00321f",
            },
            hover: {
              mode: "nearest",
              intersect: false,
              animationDuration: 400,
            },
          },
          scales: {
            x: {
              ticks: {
                font: { family: "Inter", size: 12 },
                color: "#00321f",
                autoSkip: true,
                maxTicksLimit: 15,
              },
              grid: { display: false },
            },
            y: {
              ticks: {
                font: { family: "Inter", size: 12 },
                color: "#00321f",
              },
              beginAtZero: false,
              grid: { display: false },
            },
          },
          animation: {
            duration: 800,
            easing: "easeOutQuart",
          },
        },
        plugins: [showLatestLabelPlugin],
      });
    })
    .catch((error) => console.error("Error fetching KLCI data:", error));

  // Latest share price
  let allData = [];
  let currentPage = 0;
  const cardsPerPage = 4;

  const logoMap = {
    1961: "ioi_logo.png",
    2445: "klk_logo.png",
    5285: "sdg_logo.png",
    5222: "fgv_logo.png",
    4383: "jtiasa_logo.png",
    5027: "kmloong_logo.png",
    9059: "tsh_logo.png",
    1996: "kretam_logo.png",
    2089: "utdplt_logo.png",
    2291: "genp_logo.png",
    6262: "inno_logo.png",
    5126: "sop_logo.png",
  };

  const stockMap = {
    1961: "IOI Corporation Berhad",
    2445: "Kuala Lumpur Kepong Berhad",
    5285: "SD Guthrie Berhad",
    5222: "FGV Holdings Berhad",
    4383: "Jaya Tiasa Holdings Berhad",
    5027: "Kim Loong Resources Berhad",
    9059: "TSH Resources Berhad",
    1996: "Kretam Holdings Berhad",
    2089: "United Plantations Berhad",
    2291: "Genting Plantations Berhad",
    6262: "Innoprise Plantations Berhad",
    5126: "Sarawak Oil Palms Berhad",
  };

  function renderCards() {
    const container = document.getElementById("scoreCards");
    if (!container) return;
    container.innerHTML = "";
    const start = currentPage * cardsPerPage;
    const end = start + cardsPerPage;
    const pageData = allData.slice(start, end);

    pageData.forEach((item) => {
      const arrowUp = '<span class="text-green-600">▲</span>';
      const arrowDown = '<span class="text-red-600">▼</span>';
      const arrow =
        item.change > 0 ? arrowUp : item.change < 0 ? arrowDown : "";
      const color =
        item.change > 0
          ? "text-green-600"
          : item.change < 0
            ? "text-red-600"
            : "text-gray-600";
      const logoFilename = logoMap[item.symbol] || "default_logo.png";
      const stockname = stockMap[item.symbol] || item.symbol;

      const card = `
        <div class="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
          <img src="/static/company_logo/${logoFilename}" alt="${stockname} logo" class="w-12 h-12 object-contain" />
          <div class="text-left">
            <h3 class="text-sm font-semibold text-gray-800">${stockname}</h3>
            <p class="text-lg font-bold text-green-700">RM ${item.price}</p>
            <p class="text-sm ${color}">
              ${arrow} ${item.percent}% (${item.change})
            </p>
          </div>
        </div>
      `;
      container.innerHTML += card;
    });

    document.getElementById("prevBtn").disabled = currentPage === 0;
    document.getElementById("nextBtn").disabled = end >= allData.length;
  }

  fetch(BACKEND_URL + "/yf/share-prices")
    .then((res) => res.json())
    .then((data) => {
      allData = data;
      renderCards();
    })
    .catch((error) => console.error("Error fetching share prices:", error));

  document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      renderCards();
    }
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    if ((currentPage + 1) * cardsPerPage < allData.length) {
      currentPage++;
      renderCards();
    }
  });

  // ai summary news
  const summaryDiv = document.getElementById("aiSummary");

  fetch(BACKEND_URL + "/ai-summary")
    .then(response => response.json())
    .then(data => {
      summaryDiv.innerHTML = `
        <p><strong>AI Generated Summary:</strong> ${data.summary}</p>
      `;
    })
    .catch(error => {
      console.error("Error fetching AI generated summary:", error);
      summaryDiv.innerHTML = `<p style="color: red;"><strong>Failed to load AI generated summary.</strong></p>`;
    });

  // News cards
  async function loadNews() {
    try {
      const response = await fetch(BACKEND_URL + "/the-edge/news");
      const data = await response.json();
      const newsCardsContainer = document.getElementById("newsCards");
      if (!newsCardsContainer) return;
      newsCardsContainer.innerHTML = "";

      data.news.slice(0, 10).forEach((item) => {
        const card = document.createElement("div");
        card.className =
          "w-full border rounded-lg shadow p-4 flex flex-col justify-between hover:shadow-lg transition";

        const published = item.published
          ? `<p class="text-xs text-gray-500 mb-2">${item.published}</p>`
          : "";

        const sentimentColor = {
          positive: "bg-green-100 text-green-800 border border-green-400",
          negative: "bg-red-100 text-red-800 border border-red-400",
          neutral: "bg-yellow-100 text-yellow-800 border border-yellow-400",
        }[item.sentiment] || "bg-gray-100 text-gray-800 border border-gray-400";

        const sentimentTag = `
          <span class="text-xs px-2 py-1 rounded-full font-semibold ${sentimentColor}" style="display: inline-block; width: fit-content;">
            ${item.sentiment.toUpperCase()} • ${(item.score * 100).toFixed(1)}%
          </span>
        `;

        card.innerHTML = `
          <div class="flex justify-between items-start">
            <h3 class="text-lg font-bold" style="color: #014422; font-family: 'Inter', sans-serif;">
              <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="hover:underline">
                ${item.headline}
              </a>
            </h3>
            ${sentimentTag}
          </div>
          ${published}
          <p class="flex-grow mt-1" style="color: #345f3c; font-family: 'Inter', sans-serif;">
            ${item.description}
          </p>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="mt-4 text-sm text-green-600 hover:underline">
            Read more
          </a>
        `;

        newsCardsContainer.appendChild(card);
      });
    } catch (error) {
      console.error("Failed to load news:", error);
    }
  }
  loadNews();
}

// COMPANY INITIALIZATION
const companySelect = document.getElementById("company-select");
const companyTitle = document.getElementById("company-title");
const companyDescriptionEl = document.getElementById("company-description");

const nameMap = {
  KLK: "Kuala Lumpur Kepong Berhad",
  IOI: "IOI Corporation Berhad",
  SDG: "Sime Darby Guthrie Berhad",
  FGV: "FGV Holdings Berhad",
  KMLOONG: "Kim Loong Resources Berhad",
};

const logoMap = {
  KLK: "klk_logo.png",
  IOI: "ioi_logo.png",
  SDG: "sdg_logo.png",
  FGV: "fgv_logo.png",
  KMLOONG: "kmloong_logo.png",
};

async function fetchCompanyData(company) {
  const response = await fetch(
    BACKEND_URL + `/sqlite/prod-data?company=${company}`
  );
  const result = await response.json();
  return result.data;
}

function getColor(index) {
  const colors = [
    "rgba(0, 50, 31, 1)",
    "rgba(127, 154, 131, 1)",
    "rgba(52, 95, 60, 1)",
    "rgba(137, 154, 92, 1)",
    "rgba(1, 68, 34, 1)",
    "rgba(188, 185, 138, 1)",
  ];
  return colors[index % colors.length];
}

function buildBarChart(data, companyCode) {
  const ctx = document.getElementById("prod-chart")?.getContext("2d");
  if (!ctx) return;

  const months = [...new Set(data.map(item => item.date))].sort((a, b) => new Date(a) - new Date(b));
  const rawMats = [...new Set(data.map((item) => item.raw_material))];

  const datasets = rawMats.map((mat, i) => ({
    label: mat,
    data: months.map((month) => {
      const item = data.find((d) => d.date === month && d.raw_material === mat);
      return item ? Number(item.volume) : 0;
    }),
    backgroundColor: getColor(i),
  }));

  if (window.prodChart) window.prodChart.destroy();

  window.prodChart = new Chart(ctx, {
    type: "bar",
    data: { labels: months, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: {
        onComplete: () => {
          window.prodChart.resize();
        },
      },
      scales: {
        x: {
          title: { display: false, text: "Month" },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Volume" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: { display: true, color: "black" },
      },
    },
  });
}

async function fetchPriceData(ticker) {
  const response = await fetch(BACKEND_URL + `/yf/price-data?ticker=${ticker}`);
  const result = await response.json();
  return result;
}

function drawPriceChart(data, ticker) {
  const ctx = document.getElementById("price-chart")?.getContext("2d");
  if (!ctx) return;

  const labels = data.dates;
  const prices = data.prices;

  if (window.priceChart) window.priceChart.destroy();

  window.priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Closing Price`,
          data: prices,
          borderColor: "rgba(52, 95, 60, 1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: {
        onComplete: () => {
          window.priceChart.resize();
        },
      },
      scales: {
        x: {
          title: { display: false, text: "Date" },
          grid: { display: false },
        },
        y: {
          title: { display: false, text: "Price (MYR)" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: { display: true, color: "black" },
      },
    },
  });
}

async function fetchCompanyDescription(ticker) {
  const response = await fetch(
    BACKEND_URL + `/yf/company-summary?ticker=${ticker}`
  );
  if (!response.ok) {
    console.error("Failed to fetch company description");
    return "";
  }

  let text = await response.text();
  text = text.replace(/^["“”']+|["“”']+$/g, "");

  return text;
}

async function fetchEarnings(ticker) {
  const res = await fetch(
    BACKEND_URL + `/sqlite/company-earnings?ticker=${ticker}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch earnings for ${ticker}`);
  }
  const json = await res.json();
  return json;
}

let chartInstance = null;

function drawEarningsChart(data) {
  const ctx = document.getElementById("earnings-chart")?.getContext("2d");
  if (!ctx) return;

  const labels = data.data.map((d) => d.Quarter);
  const revenue = data.data.map((d) => d["Revenue (Thousand Millions)"]);
  const netIncome = data.data.map((d) => d["Net Profit (Thousand Millions)"]);
  const margin = data.data.map((d) => d["Net Profit Margin (%)"]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue (RM billion)",
          data: revenue,
          backgroundColor: "rgba(1, 68, 34, 0.7)",
          yAxisID: "y",
        },
        {
          label: "Net Profit (RM billion)",
          data: netIncome,
          backgroundColor: "rgba(137, 154, 92, 0.7)",
          yAxisID: "y",
        },
        {
          label: "Net Profit Margin (%)",
          data: margin,
          type: "line",
          borderColor: "rgba(188, 185, 138, 1)",
          backgroundColor: "rgba(188, 185, 138, 1)",
          borderWidth: 2,
          fill: false,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      stacked: false,
      plugins: {
        title: {
          display: true,
          text: "Quarterly Earnings",
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          type: "linear",
          position: "left",
          grid: { display: false },
          title: {
            display: true,
            text: "RM (Billion)",
          },
        },
        y1: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          title: {
            display: true,
            text: "Net Profit Margin (%)",
          },
        },
      },
    },
  });
}

async function fetchPlantedAreaData(company) {
  const response = await fetch(
    BACKEND_URL + `/sqlite/plt-area?company=${company}`
  );
  const result = await response.json();
  return result.data;
}

function buildPlantedAreaPieChart(data, company) {
  const ctx = document.getElementById("plt-area-chart")?.getContext("2d");
  if (!ctx) return;

  const latestYear = Math.max(...data.map((d) => d.Year));
  const filtered = data.filter((d) => d.Year === latestYear);
  const labels = filtered.map((d) => d.Category);
  const values = filtered.map((d) => d.Value);
  const colors = labels.map((_, i) => getColor(i));

  if (window.plantedAreaChart) window.plantedAreaChart.destroy();

  window.plantedAreaChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "#fff",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "black" } },
        title: {
          display: true,
          text: `Planted Area (${latestYear})`,
          color: "black",
        },
      },
    },
  });
}

async function fetchExtractionRateData(company) {
  const response = await fetch(
    BACKEND_URL + `/sqlite/ext-rates?company=${company}`
  );
  const result = await response.json();
  return result.data;
}

function buildExtractionRateChart(data, company) {
  const ctx = document.getElementById("ext-rates-chart")?.getContext("2d");
  if (!ctx) return;

  const years = [...new Set(data.map((d) => d.date))].sort();
  const categories = [...new Set(data.map((d) => d.category))];

  const datasets = categories.map((category, i) => ({
    label: category,
    data: years.map((year) => {
      const item = data.find((d) => d.date === year && d.category === category);
      return item ? Number(item.value) : 0;
    }),
    borderColor: getColor(i),
    backgroundColor: getColor(i),
    fill: false,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
  }));

  if (window.extractionRateChart) window.extractionRateChart.destroy();

  window.extractionRateChart = new Chart(ctx, {
    type: "line",
    data: { labels: years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: false, text: "Year" },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Extraction Rate (%)" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { color: "black" } },
        title: {
          display: false,
          text: `${nameMap[company]} Extraction Rates by Year`,
          color: "black",
        },
      },
    },
  });
}

async function buildRevenueForecastChart(data, company) {
  const ctx = document
    .getElementById("revenue-forecast-chart")
    ?.getContext("2d");
  if (!ctx) return;

  const forecastResponse = await fetch(
    `${BACKEND_URL}/sqlite/predict-revenue?company=${company}`
  );
  if (!forecastResponse.ok) {
    console.error("Failed to fetch forecasted revenue from FastAPI");
    return;
  }

  const forecastData = await forecastResponse.json();
  const latestRevenue = forecastData.latest_actual_revenue_mil;
  const forecastedRevenue = forecastData.predicted_revenue;
  const hasMissing = forecastData.missing_months_imputed?.length > 0;
  const imputedMonths = forecastData.missing_months_imputed?.join(", ") || "";
  const nextQuarterRange = forecastData.next_quarter;
  const nextQuarterLabel = `Next Forecasted Quarter`;

  const latestQuarterLabel = (() => {
    const date = new Date(forecastData.latest_revenue_date);
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Latest Quarter - ${year}Q${quarter}`;
  })();

  const warningContainer = document.getElementById("revenue-warning");
  if (warningContainer) {
    warningContainer.innerText = hasMissing
      ? `⚠ Inaccurate forecasts due to missing data: ${imputedMonths}`
      : "";
  }

  const features = forecastData.features || {};
  const ffb = features["Fresh Fruit Bunches"] || 0;
  const cpo = features["Crude Palm Oil"] || 0;
  const pk = features["Palm Kernel"] || 0;
  const total = ffb + cpo + pk;

  const percent = (v) =>
    total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "0%";
  const ffbWeightElement = document.getElementById("ffb-weight");
  const cpoWeightElement = document.getElementById("cpo-weight");
  const pkWeightElement = document.getElementById("pk-weight");

  if (ffbWeightElement) ffbWeightElement.innerText = percent(ffb);
  if (cpoWeightElement) cpoWeightElement.innerText = percent(cpo);
  if (pkWeightElement) pkWeightElement.innerText = percent(pk);

  if (window.revenueForecastChart) window.revenueForecastChart.destroy();

  window.revenueForecastChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [latestQuarterLabel, nextQuarterLabel],
      datasets: [
        {
          label: "Revenue (RM mil)",
          data: [latestRevenue, forecastedRevenue],
          backgroundColor: ["rgba(1, 68, 34, 0.7)", "rgba(128, 128, 128, 0.7)"],
          borderColor: ["rgba(1, 68, 34, 1)", "rgba(128, 128, 128, 1)"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: "black" },
        },
        title: {
          display: true,
          text: `${nameMap[company]} Revenue and Forecast`,
          color: "black",
          font: { family: "Inter", size: 16, weight: "bold" },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              return `Revenue: RM ${(value / 1000).toFixed(2)}B`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#014422",
          font: {
            family: "Inter",
            size: 12,
            weight: "bold",
          },
          formatter: function (value) {
            return `${(value / 1000).toFixed(2)}B`;
          },
        },
      },
      scales: {
        x: {
          title: {
            display: false,
            text: "Quarter",
          },
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 12 },
            color: "#00321f",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Revenue (RM Million)",
          },
          grid: { display: false },
          ticks: {
            font: { family: "Inter", size: 12 },
            color: "#00321f",
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

//Insights
async function buildCorrelationHeatmap() {
  const container = document.getElementById("correlationHeatmap");
  if (container) container.innerHTML = "";

  const labels = ["Revenue", "CPO Price", "PK Price", "FFB Price"];
  const correlationMatrix = await new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        [1.0, 0.95, 0.05, 0.9], // Revenue
        [0.95, 1.0, 0.75, -0.12], // CPO Price
        [0.05, 0.75, 1.0, 0.7], // PK Price
        [0.9, -0.12, 0.7, 1.0], // FFB Price
      ]);
    }, 100);
  });

  const heatmapData = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = 0; j < labels.length; j++) {
      if (j <= i) {
        heatmapData.push({
          x: labels[j],
          y: labels[i],
          heat: +correlationMatrix[i][j].toFixed(2),
        });
      }
    }
  }

  anychart.onDocumentReady(function () {
    const chart = anychart.heatMap(heatmapData);

    chart.container("correlationHeatmap");
    chart.height("100%");
    chart.background().fill("#ffffff");

    // Set up custom color scale with gradient and range
    const scale = anychart.scales.linearColor();
    scale.colors([
      "#e7f5ef", // low
      "#a7d7b3",
      "#66bb88",
      "#2a8247",
      "#1b5e20", // high
    ]);
    scale.minimum(0).maximum(1); // ✅ set range properly

    chart.colorScale(scale); // ✅ attach the custom scale

    chart.tooltip().titleFormat("{%y} vs {%x}").format("Correlation: {%heat}");

    chart.labels().fontColor("#00321f").fontFamily("Inter").fontSize(12);

    chart.stroke("#ffffff");
    chart.hovered().stroke("white", 2);

    chart.draw();
  });
}

async function initInsightToggle() {
  const insightText = document.getElementById("insightText");
  const toggleSelect = document.getElementById("toggleSelect");

  if (!insightText || !toggleSelect) return;

  // Placeholder: replace with API call if needed
  const insightData = {
    cpo: "RM513 increase in CPO price leads to RM151 million increase in revenue",
    pk: "RM320 increase in PK price leads to RM88 million increase in revenue",
    ffb: "RM75 increase in FFB price leads to RM60 million increase in revenue",
  };

  toggleSelect.addEventListener("change", async function () {
    const selected = toggleSelect.value;

    // In future you could fetch it like this:
    // const response = await fetch(`/api/insights/${selected}`);
    // const data = await response.json();
    // insightText.textContent = data.message;

    insightText.textContent = insightData[selected];
  });

  // Initialize default
  const initial = toggleSelect.value;
  insightText.textContent = insightData[initial];
}

async function initCompanyTab() {
  try {
    const selectedOption = companySelect.options[companySelect.selectedIndex];
    const [companyCode, shareCode] = selectedOption.value.split("|");

    companyTitle.textContent = nameMap[companyCode];

    const logoImg = document.getElementById("companyLogo");
    if (logoImg && logoMap[companyCode]) {
      logoImg.src = `/static/company_logo/${logoMap[companyCode]}`;
      logoImg.alt = `${nameMap[companyCode]} company logo`;
    }

    const description = await fetchCompanyDescription(shareCode);
    if (companyDescriptionEl) companyDescriptionEl.textContent = description;

    const prodData = await fetchCompanyData(companyCode);
    buildBarChart(prodData, companyCode);

    const priceData = await fetchPriceData(shareCode);
    drawPriceChart(priceData, shareCode);

    const earningsData = await fetchEarnings(companyCode);
    drawEarningsChart(earningsData, companyCode);

    const areaData = await fetchPlantedAreaData(companyCode);
    buildPlantedAreaPieChart(areaData, companyCode);

    const extData = await fetchExtractionRateData(companyCode);
    buildExtractionRateChart(extData, companyCode);

    await buildRevenueForecastChart(earningsData, companyCode);

    await initInsightToggle();

    await buildCorrelationHeatmap();
  } catch (err) {
    console.error("Error in initCompanyTab:", err);
  }
}

companySelect.addEventListener("change", async (e) => {
  const [companyCode, shareCode] = e.target.value.split("|");
  companyTitle.textContent = nameMap[companyCode];

  const logoImg = document.getElementById("companyLogo");
  if (logoImg && logoMap[companyCode]) {
    logoImg.src = `/static/company_logo/${logoMap[companyCode]}`;
    logoImg.alt = `${nameMap[companyCode]} company logo`;
  }

  const description = await fetchCompanyDescription(shareCode);
  if (companyDescriptionEl) companyDescriptionEl.textContent = description;

  const prodData = await fetchCompanyData(companyCode);
  buildBarChart(prodData, companyCode);

  const priceData = await fetchPriceData(shareCode);
  drawPriceChart(priceData, shareCode);

  const earningsData = await fetchEarnings(companyCode);
  drawEarningsChart(earningsData, companyCode);

  const areaData = await fetchPlantedAreaData(companyCode);
  buildPlantedAreaPieChart(areaData, companyCode);

  const extData = await fetchExtractionRateData(companyCode);
  buildExtractionRateChart(extData, companyCode);

  await buildRevenueForecastChart(earningsData, companyCode);

  await initInsightToggle();

  await buildCorrelationHeatmap();
});

// COMMODITIES INITIALIZATION
async function initCommodities() {
  // MPOB stats
  fetch(BACKEND_URL + "/sqlite/mpob")
    .then((res) => res.json())
    .then((data) => {
      const ctx = document.getElementById("mpobChart")?.getContext("2d");
      if (!ctx) return;

      const months = [...new Set(data.map((d) => d.MONTH_YEAR))];
      const items = [...new Set(data.map((d) => d.ITEMS))];
      const greenPalette = [
        "rgba(0, 50, 31, 0.7)",
        "rgba(1, 68, 34, 0.7)",
        "rgba(52, 95, 60, 0.7)",
        "rgba(127, 154, 131, 0.7)",
        "rgba(137, 154, 92, 0.7)",
        "rgba(188, 185, 138, 0.7)",
      ];

      const datasets = items.map((item, index) => {
        const values = months.map(
          (month) =>
            data.find((d) => d.MONTH_YEAR === month && d.ITEMS === item)
              ?.VALUE || 0
        );

        if (item === "FFB price") {
          return {
            type: "line",
            label: item,
            data: values,
            borderColor: "rgb(6, 84, 13)",
            backgroundColor: "rgba(13, 80, 11, 0.98)",
            borderWidth: 2,
            yAxisID: "y1",
            tension: 0.3,
            fill: false,
            pointRadius: 3,
          };
        } else {
          return {
            type: "bar",
            label: item,
            data: values,
            backgroundColor: greenPalette[index % greenPalette.length],
            yAxisID: "y",
          };
        }
      });

      new Chart(ctx, {
        data: {
          labels: months,
          datasets: datasets,
        },
        options: {
          indexAxis: "x", // <-- Ensures vertical orientation
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              left: 10,
              right: 10,
              top: 10,
              bottom: 20,
            },
          },
          plugins: {
            legend: {
              position: "right",
              labels: {
                boxWidth: 12,
                padding: 10,
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: "Month Year" },
              ticks: {
                autoSkip: true,
                maxRotation: 45,
                minRotation: 45,
                padding: 10,
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Volume / Stocks / Export" },
              position: "left",
            },
          },
        },
      });
    })
    .catch((error) => console.error("Error fetching MPOB data:", error));

  // Multi-line chart for CPO, FFB, and Palm Kernel
  async function fetchMainCommoditiesData() {
    const response = await fetch(BACKEND_URL + "/sqlite/commodities");
    const result = await response.json();

    // Step 1: Get all unique dates sorted
    const uniqueDates = Array.from(new Set(result.map(item => item.date))).sort();

    // Step 2: Group values by item type and date
    const grouped = {
      "local crude palm oil": {},
      "fresh fruit bunches": {},
      "palm kernel": {},
    };

    result.forEach(item => {
      grouped[item.item][item.date] = item.value;
    });

    // Step 3: For each item, create an array of values aligned by date
    const data = {
      dates: uniqueDates,
      cpo: uniqueDates.map(date => grouped["local crude palm oil"][date] ?? null),
      ffb: uniqueDates.map(date => grouped["fresh fruit bunches"][date] ?? null),
      kernel: uniqueDates.map(date => grouped["palm kernel"][date] ?? null),
    };

    return data;
  }

  function drawMainCommoditiesChart(data) {
    const ctx = document.getElementById("cpo-price-chart")?.getContext("2d");
    if (!ctx) return;

    if (window.palmOilChart) window.palmOilChart.destroy();

    window.palmOilChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.dates,
        datasets: [
          {
            label: "Local Crude Palm Oil",
            data: data.cpo,
            yAxisID: "y",
            borderColor: "rgba(52, 95, 60, 0.8)",
            backgroundColor: "rgba(52, 95, 60, 0.1)",
            fill: true,
            tension: 0.3,
          },
          {
            label: "Palm Kernel",
            data: data.kernel,
            yAxisID: "y",
            borderColor: "rgba(93, 64, 55, 0.8)",
            backgroundColor: "rgba(93, 64, 55, 0.1)",
            fill: true,
            tension: 0.3,
          },
          {
            label: "Fresh Fruit Bunches",
            data: data.ffb,
            yAxisID: "y1",  // RIGHT axis
            borderColor: "rgba(243, 156, 18, 0.9)",
            backgroundColor: "rgba(243, 156, 18, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 20,
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: {
              color: "black",
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              padding: 10,
            },
            grid: { display: false },
          },
          y: {
            type: "linear",
            position: "left",
            title: { display: true, text: "Price (RM - Thousands)" },
            ticks: { color: "black" },
            grid: { display: false },
          },
          y1: {
            type: "linear",
            position: "right",
            title: { display: true, text: "FFB Price (RM - Tens)" },
            ticks: { color: "black" },
            grid: { drawOnChartArea: false }, // prevents overlap with left axis
          },
        },
        plugins: {
          legend: { labels: { color: "black" } },
        },
      },
    });
  }

  // Fetch and draw
  fetchMainCommoditiesData()
    .then(drawMainCommoditiesChart)
    .catch(error => console.error("Error fetching commodities data:", error));

  // Soybean price
  async function fetchSoyPriceData() {
    const response = await fetch(
      BACKEND_URL + "/yf/soy-price-data?ticker=ZL=F"
    );
    const result = await response.json();
    return result;
  }

  function drawSoyPriceChart(data) {
    const ctx = document.getElementById("soy-price-chart")?.getContext("2d");
    if (!ctx) return;

    if (window.soyChart) window.soyChart.destroy();

    window.soyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.dates,
        datasets: [
          {
            label: "Soybean Oil Futures",
            data: data.prices,
            borderColor: "rgba(52, 95, 60, 0.7)",
            backgroundColor: "rgba(52, 95, 60, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // --- Start of changes for Soybean Price Chart ---
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 10,
            bottom: 20, // Increased bottom padding
          },
        },
        // --- End of changes for Soybean Price Chart ---
        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: {
              color: "black",
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              padding: 10,
            },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Price (USD)" },
            ticks: { color: "black" },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { labels: { color: "black" } },
        },
      },
    });
  }

  fetchSoyPriceData()
    .then((data) => drawSoyPriceChart(data))
    .catch((error) =>
      console.error("Error fetching soybean price data:", error)
    );

  // Fertilizer chart
  async function renderFertilizerChart() {
    const response = await fetch(BACKEND_URL + "/ws/fertilizer-data");
    const data = await response.json();

    const ctx = document.getElementById("fert-chart")?.getContext("2d");
    if (!ctx) return;

    const labels = data["Month"];
    const colors = {
      urea: "rgba(0, 50, 31, 0.7)",
      "triple-superphosphate": "rgba(52, 95, 60, 0.7)",
      "rock-phosphate": "rgba(127, 154, 131, 0.7)",
      "potassium-chloride": "rgba(188, 185, 138, 0.7)",
      "dap-fertilizer": "rgba(237, 226, 70, 0.87)",
    };

    const datasets = Object.keys(data)
      .filter((key) => key !== "Month")
      .map((key) => ({
        label: key.replace(/-/g, " "),
        data: data[key],
        fill: false,
        borderColor: colors[key],
        tension: 0.3,
      }));

    new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { left: 10, right: 10, top: 10, bottom: 20 },
        },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              title: (tooltipItems) => `Month: ${tooltipItems[0].label}`,
              label: (tooltipItem) => {
                const label = tooltipItem.dataset.label || "";
                const value = tooltipItem.formattedValue;
                return `${label}: MYR ${value}`;
              },
            },
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            title: { display: true, text: "Month" },
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              padding: 10,
            },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Price (MYR)" },
            grid: { display: false },
          },
        },
      },
    });
  }

  renderFertilizerChart();

  // Diesel chart
  fetch(BACKEND_URL + "/opendosm/fuelprices")
    .then((response) => response.json())
    .then((data) => {
      const ctx = document.getElementById("diesel-chart")?.getContext("2d");
      if (!ctx) return;

      const labels = data.map((item) => item.date);
      const diesel = data.map((item) => parseFloat(item.diesel));
      const dieselEastMsia = data.map((item) =>
        parseFloat(item.diesel_eastmsia)
      );

      new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Diesel (West Malaysia)",
              data: diesel,
              borderColor: "green",
              backgroundColor: "rgba(1,68,34,0.8)",
              fill: false,
              tension: 0.3,
            },
            {
              label: "Diesel (East Malaysia)",
              data: dieselEastMsia,
              borderColor: "darkgreen",
              backgroundColor: "rgba(137,154,92,0.8)",
              fill: false,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // --- Start of changes for Diesel Chart ---
          layout: {
            padding: {
              left: 10,
              right: 10,
              top: 10,
              bottom: 20, // Increased bottom padding
            },
          },
          // --- End of changes for Diesel Chart ---
          scales: {
            x: {
              title: { display: true, text: "Date" },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
                autoSkip: true, // Added autoSkip here
                padding: 10,
              },
              grid: { display: false },
            },
            y: {
              title: { display: true, text: "Price (RM)" },
              beginAtZero: false,
              grid: { display: false },
            },
          },
          plugins: {
            legend: { position: "top" },
            tooltip: { mode: "index", intersect: false },
          },
        },
      });
    })
    .catch((error) => console.error("Error loading fuel price data:", error));
}

// EXPORT IMPORT INITIALIZATION
let eximChart1 = null;
let eximChart2 = null;

async function initExportImport() {
  try {
    const tradeResponse = await fetch(BACKEND_URL + "/sqlite/trade-data");
    if (!tradeResponse.ok)
      throw new Error(`Failed to fetch trade data: ${tradeResponse.status}`);
    const tradeData = await tradeResponse.json();

    if (typeof vis === "undefined") {
      console.error(
        "vis.js library is not loaded. Please ensure the vis-network script is included."
      );
      const container = document.getElementById("graphtheory");
      if (container) {
        container.innerHTML =
          '<p style="color: red; font-family: Inter, sans-serif;">Error: Unable to load trade network visualization. Please try again later.</p>';
      }
      return;
    }

    const validData = tradeData.filter(
      (row) =>
        row.reporterISO &&
        row.partnerISO &&
        row.reporterISO !== "World" &&
        row.partnerISO !== "World" &&
        ["X", "M"].includes(row.reporterDesc) &&
        !isNaN(Number(row.fobvalue)) &&
        !isNaN(Number(row.refMonth))
    );

    const years = [
      ...new Set(validData.map((row) => Number(row.refMonth))),
    ].sort((a, b) => a - b);
    const yearSlider = document.getElementById("yearSlider");
    const selectedYearEl = document.getElementById("selectedYear");
    const physicsToggle = document.getElementById("physicsToggle");
    const playButton = document.getElementById("playButton");

    if (!yearSlider || !selectedYearEl || years.length === 0) {
      console.error("Year slider or data missing");
      const container = document.getElementById("graphtheory");
      if (container) {
        container.innerHTML =
          '<p style="color: red; font-family: Inter, sans-serif;">Error: No valid years available for filtering.</p>';
      }
      return;
    }

    if (!playButton) {
      console.warn(
        "Play button not found; animation control will be unavailable."
      );
    }

    // Set up slider
    yearSlider.min = 0;
    yearSlider.max = years.length - 1;
    yearSlider.value = years.length - 1;
    selectedYearEl.textContent = years[years.length - 1];

    // Store node positions
    let nodePositions = {};

    // Helper function to format fobvalue compactly
    const formatFobValue = (value) => {
      if (value >= 1_000_000_000) {
        return `USD ${(value / 1_000_000_000).toFixed(2)}B`;
      } else if (value >= 1_000_000) {
        return `USD ${(value / 1_000_000).toFixed(2)}M`;
      } else if (value >= 1_000) {
        return `USD ${(value / 1_000).toFixed(2)}K`;
      }
      return `USD ${value.toFixed(2)}`;
    };

    // Initialize network and datasets
    const container = document.getElementById("graphtheory");
    if (!container) throw new Error("Graph theory container not found");

    // Global node ID mapping
    const isoToNodeId = {};
    let nextNodeId = 1;
    validData.forEach((row) => {
      if (!isoToNodeId[row.reporterISO])
        isoToNodeId[row.reporterISO] = nextNodeId++;
      if (!isoToNodeId[row.partnerISO])
        isoToNodeId[row.partnerISO] = nextNodeId++;
    });

    // Initialize DataSets
    const nodesDataSet = new vis.DataSet([]);
    const edgesDataSet = new vis.DataSet([]);
    const graphData = { nodes: nodesDataSet, edges: edgesDataSet };

    // Network options
    const options = {
      nodes: {
        shape: "dot",
        font: { size: 12, face: "Inter, sans-serif", color: "#00321f" },
      },
      edges: {
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        color: { color: "#3b3c36" },
        smooth: { type: "continuous" },
        font: { size: 10, face: "Inter, sans-serif", align: "middle" },
      },
      height: "100%",
      width: "100%",
      physics: {
        enabled: physicsToggle ? physicsToggle.checked : true,
        solver: "barnesHut",
        barnesHut: {
          gravitationalConstant: -1200,
          centralGravity: 0.1,
          springLength: 150,
          springConstant: 0.03,
          damping: 0.2,
          avoidOverlap: 0.3,
        },
        maxVelocity: 50,
        minVelocity: 0.1,
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25,
        },
      },
      interaction: {
        dragNodes: true,
        hover: true,
      },
    };

    // Initialize network
    let network = new vis.Network(container, graphData, options);

    // Debounce function
    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    // Animation state
    let isPlaying = false;
    let animationInterval = null;

    // Function to render graph and table for a given year
    const renderGraphAndTable = (selectedYear) => {
      // Filter data by selected year and limit to top 100 edges by fobvalue
      let filteredData = validData.filter(
        (row) => Number(row.refMonth) === Number(selectedYear)
      );
      filteredData = filteredData
        .sort((a, b) => b.fobvalue - a.fobvalue)
        .slice(0, 280);

      // Determine trade types for each country
      const tradeTypes = {};
      filteredData.forEach((row) => {
        const reporter = row.reporterISO;
        const partner = row.partnerISO;
        if (!tradeTypes[reporter])
          tradeTypes[reporter] = { hasExport: false, hasImport: false };
        if (!tradeTypes[partner])
          tradeTypes[partner] = { hasExport: false, hasImport: false };
        if (row.reporterDesc === "X") {
          tradeTypes[reporter].hasExport = true;
          tradeTypes[partner].hasImport = true;
        } else if (row.reporterDesc === "M") {
          tradeTypes[reporter].hasImport = true;
          tradeTypes[partner].hasExport = true;
        }
      });

      // Create unique nodes
      const nodeSet = new Set();
      filteredData.forEach((row) => {
        nodeSet.add(row.reporterISO);
        nodeSet.add(row.partnerISO);
      });

      // Calculate node degrees
      const nodeDegrees = {};
      filteredData.forEach((row) => {
        const reporter = row.reporterISO;
        const partner = row.partnerISO;
        if (!nodeDegrees[reporter]) nodeDegrees[reporter] = new Set();
        if (!nodeDegrees[partner]) nodeDegrees[partner] = new Set();
        nodeDegrees[reporter].add(partner);
        nodeDegrees[partner].add(reporter);
      });
      for (const iso in nodeDegrees) {
        nodeDegrees[iso] = nodeDegrees[iso].size;
      }

      // Determine min and max degrees for scaling
      const degrees = Object.values(nodeDegrees);
      const minDegree = Math.min(...degrees, 1);
      const maxDegree = Math.max(...degrees, 1);
      const minSize = 15;
      const maxSize = 45;

      // Prepare new nodes
      const newNodes = Array.from(nodeSet).map((id) => {
        let backgroundColor = "#345f3c";
        if (tradeTypes[id]) {
          const { hasExport, hasImport } = tradeTypes[id];
          if (hasExport && !hasImport) backgroundColor = "#BCB98A";
          else if (!hasExport && hasImport) backgroundColor = "#345f3c";
          else if (hasExport && hasImport) backgroundColor = "#fff8dc";
        }
        const degree = nodeDegrees[id] || 0;
        let size = minSize;
        if (maxDegree > minDegree) {
          size =
            minSize +
            ((degree - minDegree) / (maxDegree - minDegree)) *
            (maxSize - minSize);
        } else if (degree > 0) {
          size = maxSize;
        }
        return {
          id: isoToNodeId[id],
          label: id,
          title: id,
          ...(nodePositions[id]
            ? { x: nodePositions[id].x, y: nodePositions[id].y }
            : {}),
          color: { background: backgroundColor, border: "#2e4f36" },
          size: size,
        };
      });

      // Calculate total nodes and FOB value
      const totalNodes = nodeSet.size;
      const totalFobValue = filteredData.reduce(
        (sum, row) => sum + Number(row.fobvalue),
        0
      );

      // Update table with stats
      const totalNodesEl = document.getElementById("totalNodes");
      const totalFobValueEl = document.getElementById("totalFobValue");
      if (totalNodesEl) totalNodesEl.textContent = totalNodes;
      if (totalFobValueEl)
        totalFobValueEl.textContent = formatFobValue(totalFobValue);

      // Calculate FOB value for the previous year
      const previousYear = years[years.indexOf(Number(selectedYear)) - 1];
      let fobValueChange = "-";
      if (previousYear !== undefined) {
        const previousData = validData.filter(
          (row) => Number(row.refMonth) === Number(previousYear)
        );
        const previousFobValue = previousData.reduce(
          (sum, row) => sum + Number(row.fobvalue),
          0
        );
        if (previousFobValue > 0) {
          const percentageChange =
            ((totalFobValue - previousFobValue) / previousFobValue) * 100;
          fobValueChange = percentageChange.toFixed(2) + "%";
          if (percentageChange > 0) fobValueChange = "+" + fobValueChange;
        }
      }
      const fobValueChangeEl = document.getElementById("fobValueChange");
      if (fobValueChangeEl) fobValueChangeEl.textContent = fobValueChange;

      // Calculate change in number of nodes
      let nodesChange = "-";
      if (previousYear !== undefined) {
        const previousData = validData.filter(
          (row) => Number(row.refMonth) === Number(previousYear)
        );
        const previousNodeSet = new Set();
        previousData.forEach((row) => {
          previousNodeSet.add(row.reporterISO);
          previousNodeSet.add(row.partnerISO);
        });
        const previousNodes = previousNodeSet.size;
        const nodeDifference = totalNodes - previousNodes;
        nodesChange =
          nodeDifference >= 0 ? `+${nodeDifference}` : `${nodeDifference}`;
      }
      const nodesChangeEl = document.getElementById("nodesChange");
      if (nodesChangeEl) nodesChangeEl.textContent = nodesChange;

      // Prepare new edges
      const maxFobValue = Math.max(
        ...filteredData.map((row) => row.fobvalue),
        1
      );
      const newEdges = filteredData
        .map((row, index) => {
          const isExport = row.reporterDesc === "X";
          const isImport = row.reporterDesc === "M";
          return {
            id: `edge-${selectedYear}-${index}`,
            from: isExport
              ? isoToNodeId[row.reporterISO]
              : isImport
                ? isoToNodeId[row.partnerISO]
                : undefined,
            to: isExport
              ? isoToNodeId[row.partnerISO]
              : isImport
                ? isoToNodeId[row.reporterISO]
                : undefined,
            arrows: "to",
            width: Math.max(1, (row.fobvalue / maxFobValue) * 10),
            title: `FOB Value: ${row.fobvalue.toLocaleString("en-MY", {
              style: "currency",
              currency: "MYR",
            })}`,
            label: "",
            fobvalue: row.fobvalue,
          };
        })
        .filter((edge) => edge.from && edge.to);

      // Update nodes
      const currentNodeIds = nodesDataSet.getIds();
      const newNodeIds = newNodes.map((n) => n.id);
      const nodesToRemove = currentNodeIds.filter(
        (id) => !newNodeIds.includes(id)
      );
      nodesDataSet.remove(nodesToRemove);
      nodesDataSet.update(newNodes);

      // Update edges
      const currentEdgeIds = edgesDataSet.getIds();
      const newEdgeIds = newEdges.map((e) => e.id);
      const edgesToRemove = currentEdgeIds.filter(
        (id) => !newEdgeIds.includes(id)
      );
      edgesDataSet.remove(edgesToRemove);
      edgesDataSet.add(newEdges);

      // Update node positions after stabilization
      network.on("stabilized", () => {
        newNodes.forEach((node) => {
          const pos = network.getPositions([node.id])[node.id];
          if (pos) {
            nodePositions[node.label] = { x: pos.x, y: pos.y };
          }
        });
        //console.log(`Graph stabilized for year ${selectedYear}`);
        network.stopSimulation();
      });

      // Force stop physics after 1 second
      setTimeout(() => {
        if (network) {
          network.stopSimulation();
          //console.log(`Physics stopped for year ${selectedYear} after timeout`);
        }
      }, 1200);
    };

    // Initial render
    renderGraphAndTable(years[years.length - 1]);

    // Animation control
    const toggleAnimation = () => {
      if (isPlaying) {
        clearInterval(animationInterval);
        animationInterval = null;
        isPlaying = false;
        if (playButton) playButton.textContent = "▶️ Play";
        console.log("Animation stopped");
      } else {
        isPlaying = true;
        if (playButton) playButton.textContent = "⏸️ Pause";
        let currentIndex = parseInt(yearSlider.value);
        animationInterval = setInterval(() => {
          currentIndex = (currentIndex + 1) % years.length; // Loop back to start
          yearSlider.value = currentIndex;
          selectedYearEl.textContent = years[currentIndex];
          renderGraphAndTable(years[currentIndex]);
        }, 1500); // 1 second per year
        console.log("Animation started");
      }
    };

    // Play button event listener
    if (playButton) {
      playButton.addEventListener("click", toggleAnimation);
    }

    // Debounced slider event listener
    const debouncedRender = debounce((selectedIndex) => {
      if (isPlaying) {
        toggleAnimation(); // Stop animation on manual slider interaction
      }
      selectedYearEl.textContent = years[selectedIndex];
      renderGraphAndTable(years[selectedIndex]);
    }, 100);

    yearSlider.addEventListener("input", () => {
      const selectedIndex = parseInt(yearSlider.value);
      debouncedRender(selectedIndex);
    });

    // Physics toggle event listener
    if (physicsToggle) {
      physicsToggle.addEventListener("change", () => {
        if (network) {
          network.setOptions({ physics: { enabled: physicsToggle.checked } });
          if (!physicsToggle.checked) {
            network.stopSimulation();
            console.log("Physics disabled via toggle");
          } else {
            console.log("Physics enabled via toggle");
          }
        }
      });
    } else {
      //console.warn("Physics toggle not found; defaulting to static graph");
    }

    // Hover edge events
    network.on("hoverEdge", (event) => {
      const edgeId = event.edge;
      const edge = edgesDataSet.get(edgeId);
      if (edge && edge.fobvalue !== undefined) {
        edgesDataSet.update({
          id: edgeId,
          label: formatFobValue(edge.fobvalue),
          font: { color: "#000", strokeWidth: 0, align: "top" },
        });
      }
    });

    network.on("blurEdge", (event) => {
      const edgeId = event.edge;
      edgesDataSet.update({
        id: edgeId,
        label: "",
        font: { color: "rgba(0,0,0,0)", strokeWidth: 0 },
      });
    });

    // Debug: Log drag events
    network.on("dragEnd", () => {
      console.log("Node dragged, physics should respond with bounce");
    });

    // Existing export/import charts
    const res = await fetch(BACKEND_URL + "/opendosm/exim-data");
    if (!res.ok) throw new Error(`Failed to fetch exim data: ${res.status}`);
    const chartData = await res.json();

    const labels = chartData.date;
    const animal_exports =
      chartData.exports_Animal_Vegetable_Oils_Fats_and_Waxes;
    const animal_imports =
      chartData.imports_Animal_Vegetable_Oils_Fats_and_Waxes;
    const animal_net = animal_exports.map((val, i) => val - animal_imports[i]);
    const chemical_exports =
      chartData.exports_Chemical_and_Related_Products_NEC;
    const chemical_imports =
      chartData.imports_Chemical_and_Related_Products_NEC;
    const chemical_net = chemical_exports.map(
      (val, i) => val - chemical_imports[i]
    );

    const ctx1 = document.getElementById("4th-chart")?.getContext("2d");
    if (!ctx1) throw new Error("4th-chart canvas context not found");

    if (eximChart1) eximChart1.destroy();

    eximChart1 = new Chart(ctx1, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Net Trade",
            data: animal_net,
            backgroundColor: animal_net.map((v) =>
              v >= 0 ? "rgba(75, 192, 192, 0.5)" : "rgba(255, 99, 132, 0.5)"
            ),
            borderColor: animal_net.map((v) =>
              v >= 0 ? "rgba(75, 192, 192, 1)" : "rgba(255, 99, 132, 1)"
            ),
            borderWidth: 1,
            type: "bar",
            yAxisID: "y",
          },
          {
            label: "Exports",
            data: animal_exports,
            borderColor: "rgba(1,68,34,0.8)",
            backgroundColor: "rgba(1,68,34,0.1)",
            type: "line",
            yAxisID: "y",
          },
          {
            label: "Imports",
            data: animal_imports,
            borderColor: "rgba(137,154,92,0.8)",
            backgroundColor: "rgba(137,154,92,0.1)",
            type: "line",
            yAxisID: "y",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              generateLabels: function (chart) {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, i) => {
                  if (dataset.label === "Net Trade") {
                    const netValue = dataset.data.find((v) => v !== 0) || 0;
                    return {
                      text: netValue >= 0 ? "Net Export" : "Net Import",
                      fillStyle: dataset.backgroundColor[0],
                      strokeStyle: dataset.borderColor[0],
                      lineWidth: dataset.borderWidth,
                      hidden: !chart.isDatasetVisible(i),
                      datasetIndex: i,
                    };
                  }
                  return {
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i,
                  };
                });
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Date" },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Value (RM)" },
            grid: { display: false },
          },
        },
      },
    });

    const ctx2 = document.getElementById("5th-chart")?.getContext("2d");
    if (!ctx2) throw new Error("5th-chart canvas context not found");

    if (eximChart2) eximChart2.destroy();

    eximChart2 = new Chart(ctx2, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Net Trade",
            data: chemical_net,
            backgroundColor: chemical_net.map((v) =>
              v >= 0 ? "rgba(153, 102, 255, 0.5)" : "rgba(255, 159, 64, 0.5)"
            ),
            borderColor: chemical_net.map((v) =>
              v >= 0 ? "rgba(153, 102, 255, 1)" : "rgba(255, 159, 64, 1)"
            ),
            borderWidth: 1,
            type: "bar",
            yAxisID: "y",
          },
          {
            label: "Exports",
            data: chemical_exports,
            borderColor: "rgba(1,68,34,0.8)",
            backgroundColor: "rgba(1,68,34,0.1)",
            type: "line",
            yAxisID: "y",
          },
          {
            label: "Imports",
            data: chemical_imports,
            borderColor: "rgba(137,154,92,0.8)",
            backgroundColor: "rgba(137,154,92,0.1)",
            type: "line",
            yAxisID: "y",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              generateLabels: function (chart) {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, i) => {
                  if (dataset.label === "Net Trade") {
                    const netValue = dataset.data.find((v) => v !== 0) || 0;
                    return {
                      text: netValue >= 0 ? "Net Export" : "Net Import",
                      fillStyle: dataset.backgroundColor[0],
                      strokeStyle: dataset.borderColor[0],
                      lineWidth: dataset.borderWidth,
                      hidden: !chart.isDatasetVisible(i),
                      datasetIndex: i,
                    };
                  }
                  return {
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i,
                  };
                });
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Date" },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Value (RM)" },
            grid: { display: false },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error initializing Export Import charts:", error);
  }
}

// Function to toggle chart visibility
function toggleChart() {
  const select = document.getElementById("chart-select");
  const selectedChart = select.value;
  const chart4 = document.getElementById("4th-chart");
  const chart5 = document.getElementById("5th-chart");

  if (selectedChart === "4th-chart") {
    chart4.style.display = "block";
    chart5.style.display = "none";
  } else {
    chart4.style.display = "none";
    chart5.style.display = "block";
  }
}

// Initialize everything
initExportImport();

let map;
let forecastLayer = null;
let millCluster = null;

async function initMpobStats() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  // Define base layers
  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "Map data © OpenStreetMap contributors",
    }
  );

  const esriSat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri",
    }
  );

  const esriTopo = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri",
    }
  );

  // Initialize map with default base layer
  let map = L.map("map", {
    center: [4.785756684, 108.2661479634814],
    zoom: 6,
    layers: [osm]
  });

  // Marker cluster group for earthquakes
  const earthquakeMarkers = L.markerClusterGroup();

  // Custom control for arrow indicator
  const EarthquakeArrowControl = L.Control.extend({
    options: { position: 'bottomright' },

    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'earthquake-arrow-control');
      container.style.display = 'none';
      container.style.backgroundColor = 'white';
      container.style.border = '1px solid #ccc';
      container.style.borderRadius = '4px';
      container.style.padding = '5px';
      container.style.cursor = 'pointer';
      container.innerHTML = `
      <i class="fas fa-arrow-right" style="color: #ff0000ff; font-size: 16px;"></i>
      <span style="margin-left: 5px; font-size: 12px; color: #345f3c;">Earthquake</span>
    `;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'click', this._panToNearestEarthquake, this);
      return container;
    },

    initialize: function (markers) {
      this._markers = markers;
      this._map = null;
    },

    onRemove: function () {
      const container = this.getContainer();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },

    updateArrow: function () {
      const container = this.getContainer();
      if (!this._map || !container) return;

      const bounds = this._map.getBounds();
      let nearestMarker = null;
      let minDistance = Infinity;
      const mapCenter = this._map.getCenter();

      this._markers.eachLayer(marker => {
        if (!bounds.contains(marker.getLatLng())) {
          const distance = mapCenter.distanceTo(marker.getLatLng());
          if (distance < minDistance) {
            minDistance = distance;
            nearestMarker = marker;
          }
        }
      });

      if (nearestMarker) {
        container.style.display = 'block';
        const markerPos = nearestMarker.getLatLng();
        const angle = this._calculateAngle(mapCenter, markerPos);
        container.querySelector('i').style.transform = `rotate(${angle}deg)`;
        this._targetLatLng = markerPos;
      } else {
        container.style.display = 'none';
      }
    },

    _calculateAngle: function (from, to) {
      const dy = to.lat - from.lat;
      const dx = to.lng - from.lng;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return angle;
    },

    _panToNearestEarthquake: function () {
      if (this._map && this._targetLatLng) {
        this._map.panTo(this._targetLatLng, { animate: true, duration: 0.5 });
      }
    }
  });

  // Custom control for reset view button
  const ReturnToDefaultControl = L.Control.extend({
    options: { position: 'topleft' },

    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'return-default-control');
      container.style.backgroundColor = 'white';
      container.style.border = '1px solid #ccc';
      container.style.borderRadius = '4px';
      container.style.padding = '5px';
      container.style.cursor = 'pointer';
      container.innerHTML = `
      <i class="fas fa-home" style="color: #345f3c; font-size: 16px;"></i>
    `;
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'click', () => {
        map.setView([4.785756684, 108.2661479634814], 6, { animate: true, duration: 0.5 });
      });
      return container;
    },

    onRemove: function () {
      const container = this.getContainer();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  });

  // Fetch earthquake warnings
  fetch('https://api.data.gov.my/weather/warning/earthquake')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      // Get date 2 days ago
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);

      // Filter entries
      const filtered = data.filter(item => {
        const localDate = new Date(item.localdatetime);
        return localDate > yesterday;
      });

      // Add pulsing markers
      filtered.forEach(({ lat, lon, location, localdatetime, n_distancemas, magdefault, magtypedefault }) => {
        const marker = L.marker([lat, lon], {
          icon: L.icon.pulse({
            iconSize: [20, 20],
            color: 'red',
            fillColor: 'red',
            heartbeat: 1.2
          })
        }).bindTooltip(`
    <strong>${location}</strong><br>
    Distance from Malaysia Region: ${n_distancemas}<br>
    Magnitude: ${magdefault} ${magtypedefault}<br>
    Date: ${localdatetime}
  `, {
          direction: 'top',     // show above marker
          sticky: true,         // tooltip follows the mouse
          opacity: 0.9,         // optional styling
          offset: [0, -10]      // move up slightly
        });

        earthquakeMarkers.addLayer(marker);
      });

      // Add layer to map
      map.addLayer(earthquakeMarkers);

      // Add controls after map is ready
      map.whenReady(() => {
        try {
          // Add arrow control
          const arrowControl = new EarthquakeArrowControl(earthquakeMarkers);
          arrowControl.addTo(map);
          arrowControl.updateArrow();
          map.on('moveend zoomend', () => arrowControl.updateArrow());

          // Add reset view control
          const resetControl = new ReturnToDefaultControl();
          resetControl.addTo(map);
        } catch (error) {
          console.error('Error adding controls:', error);
        }
      });
    })
    .catch(error => console.error('Error fetching earthquake data:', error));

  let forecastLayer = null;
  let millCluster = null;
  let layerControl = null;

  // Add base layer switcher
  const baseLayers = {
    "🗺️ Streets (OSM)": osm,
    "🛰️ Satellite (Esri)": esriSat,
    "🏞️ Terrain (Esri Topo)": esriTopo,
  };

  // Add legend control, overlays, etc. (your original code continues below)

  // Legend for Palm Oil Estates
  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create("div", "info legend");
    div.style.background = "white";
    div.style.padding = "10px";
    div.style.border = "1px solid #ccc";
    div.style.borderRadius = "6px";
    div.style.fontSize = "14px";
    div.style.lineHeight = "1.4em";
    div.style.fontFamily = "'Inter', sans-serif";
    div.style.width = "150px"; // Smaller by default
    div.style.transition = "width 0.3s ease";

    // Initial collapsed state
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="color: #345f3c;">Map Legend</strong>
        <button id="toggleLegend" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #345f3c;" title="Toggle Legend">▶</button>
      </div>
      <div id="legendContent" style="display: none; margin-top: 8px;">
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          <div style="flex: 1; min-width: 120px;">
            <strong>Palm Oil Estate</strong><br>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <div style="width: 12px; height: 12px; background: gray; border-radius: 50%; margin-right: 6px;"></div>
              Circle Marker
            </div>
          </div>
          <div style="flex: 1; min-width: 120px;">
            <strong>Palm Oil Mills</strong><br>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <i class="fas fa-industry" style="color: #8B4513; margin-right: 6px;"></i>
              Factory Icon
            </div>
          </div>
          <div style="flex: 1; min-width: 120px;">
            <strong>Earthquake Warnings</strong><br>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <div style="width: 12px; height: 12px; background: yellow; border-radius: 50%; margin-right: 6px; animation: pulse 1.2s infinite;"></div>
              Pulsing Marker
            </div>
          </div>
        </div>
        <hr style="margin: 8px 0;">
        <strong>Weather Forecast</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px;">
          <div style="flex: 1; min-width: 100px;"><span style="color: #2ecc71;">●</span> Tiada Hujan/Cerah</div>
          <div style="flex: 1; min-width: 100px;"><span style="color: #dad01a;">●</span> Berangin</div>
          <div style="flex: 1; min-width: 100px;"><span style="color: #cc6e0a;">●</span> Hujan</div>
          <div style="flex: 1; min-width: 100px;"><span style="color: #e74c3c;">●</span> Ribut Petir</div>
        </div>
      </div>
    `;

    // Toggle function
    L.DomEvent.on(div, "click", function (e) {
      if (e.target.id === "toggleLegend") {
        const content = div.querySelector("#legendContent");
        const button = div.querySelector("#toggleLegend");

        const isCollapsed = content.style.display === "none";
        content.style.display = isCollapsed ? "block" : "none";
        button.innerHTML = isCollapsed ? "▼" : "▶";
        div.style.width = isCollapsed ? "300px" : "150px";
      }
    });

    return div;
  };

  // CSS for pulse animation
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 255, 0, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 255, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 255, 0, 0); }
    }
  `;
  document.head.appendChild(style);

  legend.addTo(map);

  const slider = document.getElementById("dateSlider");

  // Disable dragging and zoom when using slider
  slider.addEventListener("mousedown", () => {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
  });
  slider.addEventListener("touchstart", () => {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
  });

  // Re-enable after interaction ends
  slider.addEventListener("mouseup", () => {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
  });
  slider.addEventListener("touchend", () => {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
  });

  // Color mapping by forecast type
  function getColor(forecast) {
    switch ((forecast || "").toLowerCase()) {
      case "tiada hujan":
        return "green";
      case "berangin":
        return "yellow";
      case "hujan":
        return "orange";
      case "ribut petir":
        return "red";
      default:
        return "gray";
    }
  }

  // Load forecast GeoJSON
  let allForecastData = [];
  fetch(BACKEND_URL + "/rsposhapefile")
    .then((res) => res.json())
    .then((data) => {
      allForecastData = data.features || [];
      if (!allForecastData.length) {
        console.warn("No forecast data found");
        return;
      }
      initDateSlider();
      updateForecastLayer(getUniqueDates()[0]);
      loadMillData(); // Load mill data after forecast data
    })
    .catch((error) =>
      console.error("Error fetching RSPO shapefile with forecast:", error)
    );

  function getUniqueDates() {
    const dates = [...new Set(allForecastData.map((f) => f.properties.date))];
    return dates.sort();
  }

  function initDateSlider() {
    const dates = getUniqueDates();
    const slider = document.getElementById("dateSlider");
    const label = document.getElementById("sliderLabel");

    slider.min = 0;
    slider.max = dates.length - 1;
    slider.value = 0;
    label.innerText = `Date: ${dates[0]}`;

    slider.oninput = function () {
      const selectedDate = dates[this.value];
      label.innerText = `Date: ${selectedDate}`;
      updateForecastLayer(selectedDate);
    };
  }

  function updateForecastLayer(selectedDate) {
    if (forecastLayer) {
      forecastLayer.clearLayers();
    } else {
      forecastLayer = L.layerGroup().addTo(map);
    }

    const filtered = allForecastData.filter(
      (f) => f.properties.date === selectedDate
    );

    // Create all markers
    const markers = filtered.map((feature) => {
      const props = feature.properties;
      const lat = props.Latitude;
      const lng = props.Longitude;
      const color = getColor(props.summary_forecast);

      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: color,
        color: "#333",
        weight: 0.7,
        opacity: 1,
        fillOpacity: 0.8,
      });

      const tooltipContent = `
        <b>Plantation:</b> ${props.plantation}<br/>
        <b>Company:</b> ${props.company}<br/>
        <b>Date:</b> ${props.date}<br/>
        <b>Forecast:</b> ${props.summary_forecast}<br/>
        <b>Temp:</b> ${props.min_temp}–${props.max_temp} °C<br/>
        <b>Station:</b> ${props.nearest_station} (${props.distance_km} km)
      `;

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        sticky: true,
        opacity: 0.9,
        className: "leaflet-tooltip",
      });

      return marker;
    });

    // Add markers to the forecast layer
    markers.forEach((marker) => forecastLayer.addLayer(marker));

    // Add layer control if not already added
    addLayerControl();
  }

  function loadMillData() {
    fetch(BACKEND_URL + "/sqlite/mills")
      .then((res) => res.json())
      .then((data) => {
        millCluster = L.markerClusterGroup();

        const millLayer = L.geoJSON(data, {
          pointToLayer: function (feature, latlng) {
            return L.marker(latlng, {
              icon: L.divIcon({
                html: '<i class="fas fa-industry" style="color: brown; font-size: 18px;"></i>',
                className: "",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              }),
            });
          },
          onEachFeature: function (feature, layer) {
            const props = feature.properties;
            const tooltip = `
              <b>Mill:</b> ${props.Mill_Name}<br/>
              <b>Company:</b> ${props.Parent_Com}<br/>
              <b>Group:</b> ${props.Group_Name}<br/>
              <b>RSPO:</b> ${props.RSPO_Statu}
            `;
            layer.bindTooltip(tooltip, {
              direction: "top",
              sticky: true,
              className: "leaflet-tooltip",
            });
          },
        });

        millCluster.addLayer(millLayer);
        map.addLayer(millCluster);

        // Add layer control after mill data is loaded
        addLayerControl();
      })
      .catch((err) => console.error("Error fetching mill data:", err));
  }

  function addLayerControl() {
    if (forecastLayer && millCluster && !layerControl) {
      const overlayMaps = {
        "🌿 Palm Oil Estates (RSPO)": forecastLayer,
        "🏭 Palm Oil Mills": millCluster,
      };

      // Create the layer control
      layerControl = L.control.layers(baseLayers, overlayMaps, {
        position: "topright",
        collapsed: true, // Start collapsed
      });

      // Add the control to the map
      layerControl.addTo(map);

      // Customize the layer control container
      const controlContainer = layerControl.getContainer();
      controlContainer.classList.add("custom-layer-control");

      // Create a toggle button/ribbon
      const toggleButton = document.createElement("div");
      toggleButton.className = "layer-control-toggle";
      toggleButton.innerHTML = '<i class="fas fa-layer-group"></i>'; // Font Awesome icon
      toggleButton.title = "Toggle Layer Control";

      // Append toggle button to the map container
      const mapContainer = map.getContainer();
      mapContainer.appendChild(toggleButton);

      // Toggle visibility on click
      toggleButton.addEventListener("click", () => {
        controlContainer.classList.toggle("collapsed");
        toggleButton.classList.toggle("active");
      });

      // Show on hover
      toggleButton.addEventListener("mouseenter", () => {
        if (controlContainer.classList.contains("collapsed")) {
          controlContainer.classList.remove("collapsed");
        }
      });

      // Hide on mouse leave (unless clicked to stay open)
      controlContainer.addEventListener("mouseleave", () => {
        if (!toggleButton.classList.contains("active")) {
          controlContainer.classList.add("collapsed");
        }
      });
    }
  }

  // Weather slider
  async function fetchWeatherData() {
    try {
      const response = await fetch(
        BACKEND_URL + "/opendosm/weather-forecast-summary"
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.map((item) => ({
        date: item.date,
        TiadaHujan: item["Tiada Hujan"] || 0,
        Berangin: item.Berangin || 0,
        Hujan: item.Hujan || 0,
        RibutPetir: item["Ribut Petir"] || 0,
      }));
    } catch (error) {
      console.error("Error fetching weather data:", error);
      return [];
    }
  }

  async function initializeWeatherDropdown() {
    const weatherData = await fetchWeatherData();
    const dropdown = document.getElementById("date-select");
    const dateDisplay = document.getElementById("selected-date"); // Optional

    if (!dropdown || weatherData.length === 0) {
      console.error("Weather dropdown element or data missing");
      return;
    }

    // Populate dropdown options
    dropdown.innerHTML = ""; // Clear existing options
    weatherData.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = item.date.split("T")[0];
      dropdown.appendChild(option);
    });

    // Update UI values
    function updateDisplay(selectedIndex) {
      const selectedData = weatherData[selectedIndex];
      const date = selectedData.date.split("T")[0];

      if (dateDisplay) dateDisplay.textContent = date;
      document.getElementById("tiada-hujan-value").textContent =
        selectedData.TiadaHujan || 0;
      document.getElementById("berangin-value").textContent =
        selectedData.Berangin || 0;
      document.getElementById("hujan-value").textContent =
        selectedData.Hujan || 0;
      document.getElementById("ribut-petir-value").textContent =
        selectedData.RibutPetir || 0;
    }

    // Initial display
    updateDisplay(0);

    // On change event
    dropdown.addEventListener("change", function () {
      updateDisplay(parseInt(this.value));
    });
  }

  initializeWeatherDropdown();

  // Normalize data to percentages for 100% stacked bar chart
  function normalizeData(data) {
    const normalizedDatasets = data.datasets.map((dataset) => ({
      ...dataset,
      data: [...dataset.data],
    }));
    const labels = data.labels;

    // Calculate total for each label (company)
    const totals = labels.map((_, index) => {
      return data.datasets.reduce(
        (sum, dataset) => sum + (dataset.data[index] || 0),
        0
      );
    });

    // Normalize each dataset to percentages
    normalizedDatasets.forEach((dataset) => {
      dataset.data = dataset.data.map((value, index) => {
        const total = totals[index];
        return total > 0 ? ((value / total) * 100).toFixed(2) : 0;
      });
    });

    return { labels, datasets: normalizedDatasets };
  }

  // Risk bar chart with dropdown
  let riskChart = null;
  const riskData = { cfr: null, rfr: null, drr: null };

  async function initRiskChart() {
    try {
      const [cfrData, rfrData, drrData] = await Promise.all([
        fetch(BACKEND_URL + "/csv/cfr-bar-top6").then((res) => res.json()),
        fetch(BACKEND_URL + "/csv/rfr-bar-top6").then((res) => res.json()),
        fetch(BACKEND_URL + "/csv/drr-bar-top6").then((res) => res.json()),
      ]);

      // Normalize data to percentages
      riskData.cfr = normalizeData(cfrData);
      riskData.rfr = normalizeData(rfrData);
      riskData.drr = normalizeData(drrData);

      const ctx = document.getElementById("risk-bar-chart")?.getContext("2d");
      if (!ctx) {
        console.error("Canvas context for risk-bar-chart not found");
        return;
      }

      // Initialize Chart.js instance as 100% stacked bar chart
      riskChart = new Chart(ctx, {
        type: "bar",
        data: riskData.cfr,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right" },
            title: {
              display: true,
              text: "Major Plantation Companies with Coastal Flood Risks Composition",
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.dataset.label || "";
                  const value = context.parsed.y;
                  return `${label}: ${value}%`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: {
                autoSkip: true,
                maxTicksLimit: 10,
                maxRotation: 45,
                minRotation: 0,
                font: { size: 12 },
              },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              max: 100,
              title: { display: true, text: "Percentage (%)" },
              grid: { display: false },
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
            },
          },
          layout: {
            padding: {
              top: 10,
              bottom: 50,
              left: 10,
              right: 10,
            },
          },
        },
      });

      // Set up dropdown event listener
      const select = document.getElementById("risk-select");
      if (select) {
        select.addEventListener("change", updateRiskChart);
      } else {
        console.error("Dropdown element risk-select not found");
      }
    } catch (error) {
      console.error("Error fetching risk bar chart data:", error);
    }
  }

  function updateRiskChart() {
    const select = document.getElementById("risk-select");
    const title = document.getElementById("risk-chart-title");
    const description = document.getElementById("risk-description"); // new paragraph element
    const selectedRisk = select.value;

    const titles = {
      cfr: "Coastal Flood Risk Composition",
      rfr: "Riverine Flood Risk Composition",
      drr: "Drought Risk Composition",
    };

    const descriptions = {
      cfr: "Coastal floods occur when storm surges or high tides inundate coastal areas. This risk is higher in low-lying regions near the sea.",
      rfr: "Riverine floods occur when rivers overflow due to prolonged rainfall. High risk is concentrated around major river basins and low-lying inland areas.",
      drr: "Drought risk refers to potential water shortages due to low rainfall. This affects crop health, irrigation, and productivity.",
    };

    if (riskChart && riskData[selectedRisk]) {
      riskChart.data = riskData[selectedRisk];
      riskChart.options.plugins.title.text = `Major Plantation Companies with ${titles[selectedRisk]}`;
      title.textContent = titles[selectedRisk]; // just text, no span/svg
      if (description) description.textContent = descriptions[selectedRisk];
      riskChart.update();
    } else {
      console.error("Chart or data not available for", selectedRisk);
    }
  }

  // Call the initialization function
  initRiskChart();
}

// TAB SWITCHING LOGIC
const tabs = document.querySelectorAll(".tab-link");
const tabContents = document.querySelectorAll(".tab-content");
let mainpageInitialized = false;
let companyInitialized = false;
let commoditiesInitialized = false;
let exportimportInitialized = false;
let mpobstatsInitialized = false;

function showTab(tabId) {
  tabContents.forEach((section) => {
    section.classList.toggle("hidden", section.id !== tabId);
  });

  tabs.forEach((tab) => {
    tab.classList.toggle("font-semibold", tab.dataset.tab === tabId);
    tab.classList.toggle("text-green-600", tab.dataset.tab === tabId);
    tab.classList.toggle("dark:text-green-400", tab.dataset.tab === tabId);
  });

  if (tabId === "mainpage" && !mainpageInitialized) {
    initMainpage();
    mainpageInitialized = true;
  } else if (tabId === "company" && !companyInitialized) {
    initCompanyTab();
    companyInitialized = true;
  } else if (tabId === "commodities" && !commoditiesInitialized) {
    initCommodities();
    commoditiesInitialized = true;
  } else if (tabId === "exportimport" && !exportimportInitialized) {
    initExportImport();
    exportimportInitialized = true;
  } else if (tabId === "mpobstats" && !mpobstatsInitialized) {
    initMpobStats();
    mpobstatsInitialized = true;
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  } else if (tabId === "mpobstats" && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(tab.dataset.tab);
  });
});

// Initialize mainpage by default
showTab("mainpage");
