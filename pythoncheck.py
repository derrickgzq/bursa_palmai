import pandas as pd
from datetime import datetime, timedelta
import yfinance as yf

# Replace with your ticker
ticker = yf.Ticker("2445.KL")  # Example: "2445.KL" for KPJ Healthcare Berhad

# Get quarterly earnings DataFrame
earnings = ticker.quarterly_financials

# Display the latest 3 quarters
print("Latest 3 Quarterly Earnings:")
print(earnings)  # Show top 3 most recent quarters
