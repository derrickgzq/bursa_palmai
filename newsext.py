import pandas as pd

# List of your CSV files
file_names = ["fgv_prod_data.csv", "ioi_prod_data.csv", "klk_prod_data.csv", "sdg_prod_data.csv"]

# Empty list to store individual DataFrames
dfs = []

# Loop through each file and process
for file in file_names:
    company = file[:3].upper()  # Extract first 3 letters as company name and capitalize
    df = pd.read_csv(file, delimiter="|")
    df["company"] = company  # Add company column
    dfs.append(df)

# Combine all into one DataFrame
combined_df = pd.concat(dfs, ignore_index=True)

# View the result
print(combined_df)
