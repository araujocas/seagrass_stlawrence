# seagrass_stlawrence
Dataset and example of GEE code for "Massive increase of intertidal seagrass coverage in a large estuarine system revealed by four decades of Landsat imagery", by Araújo et al. (2025). doi: https://doi.org/10.1016/j.rsase.2025.101623

The dataset, located in the "data" folder, consists of shapefiles representing the spatial distribution of seagrass (eelgrass, Zostera marina). These shapefiles are organized into ZIP archives grouped by subregion (BSI, MAN, RIB, and IVE). Each shapefile is named according to its subregion followed by the survey year. Additionally, for each subregion, there is a shapefile named "xxx_emerged" (where "xxx" corresponds to the subregion). This file represents the intertidal area considered in the study, and all shapefiles within that subregion are spatially constrained by it.
DISCLAIMER: This dataset was generated using Landsat imagery with a spatial resolution of 30 meters and should be used with caution. Users should be aware that small classification errors are expected, as the regions exhibit significant intrapixel variability (e.g., presence of macroalgae, bare sediment).

The provide code 


## Usage Notice
The data and code in this repository is intended for academic and non-commercial use only.  
If you access this repository outside of the DOI-published version on Zenodo, please refer to the official release. By using this code, you agree to comply with the usage terms specified in the Zenodo publication.
