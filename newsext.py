import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import date, timedelta

offsets = [0, 10, 20, 30]
news_list = []

today = date.today()
start_date = today - timedelta(days=30)

for offset in offsets:
    news_url = (
        "https://theedgemalaysia.com/news-search-results?"
        f"keywords=palm%20oil&to={today}&from={start_date}&language=english&offset={offset}"
    )

    try:
        response = requests.get(news_url)
        soup = BeautifulSoup(response.content, "html.parser")

        links_with_title = [
            a for a in soup.select("a[href*='/node/']")
            if a.select_one("span.NewsList_newsListItemHead__dg7eK")
        ]

        for a in links_with_title:
            title = a.select_one("span.NewsList_newsListItemHead__dg7eK").get_text(strip=True)
            link = "https://theedgemalaysia.com" + a.get("href")
            html_link = f"<a href='{link}' target='_blank'>{link}</a>"
            news_list.append({"title": title, "link": html_link})
    
    except Exception as e:
        print(f"An error occurred while extracting data: {e}")

# Convert to DataFrame
news_df = pd.DataFrame(news_list)
print(news_df)
print(news_df['link'][22])