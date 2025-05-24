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
        "DUTALND": "3948.KL",
        "FAREAST": "5029.KL",
        "FGV": "5222.KL",
        "GENP": "2291.KL",
        "GLBHD": "7382.KL",
        "GOPENG": "2135.KL",
        "HARNLEN": "7501.KL",
        "HSPLANT": "5138.KL",
        "INCKEN": "2607.KL",
        "INFOTEC": "0253.KL",
        "INNO": "6262.KL",
        "IOICORP": "1961.KL",
        "JPG": "5323.KL",
        "JTIASA": "4383.KL",
        "KLK": "2445.KL",
        "KLUANG": "2453.KL",
        "KMLOONG": "5027.KL",
        "KRETAM": "1996.KL",
        "MALPAC": "4936.KL",
        "MATANG": "0189.KL",
        "MHC": "5026.KL",
        "MKHOP": "5319.KL",
        "NPC": "5047.KL",
        "NSOP": "2038.KL",
        "PINEPAC": "1902.KL",
        "PLS": "9695.KL",
        "RSAWIT": "5113.KL",
        "RVIEW": "2542.KL",
        "SBAGAN": "2569.KL",
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
            stock = yf.Ticker(ticker)
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

@app.get("/soy-price-data")
def get_soy_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("ZL=F", start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

"""@app.get("/fertilizer-data")
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

    return pivot_df.to_dict(orient="list")"""

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
