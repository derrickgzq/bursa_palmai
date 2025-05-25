import geopandas as gpd
import pandas as pd

# Load palm oil concessions (e.g., from GeoJSON or Shapefile)
concessions = gpd.read_file("rspo_oil_palm/rspo_oil_palm_v20200114.shp")
concessions = concessions[concessions['country'].isin(['Malaysia'])]

# Load drought risk zones with severity labels
drought_risk = gpd.read_file("aqueduct/aqueduct.gpkg")

# Ensure same CRS (important for accurate area calculation)
concessions = concessions.to_crs(epsg=3857)
drought_risk = drought_risk.to_crs(epsg=3857)

# Calculate original concession area (in m²)
concessions["concession_area"] = concessions.geometry.area

# Spatial intersection between concession polygons and drought risk zones
intersection = gpd.overlay(concessions, drought_risk, how="intersection")

# Calculate intersected area (m²)
intersection["intersect_area"] = intersection.geometry.area

# Calculate percentage of concession overlapped by each drought risk label
intersection["pct_overlap"] = (intersection["intersect_area"] / intersection["concession_area"]) * 100

# Add relevant columns for grouping
intersection["gfw_fid"] = intersection["gfw_fid"]  # From concessions
intersection["drr_label"] = intersection["drr_label"]  # From drought_risk

# Group by concession and drought risk label
summary = (
    intersection[["gfw_fid", "company", "plantation", "drr_label", "pct_overlap"]]
    .groupby(["gfw_fid", "company", "plantation", "drr_label"])
    .sum()
    .reset_index()
)

# Optional: round for clarity
summary["pct_overlap"] = summary["pct_overlap"].round(2)

summary.to_csv('drr_summary.csv')

