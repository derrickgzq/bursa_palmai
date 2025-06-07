//STARTING OF JAVASCRIPT FROM HERE
//define backend url
const BACKEND_URL = "https://bursa-palmai.onrender.com"
//const BACKEND_URL = "http://localhost:8000" //---> commented, only uncomment when doing development

// MAINPAGE
// treemap market cap
anychart.onDocumentReady(function() {
  // Fetch data from API endpoint
  fetch(BACKEND_URL + '/marketcap-data')
    .then(response => response.json())
    .then(apiData => {
      // Transform API data to the requested format
      var data = [
        { 
          id: "root", 
          name: "Market Cap", 
          children: apiData.map(company => ({
            id: company.company,
            name: company.company,
            value: company.market_cap_billion
          }))
        }
      ];

      // Calculate total market cap
      var total = data[0].children.reduce((sum, company) => sum + company.value, 0);

      // Create and configure chart
      var chart = anychart.treeMap(data);

      chart.colorScale().ranges([
        { less: 1, color: '#bcb98a' },   // Very light green
        { from: 1, to: 5, color: '#899a5c' },  // Light green
        { from: 5, to: 20, color: '#5a7e67' }, // Medium green
        { greater: 20, color: '#4a6854' }      // Dark green
      ]);

      // Visual settings
      chart.title("Plantation Sector Market Cap (RM " + total.toFixed(2) + "Billion)");
      chart.title()
        .fontSize(14)
        .padding(10)
        .fontColor('#00321f')  // Dark green-ish color
        .fontWeight('bold')
        .fontFamily('Inter')
        .hAlign('left');

      // Tooltip configuration
      chart.tooltip()
        .format("{%name}: {%value}B MYR")
        .fontSize(12)
        .fontFamily('Inter');

      // Labels font for treemap nodes
      chart.labels()
        .fontFamily('Inter')
        .fontSize(12)
        .fontColor('#00321f');

      // Clear loading message and render
      chart.container("treemap");
      chart.draw();
    });
});

//klci chart
fetch(BACKEND_URL + "/klci-data")
  .then(response => response.json())
  .then(data => {
    const ctx = document.getElementById("klciChart").getContext("2d");

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
          legend: {
            labels: {
              font: {
                family: 'Inter',
                size: 12
              },
              color: '#00321f'
            },
            display: false
          },
          title: {
            display: true,
            text: 'Kuala Lumpur Composite Index (KLCI), Last 30 days',
            color: '#00321f',
            font: {
              family: 'Inter',
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          tooltip: {
            bodyFont: {
              family: 'Inter',
              size: 12
            },
            titleFont: {
              family: 'Inter',
              size: 14,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: {
                family: 'Inter',
                size: 12
              },
              color: '#00321f',
              autoSkip: true,
              maxTicksLimit: 15
            },
            grid: {
              display: false
            }
          },
          y: {
            ticks: {
              font: {
                family: 'Inter',
                size: 12
              },
              color: '#00321f'
            },
            beginAtZero: false,
            grid: {
              display: false
            }
          }
        }
      }
    });
  })
  .catch(error => console.error("Error fetching KLCI data:", error));

//Latest share price
fetch(BACKEND_URL + "/api/share-prices")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("scoreCards");
    container.innerHTML = "";

    data.forEach((item, index) => {
      const arrowUp = '<span class="text-green-600">▲</span>';
      const arrowDown = '<span class="text-red-600">▼</span>';
      const arrow = item.change > 0 ? arrowUp : item.change < 0 ? arrowDown : "";
      const color = item.change > 0 ? "text-green-600" : item.change < 0 ? "text-red-600" : "text-gray-600";

      const card = `
        <div class="bg-white p-4 rounded-lg shadow text-center">
          <h3 class="text-sm font-semibold text-gray-600">${item.symbol}</h3>
          <p class="text-2xl font-bold text-green-700">RM ${item.price}</p>
          <p class="text-sm ${color}">
            ${arrow} ${item.percent}% (${item.change})
          </p>
        </div>
      `;
      container.innerHTML += card;
    });
  });

//news cards
async function loadNews() {
  try {
    const response = await fetch(BACKEND_URL + '/api/news');
    const data = await response.json();
    const newsCardsContainer = document.getElementById('newsCards');
    newsCardsContainer.innerHTML = '';  // Clear any existing cards

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

window.addEventListener('DOMContentLoaded', loadNews);

// MAINPAGE

// COMPANY
const companySelect = document.getElementById("company-select");
const companyTitle = document.getElementById("company-title");
const companyDescriptionEl = document.getElementById("company-description"); // Make sure this exists

const nameMap = {
  KLK: "Kuala Lumpur Kepong Berhad",
  IOI: "IOI Corporation Berhad",
  SDG: "Sime Darby Guthrie",
  FGV: "FGV Holdings Berhad"
};

// Production Data
async function fetchCompanyData(company) {
  const response = await fetch(BACKEND_URL + `/prod-data?company=${company}`);
  const result = await response.json();
  return result.data;
}

function getColor(index) {
  const colors = [
    "rgba(0, 50, 31, 0.7)",
    "rgba(1, 68, 34, 0.7)",
    "rgba(52, 95, 60, 0.7)",
    "rgba(127, 154, 131, 0.7)",
    "rgba(137, 154, 92, 0.7)",
    "rgba(188, 185, 138, 0.7)"
  ];
  return colors[index % colors.length];
}

function buildBarChart(data, companyCode) {
  const ctx = document.getElementById("prod-chart").getContext("2d");
  const months = [...new Set(data.map(item => item.month))];
  const rawMats = [...new Set(data.map(item => item.raw_mat))];

  const datasets = rawMats.map((mat, i) => ({
    label: mat,
    data: months.map(month => {
      const item = data.find(d => d.month === month && d.raw_mat === mat);
      return item ? Number(item.volume) : 0;
    }),
    backgroundColor: getColor(i),
  }));

  if (window.prodChart) window.prodChart.destroy();

  window.prodChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: {
        onComplete: () => {
          window.prodChart.resize();
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Month' },
          grid: { display: false } 
        },
        y: { 
          beginAtZero: true, 
          title: { display: true, text: 'Volume' },
          grid: { display: false } 
        }
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: {
          display: true,
          text: `${nameMap[companyCode]} Monthly Production by Raw Material`,
          color: "black"
        }
      }
    }
  });
}

// Share Price Data
async function fetchPriceData(ticker) {
  const response = await fetch(BACKEND_URL + `/price-data?ticker=${ticker}`);
  const result = await response.json();
  return result;
}

function drawPriceChart(data, ticker) {
  const ctx = document.getElementById("price-chart").getContext("2d");
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
        borderColor: 'rgba(52, 95, 60, 0.7)', 
        backgroundColor: 'rgba(0, 50, 31, 0.7)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      animation: {
        onComplete: () => {
          window.priceChart.resize();
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Date' },
          grid: { display: false } 
        },
        y: { 
          title: { display: true, text: 'Price (MYR)' },
          grid: { display: false } 
        }
      },
      plugins: {
        legend: { labels: { color: "black" } },
        title: { 
          display: true, 
          text: `Share Price for ${ticker}`,
          color: "black"
        }
      }
    }
  });
}

// Company description data
async function fetchCompanyDescription(ticker) {
  const response = await fetch(BACKEND_URL + `/company-summary?ticker=${ticker}`);
  if (!response.ok) {
    console.error("Failed to fetch company description");
    return "";
  }
  return await response.text();
}

// company earnings data
async function fetchEarnings(ticker) {
  const res = await fetch(BACKEND_URL + `/company-earnings?ticker=${ticker}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch earnings for ${ticker}`);
  }
  const json = await res.json();
  return json;
}

let chartInstance = null;  // Declare globally or in module scope

function drawEarningsChart(data) {
  const labels = data.data.map(d => d.Quarter);
  const revenue = data.data.map(d => d["Total Revenue"]);
  const netIncome = data.data.map(d => d["Net Income"]);
  const margin = data.data.map(d => d["Operating Margin"]);

  const ctx = document.getElementById("earnings-chart").getContext("2d");

  // Destroy previous chart instance to avoid overlap
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Revenue (RM mil)",
          data: revenue,
          backgroundColor: "rgba(1, 68, 34, 0.7)",
          yAxisID: 'y',
        },
        {
          label: "Net Income (RM mil)",
          data: netIncome,
          backgroundColor: "rgba(137, 154, 92, 0.7)",
          yAxisID: 'y',
        },
        {
          label: "Operating Margin (%)",
          data: margin,
          type: "line",
          borderColor: "rgba(188, 185, 138, 1)",
          backgroundColor: "rgba(188, 185, 138, 0.2)",
          borderWidth: 2,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      stacked: false,
      plugins: {
        title: {
          display: true,
          text: `Quarterly Earnings – ${data.company}`
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'RM (Million)'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          title: {
            display: true,
            text: 'Operating Margin (%)'
          }
        }
      }
    }
  });
}

//Plantation area chart
// Utility to get colors
function getColor(index) {
  const colors = [
    "rgba(1, 68, 34, 0.7)",
    "rgba(127, 154, 131, 0.7)",
    "rgba(188, 185, 138, 0.7)"
  ];
  return colors[index % colors.length];
}

// Fetch planted area data
async function fetchPlantedAreaData(company) {
  const response = await fetch(BACKEND_URL + `/plt-area?company=${company}`);
  const result = await response.json();
  return result.data;
}

// Build pie chart for the latest year
function buildPlantedAreaPieChart(data, company) {
  const ctx = document.getElementById("plt-area-chart").getContext("2d");

  // Extract latest year
  const latestYear = Math.max(...data.map(d => d.Year));
  const filtered = data.filter(d => d.Year === latestYear);

  const labels = filtered.map(d => d.Category);
  const values = filtered.map(d => d.Value);
  const colors = labels.map((_, i) => getColor(i));

  // Destroy old chart
  if (window.plantedAreaChart) window.plantedAreaChart.destroy();

  // Create new chart
  window.plantedAreaChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "#fff",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: "black" }
        },
        title: {
          display: true,
          text: `${nameMap[company]} Planted Area (${latestYear})`,
          color: "black"
        }
      }
    }
  });
}
//Oil extraction rates chart
// Fetch extraction rate data
async function fetchExtractionRateData(company) {
  const response = await fetch(BACKEND_URL + `/ext-rates?company=${company}`);
  const result = await response.json();
  return result.data;
}

// Build extraction rate bar chart
function buildExtractionRateChart(data, company) {
  const ctx = document.getElementById("ext-rates-chart").getContext("2d");

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
    pointHoverRadius: 6,
  }));

  if (window.extractionRateChart) window.extractionRateChart.destroy();

  window.extractionRateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Year' },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Extraction Rate (%)' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'black' }
        },
        title: {
          display: true,
          text: `${nameMap[company]} Extraction Rates by Year`,
          color: 'black'
        }
      }
    }
  });
}

// When dropdown changes
companySelect.addEventListener("change", async (e) => {
  const [companyCode, shareCode] = e.target.value.split("|");

  // Update title
  companyTitle.textContent = nameMap[companyCode];

  // Fetch and update description
  const description = await fetchCompanyDescription(shareCode);
  if (companyDescriptionEl) {
    companyDescriptionEl.textContent = description;
  }

  // Fetch and rebuild charts
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
});

// Initialize first load
async function initCompanyTab() {
  const selectedOption = companySelect.options[companySelect.selectedIndex];
  const [companyCode, shareCode] = selectedOption.value.split("|");

  companyTitle.textContent = nameMap[companyCode];

  const description = await fetchCompanyDescription(shareCode);
  if (companyDescriptionEl) {
    companyDescriptionEl.textContent = description;
  }

  const prodData = await fetchCompanyData(companyCode);
  buildBarChart(prodData, companyCode);

  const priceData = await fetchPriceData(shareCode);
  drawPriceChart(priceData, shareCode);

  const earningsData = await fetchEarnings(shareCode);
  setTimeout(() => {
    drawEarningsChart(earningsData, shareCode);
  }, 100); 

  const areaData = await fetchPlantedAreaData(companyCode);
  buildPlantedAreaPieChart(areaData, companyCode);

  const extData = await fetchExtractionRateData(companyCode);
  buildExtractionRateChart(extData, companyCode);
}

// Tab click handler - no longer needed for resizing, but kept for initialization
document.querySelector("[data-tab='company']").addEventListener("click", initCompanyTab);

// Initialize on page load
document.addEventListener("DOMContentLoaded", initCompanyTab);
//COMPANY

//SIDEBAR
  // Tab switching logic
  const tabs = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  function showTab(tabId) {
    tabContents.forEach(section => {
      section.classList.toggle("hidden", section.id !== tabId);
    });

    tabs.forEach(tab => {
      tab.classList.toggle("font-semibold", tab.dataset.tab === tabId);
      tab.classList.toggle("text-green-600", tab.dataset.tab === tabId);
      tab.classList.toggle("dark:text-green-400", tab.dataset.tab === tabId);
    });

    if (tabId === "mainpage") {
    initMainpage(); // Initialize heatmap when mainpage tab is shown
  } else if (tabId === "company") {
    const [companyCode, shareCode] = companySelect.value.split("|");
    companyTitle.textContent = nameMap[companyCode];

    fetchCompanyData(companyCode).then(data => buildBarChart(data, companyCode));
    fetchPriceData(shareCode).then(data => drawPriceChart(data, shareCode));
    fetchEarnings(shareCode).then(data => drawEarningsChart(data, shareCode));
  } else if (tabId === "mpobstats" && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}
//SIDEBAR

//COMMODITIES
  //soybean price
  async function fetchSoyPriceData() {
    const response = await fetch(BACKEND_URL + "/soy-price-data?ticker=ZL=F");
    const result = await response.json();
    return result;
  }

  function drawSoyPriceChart(data) {
    const ctx = document.getElementById("soy-price-chart").getContext("2d");

    if (window.soyChart) window.soyChart.destroy();

    window.soyChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.dates,
        datasets: [{
          label: "Soybean Oil Futures (ZL=F)",
          data: data.prices,
          borderColor: "rgba(52, 95, 60, 0.7)",       // blue
          backgroundColor: "rgba(52, 95, 60, 0.1)",  // light fill
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: { color: "black" },
            grid: { display: false } 
          },
          y: {
            title: { display: true, text: "Price (USD)" },
            ticks: { color: "black" },
            grid: { display: false } 
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "black"
            }
          },
          title: {
            display: true,
            text: "Soybean Oil Futures (Last 6 Months)",
            color: "rgba(52, 95, 60, 0.7)",
            font: { size: 18 }
          }
        }
      }
    });
  }

  // Optional: Only render the chart when the 'commodities' tab is opened
  document.querySelectorAll(".tab-link").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const tabId = tab.dataset.tab;
      if (tabId === "commodities") {
        fetchSoyPriceData().then(data => drawSoyPriceChart(data));
      }
    });
  });

  async function renderFertilizerChart() {
    const response = await fetch(BACKEND_URL + "/fertilizer-data"); // Update URL if needed
    const data = await response.json();

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

    new Chart(document.getElementById("fert-chart"), {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: "Fertilizer Prices (MYR)",
            font: { size: 18 }
          },
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Month" },
            grid: { display: false } 
          },
          y: {
            title: { display: true, text: "Price (MYR)" },
            grid: { display: false } 
          }
        }
      }
    });
  }

  // Call this on page load or tab click
  renderFertilizerChart();

//diesel chart
fetch(BACKEND_URL + "/fuelprices")
  .then(response => response.json())
  .then(data => {
    // Extract data for chart
    const labels = data.map(item => item.date);
    const diesel = data.map(item => parseFloat(item.diesel));
    const dieselEastMsia = data.map(item => parseFloat(item.diesel_eastmsia));

    const ctx = document.getElementById("diesel-chart").getContext("2d");

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Diesel (West Malaysia)",
            data: diesel,
            borderColor: "green",
            backgroundColor: "rgba(1,68,34,0.8)",
            fill: true,
            tension: 0.3,
          },
          {
            label: "Diesel (East Malaysia)",
            data: dieselEastMsia,
            borderColor: "darkgreen",
            backgroundColor: "rgba(137,154,92,0.8)",
            fill: true,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: { display: true, text: "Date" },
            ticks: { maxRotation: 45, minRotation: 45 }
          },
          y: {
            title: { display: true, text: "Price (RM)" },
            beginAtZero: false
          }
        },
        plugins: {
          legend: { position: "top" },
          tooltip: { mode: "index", intersect: false }
        },
      }
    });
  })
  .catch(error => console.error("Error loading fuel price data:", error));
//COMMODITIES

//EXPORT IMPORT
  async function loadEXIMData() {
      const res = await fetch(BACKEND_URL + "/exim-data");
      const data = await res.json();

      const labels = data.date;

      const animal_exports = data.exports_Animal_Vegetable_Oils_Fats_and_Waxes;
      const animal_imports = data.imports_Animal_Vegetable_Oils_Fats_and_Waxes;
      const animal_net = animal_exports.map((val, i) => val - animal_imports[i]);

      const chemical_exports = data.exports_Chemical_and_Related_Products_NEC;
      const chemical_imports = data.imports_Chemical_and_Related_Products_NEC;
      const chemical_net = chemical_exports.map((val, i) => val - chemical_imports[i]);

      // Create chart for Animal Section
      new Chart(document.getElementById("4th-chart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Net Export",
              data: animal_net,
              backgroundColor: animal_net.map(v => v >= 0 ? "rgba(75, 192, 192, 0.5)" : "rgba(255, 99, 132, 0.5)"),
              borderColor: animal_net.map(v => v >= 0 ? "rgba(75, 192, 192, 1)" : "rgba(255, 99, 132, 1)"),
              borderWidth: 1,
              type: 'bar',
              yAxisID: 'y',
            },
            {
              label: "Exports",
              data: animal_exports,
              borderColor: "rgba(1,68,34,0.8)",
              backgroundColor: "rgba(1,68,34,0.1)",
              type: "line",
              yAxisID: 'y',
            },
            {
              label: "Imports",
              data: animal_imports,
              borderColor: "rgba(137,154,92,0.8)",
              backgroundColor: "rgba(137,154,92,0.1)",
              type: "line",
              yAxisID: 'y',
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });

      // Create chart for Chemical Section
      new Chart(document.getElementById("5th-chart"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Net Export",
              data: chemical_net,
              backgroundColor: chemical_net.map(v => v >= 0 ? "rgba(153, 102, 255, 0.5)" : "rgba(255, 159, 64, 0.5)"),
              borderColor: chemical_net.map(v => v >= 0 ? "rgba(153, 102, 255, 1)" : "rgba(255, 159, 64, 1)"),
              borderWidth: 1,
              type: 'bar',
              yAxisID: 'y',
            },
            {
              label: "Exports",
              data: chemical_exports,
              borderColor: "rgba(1,68,34,0.8)",
              backgroundColor: "rgba(1,68,34,0.1)",
              type: "line",
              yAxisID: 'y',
            },
            {
              label: "Imports",
              data: chemical_imports,
              borderColor: "rgba(137,154,92,0.8)",
              backgroundColor: "rgba(137,154,92,0.1)",
              type: "line",
              yAxisID: 'y',
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

  loadEXIMData();
//EXPORT IMPORT

//MPOB
let map; // Make it global so we can call invalidateSize later
let rspolayer, oplayer, millslayer, rfrlayer, cfrlayer, drrlayer; // To store the polygon layer

document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = document.getElementById("map");
  map = L.map("map").setView([4.310756684156521, 108.3481479634814], 6); // Malaysia center

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: 'Map data © OpenStreetMap contributors',
  }).addTo(map);

  // Fetch shapefile as GeoJSON and create a layer
  fetch(BACKEND_URL + "/rsposhapefile")
    .then(res => res.json())
    .then(geojson => {
      rspolayer = L.geoJSON(geojson, {
        style: {
          color: "green",
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0.3,
        },
        onEachFeature: function (feature, layer) {
          const company = feature.properties.company || "N/A";
          const plantation = feature.properties.plantation || "N/A";
          const tooltipContent = `<b>Company:</b> ${company}<br><b>Plantation:</b> ${plantation}`;

          layer.bindTooltip(tooltipContent, {
            permanent: false, // shows on hover
            direction: "top",
            className: "leaflet-tooltip"
          });
        }
      });
      //rspolayer.addTo(map); // add to map
      addLayerControl();
    });
  fetch(BACKEND_URL + "/opshapefile")
    .then(res => res.json())
    .then(geojson => {
      oplayer = L.geoJSON(geojson, {
        style: {
          color: "blue",
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0.3,
        },
        onEachFeature: function (feature, layer) {
          const company = feature.properties.company || "N/A";
          const name = feature.properties.name || "N/A";
          const tooltipContent = `<b>Company:</b> ${company}<br><b>Name:</b> ${name}`;

          layer.bindTooltip(tooltipContent, {
            permanent: false, // shows on hover
            direction: "top",
            className: "leaflet-tooltip"
          });
        }
      });
      //oplayer.addTo(map);
      addLayerControl(); // Add control after both layers loaded
    });
    fetch(BACKEND_URL + "/mills")
      .then(res => res.json())
      .then(geojson => {
        millslayer = L.geoJSON(geojson, {
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
              radius: 1,
              fillColor: "black",
              color: "#000",
              weight: 0.8,
              opacity: 1,
              fillOpacity: 0.8
            });
          },
          onEachFeature: function (feature, layer) {
            const name = feature.properties.Mill_Name || "Unknown";
            const company = feature.properties.Parent_Com || "Unknown";
            layer.bindTooltip(`<b>Mill:</b> ${name}<br><b>Company:</b> ${company}`);
          }
        });
        //millslayer.addTo(map);
        addLayerControl();
      });
    fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
      switch (label) {
        case "No Data":
          return "#999999";  // grey
        case "Low (0 to 1 in 1,000)":
          return "#ffff99";  // pale yellow
        case "Low - Medium (1 in 1,000 to 2 in 1,000)":
          return "#ffcc33";  // yellow-orange
        case "Medium - High (2 in 1,000 to 6 in 1,000)":
          return "#ff6600";  // orange
        case "High (6 in 1,000 to 1 in 100)":
          return "#ff3300";  // red-orange
        case "Extremely High (more than 1 in 100)":
          return "#cc0000";  // dark red
        default:
          return "#cccccc";  // light grey for unknown
      }
    }
      rfrlayer = L.geoJSON(geojson, {
        style: function(feature) {
        const label = feature.properties.rfr_label || "N/A";
        return {
          color: getColor(label),
          weight: 1.5,
          opacity: 0.5,
          fillOpacity: 0.3,
          fillColor: getColor(label)
        };
      },
        onEachFeature: function (feature, layer) {
          const label = feature.properties.rfr_label || "N/A";
          const name = feature.properties.gid_0 || "N/A";
          const tooltipContent = `<b>Riverine Flood Risk Label:</b> ${label}`;

          layer.bindTooltip(tooltipContent, {
            permanent: false, // shows on hover
            direction: "top",
            className: "leaflet-tooltip"
          });
        }
      });

      //rfrlayer.addTo(map);
      addLayerControl(); // Add control after both layers loaded
    });
    fetch(BACKEND_URL + "weather_stations")
    .then(res => res.json())
    .then(stationData => {
      stationData.forEach(station => {
        const lat = station.Latitude;
        const lon = station.Longitude;
        const name = station.location_name;
        const forecast = station.forecast_with_dates;

        // Optional: use cross icon
        const crossIcon = L.divIcon({
          className: 'custom-cross-icon',
          html: '<div style="color: yellow; font-weight: bold; font-size: 18px;">+</div>',
          iconSize: [15, 15],
          iconAnchor: [5, 5]
        });

        const marker = L.marker([lat, lon], { icon: crossIcon });

        const tooltipContent = `
          <b>${name}</b><br>
          <div style="font-size: 12px;">${forecast}</div>
        `;

        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          permanent: false, // only shows on hover
          className: 'leaflet-tooltip',
          sticky: true     // follows the cursor
        });

        marker.addTo(map);
      });
    });
    fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
      switch (label) {
        case "No Risk":
      return "#00cc66"; // Green
        case "Low (0 to 9 in 1,000,000)":
          return "#ccff33"; // Light yellow-green
        case "Low - Medium (9 in 1,000,000 to 7 in 100,000)":
          return "#ffff66"; // Yellow
        case "Medium - High (7 in 100,000 to 3 in 10,000)":
          return "#ffcc00"; // Orange-yellow
        case "High (3 in 10,000 to 2 in 1,000)":
          return "#ff6600"; // Orange
        case "Extremely High (more than 2 in 1,000)":
          return "#cc0000"; // Red
        case "No Data":
        default:
          return "#999999"; // Grey for unknown
      }
    }
      cfrlayer = L.geoJSON(geojson, {
        style: function(feature) {
        const label = feature.properties.cfr_label || "N/A";
        return {
          color: getColor(label),
          weight: 1.5,
          opacity: 0.5,
          fillOpacity: 0.3,
          fillColor: getColor(label)
        };
      },
        onEachFeature: function (feature, layer) {
          const label = feature.properties.cfr_label || "N/A";
          const name = feature.properties.gid_0 || "N/A";
          const tooltipContent = `<b>Coastal Flood Risk Label:</b> ${label}`;

          layer.bindTooltip(tooltipContent, {
            permanent: false, // shows on hover
            direction: "top",
            className: "leaflet-tooltip"
          });
        }
      });
      //cfrlayer.addTo(map);
      addLayerControl(); // Add control after both layers loaded
    });
    fetch(BACKEND_URL + "/aqueduct")
    .then(res => res.json())
    .then(geojson => {
      function getColor(label) {
        switch (label) {
          case "Medium (0.4-0.6)":
            return "#FFD700"; // Gold
          case "Medium - High (0.6-0.8)":
            return "#FFA500"; // Orange
          case "High (0.8-1.0)":
            return "#FF4500"; // OrangeRed
          case "No Data":
          default:
            return "#D3D3D3"; // Light Gray
        }
    }
      drrlayer = L.geoJSON(geojson, {
        style: function(feature) {
        const label = feature.properties.drr_label || "N/A";
        return {
          color: getColor(label),
          weight: 1.5,
          opacity: 0.5,
          fillOpacity: 0.3,
          fillColor: getColor(label)
        };
      },
        onEachFeature: function (feature, layer) {
          const label = feature.properties.drr_label || "N/A";
          const name = feature.properties.gid_0 || "N/A";
          const tooltipContent = `<b>Drought Risk Label:</b> ${label}`;

          layer.bindTooltip(tooltipContent, {
            permanent: false, // shows on hover
            direction: "top",
            className: "leaflet-tooltip"
          });
        }
      });
      //cfrlayer.addTo(map);
      addLayerControl(); // Add control after both layers loaded
    });
    function addLayerControl() {
    if (rspolayer && oplayer && millslayer && rfrlayer && cfrlayer && drrlayer && !map.layerControlAdded) {
      rspolayer.addTo(map);
      oplayer.addTo(map);
      millslayer.addTo(map);

      const overlayMaps = {
        "RSPO Plantation": rspolayer,
        "Oil Palm Consessions": oplayer,
        "Mills": millslayer,
        "Riverine flood risk": rfrlayer,
        "Coastal flood risk": cfrlayer,
        "Drought risk": drrlayer
      };
      L.control.layers(null, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);
      map.layerControlAdded = true;
    }
  }
});

  // Example function to switch tabs and fix map rendering
  function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.add('hidden');
    });

    const activeTab = document.getElementById(tabId);
    activeTab.classList.remove('hidden');

    if (tabId === 'mpobstats' && map) {
      setTimeout(() => {
        map.invalidateSize(); // Important fix!
      }, 100); // Short delay ensures it's visible first
    }
  }

fetch(BACKEND_URL + "/cfr-bar-top6")
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById("cfr-bar-chart"), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: 'Major Plantation Companies with Coastal Flood Risks Composition'
          }
        },
        scales: {
                x: {stacked: true, grid: { display: false }},
                y: {beginAtZero: true, stacked: true,
                    title: { display: true, text: 'Count' },
                    grid: { display: false }}
                }
      }
    });
  });

fetch(BACKEND_URL + "/rfr-bar-top6")
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById("rfr-bar-chart"), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: 'Major Plantation Companies with Riverine Flood Risks Composition'
          }
        },
        scales: {
                x: {stacked: true, grid: { display: false }},
                y: {beginAtZero: true, stacked: true,
                    title: { display: true, text: 'Count' },
                    grid: { display: false }}
                }
      }
    });
  });  

fetch(BACKEND_URL + "/drr-bar-top6")
  .then(res => res.json())
  .then(data => {
    new Chart(document.getElementById("drr-bar-chart"), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: 'Major Plantation Companies with Drought Risks Composition'
          }
        },
        scales: {
                x: {stacked: true, grid: { display: false }},
                y: {beginAtZero: true, stacked: true,
                    title: { display: true, text: 'Count' },
                    grid: { display: false }}
                }
      }
    });
  });    
//MPOB

//MISCELLANEOUS
  // Default to mainpage
  showTab("mainpage");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      showTab(tab.dataset.tab);
    });
  });
//MISCELLANEOUS

//ENDING OF JAVASCRIPT FROM HERE