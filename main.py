from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import Point
from bs4 import BeautifulSoup
from datetime import datetime, timedelta, date
from shapely.geometry import Point
from shapely.ops import nearest_points
from geopy.distance import geodesic
from typing import List, Dict, Any
from io import BytesIO
import pandas as pd
import yfinance as yf
import os
import requests
import geopandas as gpd
import json
import sqlite3
import geopandas as gpd
import re

SQLITE_DB = "bursa_palmai_database.db"

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory = "templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow this frontend origin
    allow_credentials=True,
    allow_methods=["*"],                     # Allow all HTTP methods
    allow_headers=["*"],                     # Allow all headers
)

#define weather forecast comp
response = requests.get('https://api.data.gov.my/weather/forecast')
wfcast_json = response.json()
wfcast_df = pd.json_normalize(wfcast_json)

wfcast_df = wfcast_df[['date', 'summary_forecast', 'min_temp', 'max_temp', 'location.location_name']]
wfcast_df.rename(columns={'location.location_name': 'location_name'}, inplace=True)
points_df = pd.read_csv('weather_station_base.csv')

rain_table = wfcast_df.merge(points_df, on='location_name', how='left')
weather_gdf = gpd.GeoDataFrame(
    rain_table,
    geometry=gpd.points_from_xy(rain_table.Longitude, rain_table.Latitude),
    crs="EPSG:4326"
)
weather_gdf['date'] = pd.to_datetime(weather_gdf['date'])

earliest_date = weather_gdf['date'].min()

concessions = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp").to_crs("EPSG:4326")
concessions = concessions[concessions['country'].isin(['Malaysia'])]

station_points = weather_gdf[['location_name', 'Longitude', 'Latitude']].drop_duplicates()
station_points['geometry'] = gpd.points_from_xy(station_points.Longitude, station_points.Latitude)
station_gdf = gpd.GeoDataFrame(station_points, geometry='geometry', crs='EPSG:4326')

# Find nearest station and calculate distance
def get_nearest_station_info(row):
    concession_centroid = row.geometry.centroid
    nearest_station = station_gdf.geometry.distance(concession_centroid).sort_values().index[0]
    nearest_row = station_gdf.loc[nearest_station]
    
    # Compute geodesic distance in km
    dist_km = geodesic(
        (concession_centroid.y, concession_centroid.x),
        (nearest_row.Latitude, nearest_row.Longitude)
    ).km
    
    return pd.Series({
        'nearest_station': nearest_row.location_name,
        'distance_km': round(dist_km, 2)
    })

# Apply to concessions
concessions[['nearest_station', 'distance_km']] = concessions.apply(get_nearest_station_info, axis=1)

# Merge 7-day forecast from the matched station
concessions_forecast = pd.merge(concessions, weather_gdf, left_on='nearest_station', right_on='location_name', how='left')
concessions_forecast_comp = concessions_forecast.reset_index(drop=True)
#define weather forecast comp

# coloured palm oil layer
df_lab = concessions_forecast_comp.copy()
df_lab['date'] = pd.to_datetime(df_lab['date'])

def categorize_weather(weather):
    weather = str(weather).lower()  # Ensure string type
    if 'hujan' in weather and 'tiada' not in weather:
        return 'Hujan'
    elif 'ribut petir' in weather:
        return 'Ribut Petir'
    elif 'berangin' in weather:
        return 'Berangin'
    elif 'tiada hujan' in weather:
        return 'Tiada Hujan'
    return weather

df_lab['summary_forecast'] = df_lab['summary_forecast'].apply(categorize_weather)
# coloured palm oil layer 

# mainpage
# market cap aka treemap
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

# klci vs fbmplt chart
@app.get("/klci-data")
def get_klci_data():
    end = datetime.today()
    start = end - timedelta(days=30)  # last 30 days
    data = yf.download('^KLSE', start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# stock share price aka scorecards
@app.get("/api/share-prices")
def get_share_prices():
    stocks = ["1961.KL", #ioi
              "2445.KL", #klk
              "5285.KL", #sdg
              "5222.KL", #fgv
              "4383.KL", #jtiasa
              "5027.KL", #kmloong
              "9059.KL", #tsh
              "1996.KL", #kretam
              "2089.KL", #utdplt
              "2291.KL", #genp
              "6262.KL", #inno
              "5126.KL" #sop
              ]
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

# news display
@app.get("/api/news")
def get_news():
    def format_description(text):
        # Fix common mashed variants like 'palmoil'
        text = re.sub(r'(?i)palmoil', 'palm oil', text)

        # Add space before 'palm' if mashed, e.g., 'basedpalm' -> 'based palm'
        text = re.sub(r'(?i)(\w)(palm)', r'\1 palm', text)

        # Add space after 'palm' if mashed, e.g., 'palmcompany' -> 'palm company'
        text = re.sub(r'(?i)(palm)([A-Z]?\w)', r'palm \2', text)

        # Add space after 'oil' if mashed, e.g., 'oilcompany' -> 'oil company'
        text = re.sub(r'(?i)(oil)([A-Z]?\w)', r'oil \2', text)

        return text

    today = date.today()  
    today_str = today.strftime("%Y-%m-%d")  
    url = f"https://theedgemalaysia.com/news-search-results?keywords=palm%20oil&to={today_str}&from=1999-01-01&language=english&offset=0"

    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    news_items = soup.find_all('div', class_='NewsList_newsListText__hstO7')

    data = []
    for item in news_items:
        a_tag = item.find('a', href=True)
        headline_tag = item.find('span', class_='NewsList_newsListItemHead__dg7eK')
        description_tag = item.find('span', class_='NewsList_newsList__2fXyv')

        img_tag = item.find_previous_sibling('div')
        if img_tag:
            img_tag = img_tag.find('img', class_='NewsList_newsImage__j_h0a')

        if a_tag and headline_tag and description_tag:
            link = a_tag['href']
            if link.startswith('/'):
                link = f"https://theedgemalaysia.com{link}"
            headline = headline_tag.get_text(strip=True)
            description = format_description(description_tag.get_text(strip=True))
            image_url = img_tag['src'] if img_tag else None

            data.append({
                'headline': headline,
                'link': link,
                'description': description,
                'image_url': image_url
            })

    return {"news": data}
# mainpage

# company
# company mthly production data
@app.get("/prod-data")
def get_prod_data(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    try:
        # Connect to SQLite database
        conn = sqlite3.connect(SQLITE_DB)
        
        # Query data for the specific company
        query = f"""
        SELECT * FROM company_mthly_prod 
        WHERE company = '{company.upper()}'
        """
        
        df = pd.read_sql(query, conn)
        
        if df.empty:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for company {company}"
            )
            
        data = df.to_dict(orient="records")
        
        return JSONResponse(
            content={"company": company.upper(), "data": data}
        )
        
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Database error: {str(e)}"
        )
    finally:
        if 'conn' in locals():
            conn.close()

# company plantation area
@app.get("/plt-area")
def get_plt_area(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    try:
        conn = sqlite3.connect(SQLITE_DB)
        query = """
        SELECT * FROM company_plt_area
        WHERE UPPER(Company) = ?
        """
        
        df = pd.read_sql(query, conn, params=(company.upper(),))
        
        if df.empty:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for company '{company}'"
            )
            
        data = df.to_dict(orient="records")
        
        return JSONResponse(
            content={"company": company, "data": data}
        )
        
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Database error: {str(e)}"
        )
    finally:
        if 'conn' in locals():
            conn.close()

# company oil extraction rates
@app.get("/ext-rates")
def get_ext_rates(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    try:
        conn = sqlite3.connect(SQLITE_DB)
        query = """
        SELECT * FROM company_ext_rate 
        WHERE UPPER(company) = UPPER(?)
        """
        
        df = pd.read_sql(query, conn, params=(company,))
        
        if df.empty:
            raise HTTPException(
                status_code=404, 
                detail=f"No extraction rate data found for company {company}"
            )
            
        data = df.to_dict(orient="records")
        
        return JSONResponse(
            content={"company": company.upper(), "data": data}
        )
        
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Database error: {str(e)}"
        )
    finally:
        if 'conn' in locals():
            conn.close()

# company description summary 
@app.get("/company-summary")
def get_company_description(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info
    summary = info.get('longBusinessSummary', '')

    # Clean ONLY leading/trailing quotes — including smart quotes
    summary = summary.strip().strip('"').strip("“”").strip("'")

    # Extra safety: use regex to remove quotes only at the start and end
    summary = re.sub(r'^[\"“”\']+|[\"“”\']+$', '', summary)

    return summary

# company share price chart 
@app.get("/price-data")
def get_company_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download(ticker, start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# company earnings
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
        "Quarter_Date": row["Quarter"] if isinstance(row["Quarter"], pd.Timestamp) else pd.to_datetime(row["Quarter"]),
        "Total Revenue": round(total_revenue / 1e6, 2),
        "Net Income": round(net_income / 1e6, 2),
        "Operating Margin": round(margin, 2)
        })
    # Sort the data by Quarter_Date in chronological order
    data = sorted(data, key=lambda x: x["Quarter_Date"])

    # Remove the temporary Quarter_Date field if you don't need it
    for item in data:
        item.pop("Quarter_Date", None)

    return JSONResponse(content={"company": ticker, "data": data})
# company

# commodities
# mpob stats
@app.get("/api/mpob")
def get_mpob_data():
    try:
        conn = sqlite3.connect(SQLITE_DB)
        df = pd.read_sql("SELECT * FROM mpob_stats", conn)
        
        if df.empty:
            raise HTTPException(
                status_code=404, 
                detail="No data found in mpob_stats table"
            )
            
        return df.to_dict(orient="records")
        
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Database error: {str(e)}"
        )
    finally:
        if 'conn' in locals():
            conn.close()

# soy futures chart
@app.get("/soy-price-data")
def get_soy_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("ZL=F", start=start, end=end, progress=False, proxy="")

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# fertilizer chart
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

# diesel price chart
@app.get("/fuelprices")
def get_fuel_prices():
    fuel_source = "https://storage.data.gov.my/commodities/fuelprice.csv"
    df = pd.read_csv(fuel_source)

    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df_filtered = df[df['date'] > '2022-12-31'][['date', 'diesel', 'diesel_eastmsia']]
    df_filtered = df_filtered[~((df_filtered['diesel'].fillna(0) == 0) & (df_filtered['diesel_eastmsia'].fillna(0) == 0))]
    df_filtered = df_filtered.drop_duplicates(subset='date', keep='first')
    df_filtered = df_filtered.sort_values(by='date')
    df_filtered['date'] = df_filtered['date'].dt.strftime('%Y-%m-%d')

    return df_filtered.to_dict(orient='records')

# crude oil chart
@app.get("/crude-oil-data")
def get_crude_oil_price_data():
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("CL=F", start=start, end=end, progress=False, proxy="")

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# brent oil chart
@app.get("/brent-oil-data")
def get_brent_oil_price_data():
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("BZ=F", start=start, end=end, progress=False, proxy="")

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}
# commodities

#export import
#graph theory
@app.get("/trade-data")
async def get_trade_data():
    conn = sqlite3.connect(SQLITE_DB)
    query_result = pd.read_sql("SELECT * FROM test_gt", conn)
    dff = query_result[['reporterISO', 'partnerISO', 'reporterDesc', 'refMonth', 'cmdCode', 'fobvalue']]
    data = dff.to_dict(orient="records")
    conn.close()
    
    return JSONResponse(content=data)

#export import and trade surplus/deficit chart
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
# export import

# mpob stats
# concessions with 7-days weather forecast
@app.get("/weather_forecast_summary")
async def weather_forecast_summary():
    df = df_lab.copy()

    weather_fc_df = (
        df.groupby(['date', 'summary_forecast'])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    
    weather_fc_df['date'] = weather_fc_df['date'].apply(lambda x: x.isoformat())
    return weather_fc_df.to_dict(orient='records')

# weather station layer
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

# rspolayer
@app.get("/rsposhapefile")
def get_shapefile():
    rspo_gdf = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp")
    rspo_gdf = rspo_gdf[rspo_gdf['country'].isin(['Malaysia'])]

    for col in rspo_gdf.columns:
        if rspo_gdf[col].dtype.name.startswith("datetime"):
            rspo_gdf[col] = rspo_gdf[col].astype(str)

    rspo_geojson = rspo_gdf.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(rspo_geojson))

# oplayer
@app.get("/opshapefile")
def get_shapefile():
    op_gdf = gpd.read_file("gfw_oil_palm/gfw_oil_palm_v20191031.shp")
    op_gdf = op_gdf[op_gdf['country'].isin(['MYS', 'IDN'])]

    for col in op_gdf.columns:
        if op_gdf[col].dtype.name.startswith("datetime"):
            op_gdf[col] = op_gdf[col].astype(str)

    op_geojson = op_gdf.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(op_geojson))

# milllayer
@app.get("/mills")
def get_mills():
    try:
        conn = sqlite3.connect(SQLITE_DB)
        mill_df = pd.read_sql("SELECT * FROM universal_mill_list", conn)
        
        if mill_df.empty:
            raise HTTPException(
                status_code=404, 
                detail="No mill data found in database"
            )
            
        geometry = [Point(xy) for xy in zip(mill_df["Longitude"], mill_df["Latitude"])]
        mill_gdf = gpd.GeoDataFrame(mill_df, geometry=geometry, crs="EPSG:4326")
        mill_geojson = mill_gdf.to_json()
        return JSONResponse(content=json.loads(mill_geojson))
        
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Database error: {str(e)}"
        )
    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required column in database: {str(e)}"
        )
    finally:
        if 'conn' in locals():
            conn.close()

# rfrlayer/cfrlyer/drrlayer
@app.get("/aqueduct")
def get_shapefile():
    auqeduct = gpd.read_file("aqueduct/aqueduct.gpkg")

    for col in auqeduct.columns:
        if auqeduct[col].dtype.name.startswith("datetime"):
            auqeduct[col] = auqeduct[col].astype(str)

    aq_geojson = auqeduct.to_crs(epsg=4326).to_json()
    return JSONResponse(content=json.loads(aq_geojson))

# cfr chart
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

#rfr chart
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

#drr chart
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