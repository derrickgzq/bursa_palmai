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
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import BaseModel
from pandas.tseries.offsets import DateOffset
from mangum import Mangum
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from collections import Counter
from transformers import pipeline
import torch
import torch.nn.functional as F
import pandas as pd
import yfinance as yf
import os
import requests
import geopandas as gpd
import json
import sqlite3
import geopandas as gpd
import re

#database
SQLITE_DB = "bursa_palmai_database.db"

# Load environment variables from .env file
load_dotenv(override=True)

api_key = os.getenv("OPENROUTER_API_KEY")
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

#FinBERT
# Load FinBERT model and tokenizer once
finbert_model = AutoModelForSequenceClassification.from_pretrained("yiyanghkust/finbert-tone")
finbert_tokenizer = AutoTokenizer.from_pretrained("yiyanghkust/finbert-tone")
labels = ["negative", "neutral", "positive"]

def analyze_sentiment(text):
    inputs = finbert_tokenizer(text, return_tensors="pt", truncation=True)
    with torch.no_grad():
        outputs = finbert_model(**inputs)
    probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]
    score, pred_idx = torch.max(probs, dim=0)
    sentiment = labels[pred_idx]
    return sentiment, float(score)

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
# 1. Fetch weather forecast
response = requests.get('https://api.data.gov.my/weather/forecast')
wfcast_json = response.json()
wfcast_df = pd.json_normalize(wfcast_json)

# 2. Normalize and clean
wfcast_df = wfcast_df[['date', 'summary_forecast', 'min_temp', 'max_temp', 'location.location_name']]
wfcast_df.rename(columns={'location.location_name': 'location_name'}, inplace=True)
wfcast_df['date'] = pd.to_datetime(wfcast_df['date'])

# 3. Load weather station coordinates
points_df = pd.read_csv('weather_station_base.csv')  # Has base_latitude, base_longitude

# 4. Merge weather with station coordinates
rain_table = wfcast_df.merge(points_df, on='location_name', how='left')
weather_gdf = gpd.GeoDataFrame(
    rain_table,
    geometry=gpd.points_from_xy(rain_table.base_longitude, rain_table.base_latitude),
    crs="EPSG:4326"
)

# 5. Load concessions and convert to centroids only
concessions = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp")
concessions = concessions.to_crs("EPSG:4326")
concessions = concessions[concessions['country'] == 'Malaysia']

# ➤ Convert polygons to centroids and drop heavy geometry
concessions['geometry'] = concessions.geometry.centroid
concessions['Latitude'] = concessions.geometry.y
concessions['Longitude'] = concessions.geometry.x

# 6. Prepare station GeoDataFrame
station_points = weather_gdf[['location_name', 'base_longitude', 'base_latitude']].drop_duplicates()
station_points['geometry'] = gpd.points_from_xy(station_points.base_longitude, station_points.base_latitude)
station_gdf = gpd.GeoDataFrame(station_points, geometry='geometry', crs='EPSG:4326')

# 7. Match nearest station using geodesic distance (lightweight)
def get_nearest_station_info(row):
    concession_point = (row['Latitude'], row['Longitude'])
    distances = station_gdf.apply(
        lambda x: geodesic(concession_point, (x.base_latitude, x.base_longitude)).km,
        axis=1
    )
    nearest_idx = distances.idxmin()
    nearest_station = station_gdf.loc[nearest_idx]
    return pd.Series({
        'nearest_station': nearest_station.location_name,
        'distance_km': round(distances[nearest_idx], 2)
    })

concessions[['nearest_station', 'distance_km']] = concessions.apply(get_nearest_station_info, axis=1)

# 8. Merge weather forecast from nearest station
concessions_forecast = pd.merge(concessions, weather_gdf, left_on='nearest_station', right_on='location_name', how='left')

# 9. Drop unneeded geometries to reduce memory
concessions_forecast = concessions_forecast.drop(columns=['geometry_x', 'geometry_y'], errors='ignore')

# 10. Reset index
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

#revenue prediction
# --- Coefficients Map ---
coefficients_map = {
    'KLK': {
        'intercept': 3.129,
        'scale': 1000,
        'coefficients': {
            'Fresh Fruit Bunches': 6.37e-6,
            'Crude Palm Oil': -7.238e-5,
            'Palm Kernel': 2.766e-4,
            'Rubber': 1.508e-7,
            'FCPO': -3.544e-4,
            'PK Price': 1.069e-3
        }
    },
    'IOI': {
        'intercept': 1.062,
        'scale': 1000,
        'coefficients': {
            'Fresh Fruit Bunches': 7.685e-6,
            'Crude Palm Oil': -5.236e-5,
            'Palm Kernel': 1.236e-4,
            'Rubber': -7.351e-7,
            'FCPO': -1.675e-4,
            'PK Price': 1.089e-3
        }
    },
    'SDG': {
        'intercept': 4.383,
        'scale': 1000,
        'coefficients': {
            'Fresh Fruit Bunches': 4.893e-6,
            'Crude Palm Oil': -2.636e-5,
            'Palm Kernel': 4.647e-5,
            'Rubber': 0.0,
            'FCPO': -4.38e-4,
            'PK Price': 4.555e-4
        }
    }
}

raw_material_base_names = [
    "Fresh Fruit Bunches",
    "Crude Palm Oil",
    "Palm Kernel",
    "Rubber",
    "Coconut"
]

# mainpage
# market cap aka treemap
@app.get("/yf/marketcap-data")
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
@app.get("/yf/klci-data")
def get_klci_data():    
    end = datetime.today()
    start = end - timedelta(days=30)  # last 30 days
    data = yf.download('^KLSE', start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# stock share price aka scorecards
@app.get("/yf/share-prices")
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

# ai summary news
@app.get("/ai-summary")
def get_ai_summary():
    # Get the news data
    news_data = get_news()
    top_10_news = news_data["news"][:10]  # limit to top 10
    headlines = [item["headline"] for item in top_10_news]

    # Join headlines into one prompt
    news_prompt = "Without saying Here is a 20-word summary, summarize the palm oil related news headlines in 20 words, and conclude either is bullish, neutral or bearish:\n\n"
    news_prompt += "\n".join(f"- {hl}" for hl in headlines)

    # Get AI summary from OpenRouter
    response = client.chat.completions.create(
        model="meta-llama/llama-3.1-8b-instruct",
        messages=[
            {
                "role": "user",
                "content": news_prompt
            }
        ]
    )

    summary = response.choices[0].message.content
    return {"summary": summary}

# news display
@app.get("/the-edge/news")
def get_news():
    def format_description(text):
        text = re.sub(r'(?i)palmoil', 'palm oil', text)
        text = re.sub(r'(?i)(\w)(palm)', r'\1 palm', text)
        text = re.sub(r'(?i)(palm)([A-Z]?\w)', r'palm \2', text)
        text = re.sub(r'(?i)(oil)([A-Z]?\w)', r'oil \2', text)
        return text

    today_str = date.today().strftime("%Y-%m-%d")
    offsets = [0, 10, 20, 30]  # You can extend this
    data = []

    for offset in offsets:
        url = f"https://theedgemalaysia.com/news-search-results?keywords=palm%20oil&to={today_str}&from=1999-01-01&language=english&offset={offset}"
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        news_items = soup.find_all('div', class_='NewsList_newsListText__hstO7')

        for item in news_items:
            a_tag = item.find('a', href=True)
            headline_tag = item.find('span', class_='NewsList_newsListItemHead__dg7eK')
            description_tag = item.find('span', class_='NewsList_newsList__2fXyv')

            parent = item.parent
            date_tag = parent.find('div', class_='NewsList_infoNewsListSubMobile__SPmAG')
            publish_date = date_tag.find('span').get_text(strip=True) if date_tag else None

            img_tag = item.find_previous_sibling('div')
            img_tag = img_tag.find('img', class_='NewsList_newsImage__j_h0a') if img_tag else None

            if a_tag and headline_tag and description_tag:
                link = a_tag['href']
                if link.startswith('/'):
                    link = f"https://theedgemalaysia.com{link}"

                headline = headline_tag.get_text(strip=True)
                description = format_description(description_tag.get_text(strip=True))
                image_url = img_tag['src'] if img_tag else None

                sentiment, score = analyze_sentiment(headline)

                data.append({
                    'headline': headline,
                    'link': link,
                    'description': description,
                    'image_url': image_url,
                    'published': publish_date,
                    'sentiment': sentiment,
                    'score': round(score, 4)
                })
    return {"news": data}

@app.get("/the-edge/news-sentiment-summary")
def summarize_sentiments():
    news_response = get_news()
    sentiment_list = [item["sentiment"] for item in news_response["news"] if "sentiment" in item]
    
    counts = Counter(sentiment_list)

    return {
        "positive": counts.get("positive", 0),
        "neutral": counts.get("neutral", 0),
        "negative": counts.get("negative", 0),
        "total_news": len(sentiment_list)
    }
# mainpage

# company
# company mthly production data
@app.get("/sqlite/prod-data")
def get_prod_data(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV|KMLOONG)$")):
    try:
        # Connect to SQLite database
        conn = sqlite3.connect(SQLITE_DB)
        
        # Query data for the specific company
        query = f"""
        SELECT * FROM company_monthly_production 
        WHERE company_short_name = '{company.upper()}'
        """
        
        df = pd.read_sql(query, conn)
        df = df[df['date'] > '2025-01-01']
        
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
@app.get("/sqlite/plt-area")
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
@app.get("/sqlite/ext-rates")
def get_ext_rates(company: str = Query(..., regex="^(KLK|IOI|SDG|FGV)$")):
    try:
        conn = sqlite3.connect(SQLITE_DB)
        query = """
        SELECT * FROM company_extraction_rate 
        WHERE UPPER(company_short_name) = UPPER(?)
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
@app.get("/yf/company-summary")
def get_company_description(ticker):
    stock = yf.Ticker(ticker)
    info = stock.info
    summary = info.get('longBusinessSummary', '')

    summary = summary.strip().strip('"').strip("“”").strip("'")
    summary = re.sub(r'^[\"“”\']+|[\"“”\']+$', '', summary)

    return summary

# company share price chart 
@app.get("/yf/price-data")
def get_company_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=30) 
    data = yf.download(ticker, start=start, end=end)

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# company earnings
@app.get("/sqlite/company-earnings")
def get_company_earnings(ticker: str):
    conn = sqlite3.connect(SQLITE_DB)
    query = "SELECT * FROM company_earnings_data"
    eardata = pd.read_sql_query(query, conn)

    # Ensure date is datetime
    eardata["date"] = pd.to_datetime(eardata["date"], errors="coerce")
    eardata = eardata[eardata["company_short_name"] == ticker]

    if eardata.empty:
        raise HTTPException(status_code=404, detail="No earnings data found for this company")

    # Drop rows where revenue and net profit are both missing
    eardata = eardata.dropna(subset=["revenue", "net_profit"], how="all")

    data = []
    for _, row in eardata.iterrows():
        revenue = row.get("revenue", 0) or 0
        net_profit = row.get("net_profit", 0) or 0
        margin = row.get("net_profit_margin", 0) or 0
        date = row["date"]

        data.append({
            "Quarter": date.strftime("%Y-%m-%d") if pd.notnull(date) else "Unknown",
            "Quarter_Date": date,
            "Revenue (Thousand Millions)": round(revenue / 1e9, 4),
            "Net Profit (Thousand Millions)": round(net_profit / 1e9, 4),
            "Net Profit Margin (%)": round(margin, 2)
        })

    # Sort by date
    data = sorted(data, key=lambda x: x["Quarter_Date"])

    # Remove helper column
    for item in data:
        item.pop("Quarter_Date", None)

    return JSONResponse(content={"company": ticker, "data": data})

@app.get("/sqlite/predict-revenue")
def forecast(company: str):
    if company not in coefficients_map:
        raise HTTPException(status_code=404, detail="No coefficients for company")

    # Load all necessary data
    conn = sqlite3.connect(SQLITE_DB)
    revenue_df = pd.read_sql("SELECT * FROM company_earnings_data", conn)
    prod_df = pd.read_sql("SELECT * FROM company_monthly_production", conn)
    commodities_df = pd.read_sql("SELECT * FROM commodities_data", conn)
    conn.close()

    # Parse dates
    revenue_df['date'] = pd.to_datetime(revenue_df['date'])
    prod_df['date'] = pd.to_datetime(prod_df['date'])
    commodities_df['date'] = pd.to_datetime(commodities_df['date'])

    # Get latest revenue entry
    latest_row = revenue_df[revenue_df['company_short_name'] == company].sort_values("date", ascending=False).head(1)
    if latest_row.empty:
        raise HTTPException(status_code=404, detail="No revenue found")

    latest_revenue_date = latest_row.iloc[0]['date']
    latest_revenue_value = latest_row.iloc[0]['revenue']

    # Define the quarter to forecast
    start_next_q = (latest_revenue_date + DateOffset(days=1)).replace(day=1)
    end_next_q = (start_next_q + DateOffset(months=3)) - DateOffset(days=1)
    month_ends = pd.date_range(start=start_next_q, end=end_next_q, freq='ME')

    # === Get production data ===
    def normalize_material(name):
        for base in raw_material_base_names:
            if name.startswith(base):
                return base
        return name

    filtered = prod_df[(prod_df['company_short_name'] == company) & (prod_df['date'].isin(month_ends))].copy()
    filtered['raw_material'] = filtered['raw_material'].apply(normalize_material)

    # Impute missing months
    available_months = set(filtered['date'].dt.to_period('M'))
    expected_months = set(month_ends.to_period('M'))
    missing_months = expected_months - available_months

    dummy_rows = []
    for m in missing_months:
        for mat in coefficients_map[company]['coefficients'].keys():
            dummy_rows.append({
                'date': m.to_timestamp('M'),
                'raw_material': mat,
                'volume': 0,
                'company_short_name': company
            })
    if dummy_rows:
        dummy_df = pd.DataFrame(dummy_rows)
        filtered = pd.concat([filtered, dummy_df], ignore_index=True)

    # Summarize production features
    features_df = (
        filtered.groupby('raw_material')['volume']
        .sum()
        .reset_index()
        .pivot_table(index=None, columns='raw_material', values='volume')
        .fillna(0)
    )

    # === Add FCPO and PK Price from commodities_data ===
    # Mapping
    type_map = {
        "local crude palm oil": "FCPO",
        "palm kernel": "PK Price"
    }

    # Define relevant months: average of 3 months before quarter end
    end_month = end_next_q.replace(day=1)
    start_month = end_month - DateOffset(months=3)
    three_months = pd.date_range(start=start_month, end=end_month, freq='MS').to_period('M')

    # Extract and average FCPO and PK Price
    commodities_df['month'] = commodities_df['date'].dt.to_period('M')
    avg_prices = (
        commodities_df[
            commodities_df['month'].isin(three_months) &
            commodities_df['item'].isin(type_map.keys())
        ]
        .groupby('item')['value']
        .mean()
        .rename(index=type_map)  # Rename to match coefficient feature names
        .to_dict()
    )

    # Inject into features_df
    for feature in ['FCPO', 'PK Price']:
        features_df[feature] = avg_prices.get(feature, 0)

    # Get model config
    config = coefficients_map[company]
    intercept = config['intercept']
    scale = config['scale']
    coefficients = config['coefficients']

    # Ensure all coefficient columns exist in the features
    features_df = features_df.reindex(columns=coefficients.keys(), fill_value=0)
    raw_values = features_df.to_dict(orient='records')[0]

    # === Compute prediction ===
    predicted_revenue = intercept + sum(
        raw_values.get(feature, 0) * coef for feature, coef in coefficients.items()
    )
    predicted_revenue *= scale

    # === Contribution per feature ===
    contributions = {
        feature: round(raw_values.get(feature, 0) * coef * scale, 2)
        for feature, coef in coefficients.items()
    }

    # === Optional: weights ===
    positive_contributions = {k: abs(v) for k, v in contributions.items()}
    total_contribution = sum(positive_contributions.values())
    contribution_weights = {
        k: round((abs(v) / total_contribution) * 100, 1) if total_contribution else 0
        for k, v in contributions.items()
    }

    # === Return with audit (raw feature values too) ===
    return JSONResponse(content={
        "company": company,
        "latest_revenue_date": latest_revenue_date.strftime("%Y-%m-%d"),
        "latest_actual_revenue_mil": round(latest_revenue_value / 1e6, 2),
        "next_quarter": [start_next_q.strftime("%Y-%m-%d"), end_next_q.strftime("%Y-%m-%d")],
        "missing_months_imputed": sorted([str(m) for m in missing_months]),
        "features": raw_values,  # For model input
        "predicted_revenue": round(predicted_revenue, 2),
        "contribution_by_feature": contributions,
        "contribution_weights": contribution_weights,
        "audit_feature_values": features_df.to_dict(orient='records')[0]  # Full features for traceability
    })
# company

# commodities
# mpob stats
@app.get("/sqlite/mpob")
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

# local crude palm oil
@app.get("/sqlite/commodities")
def get_commodities_data():
    try:
        conn = sqlite3.connect(SQLITE_DB)
        df = pd.read_sql(
            "SELECT date, item, value FROM commodities_data WHERE date >= '2025-01-01'", 
            conn
        )        
        if df.empty:
            raise HTTPException(
                status_code=404,
                detail="No data found in commodities_data"
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
@app.get("/yf/soy-price-data")
def get_soy_price_data(ticker: str):
    end = datetime.today()
    start = end - timedelta(days=180)  # last 6 months
    data = yf.download("ZL=F", start=start, end=end, progress=False, proxy="")

    dates = list(data.index.strftime('%Y-%m-%d')) 
    data.columns = data.columns.droplevel(1)  # Remove 'Ticker' level
    prices = data['Close'].tolist()
    return {"dates": dates, "prices": prices}

# fertilizer chart
@app.get("/ws/fertilizer-data")
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
@app.get("/opendosm/fuelprices")
def get_fuel_prices():
    fuel_source = "https://storage.data.gov.my/commodities/fuelprice.csv"
    df = pd.read_csv(fuel_source)

    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df_filtered = df[df['date'] > '2025-01-31'][['date', 'diesel', 'diesel_eastmsia']]
    df_filtered = df_filtered[~((df_filtered['diesel'].fillna(0) == 0) & (df_filtered['diesel_eastmsia'].fillna(0) == 0))]
    df_filtered = df_filtered.drop_duplicates(subset='date', keep='first')
    df_filtered = df_filtered.sort_values(by='date')
    df_filtered['date'] = df_filtered['date'].dt.strftime('%Y-%m-%d')

    return df_filtered.to_dict(orient='records')
# commodities

#export import
#graph theory
@app.get("/sqlite/trade-data")
async def get_trade_data():
    conn = sqlite3.connect(SQLITE_DB)
    query_result = pd.read_sql("SELECT * FROM test_gt", conn)
    dff = query_result[['reporterISO', 'partnerISO', 'reporterDesc', 'refMonth', 'cmdCode', 'fobvalue']]
    data = dff.to_dict(orient="records")
    conn.close()
    
    return JSONResponse(content=data)

#export import and trade surplus/deficit chart
@app.get("/opendosm/exim-data")
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
@app.get("/opendosm/weather-forecast-summary")
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
@app.get("/opendosm/weather-stations")
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
    #rspo_gdf = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp")
    #rspo_gdf = rspo_gdf[rspo_gdf['country'].isin(['Malaysia'])]

    #for col in rspo_gdf.columns:
    #    if rspo_gdf[col].dtype.name.startswith("datetime"):
    #        rspo_gdf[col] = rspo_gdf[col].astype(str)

    #rspo_geojson = rspo_gdf.to_crs(epsg=4326).to_json()
    gdf = df_lab.copy()
    gdf['geometry'] = gpd.points_from_xy(gdf['Longitude'], gdf['Latitude'])
    gdf = gpd.GeoDataFrame(gdf, geometry='geometry', crs="EPSG:4326")

    for col in gdf.columns:
        if pd.api.types.is_datetime64_any_dtype(gdf[col]):
            gdf[col] = gdf[col].dt.strftime('%Y-%m-%d')

    rspo_geojson = gdf.to_json()
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
@app.get("/sqlite/mills")
def get_mills():
    try:
        conn = sqlite3.connect(SQLITE_DB)
        mill_df = pd.read_sql("SELECT * FROM universal_mill_list where ISO = 'MYS'", conn)
        
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
@app.get("/csv/cfr-bar-top6")
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
@app.get("/csv/rfr-bar-top6")
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
@app.get("/csv/drr-bar-top6")
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

#For Azure Deployment
handler = Mangum(app)