//STARTING OF JAVASCRIPT FROM HERE
// MAINPAGE
fetch('http://127.0.0.1:8000/marketcap-data')
      .then(response => response.json())
      .then(data => {
        // Convert to AnyChart heatmap data format
        const heatmapData = data.map((item, index) => ({
          x: item.company,
          y: "Market Cap",
          heat: item.market_cap_billion
        }));

        anychart.onDocumentReady(function () {
          // Create a heatmap chart
          var chart = anychart.heatMap(heatmapData);

          // Set chart title and container
          chart.title("Market Cap by Company (Billion MYR)");

          // Configure color scale
          chart.colorScale()
            .ranges([
              { less: 1, color: "#d4f4dd" },
              { from: 1, to: 5, color: "#34d399" },
              { greater: 5, color: "#059669" }
            ]);

          // Tooltip customization
          chart.tooltip().format(function () {
            return this.x + ": " + this.heat + " Billion MYR";
          });

          chart.container("heatmap");
          chart.draw();
        });
      })
      .catch(error => {
        console.error("Failed to load market cap data:", error);
      });
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
  const response = await fetch(`http://localhost:8000/prod-data?company=${company}`);
  const result = await response.json();
  return result.data;
}

function getColor(index) {
  const colors = [
    "rgba(34, 197, 94, 0.7)",
    "rgba(59, 130, 246, 0.7)",
    "rgba(234, 179, 8, 0.7)",
    "rgba(16, 185, 129, 0.7)",
    "rgba(139, 92, 246, 0.7)",
    "rgba(244, 63, 94, 0.7)"
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
  const response = await fetch(`http://localhost:8000/price-data?ticker=${ticker}`);
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
        borderColor: 'rgba(34, 197, 94, 0.7)', 
        backgroundColor: 'rgba(34, 197, 94, 0.07)',
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
  const response = await fetch(`http://localhost:8000/company-summary?ticker=${ticker}`);
  if (!response.ok) {
    console.error("Failed to fetch company description");
    return "";
  }
  return await response.text();
}

// company earnings data
async function fetchEarnings(ticker) {
  const res = await fetch(`http://127.0.0.1:8000/company-earnings?ticker=${ticker}`);
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
          backgroundColor: "rgba(75, 192, 192, 0.6)",
          yAxisID: 'y',
        },
        {
          label: "Net Income (RM mil)",
          data: netIncome,
          backgroundColor: "rgba(153, 102, 255, 0.6)",
          yAxisID: 'y',
        },
        {
          label: "Operating Margin (%)",
          data: margin,
          type: "line",
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
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
    const response = await fetch("http://localhost:8000/soy-price-data?ticker=ZL=F");
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
          borderColor: "rgba(34, 197, 94, 0.7)",       // blue
          backgroundColor: "rgba(34, 197, 94, 0.07)",  // light fill
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
            color: "black",
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
    const response = await fetch("http://localhost:8000/fertilizer-data"); // Update URL if needed
    const data = await response.json();

    const labels = data["Month"];
    const colors = {
      "urea": "rgba(255, 99, 132, 1)",
      "triple-superphosphate": "rgba(54, 162, 235, 1)",
      "rock-phosphate": "rgba(255, 206, 86, 1)",
      "potassium-chloride": "rgba(75, 192, 192, 1)",
      "dap-fertilizer": "rgba(153, 102, 255, 1)"
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
//COMMODITIES

//EXPORT IMPORT
  async function loadEXIMData() {
      const res = await fetch("http://localhost:8000/exim-data");
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
              borderColor: "blue",
              backgroundColor: "rgba(0, 0, 255, 0.1)",
              type: "line",
              yAxisID: 'y',
            },
            {
              label: "Imports",
              data: animal_imports,
              borderColor: "orange",
              backgroundColor: "rgba(255, 165, 0, 0.1)",
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
              borderColor: "green",
              backgroundColor: "rgba(0, 255, 0, 0.1)",
              type: "line",
              yAxisID: 'y',
            },
            {
              label: "Imports",
              data: chemical_imports,
              borderColor: "red",
              backgroundColor: "rgba(255, 0, 0, 0.1)",
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
let rspolayer, oplayer, millslayer; // To store the polygon layer

document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = document.getElementById("map");
  map = L.map("map").setView([4.310756684156521, 108.3481479634814], 6); // Malaysia center

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: 'Map data © OpenStreetMap contributors',
  }).addTo(map);

  // Fetch shapefile as GeoJSON and create a layer
  fetch("http://127.0.0.1:8000/rsposhapefile")
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
  fetch("http://127.0.0.1:8000/opshapefile")
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
    fetch("http://127.0.0.1:8000/mills")
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
    fetch("http://127.0.0.1:8000/aqueduct")
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
    fetch("http://127.0.0.1:8000/weather_stations")
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
    fetch("http://127.0.0.1:8000/aqueduct")
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
    fetch("http://127.0.0.1:8000/aqueduct")
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

fetch("http://127.0.0.1:8000/cfr-bar-top6")
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

fetch("http://127.0.0.1:8000/rfr-bar-top6")
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

fetch("http://127.0.0.1:8000/drr-bar-top6")
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