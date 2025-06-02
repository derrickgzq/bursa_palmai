import requests
from bs4 import BeautifulSoup
import pandas as pd

# URL to scrape
url = "https://theedgemalaysia.com/news-search-results?keywords=palm%20oil&to=2025-05-31&from=1999-01-01&language=english&offset=0"

# Send GET request
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# Find all relevant news container divs
news_items = soup.find_all('div', class_='NewsList_newsListText__hstO7')

# Prepare data list
data = []

for item in news_items:
    a_tag = item.find('a', href=True)
    headline_tag = item.find('span', class_='NewsList_newsListItemHead__dg7eK')
    description_tag = item.find('span', class_='NewsList_newsList__2fXyv')

    if a_tag and headline_tag and description_tag:
        link = a_tag['href']
        # Convert relative links to absolute if needed
        if link.startswith('/'):
            link = f"https://example.com{link}"  # Replace with your domain
        
        headline = headline_tag.get_text(strip=True)
        description = description_tag.get_text(strip=True)
        
        data.append({
            'headline': headline,
            'link': link,
            'description': description
        })

# Convert to DataFrame
df = pd.DataFrame(data)

# Display result
print(df)
