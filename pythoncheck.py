import pandas as pd
from datetime import datetime, timedelta
import yfinance as yf

end = datetime.today()
start = end - timedelta(days=180)  # last 6 months
data = yf.download('AAPL', start=start, end=end)

ticker = yf.Ticker("2445.KL")
description = ticker.info.get('longBusinessSummary')

print(description)
