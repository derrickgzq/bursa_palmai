import pandas as pd

url = "https://storage.data.gov.my/commodities/fuelprice.csv"

# Read CSV directly from URL
df = pd.read_csv(url)

# Display first 5 rows
print(df.head())
print(len(df))
