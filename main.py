from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import Point
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from io import BytesIO
import pandas as pd
import yfinance as yf
import os
import requests
import geopandas as gpd
import json

app = FastAPI()
templates = Jinja2Templates(directory = "templates")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow this frontend origin
    allow_credentials=True,
    allow_methods=["*"],                     # Allow all HTTP methods
    allow_headers=["*"],                     # Allow all headers
)

@app.get("/marketcap-data")
def get_market_cap_data():
    companies = {
        "AASIA": "7054.KL",
        "BKAWAN": "1899.KL",
        "BLDPLNT": "5069.KL",
        "CEPAT": "8982.KL",
        "CHINTEK": "1929.KL",
        "FAREAST": "5029.KL",
        "FGV": "5222.KL",
        "GENP": "2291.KL",
        "HSPLANT": "5138.KL",
        "INNO": "6262.KL",
        "IOICORP": "1961.KL",
        "JPG": "5323.KL",
        "JTIASA": "4383.KL",
        "KLK": "2445.KL",
        "KMLOONG": "5027.KL",
        "KRETAM": "1996.KL",
        "MHC": "5026.KL",
        "MKHOP": "5319.KL",
        "NSOP": "2038.KL",
        "PLS": "9695.KL",
        "RSAWIT": "5113.KL",
        "RVIEW": "2542.KL",
        "SDG": "5285.KL",
        "SHCHAN": "4316.KL",
        "SOP": "5126.KL",
        "SWKPLNT": "5135.KL",
        "TAANN": "5012.KL",
        "TDM": "2054.KL",
        "THPLANT": "5112.KL",
        "TSH": "9059.KL",
        "UMCCA": "2593.KL",
        "UTDPLT": "2089.KL"}

    result = []
    for name, ticker in companies.items():
        try:
            stock = yf.Ticker(ticker, proxy="")
            info = stock.info
            market_cap = info.get("marketCap", None)
            if market_cap:
                result.append({
                    "company": name,
                    "market_cap_billion": round(market_cap / 1e9, 2)
                })
        except:
            continue

    if not result:
        raise HTTPException(status_code=500, detail="Market cap data could not be retrieved.")

    return JSONResponse(content=result)

@app.get("/klci-data")
def get_klci_data():
    end = datetime.today()
    start = end - timedelta(days=30)  # last 6 months
    data = yf.download('^KLSE', start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

@app.get("/api/share-prices")
def get_share_prices():
    stocks = ["1961.KL", "2445.KL", "5285.KL", "5222.KL"]
    data = []

    for stock in stocks:
        ticker = yf.Ticker(stock)
        hist = ticker.history(period="2d")  # get last two days
        if len(hist) >= 2:
            latest = hist["Close"].iloc[-1]
            previous = hist["Close"].iloc[-2]
            change = latest - previous
            percent_change = (change / previous) * 100
            data.append({
                "symbol": stock.replace(".KL", ""),
                "price": round(latest, 2),
                "change": round(change, 2),
                "percent": round(percent_change, 2)
            })
        else:
            data.append({
                "symbol": stock.replace(".KL", ""),
                "price": None,
                "change": None,
                "percent": None
            })
    return data

@app.get("/prod-data")
def get_prod_data(company: str = Query(..., regex = "^(KLK|IOI|SDG|FGV)$")):
    filename_map = {
        "KLK":"klk_prod_data.csv",
        "IOI":"ioi_prod_data.csv",
        "SDG":"sdg_prod_data.csv",
        "FGV":"fgv_prod_data.csv"
    }

    csv_file = filename_map.get(company.upper())
    if not csv_file or not os.path.exists(csv_file):
        raise HTTPException(status_code=404, detail="CSV file not found")

    df = pd.read_csv(csv_file, sep="|")
    data = df.to_dict(orient = "records")
    return JSONResponse(content = {"company": company, "data": data})

@app.get("/plt-area")
def get_plt_area(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    csv_file = "plt_area.csv"

    if not os.path.exists(csv_file):
        raise HTTPException(status_code=404, detail="CSV file not found")

    df = pd.read_csv(csv_file, delimiter = '|')
    
    # Filter by company (case-insensitive match)
    filtered_df = df[df["Company"].str.upper() == company.upper()]
    if filtered_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for company '{company}'")

    data = filtered_df.to_dict(orient="records")
    return JSONResponse(content={"company": company, "data": data})

@app.get("/ext-rates")
def get_ext_rates(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    csv_file = "extraction_rates.csv"

    if not os.path.exists(csv_file):
        raise HTTPException(status_code=404, detail="CSV file not found")

    df = pd.read_csv(csv_file, delimiter='|')

    # Filter by company (case-insensitive match)
    filtered_df = df[df["Company"].str.upper() == company.upper()]
    if filtered_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for company '{company}'")

    data = filtered_df.to_dict(orient="records")
    return JSONResponse(content={"company": company, "data": data})

@app.get("/company-summary")
def get_company_description(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info
    return info.get('longBusinessSummary', '')

@app.get("/price-data")
def get_company_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download(ticker, start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

@app.get("/company-earnings")
def get_company_earnings(ticker):
    stock = yf.Ticker(ticker)
    earnings_df = stock.quarterly_financials

    if earnings_df.empty:
        raise HTTPException(status_code=404, detail="No earnings data found")

    # Transpose so that each row is a quarter
    earnings_df = earnings_df.T.reset_index()
    earnings_df.rename(columns={"index": "Quarter"}, inplace=True)

    # Keep only needed columns if available
    needed_cols = ["Quarter"]
    for col in ["Total Revenue", "Net Income", "Operating Income"]:
        if col in earnings_df.columns:
            needed_cols.append(col)

    earnings_df = earnings_df[needed_cols]
    earnings_df = earnings_df.dropna(how='all', subset=needed_cols[1:])  # Keep only rows with at least some data

    earnings_df[needed_cols[1:]] = earnings_df[needed_cols[1:]].apply(pd.to_numeric, errors="coerce")

    data = []
    for _, row in earnings_df.iterrows():
        total_revenue = row.get("Total Revenue", 0) or 0
        net_income = row.get("Net Income", 0) or 0
        operating_income = row.get("Operating Income", 0) or 0
        margin = (operating_income / total_revenue * 100) if total_revenue else 0

        quarter_str = row["Quarter"].strftime("%Y-%m-%d") if isinstance(row["Quarter"], pd.Timestamp) else str(row["Quarter"])

        data.append({
            "Quarter": quarter_str,
            "Total Revenue": round(total_revenue / 1e6, 2),
            "Net Income": round(net_income / 1e6, 2),
            "Operating Margin": round(margin, 2)
        })

    return JSONResponse(content={"company": ticker, "data": data})

@app.get("/soy-price-data")
def get_soy_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("ZL=F", start=start, end=end, progress=False, proxy="")

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

@app.get("/fertilizer-data")
def get_fertilizer_data():
    commodities = [
        "urea", "triple-superphosphate", "rock-phosphate",
        "potassium-chloride", "dap-fertilizer"
    ]
    all_data = []

    for item in commodities:
        url = f"https://www.indexmundi.com/commodities/?commodity={item}&months=30&currency=myr"
        response = requests.get(url)
        soup = BeautifulSoup(response.content, "html.parser")
        table = soup.find("table", id="gvPrices")
        
        if table is None:
            print(f"Table not found for {item} — skipping")
            continue
        
        rows = table.find_all("tr")[1:]
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 2:
                all_data.append({
                    "Month": cols[0].text.strip(),
                    "Price": cols[1].text.strip().replace(",", ""),
                    "Commodity": item
                })

    if not all_data:
        raise HTTPException(status_code=500, detail="No data was extracted from IndexMundi.")

    df = pd.DataFrame(all_data)
    df["Month"] = pd.to_datetime("01 " + df["Month"], format="%d %b %Y", errors="coerce")
    df["Price"] = pd.to_numeric(df["Price"], errors="coerce")
    df = df.dropna()

    pivot_df = df.pivot_table(index="Month", columns="Commodity", values="Price").reset_index()
    pivot_df["Month"] = pivot_df["Month"].dt.strftime("%Y-%m")

    return pivot_df.to_dict(orient="list")

@app.get("/fuelprices")
def get_fuel_prices():
    fuel_source = "https://storage.data.gov.my/commodities/fuelprice.csv"
    df = pd.read_csv(fuel_source)

    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df_filtered = df[df['date'] > '2022-12-31'][['date', 'diesel', 'diesel_eastmsia']]
    df_filtered = df_filtered.sort_values(by='date')
    df_filtered['date'] = df_filtered['date'].dt.strftime('%Y-%m-%d')

    return df_filtered.to_dict(orient='records')

@app.get("/exim-data")
def get_exim_data():
    url = "https://storage.dosm.gov.my/trade/trade_sitc_1d.csv"
    exim_data = pd.read_csv(url, sep=",")

    section_map = {
        '4': "Animal Vegetable Oils Fats and Waxes",
        '5': "Chemical and Related Products NEC"
    }
    exim_filtered_data = exim_data[exim_data['section'].isin(['4', '5'])].copy()
    exim_filtered_data['section'] = exim_filtered_data['section'].map(section_map)

    exim_filtered_data['date'] = pd.to_datetime(exim_filtered_data['date'])
    exim_filtered_data = exim_filtered_data[exim_filtered_data['date'].dt.year > 2018]
    exim_filtered_data['date'] = pd.to_datetime(exim_filtered_data['date']).dt.strftime('%Y-%m')

    grouped = exim_filtered_data.groupby(['date', 'section'])[['exports', 'imports']].sum().reset_index()

    eximpivoted = grouped.pivot(index="date", columns="section", values=["exports", "imports"])
    eximpivoted.columns = ['_'.join(col).strip().replace(" ", "_") for col in eximpivoted.columns.values]
    eximpivoted = eximpivoted.reset_index()

    return eximpivoted.to_dict(orient="list")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    with open("index.html", "r") as f:
        return HTMLResponse(f.read())

@app.get("/weather_stations")
async def weather_stations():
    response = requests.get('https://api.data.gov.my/weather/forecast')
    wfcast_json = response.json()
    wfcast_df = pd.json_normalize(wfcast_json)

    wfcast_df = wfcast_df[['date', 'summary_forecast', 'min_temp', 'max_temp', 'location.location_name']]
    wfcast_df.rename(columns={'location.location_name': 'location_name'}, inplace=True)
    points_df = pd.read_csv('weather_station_base.csv')

    rain_table = wfcast_df.merge(points_df, on='location_name', how='left').drop_duplicates(subset=['location_name', 'date'])
    grouped = rain_table.groupby(['location_name', 'Latitude', 'Longitude']).apply(
        lambda x: "<br>".join(f"{row['date']}: {row['summary_forecast']}" for _, row in x.iterrows())
    ).reset_index(name='forecast_with_dates')

    wf_result = grouped.to_dict(orient='records')
    return JSONResponse(content=wf_result)

@app.get("/rsposhapefile")
def get_shapefile():
    rspo_gdf = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp")
    rspo_gdf = rspo_gdf[rspo_gdf['country'].isin(['Malaysia'])]

    for col in rspo_gdf.columns:
        if rspo_gdf[col].dtype.name.startswith("datetime"):
            rspo_gdf[col] = rspo_gdf[col].astype(str)

    rspo_geojson = rspo_gdf.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(rspo_geojson))

@app.get("/opshapefile")
def get_shapefile():
    op_gdf = gpd.read_file("gfw_oil_palm/gfw_oil_palm_v20191031.shp")
    op_gdf = op_gdf[op_gdf['country'].isin(['MYS', 'IDN'])]

    for col in op_gdf.columns:
        if op_gdf[col].dtype.name.startswith("datetime"):
            op_gdf[col] = op_gdf[col].astype(str)

    op_geojson = op_gdf.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(op_geojson))

@app.get("/mills")
def get_mills():
    mill_df = pd.read_csv("universal_mill_list.csv")
    geometry = [Point(xy) for xy in zip(mill_df["Longitude"], mill_df["Latitude"])]
    mill_gdf = gpd.GeoDataFrame(mill_df, geometry=geometry, crs="EPSG:4326")
    
    mill_geojson = mill_gdf.to_json()
    return JSONResponse(content=json.loads(mill_geojson))

@app.get("/aqueduct")
def get_shapefile():
    auqeduct = gpd.read_file("aqueduct/aqueduct.gpkg")

    for col in auqeduct.columns:
        if auqeduct[col].dtype.name.startswith("datetime"):
            auqeduct[col] = auqeduct[col].astype(str)

    aq_geojson = auqeduct.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(aq_geojson))

@app.get("/cfr-bar-top6")
def cfr_bar_top6():
    df = pd.read_csv("cfr_summary.csv")

    label_order = [
        "No Risk",
        "Low (0 to 9 in 1,000,000)",
        "Low - Medium (9 in 1,000,000 to 7 in 100,000)",
        "Medium - High (7 in 100,000 to 3 in 10,000)",
        "High (3 in 10,000 to 2 in 1,000)",
        "Extremely High (more than 2 in 1,000)"
    ]

    color_map = {
        "No Risk": "#00cc66",
        "Low (0 to 9 in 1,000,000)": "#ccff33",
        "Low - Medium (9 in 1,000,000 to 7 in 100,000)": "#ffff66",
        "Medium - High (7 in 100,000 to 3 in 10,000)": "#ffcc00",
        "High (3 in 10,000 to 2 in 1,000)": "#ff6600",
        "Extremely High (more than 2 in 1,000)": "#cc0000"
    }

    counts = (df.groupby(["company", "cfr_label"]).size().reset_index(name="count"))

    total_counts = (
        counts.groupby("company")["count"]
        .sum()
        .reset_index(name="total")
        .sort_values(by="total", ascending=False)
    )

    top6 = total_counts.head(6)["company"].tolist()

    filtered = counts[counts["company"].isin(top6)]
    pivoted = filtered.pivot(index="company", columns="cfr_label", values="count").fillna(0)
    pivoted = pivoted.reindex(columns=label_order, fill_value=0)

    chart_data = {
        "labels": pivoted.index.tolist(),
        "datasets": [
            {
                "label": label,
                "data": pivoted[label].tolist(),
                "backgroundColor": color_map.get(label, "#cccccc")
            }
            for label in label_order if label in pivoted.columns
        ]
    }
    return JSONResponse(content=chart_data)

@app.get("/rfr-bar-top6")
def rfr_bar_top6():
    df = pd.read_csv("rfr_summary.csv")

    label_order = [
    "No Risk",
    "Low (0 to 1 in 1,000)",
    "Low - Medium (1 in 1,000 to 2 in 1,000)",
    "Medium - High (2 in 1,000 to 6 in 1,000)",
    "High (6 in 1,000 to 1 in 100)",
    "Extremely High (more than 1 in 100)"
    ]

    color_map = {
        "No Risk": "#00cc66",                                # green
        "Low (0 to 1 in 1,000)": "#ccff33",                   # light green-yellow
        "Low - Medium (1 in 1,000 to 2 in 1,000)": "#ffff66", # yellow
        "Medium - High (2 in 1,000 to 6 in 1,000)": "#ffcc00",# orange-yellow
        "High (6 in 1,000 to 1 in 100)": "#ff6600",           # orange
        "Extremely High (more than 1 in 100)": "#cc0000"      # red
    }

    counts = (df.groupby(["company", "rfr_label"]).size().reset_index(name="count"))

    total_counts = (
        counts.groupby("company")["count"]
        .sum()
        .reset_index(name="total")
        .sort_values(by="total", ascending=False)
    )

    top6 = total_counts.head(6)["company"].tolist()

    filtered = counts[counts["company"].isin(top6)]
    pivoted = filtered.pivot(index="company", columns="rfr_label", values="count").fillna(0)
    pivoted = pivoted.reindex(columns=label_order, fill_value=0)

    chart_data = {
        "labels": pivoted.index.tolist(),
        "datasets": [
            {
                "label": label,
                "data": pivoted[label].tolist(),
                "backgroundColor": color_map.get(label, "#cccccc")
            }
            for label in label_order if label in pivoted.columns
        ]
    }
    return JSONResponse(content=chart_data)

@app.get("/drr-bar-top6")
def drr_bar_top6():
    df = pd.read_csv("drr_summary.csv")

    label_order = [
    "No Risk",
    "Low (0-0.4)",
    "Medium (0.4-0.6)",
    "High (0.6 and above)"]

    color_map = {
        "No Risk": "#00cc66",             # green
        "Low (0-0.4)": "#ccff33",      # light green-yellow
        "Medium (0.4-0.6)": "#ffff66", # yellow
        "High (0.6 and above)": "#d12323" # red
    }

    counts = (df.groupby(["company", "drr_label"]).size().reset_index(name="count"))

    total_counts = (
        counts.groupby("company")["count"]
        .sum()
        .reset_index(name="total")
        .sort_values(by="total", ascending=False)
    )

    top6 = total_counts.head(6)["company"].tolist()

    filtered = counts[counts["company"].isin(top6)]
    pivoted = filtered.pivot(index="company", columns="drr_label", values="count").fillna(0)
    pivoted = pivoted.reindex(columns=label_order, fill_value=0)

    chart_data = {
        "labels": pivoted.index.tolist(),
        "datasets": [
            {
                "label": label,
                "data": pivoted[label].tolist(),
                "backgroundColor": color_map.get(label, "#cccccc")
            }
            for label in label_order if label in pivoted.columns
        ]
    }
    return JSONResponse(content=chart_data)