//const BACKEND_URL = "http://localhost:8000"; // Uncomment for development
const BACKEND_URL = "https://bursa-palmai.onrender.com"
// MAINPAGE INITIALIZATION
function initMainpage() {
  // Treemap market cap
  if (!window.anychart) {
    console.error("AnyChart library not loaded");
    return;
  }

  anychart.onDocumentReady(function() {
    fetch(BACKEND_URL + '/marketcap-data')
      .then(response => response.json())
      .then(apiData => {
        const data = [{
          id: "root",
          name: "Market Cap",
          children: apiData.map(company => ({
            id: company.company,
            name: company.company,
            value: company.market_cap_billion
          }))
        }];

        const total = data[0].children.reduce((sum, company) => sum + company.value, 0);

        const chart = anychart.treeMap(data);
        chart.colorScale().ranges([
          { less: 1, color: '#bcb98a' },
          { from: 1, to: 5, color: '#899a5c' },
          { from: 5, to: 20, color: '#5a7e67' },
          { greater: 20, color: '#4a6854' }
        ]);

        // Configure title using title() object
        const title = chart.title();
        title.enabled(true);
        title.text(`Plantation Sector Market Cap (RM ${total.toFixed(2)} Billion)`);
        title.fontSize(14);
        title.padding(10);
        title.fontColor('#00321f');
        title.fontWeight('bold');
        title.fontFamily('Inter');
        title.hAlign('left');

        chart.tooltip()
          .format("{%name}: {%value}B MYR")
          .fontSize(12)
          .fontFamily('Inter');

        chart.labels()
          .fontFamily('Inter')
          .fontSize(12)
          .fontColor('#00321f');

        chart.container("treemap");
        chart.draw();
      })
      .catch(error => console.error("Error fetching market cap data:", error));
  });

  // KLCI chart
  fetch(BACKEND_URL + "/klci-data")
    .then(response => response.json())
    .then(data => {
      const ctx = document.getElementById("klciChart")?.getContext("2d");
      if (!ctx) throw new Error("KLCI chart canvas context not found");

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.dates,
          datasets: [{
            label: "KLCI Index",
            data: data.prices,
            borderColor: "#014422",
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false, labels: { font: { family: 'Inter', size: 12 }, color: '#00321f' } },
            title: {
              display: true,
              text: 'Kuala Lumpur Composite Index (KLCI), Last 30 days',
              color: '#00321f',
              font: { family: 'Inter', size: 16, weight: 'bold' },
              padding: { top: 10, bottom: 20 }
            },
            tooltip: {
              bodyFont: { family: 'Inter', size: 12 },
              titleFont: { family: 'Inter', size: 14, weight: 'bold' }
            }
          },
          scales: {
            x: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f', autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
            y: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f' }, beginAtZero: false, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching KLCI data:", error));

  // Latest share price
  let allData = [];
  let currentPage = 0;
  const cardsPerPage = 4;

  const logoMap = {
    "1961": "ioi_logo.png",
    "2445": "klk_logo.png",
    "5285": "sdg_logo.png",
    "5222": "fgv_logo.png",
    "4383": "jtiasa_logo.png",
    "5027": "kmloong_logo.png",
    "9059": "tsh_logo.png",
    "1996": "kretam_logo.png",
    "2089": "utdplt_logo.png",
    "2291": "genp_logo.png",
    "6262": "inno_logo.png",
    "5126": "sop_logo.png"
  };

  const stockMap = {
    "1961": "IOI Corporation Berhad",
    "2445": "Kuala Lumpur Kepong Berhad",
    "5285": "SD Guthrie Berhad",
    "5222": "FGV Holdings Berhad",
    "4383": "Jaya Tiasa Holdings Berhad",
    "5027": "Kim Loong Resources Berhad",
    "9059": "TSH Resources Berhad",
    "1996": "Kretam Holdings Berhad",
    "2089": "United Plantations Berhad",
    "2291": "Genting Plantations Berhad",
    "6262": "Innoprise Plantations Berhad",
    "5126": "Sarawak Oil Palms Berhad"
  };

  function renderCards() {
    const container = document.getElementById("scoreCards");
    if (!container) return;
    container.innerHTML = "";
    const start = currentPage * cardsPerPage;
    const end = start + cardsPerPage;
    const pageData = allData.slice(start, end);

    pageData.forEach(item => {
      const arrowUp = '<span class="text-green-600">▲</span>';
      const arrowDown = '<span class="text-red-600">▼</span>';
      const arrow = item.change > 0 ? arrowUp : item.change < 0 ? arrowDown : "";
      const color = item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-600" : "text-gray-600";
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

  fetch(BACKEND_URL + "/api/share-prices")
    .then(res => res.json())
    .then(data => {
      allData = data;
      renderCards();
    })
    .catch(error => console.error("Error fetching share prices:", error));

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

  // News cards
  async function loadNews() {
    try {
      const response = await fetch(BACKEND_URL + '/api/news');
      const data = await response.json();
      const newsCardsContainer = document.getElementById('newsCards');
      if (!newsCardsContainer) return;
      newsCardsContainer.innerHTML = '';

      data.news.forEach(item => {
        const card = document.createElement('div');
        card.className = 'w-full border rounded-lg shadow p-4 flex flex-col justify-between hover:shadow-lg transition';
        card.innerHTML = `
          <h3 class="text-lg font-bold mb-2" style="color: #014422; font-family: 'Inter', sans-serif;">
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="hover:underline">${item.headline}</a>
          </h3>
          <p class="flex-grow" style="color: #345f3c; font-family: 'Inter', sans-serif;">${item.description}</p>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="mt-4 text-sm text-green-600 hover:underline">Read more</a>
        `;
        newsCardsContainer.appendChild(card);
      });
    } catch (error) {
      console.error('Failed to load news:', error);
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
  SDG: "Sime Darby Guthrie",
  FGV: "FGV Holdings Berhad"
};

async function fetchCompanyData(company) {
  const response = await fetch(BACKEND_URL + `/prod-data?company=${company}`);
  const result = await response.json();
  return result.data;
}

function getColor(index) {
  const colors = [
    "rgba(0, 50, 31, 1)",
    "rgba(1, 68, 34, 1)",
    "rgba(52, 95, 60, 1)",
    "rgba(127, 154, 131, 1)",
    "rgba(137, 154, 92, 1)",
    "rgba(188, 185, 138, 1)"
  ];
  return colors[index % colors.length];
}

function buildBarChart(data, companyCode) {
  const ctx = document.getElementById("prod-chart")?.getContext("2d");
  if (!ctx) return;

  const months = [...new Set(data.map(item => item.month))];
  const rawMats = [...new Set(data.map(item => item.raw_mat))];

  const datasets = rawMats.map((mat, i) => ({
    label: mat,
    data: months.map(month => {
      const item = data.find(d => d.month === month && d.raw_mat === mat);
      return item ? Number(item.volume) : 0;
    }),
    backgroundColor: getColor(i)
  }));

  if (window.prodChart) window.prodChart.destroy();

  window.prodChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: { onComplete: () => { window.prodChart.resize(); } },
      scales: {
        x: { title: { display: true, text: 'Month' }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Volume' }, grid: { display: false } }
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: { display: true, color: "black" }
      }
    }
  });
}

async function fetchPriceData(ticker) {
  const response = await fetch(BACKEND_URL + `/price-data?ticker=${ticker}`);
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
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${ticker} Closing Price`,
        data: prices,
        borderColor: 'rgba(52, 95, 60, 1)',
        backgroundColor: 'rgba(0, 50, 31, 1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: { onComplete: () => { window.priceChart.resize(); } },
      scales: {
        x: { title: { display: true, text: 'Date' }, grid: { display: false } },
        y: { title: { display: true, text: 'Price (MYR)' }, grid: { display: false } }
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: { display: true, color: "black" }
      }
    }
  });
}

async function fetchCompanyDescription(ticker) {
  const response = await fetch(BACKEND_URL + `/company-summary?ticker=${ticker}`);
  if (!response.ok) {
    console.error("Failed to fetch company description");
    return "";
  }

  let text = await response.text();

  // Remove leading and trailing quotes (", “, ”, ')
  text = text.replace(/^["“”']+|["“”']+$/g, '');

  return text;
}

async function fetchEarnings(ticker) {
  const res = await fetch(BACKEND_URL + `/company-earnings?ticker=${ticker}`);
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

  const labels = data.data.map(d => d.Quarter);
  const revenue = data.data.map(d => d["Total Revenue"]);
  const netIncome = data.data.map(d => d["Net Income"]);
  const margin = data.data.map(d => d["Operating Margin"]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Total Revenue (RM mil)", data: revenue, backgroundColor: "rgba(1, 68, 34, 0.7)", yAxisID: 'y' },
        { label: "Net Income (RM mil)", data: netIncome, backgroundColor: "rgba(137, 154, 92, 0.7)", yAxisID: 'y' },
        {
          label: "Operating Margin (%)",
          data: margin,
          type: "line",
          borderColor: "rgba(188, 185, 138, 1)",
          backgroundColor: "rgba(188, 185, 138, 1)",
          borderWidth: 2,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      stacked: false,
      plugins: { title: { display: true } },
      scales: {
        x: { grid: { display: false } },
        y: { type: 'linear', position: 'left', grid: { display: false }, title: { display: true, text: 'RM (Million)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Operating Margin (%)' } }
      }
    }
  });
}

async function fetchPlantedAreaData(company) {
  const response = await fetch(BACKEND_URL + `/plt-area?company=${company}`);
  const result = await response.json();
  return result.data;
}

function buildPlantedAreaPieChart(data, company) {
  const ctx = document.getElementById("plt-area-chart")?.getContext("2d");
  if (!ctx) return;

  const latestYear = Math.max(...data.map(d => d.Year));
  const filtered = data.filter(d => d.Year === latestYear);
  const labels = filtered.map(d => d.Category);
  const values = filtered.map(d => d.Value);
  const colors = labels.map((_, i) => getColor(i));

  if (window.plantedAreaChart) window.plantedAreaChart.destroy();

  window.plantedAreaChart = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 1 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: "black" } },
        title: { display: true, text: `${nameMap[company]} Planted Area (${latestYear})`, color: "black" }
      }
    }
  });
}

async function fetchExtractionRateData(company) {
  const response = await fetch(BACKEND_URL + `/ext-rates?company=${company}`);
  const result = await response.json();
  return result.data;
}

function buildExtractionRateChart(data, company) {
  const ctx = document.getElementById("ext-rates-chart")?.getContext("2d");
  if (!ctx) return;

  const years = [...new Set(data.map(d => d.Date))].sort();
  const categories = [...new Set(data.map(d => d.Category))];

  const datasets = categories.map((category, i) => ({
    label: category,
    data: years.map(year => {
      const item = data.find(d => d.Date === year && d.Category === category);
      return item ? Number(item.Value) : 0;
    }),
    borderColor: getColor(i),
    backgroundColor: getColor(i),
    fill: false,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6
  }));

  if (window.extractionRateChart) window.extractionRateChart.destroy();

  window.extractionRateChart = new Chart(ctx, {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Year' }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Extraction Rate (%)' }, grid: { display: false } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: 'black' } },
        title: { display: true, text: `${nameMap[company]} Extraction Rates by Year`, color: 'black' }
      }
    }
  });
}

async function buildRevenueForecastChart(data, company, prodData) {
  const ctx = document.getElementById("revenue-forecast-chart")?.getContext("2d");
  if (!ctx) return;

  // Get the latest quarter's revenue and quarter label
  const latestQuarter = data.data[data.data.length - 1];
  const latestRevenue = latestQuarter["Total Revenue"];
  const latestQuarterLabel = latestQuarter.Quarter;

  // Get the latest three months from prodData
  const months = [...new Set(prodData.map(item => item.month))].sort((a, b) => new Date(b) - new Date(a));
  const latestThreeMonths = months.slice(0, 3);

  // Sum volumes for each raw_mat over the latest three months
  const volumeSums = {
    "Fresh Fruit Bunches": 0,
    "Crude Palm Oil": 0,
    "Palm Kernel": 0,
    "Rubber": 0
  };

  prodData
  .filter(item => latestThreeMonths.includes(item.month))
  .forEach(item => {
    if (item.raw_mat.includes("Fresh Fruit Bunches")) {
      volumeSums["Fresh Fruit Bunches"] += Number(item.volume);
    } else if (["Crude Palm Oil", "Palm Kernel", "Rubber"].includes(item.raw_mat)) {
      volumeSums[item.raw_mat] += Number(item.volume);
    }
  });

  // Assign dynamic values for forecasting
  const ffbProdVol = volumeSums["Fresh Fruit Bunches"];
  const cpoProdVol = volumeSums["Crude Palm Oil"];
  const pkProdVol = volumeSums["Palm Kernel"];
  const rubberProdVol = volumeSums["Rubber"];

  // Static values for prices
  const fcpoPrice = 3000;
  const pkPrice = 2000;

  // Define company-specific formulas
  const formulas = {
    KLK: {
      intercept: 3.129,
      ffbCoef: 6.37e-6,
      cpoCoef: -7.238e-5,
      pkCoef: 2.766e-4,
      rubberCoef: 1.508e-7,
      fcpoCoef: -3.544e-4,
      pkPriceCoef: 1.069e-3,
      scale: 1000
    },
    IOI: {
      intercept: 1.062, 
      ffbCoef: 7.685e-6,
      cpoCoef: -5.236e-5, 
      pkCoef: 1.236e-4, 
      rubberCoef: -7.351e-7, 
      fcpoCoef: -1.675e-4, 
      pkPriceCoef: 1.089e-3, 
      scale: 1000
    },
    SDG: {
      intercept: 4.383, 
      ffbCoef: 4.893e-6,
      cpoCoef: -2.636e-5, 
      pkCoef: 4.647e-5, 
      rubberCoef: 0, 
      fcpoCoef: -4.38e-4, 
      pkPriceCoef: 4.555e-4, 
      scale: 1000
    }
  };

  // Select formula based on company, default to KLK if company not found
  const formula = formulas[company] || formulas.KLK;

  // Forecast revenue using the company-specific formula
  const forecastedRevenue = (
    formula.intercept +
    ffbProdVol * formula.ffbCoef +
    cpoProdVol * formula.cpoCoef +
    pkProdVol * formula.pkCoef +
    rubberProdVol * formula.rubberCoef +
    fcpoPrice * formula.fcpoCoef +
    pkPrice * formula.pkPriceCoef
  ) * formula.scale;  

  // Calculate weightages for FFB, CPO, and PK
  const ffbContribution = Math.abs(ffbProdVol * formula.ffbCoef);
  const cpoContribution = Math.abs(cpoProdVol * formula.cpoCoef);
  const pkContribution = Math.abs(pkProdVol * formula.pkCoef);
  const totalContribution = ffbContribution + cpoContribution + pkContribution;

  // Avoid division by zero
  const ffbWeightage = totalContribution > 0 ? (ffbContribution / totalContribution * 100).toFixed(1) : 0;
  const cpoWeightage = totalContribution > 0 ? (cpoContribution / totalContribution * 100).toFixed(1) : 0;
  const pkWeightage = totalContribution > 0 ? (pkContribution / totalContribution * 100).toFixed(1) : 0;

  // Update values in the HTML
  const ffbWeightElement = document.getElementById('ffb-weight');
  const cpoWeightElement = document.getElementById('cpo-weight');
  const pkWeightElement = document.getElementById('pk-weight');

  if (ffbWeightElement) ffbWeightElement.innerText = `${ffbWeightage}%`;
  else console.error('Element with ID "ffb-weight" not found');
  if (cpoWeightElement) cpoWeightElement.innerText = `${cpoWeightage}%`;
  else console.error('Element with ID "cpo-weight" not found');
  if (pkWeightElement) pkWeightElement.innerText = `${pkWeightage}%`;
  else console.error('Element with ID "pk-weight" not found');

  // Define the next quarter label (simplified assumption: increment quarter)
  const [year, q] = latestQuarterLabel.split('Q');
  const nextQuarter = parseInt(q) === 4 
    ? `${parseInt(year) + 1}Q1` 
    : `${year}Q${parseInt(q) + 1}`;

  // Destroy existing chart if it exists
  if (window.revenueForecastChart) window.revenueForecastChart.destroy();

  // Create the bar chart
  window.revenueForecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [latestQuarterLabel, nextQuarter],
      datasets: [{
        label: 'Revenue (RM mil)',
        data: [latestRevenue, forecastedRevenue],
        backgroundColor: ['rgba(1, 68, 34, 0.7)', 'rgba(128, 128, 128, 0.7)'], // Grey for forecast
        borderColor: ['rgba(1, 68, 34, 1)', 'rgba(128, 128, 128, 1)'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: 'black' } },
        title: { 
          display: true, 
          text: `${nameMap[company]} Revenue and Forecast`, 
          color: 'black',
          font: { family: 'Inter', size: 16, weight: 'bold' }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Quarter' }, 
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f' }
        },
        y: { 
          beginAtZero: true, 
          title: { display: true, text: 'Revenue (RM Million)' }, 
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f' }
        }
      }
    }
  });
}

async function initCompanyTab() {
  const selectedOption = companySelect.options[companySelect.selectedIndex];
  const [companyCode, shareCode] = selectedOption.value.split("|");

  companyTitle.textContent = nameMap[companyCode];

  const description = await fetchCompanyDescription(shareCode);
  if (companyDescriptionEl) companyDescriptionEl.textContent = description;

  const prodData = await fetchCompanyData(companyCode);
  buildBarChart(prodData, companyCode);

  const priceData = await fetchPriceData(shareCode);
  drawPriceChart(priceData, shareCode);

  const earningsData = await fetchEarnings(shareCode);
  drawEarningsChart(earningsData, shareCode);

  const areaData = await fetchPlantedAreaData(companyCode);
  buildPlantedAreaPieChart(areaData, companyCode);

  const extData = await fetchExtractionRateData(companyCode);
  buildExtractionRateChart(extData, companyCode);

  await buildRevenueForecastChart(earningsData, companyCode, prodData);
}

companySelect.addEventListener("change", async (e) => {
  const [companyCode, shareCode] = e.target.value.split("|");
  companyTitle.textContent = nameMap[companyCode];

  const description = await fetchCompanyDescription(shareCode);
  if (companyDescriptionEl) companyDescriptionEl.textContent = description;

  const prodData = await fetchCompanyData(companyCode);
  buildBarChart(prodData, companyCode);

  const priceData = await fetchPriceData(shareCode);
  drawPriceChart(priceData, shareCode);

  const earningsData = await fetchEarnings(shareCode);
  drawEarningsChart(earningsData, shareCode);

  const areaData = await fetchPlantedAreaData(companyCode);
  buildPlantedAreaPieChart(areaData, companyCode);

  const extData = await fetchExtractionRateData(companyCode);
  buildExtractionRateChart(extData, companyCode);

  await buildRevenueForecastChart(earningsData, companyCode, prodData);
});

// COMMODITIES INITIALIZATION
async function initCommodities() {
  // MPOB stats
  fetch(BACKEND_URL + "/api/mpob")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("mpobChart")?.getContext("2d");
      if (!ctx) return;

      const months = [...new Set(data.map(d => d.MONTH_YEAR))];
      const items = [...new Set(data.map(d => d.ITEMS))];
      const greenPalette = [
        "rgba(0, 50, 31, 0.7)",
        "rgba(1, 68, 34, 0.7)",
        "rgba(52, 95, 60, 0.7)",
        "rgba(127, 154, 131, 0.7)",
        "rgba(137, 154, 92, 0.7)",
        "rgba(188, 185, 138, 0.7)"
      ];

      const datasets = items.map((item, index) => ({
        label: item,
        data: months.map(month => data.find(d => d.MONTH_YEAR === month && d.ITEMS === item)?.VALUE || 0),
        backgroundColor: greenPalette[index % greenPalette.length],
        yAxisID: item === "FFB (RM)" ? "y1" : "y"
      }));

      new Chart(ctx, {
        type: "bar",
        data: { labels: months, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" }
          },
          scales: {
            x: { title: { display: true, text: "Month Year" } },
            y: { beginAtZero: true, title: { display: true, text: "Volume / Stocks / Export" }, position: "left" },
            y1: { beginAtZero: true, position: "right", title: { display: true, text: "FFB Price (RM)" }, grid: { drawOnChartArea: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching MPOB data:", error));

  // Soybean price
  async function fetchSoyPriceData() {
    const response = await fetch(BACKEND_URL + "/soy-price-data?ticker=ZL=F");
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
        datasets: [{
          label: "Soybean Oil Futures",
          data: data.prices,
          borderColor: "rgba(52, 95, 60, 0.7)",
          backgroundColor: "rgba(52, 95, 60, 0.1)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Date" }, ticks: { color: "black" }, grid: { display: false } },
          y: { title: { display: true, text: "Price (USD)" }, ticks: { color: "black" }, grid: { display: false } }
        },
        plugins: {
          legend: { labels: { color: "black" } }
        }
      }
    });
  }

  fetchSoyPriceData()
    .then(data => drawSoyPriceChart(data))
    .catch(error => console.error("Error fetching soybean price data:", error));

  // Fertilizer chart
  async function renderFertilizerChart() {
    const response = await fetch(BACKEND_URL + "/fertilizer-data");
    const data = await response.json();

    const ctx = document.getElementById("fert-chart")?.getContext("2d");
    if (!ctx) return;

    const labels = data["Month"];
    const colors = {
      "urea": "rgba(0, 50, 31, 0.7)",
      "triple-superphosphate": "rgba(52, 95, 60, 0.7)",
      "rock-phosphate": "rgba(127, 154, 131, 0.7)",
      "potassium-chloride": "rgba(188, 185, 138, 0.7)",
      "dap-fertilizer": "rgba(237, 226, 70, 0.87)"
    };

    const datasets = Object.keys(data)
      .filter(key => key !== "Month")
      .map(key => ({
        label: key.replace(/-/g, ' '),
        data: data[key],
        fill: false,
        borderColor: colors[key],
        tension: 0.3
      }));

    new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          x: { title: { display: true, text: "Month" }, grid: { display: false } },
          y: { title: { display: true, text: "Price (MYR)" }, grid: { display: false } }
        }
      }
    });
  }

  renderFertilizerChart();

  // Diesel chart
  fetch(BACKEND_URL + "/fuelprices")
    .then(response => response.json())
    .then(data => {
      const ctx = document.getElementById("diesel-chart")?.getContext("2d");
      if (!ctx) return;

      const labels = data.map(item => item.date);
      const diesel = data.map(item => parseFloat(item.diesel));
      const dieselEastMsia = data.map(item => parseFloat(item.diesel_eastmsia));

      new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Diesel (West Malaysia)", data: diesel, borderColor: "green", backgroundColor: "rgba(1,68,34,0.8)", fill: true, tension: 0.3 },
            { label: "Diesel (East Malaysia)", data: dieselEastMsia, borderColor: "darkgreen", backgroundColor: "rgba(137,154,92,0.8)", fill: true, tension: 0.3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: "Date" }, ticks: { maxRotation: 45, minRotation: 45 }, grid: { display: false } },
            y: { title: { display: true, text: "Price (RM)" }, beginAtZero: false, grid: { display: false } }
          },
          plugins: { legend: { position: "top" }, tooltip: { mode: "index", intersect: false } }
        }
      });
    })
    .catch(error => console.error("Error loading fuel price data:", error));

  // Crude oil
  fetch(BACKEND_URL + "/crude-oil-data")
    .then(response => response.json())
    .then(data => {
      const ctx = document.getElementById("crude-oil-chart")?.getContext("2d");
      if (!ctx) return;

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.dates,
          datasets: [{
            label: "Crude Oil",
            data: data.prices,
            borderColor: "#014422",
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false, labels: { font: { family: 'Inter', size: 12 }, color: '#00321f' } },
            tooltip: {
              bodyFont: { family: 'Inter', size: 12 },
              titleFont: { family: 'Inter', size: 14, weight: 'bold' }
            }
          },
          scales: {
            x: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f', autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
            y: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f' }, beginAtZero: false, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching Crude Oil data:", error));

  // Brent oil
  fetch(BACKEND_URL + "/brent-oil-data")
    .then(response => response.json())
    .then(data => {
      const ctx = document.getElementById("brent-oil-chart")?.getContext("2d");
      if (!ctx) return;

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.dates,
          datasets: [{
            label: "Brent Oil",
            data: data.prices,
            borderColor: "#014422",
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false, labels: { font: { family: 'Inter', size: 12 }, color: '#00321f' } },
            tooltip: {
              bodyFont: { family: 'Inter', size: 12 },
              titleFont: { family: 'Inter', size: 14, weight: 'bold' }
            }
          },
          scales: {
            x: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f', autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
            y: { ticks: { font: { family: 'Inter', size: 12 }, color: '#00321f' }, beginAtZero: false, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching Brent Oil data:", error));
}

// EXPORT IMPORT INITIALIZATION
let eximChart1 = null;
let eximChart2 = null;

async function initExportImport() {
  try {
    // Fetch trade data
    const tradeResponse = await fetch(BACKEND_URL + "/trade-data");
    if (!tradeResponse.ok) throw new Error(`Failed to fetch trade data: ${tradeResponse.status}`);
    const tradeData = await tradeResponse.json();

    // Debug: Log trade data sample
    console.log('Trade Data Sample (first 5 rows):', tradeData.slice(0, 5));

    // Check if vis.js is loaded
    if (typeof vis === 'undefined') {
      console.error('vis.js library is not loaded. Please ensure the vis-network script is included.');
      const container = document.getElementById("graphtheory");
      if (container) {
        container.innerHTML = '<p style="color: red; font-family: Inter, sans-serif;">Error: Unable to load trade network visualization. Please try again later.</p>';
      }
      return; // Skip graph rendering but continue with other charts
    }

    // Filter out invalid data and exclude 'World' to reduce graph size
    const validData = tradeData.filter(row => 
      row.reporterISO && row.partnerISO && 
      row.reporterISO !== 'World' && row.partnerISO !== 'World' && 
      ['X', 'M'].includes(row.reporterDesc) && 
      !isNaN(Number(row.fobvalue)) && 
      !isNaN(Number(row.refMonth))
    );

    // Extract unique years from refMonth (as numbers)
    const years = [...new Set(validData.map(row => Number(row.refMonth)))].sort((a, b) => a - b);
    const yearSlider = document.getElementById("yearSlider");
    const selectedYearEl = document.getElementById("selectedYear");
    const physicsToggle = document.getElementById("physicsToggle");
    const playButton = document.getElementById("playButton");
    
    if (!yearSlider || !selectedYearEl || years.length === 0) {
      console.error('Year slider or data missing');
      const container = document.getElementById("graphtheory");
      if (container) {
        container.innerHTML = '<p style="color: red; font-family: Inter, sans-serif;">Error: No valid years available for filtering.</p>';
      }
      return;
    }

    if (!playButton) {
      console.warn('Play button not found; animation control will be unavailable.');
    }

    // Set up slider
    yearSlider.min = 0;
    yearSlider.max = years.length - 1;
    yearSlider.value = years.length - 1; // Default to latest year
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
    validData.forEach(row => {
      if (!isoToNodeId[row.reporterISO]) isoToNodeId[row.reporterISO] = nextNodeId++;
      if (!isoToNodeId[row.partnerISO]) isoToNodeId[row.partnerISO] = nextNodeId++;
    });

    // Initialize DataSets
    const nodesDataSet = new vis.DataSet([]);
    const edgesDataSet = new vis.DataSet([]);
    const graphData = { nodes: nodesDataSet, edges: edgesDataSet };

    // Network options
    const options = {
      nodes: {
        shape: 'dot',
        font: { size: 12, face: 'Inter, sans-serif', color: '#00321f' }
      },
      edges: {
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        color: { color: '#3b3c36' },
        smooth: { type: 'continuous' },
        font: { size: 10, face: 'Inter, sans-serif', align: 'middle' }
      },
      height: '100%',
      width: '100%',
      physics: {
        enabled: physicsToggle ? physicsToggle.checked : true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -1200,
          centralGravity: 0.1,
          springLength: 150,
          springConstant: 0.03,
          damping: 0.2,
          avoidOverlap: 0.3
        },
        maxVelocity: 50,
        minVelocity: 0.1,
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25
        }
      },
      interaction: {
        dragNodes: true,
        hover: true
      }
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
      let filteredData = validData.filter(row => Number(row.refMonth) === Number(selectedYear));
      filteredData = filteredData.sort((a, b) => b.fobvalue - a.fobvalue).slice(0, 200);

      // Debug: Log filtered data sample
      console.log(`Filtered Data for ${selectedYear} (first 5 rows):`, filteredData.slice(0, 5));

      // Determine trade types for each country
      const tradeTypes = {};
      filteredData.forEach(row => {
        const reporter = row.reporterISO;
        const partner = row.partnerISO;
        if (!tradeTypes[reporter]) tradeTypes[reporter] = { hasExport: false, hasImport: false };
        if (!tradeTypes[partner]) tradeTypes[partner] = { hasExport: false, hasImport: false };
        if (row.reporterDesc === 'X') {
          tradeTypes[reporter].hasExport = true;
          tradeTypes[partner].hasImport = true;
        } else if (row.reporterDesc === 'M') {
          tradeTypes[reporter].hasImport = true;
          tradeTypes[partner].hasExport = true;
        }
      });

      // Debug: Log trade types
      console.log(`Trade Types for ${selectedYear}:`, tradeTypes);

      // Create unique nodes
      const nodeSet = new Set();
      filteredData.forEach(row => {
        nodeSet.add(row.reporterISO);
        nodeSet.add(row.partnerISO);
      });

      // Calculate node degrees
      const nodeDegrees = {};
      filteredData.forEach(row => {
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
      const newNodes = Array.from(nodeSet).map(id => {
        let backgroundColor = '#345f3c';
        if (tradeTypes[id]) {
          const { hasExport, hasImport } = tradeTypes[id];
          if (hasExport && !hasImport) backgroundColor = '#BCB98A';
          else if (!hasExport && hasImport) backgroundColor = '#345f3c';
          else if (hasExport && hasImport) backgroundColor = '#fff8dc';
        }
        const degree = nodeDegrees[id] || 0;
        let size = minSize;
        if (maxDegree > minDegree) {
          size = minSize + ((degree - minDegree) / (maxDegree - minDegree)) * (maxSize - minSize);
        } else if (degree > 0) {
          size = maxSize;
        }
        return {
          id: isoToNodeId[id],
          label: id,
          title: id,
          ...(nodePositions[id] ? { x: nodePositions[id].x, y: nodePositions[id].y } : {}),
          color: { background: backgroundColor, border: '#2e4f36' },
          size: size
        };
      });

      // Calculate total nodes and FOB value
      const totalNodes = nodeSet.size;
      const totalFobValue = filteredData.reduce((sum, row) => sum + Number(row.fobvalue), 0);

      // Update table with stats
      const totalNodesEl = document.getElementById("totalNodes");
      const totalFobValueEl = document.getElementById("totalFobValue");
      if (totalNodesEl) totalNodesEl.textContent = totalNodes;
      if (totalFobValueEl) totalFobValueEl.textContent = formatFobValue(totalFobValue);

      // Prepare new edges
      const maxFobValue = Math.max(...filteredData.map(row => row.fobvalue), 1);
      const newEdges = filteredData.map((row, index) => {
        const isExport = row.reporterDesc === 'X';
        const isImport = row.reporterDesc === 'M';
        return {
          id: `edge-${selectedYear}-${index}`,
          from: isExport ? isoToNodeId[row.reporterISO] : isImport ? isoToNodeId[row.partnerISO] : undefined,
          to: isExport ? isoToNodeId[row.partnerISO] : isImport ? isoToNodeId[row.reporterISO] : undefined,
          arrows: 'to',
          width: Math.max(1, (row.fobvalue / maxFobValue) * 10),
          title: `FOB Value: ${row.fobvalue.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' })}`,
          label: '',
          fobvalue: row.fobvalue
        };
      }).filter(edge => edge.from && edge.to);

      // Debug: Log graph details
      console.log(`Year ${selectedYear}: ${newNodes.length} nodes, ${newEdges.length} edges, Total FOB: ${totalFobValue}`);

      // Update nodes
      const currentNodeIds = nodesDataSet.getIds();
      const newNodeIds = newNodes.map(n => n.id);
      const nodesToRemove = currentNodeIds.filter(id => !newNodeIds.includes(id));
      nodesDataSet.remove(nodesToRemove);
      nodesDataSet.update(newNodes);

      // Update edges
      const currentEdgeIds = edgesDataSet.getIds();
      const newEdgeIds = newEdges.map(e => e.id);
      const edgesToRemove = currentEdgeIds.filter(id => !newEdgeIds.includes(id));
      edgesDataSet.remove(edgesToRemove);
      edgesDataSet.add(newEdges);

      // Update node positions after stabilization
      network.on('stabilized', () => {
        newNodes.forEach(node => {
          const pos = network.getPositions([node.id])[node.id];
          if (pos) {
            nodePositions[node.label] = { x: pos.x, y: pos.y };
          }
        });
        console.log(`Graph stabilized for year ${selectedYear}`);
        network.stopSimulation();
      });

      // Force stop physics after 1 second
      setTimeout(() => {
        if (network) {
          network.stopSimulation();
          console.log(`Physics stopped for year ${selectedYear} after timeout`);
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
        if (playButton) playButton.textContent = '▶️ Play';
        console.log('Animation stopped');
      } else {
        isPlaying = true;
        if (playButton) playButton.textContent = '⏸️ Pause';
        let currentIndex = parseInt(yearSlider.value);
        animationInterval = setInterval(() => {
          currentIndex = (currentIndex + 1) % years.length; // Loop back to start
          yearSlider.value = currentIndex;
          selectedYearEl.textContent = years[currentIndex];
          renderGraphAndTable(years[currentIndex]);
        }, 1500); // 1 second per year
        console.log('Animation started');
      }
    };

    // Play button event listener
    if (playButton) {
      playButton.addEventListener('click', toggleAnimation);
    }

    // Debounced slider event listener
    const debouncedRender = debounce((selectedIndex) => {
      if (isPlaying) {
        toggleAnimation(); // Stop animation on manual slider interaction
      }
      selectedYearEl.textContent = years[selectedIndex];
      renderGraphAndTable(years[selectedIndex]);
    }, 100);

    yearSlider.addEventListener('input', () => {
      const selectedIndex = parseInt(yearSlider.value);
      debouncedRender(selectedIndex);
    });

    // Physics toggle event listener
    if (physicsToggle) {
      physicsToggle.addEventListener('change', () => {
        if (network) {
          network.setOptions({ physics: { enabled: physicsToggle.checked } });
          if (!physicsToggle.checked) {
            network.stopSimulation();
            console.log('Physics disabled via toggle');
          } else {
            console.log('Physics enabled via toggle');
          }
        }
      });
    } else {
      console.warn('Physics toggle not found; defaulting to static graph');
    }

    // Hover edge events
    network.on('hoverEdge', (event) => {
      const edgeId = event.edge;
      const edge = edgesDataSet.get(edgeId);
      if (edge && edge.fobvalue !== undefined) {
        edgesDataSet.update({
          id: edgeId,
          label: formatFobValue(edge.fobvalue),
          font: { color: '#000', strokeWidth: 0, align: 'top' }
        });
      }
    });

    network.on('blurEdge', (event) => {
      const edgeId = event.edge;
      edgesDataSet.update({
        id: edgeId,
        label: '',
        font: { color: 'rgba(0,0,0,0)', strokeWidth: 0 }
      });
    });

    // Debug: Log drag events
    network.on('dragEnd', () => {
      console.log('Node dragged, physics should respond with bounce');
    });

    // Existing export/import charts
    // Existing export/import charts
    const res = await fetch(BACKEND_URL + "/exim-data");
    if (!res.ok) throw new Error(`Failed to fetch exim data: ${res.status}`);
    const chartData = await res.json();

    const labels = chartData.date;
    const animal_exports = chartData.exports_Animal_Vegetable_Oils_Fats_and_Waxes;
    const animal_imports = chartData.imports_Animal_Vegetable_Oils_Fats_and_Waxes;
    const animal_net = animal_exports.map((val, i) => val - animal_imports[i]);
    const chemical_exports = chartData.exports_Chemical_and_Related_Products_NEC;
    const chemical_imports = chartData.imports_Chemical_and_Related_Products_NEC;
    const chemical_net = chemical_exports.map((val, i) => val - chemical_imports[i]);

    const ctx1 = document.getElementById("4th-chart")?.getContext("2d");
    if (!ctx1) throw new Error("4th-chart canvas context not found");

    if (eximChart1) eximChart1.destroy();

    eximChart1 = new Chart(ctx1, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Net Trade", // Base label for dataset
            data: animal_net,
            backgroundColor: animal_net.map(v => v >= 0 ? "rgba(75, 192, 192, 0.5)" : "rgba(255, 99, 132, 0.5)"),
            borderColor: animal_net.map(v => v >= 0 ? "rgba(75, 192, 192, 1)" : "rgba(255, 99, 132, 1)"),
            borderWidth: 1,
            type: 'bar',
            yAxisID: 'y'
          },
          {
            label: "Exports",
            data: animal_exports,
            borderColor: "rgba(1,68,34,0.8)",
            backgroundColor: "rgba(1,68,34,0.1)",
            type: "line",
            yAxisID: 'y'
          },
          {
            label: "Imports",
            data: animal_imports,
            borderColor: "rgba(137,154,92,0.8)",
            backgroundColor: "rgba(137,154,92,0.1)",
            type: "line",
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              generateLabels: function(chart) {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, i) => {
                  if (dataset.label === "Net Trade") {
                    // Check the first non-zero data point to determine label
                    const netValue = dataset.data.find(v => v !== 0) || 0;
                    return {
                      text: netValue >= 0 ? "Net Export" : "Net Import",
                      fillStyle: dataset.backgroundColor[0],
                      strokeStyle: dataset.borderColor[0],
                      lineWidth: dataset.borderWidth,
                      hidden: !chart.isDatasetVisible(i),
                      datasetIndex: i
                    };
                  }
                  return {
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i
                  };
                });
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Date" }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "Value (RM)" }, grid: { display: false } }
        }
      }
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
            label: "Net Trade", // Base label for dataset
            data: chemical_net,
            backgroundColor: chemical_net.map(v => v >= 0 ? "rgba(153, 102, 255, 0.5)" : "rgba(255, 159, 64, 0.5)"),
            borderColor: chemical_net.map(v => v >= 0 ? "rgba(153, 102, 255, 1)" : "rgba(255, 159, 64, 1)"),
            borderWidth: 1,
            type: 'bar',
            yAxisID: 'y'
          },
          {
            label: "Exports",
            data: chemical_exports,
            borderColor: "rgba(1,68,34,0.8)",
            backgroundColor: "rgba(1,68,34,0.1)",
            type: "line",
            yAxisID: 'y'
          },
          {
            label: "Imports",
            data: chemical_imports,
            borderColor: "rgba(137,154,92,0.8)",
            backgroundColor: "rgba(137,154,92,0.1)",
            type: "line",
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              generateLabels: function(chart) {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, i) => {
                  if (dataset.label === "Net Trade") {
                    // Check the first non-zero data point to determine label
                    const netValue = dataset.data.find(v => v !== 0) || 0;
                    return {
                      text: netValue >= 0 ? "Net Export" : "Net Import",
                      fillStyle: dataset.backgroundColor[0],
                      strokeStyle: dataset.borderColor[0],
                      lineWidth: dataset.borderWidth,
                      hidden: !chart.isDatasetVisible(i),
                      datasetIndex: i
                    };
                  }
                  return {
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i
                  };
                });
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Date" }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "Value (RM)" }, grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error("Error initializing Export Import charts:", error);
  }
}

// MPOB INITIALIZATION
let map;
let rspolayer, oplayer, millslayer, rfrlayer, cfrlayer, drrlayer;

async function initMpobStats() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  map = L.map("map").setView([4.310756684156521, 108.3481479634814], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: 'Map data © OpenStreetMap contributors'
  }).addTo(map);

  fetch(BACKEND_URL + "/rsposhapefile")
    .then(res => res.json())
    .then(geojson => {
      rspolayer = L.geoJSON(geojson, {
        style: { color: "green", weight: 1.5, opacity: 0.7, fillOpacity: 0.3 },
        onEachFeature: function(feature, layer) {
          const company = feature.properties.company || "N/A";
          const plantation = feature.properties.plantation || "N/A";
          const tooltipContent = `<b>Company:</b> ${company}<br><b>Plantation:</b> ${plantation}`;
          layer.bindTooltip(tooltipContent, { permanent: false, direction: "top", className: "leaflet-tooltip" });
        }
      });
      rspolayer.addTo(map);
      addLayerControl();
    })
    .catch(error => console.error("Error fetching RSPO shapefile:", error));

  fetch(BACKEND_URL + "/opshapefile")
    .then(res => res.json())
    .then(geojson => {
      oplayer = L.geoJSON(geojson, {
        style: { color: "blue", weight: 1.5, opacity: 0.7, fillOpacity: 0.3 },
        onEachFeature: function(feature, layer) {
          const company = feature.properties.company || "N/A";
          const name = feature.properties.name || "N/A";
          const tooltipContent = `<b>Company:</b> ${company}<br><b>Name:</b> ${name}`;
          layer.bindTooltip(tooltipContent, { permanent: false, direction: "top", className: "leaflet-tooltip" });
        }
      });
      oplayer.addTo(map);
      addLayerControl();
    })
    .catch(error => console.error("Error fetching OP shapefile:", error));

  fetch(BACKEND_URL + "/mills")
    .then(res => res.json())
    .then(geojson => {
      millslayer = L.geoJSON(geojson, {
        pointToLayer: function(feature, latlng) {
          return L.circleMarker(latlng, { radius: 1, fillColor: "black", color: "#000", weight: 0.8, opacity: 1, fillOpacity: 0.8 });
        },
        onEachFeature: function(feature, layer) {
          const name = feature.properties.Mill_Name || "Unknown";
          const company = feature.properties.Parent_Com || "Unknown";
          layer.bindTooltip(`<b>Mill:</b> ${name}<br><b>Company:</b> ${company}`);
        }
      });
      millslayer.addTo(map);
      addLayerControl();
    })
    .catch(error => console.error("Error fetching mills data:", error));

  fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
        switch (label) {
          case "No Data": return "#999999";
          case "Low (0 to 1 in 1,000)": return "#ffff99";
          case "Low - Medium (1 in 1,000 to 2 in 1,000)": return "#ffcc33";
          case "Medium - High (2 in 1,000 to 6 in 1,000)": return "#ff6600";
          case "High (6 in 1,000 to 1 in 100)": return "#ff3300";
          case "Extremely High (more than 1 in 100)": return "#cc0000";
          default: return "#cccccc";
        }
      }
      rfrlayer = L.geoJSON(geojson, {
        style: function(feature) {
          const label = feature.properties.rfr_label || "N/A";
          return { color: getColor(label), weight: 1.5, opacity: 0.5, fillOpacity: 0.3, fillColor: getColor(label) };
        },
        onEachFeature: function(feature, layer) {
          const label = feature.properties.rfr_label || "N/A";
          const tooltipContent = `<b>Riverine Flood Risk Label:</b> ${label}`;
          layer.bindTooltip(tooltipContent, { permanent: false, direction: "top", className: "leaflet-tooltip" });
        }
      });
      addLayerControl();
    })
    .catch(error => console.error("Error fetching riverine flood risk data:", error));

  fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
        switch (label) {
          case "No Risk": return "#00cc66";
          case "Low (0 to 9 in 1,000,000)": return "#ccff33";
          case "Low - Medium (9 in 1,000,000 to 7 in 100,000)": return "#ffff66";
          case "Medium - High (7 in 100,000 to 3 in 10,000)": return "#ffcc00";
          case "High (3 in 10,000 to 2 in 1,000)": return "#ff6600";
          case "Extremely High (more than 2 in 1,000)": return "#cc0000";
          case "No Data": return "#999999";
          default: return "#999999";
        }
      }
      cfrlayer = L.geoJSON(geojson, {
        style: function(feature) {
          const label = feature.properties.cfr_label || "N/A";
          return { color: getColor(label), weight: 1.5, opacity: 0.5, fillOpacity: 0.3, fillColor: getColor(label) };
        },
        onEachFeature: function(feature, layer) {
          const label = feature.properties.cfr_label || "N/A";
          const tooltipContent = `<b>Coastal Flood Risk Label:</b> ${label}`;
          layer.bindTooltip(tooltipContent, { permanent: false, direction: "top", className: "leaflet-tooltip" });
        }
      });
      addLayerControl();
    })
    .catch(error => console.error("Error fetching coastal flood risk data:", error));

  fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
        switch (label) {
          case "Medium (0.4-0.6)": return "#FFD700";
          case "Medium - High (0.6-0.8)": return "#FFA500";
          case "High (0.8-1.0)": return "#FF4500";
          case "No Data": return "#D3D3D3";
          default: return "#D3D3D3";
        }
      }
      drrlayer = L.geoJSON(geojson, {
        style: function(feature) {
          const label = feature.properties.drr_label || "N/A";
          return { color: getColor(label), weight: 1.5, opacity: 0.5, fillOpacity: 0.3, fillColor: getColor(label) };
        },
        onEachFeature: function(feature, layer) {
          const label = feature.properties.drr_label || "N/A";
          const tooltipContent = `<b>Drought Risk Label:</b> ${label}`;
          layer.bindTooltip(tooltipContent, { permanent: false, direction: "top", className: "leaflet-tooltip" });
        }
      });
      addLayerControl();
    })
    .catch(error => console.error("Error fetching drought risk data:", error));

  fetch(BACKEND_URL + "/weather_stations")
    .then(res => res.json())
    .then(stationData => {
      stationData.forEach(station => {
        const lat = station.Latitude;
        const lon = station.Longitude;
        const name = station.location_name;
        const forecast = station.forecast_with_dates;
        const crossIcon = L.divIcon({
          className: 'custom-cross-icon',
          html: '<div style="color: yellow; font-weight: bold; font-size: 18px;">+</div>',
          iconSize: [15, 15],
          iconAnchor: [5, 5]
        });
        const marker = L.marker([lat, lon], { icon: crossIcon });
        const tooltipContent = `<b>${name}</b><br><div style="font-size: 12px;">${forecast}</div>`;
        marker.bindTooltip(tooltipContent, { direction: 'top', permanent: false, className: 'leaflet-tooltip', sticky: true });
        marker.addTo(map);
      });
    })
    .catch(error => console.error("Error fetching weather stations:", error));

  function addLayerControl() {
    if (rspolayer && oplayer && millslayer && rfrlayer && cfrlayer && drrlayer && !map.layerControlAdded) {
      rspolayer.addTo(map);
      oplayer.addTo(map);
      millslayer.addTo(map);
      const overlayMaps = {
        "RSPO Plantation": rspolayer,
        "Oil Palm Concessions": oplayer,
        "Mills": millslayer,
        "Riverine flood risk": rfrlayer,
        "Coastal flood risk": cfrlayer,
        "Drought risk": drrlayer
      };
      L.control.layers(null, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);
      map.layerControlAdded = true;
    }
  }

  // Weather slider
  async function fetchWeatherData() {
    try {
      const response = await fetch(BACKEND_URL + '/weather_forecast_summary');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.map(item => ({
        date: item.date,
        TiadaHujan: item['Tiada Hujan'] || 0,
        Berangin: item.Berangin || 0,
        Hujan: item.Hujan || 0,
        RibutPetir: item['Ribut Petir'] || 0
      }));
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return [];
    }
  }

  async function initializeWeatherSlider() {
    const weatherData = await fetchWeatherData();
    const slider = document.getElementById('date-slider');
    const dateDisplay = document.getElementById('selected-date');
    if (!slider || !dateDisplay || weatherData.length === 0) {
      console.error('Weather slider elements or data missing');
      return;
    }

    slider.max = weatherData.length - 1;

    function updateDisplay(selectedIndex) {
      const selectedData = weatherData[selectedIndex];
      dateDisplay.textContent = selectedData.date.split('T')[0];
      document.getElementById('tiada-hujan-value').textContent = selectedData.TiadaHujan || 0;
      document.getElementById('berangin-value').textContent = selectedData.Berangin || 0;
      document.getElementById('hujan-value').textContent = selectedData.Hujan || 0;
      document.getElementById('ribut-petir-value').textContent = selectedData.RibutPetir || 0;
    }

    updateDisplay(0);
    slider.addEventListener('input', function() {
      updateDisplay(parseInt(this.value));
    });
  }

  initializeWeatherSlider();

  // CFR bar chart
  fetch(BACKEND_URL + "/cfr-bar-top6")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("cfr-bar-chart")?.getContext("2d");
      if (!ctx) return;

      new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: data.datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Major Plantation Companies with Coastal Flood Risks Composition' }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { beginAtZero: true, stacked: true, title: { display: true, text: 'Count' }, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching CFR bar chart data:", error));

  // RFR bar chart
  fetch(BACKEND_URL + "/rfr-bar-top6")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("rfr-bar-chart")?.getContext("2d");
      if (!ctx) return;

      new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: data.datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Major Plantation Companies with Riverine Flood Risks Composition' }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { beginAtZero: true, stacked: true, title: { display: true, text: 'Count' }, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching RFR bar chart data:", error));

  // DRR bar chart
  fetch(BACKEND_URL + "/drr-bar-top6")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("drr-bar-chart")?.getContext("2d");
      if (!ctx) return;

      new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: data.datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Major Plantation Companies with Drought Risks Composition' }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { beginAtZero: true, stacked: true, title: { display: true, text: 'Count' }, grid: { display: false } }
          }
        }
      });
    })
    .catch(error => console.error("Error fetching DRR bar chart data:", error));
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
  tabContents.forEach(section => {
    section.classList.toggle("hidden", section.id !== tabId);
  });

  tabs.forEach(tab => {
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
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  } else if (tabId === "mpobstats" && map) {
    setTimeout(() => { map.invalidateSize(); }, 100);
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(tab.dataset.tab);
  });
});

// Initialize mainpage by default
showTab("mainpage");