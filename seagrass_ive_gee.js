//////////////////////////////////////////////////////////////////////////////////////////////////////
// Example code for the retrieval of emerged areas and seagrass cover in the region of L'Isle-Verte, in
// the Estuary and Gulf of St. Lawrence (Québec, Canada). Refer to article: "Massive increase of
// intertidal seagrass coverage in a large estuarine system revealed by four decades of Landsat imagery".
// Available at: https://doi.org/10.1016/j.rsase.2025.101623
// Developed by Carlos Araújo
//////////////////////////////////////////////////////////////////////////////////////////////////////

//// UPLOAD REGION OF INTEREST (roi) AND EXPANDED AREA (FOR VISUALIZATION):
var roi = ee.FeatureCollection("projects/shared-assets-1/assets/roi_ive"),
    ea = ee.Geometry.MultiPolygon(
        [[[[-69.24633555454352, 48.13687035544423],
           [-69.24633555454352, 48.13687035544423],
           [-69.24633555454352, 48.13687035544423],
           [-69.24633555454352, 48.13687035544423]]],
         [[[-69.5306067947779, 48.11395348073427],
           [-69.5306067947779, 47.93945100234268],
           [-69.25320200962165, 47.93945100234268],
           [-69.25320200962165, 48.11395348073427]]]], null, false);
////

//// MAP ADJUSTMENT FOR BETTER VISUALIZATION:
Map.centerObject(roi);
////

//// USER-DECLARED VARIABLES (SENSITIVE FOR EACH SUBREGION OR IMAGE):
// Thresholds for minimum areas after cloud and water masks:
var valcloudmin = 20000; // minimum pixel countings after cloud mask //
var valpcloudmin = 0.5; // minimum percentage of cloud-free pixels //
var vallandmin = 20000; // minimum pixel countings after water mask //
// Mean band values of segments used for the retrieval of "emerged" and "eelgrass" classes:
var nircut = 0.05;
var ndvicut = 0.4;
var redcut = 0.04;
var ndmicut = 0.4;
// Location of images to exclude after visual inspection (applied to dt3): 
var manusel = [1, 3, 5, 6, 9, 10, 13, 16, 17, 20, 22, 24, 25, 27, 28, 30, 34, 35, 39, 40, 41,
  48, 53, 58, 60, 62, 63, 64, 65, 71, 72, 76, 77, 82, 83, 84, 87, 88, 92, 93, 97,
  101, 102, 104, 106, 107, 108, 109, 110, 114, 115, 116, 117, 119];
// Position of images to be added as map objects:
var pos = 11;
////

//// FUNCTIONS: 
// F1 - Mask images outside polygons.
//roi:
function maskroi(img) {
  var mask = img.clip(roi);
  return img.updateMask(mask);
}
//ea:
function maskea(img) {
  var mask = img.clip(ea);
  return img.updateMask(mask);
}
// F2 - Apply scaling factors:
var banames1 = ['blue','green','red','nir','swir1','swir2'];
var slope = 0.0000275;
var bias = -0.2;
function applyScaleFactors(img) {
  var opticalBands = img.select(banames1).multiply(slope).add(bias);
  return img.addBands(opticalBands, null, true);
}
// F3 - Calculate spectral indices and add as a band:
function addInd(img) {
  var ndvi = img.normalizedDifference(['nir', 'red']).rename('NDVI');
  var ndmi = img.normalizedDifference(['nir', 'swir1']).rename('NDMI');
  return img.addBands(ndvi).addBands(ndmi);
}
// F4 - Counting of valid pixels:
function countpix(img) {
  var dictionary = img.reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: roi
  });
  return ee.Image(img.setMulti(dictionary)); 
}
// F5 - Mask cloud pixels:
function maskclou(img) {
  var cloudsBitMask1 = (1 << 1); // Bits 1 and 3, clouds (CFMASK)
  var cloudsBitMask2 = (1 << 3);
  var qa = img.select('QA');
  var mask = qa
    .bitwiseAnd(cloudsBitMask1).eq(0)
    .and(qa.bitwiseAnd(cloudsBitMask2).eq(0));
  return img.updateMask(mask);
}
// F6 - Add a list element to a Feature Collection as a property of each image:
//"pixcloudthresh"//
function addele1(li) {
  return ee.Feature(ee.List(li).get(0)).set('pixcloudthresh', ee.List(li).get(1));
}
//"landpix"//
function addele2(li) {
  return ee.Feature(ee.List(li).get(0)).set('landpix', ee.List(li).get(1));
}
//"manualsel"//
function addele3(li) {
  return ee.Feature(ee.List(li).get(0)).set('manualsel', ee.List(li).get(1));
}
// F7 - Apply gaussian filter:
var raio = 3;
var gaussi = ee.Kernel.gaussian({ radius: raio });
function fedge(img) {
  var edgy = img.convolve(gaussi);
  return edgy;
}
// F8 - Segmentation (SNIC) algorithms.
//Emerged class - NIR-based approach:
var sg1 = 11;
var nb1 = 22;
var seeds1 = ee.Algorithms.Image.Segmentation.seedGrid(sg1);
function segIC1(img) {
  var snic = ee.Algorithms.Image.Segmentation.SNIC({
    image: img,
    compactness: 0,
    connectivity: 4,
    neighborhoodSize: nb1,
    seeds: seeds1
    });
  return snic.select('clusters');
}
//Eelgrass class:
var sg2 = 8;
var nb2 = 16;
var seeds2 = ee.Algorithms.Image.Segmentation.seedGrid(sg2);
function segIC2(img) {
  var snic = ee.Algorithms.Image.Segmentation.SNIC({
    image: img,
    compactness: 0,
    connectivity: 4,
    neighborhoodSize: nb2,
    seeds: seeds2
    });
  return snic.select('clusters');
}
// F9 - Attribute unique ID ("labels") to segmented images:
function unid(img) {
  var objectId = img.connectedComponents({
    connectedness: ee.Kernel.plus(1),
    maxSize: 128
  });
  return objectId;
}
// F10 - Calculate zonal means, for each patch defined in "labels":
function patchmeans(img) {
  var zonal = img.reduceConnectedComponents({
    reducer: ee.Reducer.mean(),
    labelBand: 'labels'
  });
  return zonal;
}
// F11 - Obtain an image with "value=1" from a predefined selection criteria.
//Emerged area: 
function emerg(img) {
  var emergi = img.gte(nircut)
  .selfMask()
  .rename('emerged');
  return emergi;
}
//Eelgrass:
function eelg(img) {
  var bandA = img.select('NDVI');
  var bandB = img.select('red');
  var bandC = img.select('NDMI');
  var eelg1 = bandA.gte(ndvicut).and(bandB.lte(redcut)).and(bandC.gte(ndmicut))
  .selfMask()
  .rename('eelgrass');
  return eelg1;
}
// F12 - Mask all bands using an specific band:
function maskemerg(img) {
  var mask = img.select('emerged');
  return img.updateMask(mask);
}
////

//// PROCESSING CHAIN:
// Load Landsat collections:
var banames2 = ['blue','green','red','nir','swir1','swir2','QA'];
var decol1 = 'LANDSAT/LT04/C02/T1_L2';
var dtx1 = ee.ImageCollection(decol1)
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(6, 10, 'month'))
    .filter(ee.Filter.calendarRange(1984, 2023, 'year'))
    .filter(ee.Filter.eq('WRS_PATH', 12))
    .select(['SR_B.','QA_PIXEL'],banames2);
var decol2 = 'LANDSAT/LT05/C02/T1_L2';
var dtx2 = ee.ImageCollection(decol2)
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(6, 10, 'month'))
    .filter(ee.Filter.calendarRange(1984, 2023, 'year'))
    .filter(ee.Filter.eq('WRS_PATH', 12))
    .select(['SR_B.','QA_PIXEL'],banames2);
var decol3 = 'LANDSAT/LE07/C02/T1_L2';
var dtx3 = ee.ImageCollection(decol3)
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(6, 10, 'month'))
    .filter(ee.Filter.calendarRange(1984, 2023, 'year'))
    .filter(ee.Filter.eq('WRS_PATH', 12))
    .select(['SR_B.','QA_PIXEL'],banames2);
var decol4 = 'LANDSAT/LC08/C02/T1_L2';
var dtx4 = ee.ImageCollection(decol4)
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(6, 10, 'month'))
    .filter(ee.Filter.calendarRange(1984, 2023, 'year'))
    .filter(ee.Filter.eq('WRS_PATH', 12))
    .select(['SR_B[2-7]','QA_PIXEL'],banames2);
var decol5 = 'LANDSAT/LC09/C02/T1_L2';
var dtx5 = ee.ImageCollection(decol5)
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(6, 10, 'month'))
    .filter(ee.Filter.calendarRange(1984, 2023, 'year'))
    .filter(ee.Filter.eq('WRS_PATH', 12))
    .select(['SR_B[2-7]','QA_PIXEL'],banames2);
var dtx6 = dtx1.merge(dtx2.merge(dtx3.merge(dtx4.merge(dtx5))));
var dtx7 = dtx6.sort('DATE_ACQUIRED');
// Apply mask and scalling factors:
var dtx8 = dtx7.map(maskroi);
var dtx9 = dtx8.map(applyScaleFactors);
// Calculate indices:
var dt1 = dtx9.map(addInd);
print(dt1, 'dt1: All available images that covers the ROI area');
//
// Apply cloud mask and refine selection based on minimum percentage of cloudfree pixels:
var dtx10 = dt1.map(countpix);
var a1 = ee.Array(dtx10.aggregate_array('red'));
var dtx11 = dt1.map(maskclou);
var dtx12 = dtx11.map(countpix);
var a2 = ee.Array(dtx12.aggregate_array('red'));
var a3 = a2.divide(a1);
var a4 = a2.gt(valcloudmin);
var a5 = a3.gt(valpcloudmin);
var a6 = a4.and(a5); 
var f1 = ee.FeatureCollection(dtx11);
var l1 = f1.toList(f1.size()).zip(a6.toList()); // boolean list to be added to an ImageCollection //
var dtx13 = ee.ImageCollection(l1.map(addele1));
var dt2 = dtx13
  .filter(ee.Filter.eq('pixcloudthresh', 1));
print(dt2, 'dt2: Available images after cloud mask');
//
// Retrieval of emerged area class:
var dtx14 = dt2.select('nir');
var dtx15 = dtx14.map(fedge);
var dtx16 = dtx14.combine(dtx15).sort('DATE_ACQUIRED');
var dtx17 = dtx16.map(segIC1);
var dtx18 = dtx17.map(unid);
var dtx19 = dtx18.select('labels').combine(dtx14).sort('DATE_ACQUIRED');
var dtx20 = dtx19.map(patchmeans);
var dtx21 = dtx20.map(emerg);
var dtx22 = dt2.combine(dtx21).sort('DATE_ACQUIRED');
var dtx23 = dtx22.map(countpix);
var a7 = ee.Array(dtx23.aggregate_array('emerged'));
var f2 = ee.FeatureCollection(dtx23);
var l2 = f2.toList(f2.size()).zip(a7.toList());
var dtx24 = ee.ImageCollection(l2.map(addele2));
var dt3 = dtx24
  .filter(ee.Filter.gt('landpix', vallandmin));
print(dt3, 'dt3: Available images after water mask');
//
// Reduce number of images after visual inspection:
var a8 = dt3.size();
var l3 = ee.List.repeat(1, a8);
var l4 = ee.List(manusel);
var newval = 0;
var l5 = ee.List.sequence(0, a8.subtract(1)).map(function(index) {
  return ee.Algorithms.If(l4.contains(index), newval, l3.get(index));
});
var f3 = ee.FeatureCollection(dt3);
var l6 = f3.toList(f3.size()).zip(l5);
var dtx25 = ee.ImageCollection(l6.map(addele3));
var dt4 = dtx25
  .filter(ee.Filter.eq('manualsel', 1));
print(dt4, 'dt4: Selected images after visual inspection');
//
// Retrieval of eelgrass class:
var dtx26 = dt4.map(maskemerg);
var dtx27 = dtx26.select('blue', 'green', 'red');
var dtx28 = dtx27.map(fedge);
var dtx29 = dtx27.combine(dtx28).sort('DATE_ACQUIRED');
var dtx30 = dtx29.map(segIC2);
var dtx31 = dtx30.map(unid);
var dtx32 = dtx31.select('labels').combine(dtx26).sort('DATE_ACQUIRED');
var dtx33 = dtx32.map(patchmeans);
var dtx34 = dtx33.map(eelg);
var dtx35 = dt4.select('blue','green','red','nir','swir1','swir2','NDVI','NDMI','emerged');
var dtx36 = dtx35.combine(dtx34).sort('DATE_ACQUIRED');
var dt5 = dtx36.select('emerged', 'eelgrass');
print(dt5, 'dt5: "eelgrass" and "emerged" classes');
// 
// Expanded area ("ea") retrieval for context visualization:
var l7 = dt4.aggregate_array('system:index');
var dtx38 = ee.ImageCollection.fromImages(
  l7.map(function(id) {
    var img = dtx7.select(banames1).filter(ee.Filter.eq('system:index', id)).first();
    return img.set('system:index', id);
  })
);
var dtx39 = dtx38.map(maskea);
var dt6 = dtx39.map(applyScaleFactors);
print(dt6, 'dt6: Original bands in expanded area for context visulization');
////

//// ADD A RGB IMAGE OF THE EXPANDED AREA AND THE 2 CLASSES AS MAP OBJECTS:
// Expanded area RGB:
var loi1 = dt6.toList(dt6.size());////declare which imagecollection
var seim1 = ee.Image(loi1.get(pos));
var comp1 = ['red', 'green', 'blue'];
var vispc1 = {
  min: 0,
  max: 0.2,
};
var seim1A = seim1.select(comp1);
Map.addLayer(seim1A, vispc1, 'True RGB - Exp. Area', 1);
// Emerged class:
var loi2 = dt5.toList(dt5.size());
var seim2 = ee.Image(loi2.get(pos));
var comp2 = 'emerged';
var seim2A = seim2.select(comp2);
var vectors1 = seim2A.reduceToVectors({
  geometry: roi,
  geometryType: 'polygon',
  reducer: ee.Reducer.countEvery(),
  maxPixels: 1e13,
});
var empty = ee.Image().byte();
var outline1 = empty.paint({
  featureCollection: vectors1,
  color: 1,
  width: 1
});
Map.addLayer(outline1, {palette: 'FF0000'}, 'emerged area', 1);
// Eelgrass class:
var loi3 = dt5.toList(dt5.size());
var seim3 = ee.Image(loi3.get(pos));
var comp3 = 'eelgrass';
var seim3A = seim3.select(comp3);
var vectors2 = seim3A.reduceToVectors({
  geometry: roi,
  geometryType: 'polygon',
  reducer: ee.Reducer.countEvery(),
  maxPixels: 1e13,
});
var empty = ee.Image().byte();
var outline2 = empty.paint({
  featureCollection: vectors2,
  color: 1,
  width: 1
});
Map.addLayer(outline2, {palette: 'green'}, 'eelgrass', 1);
////

//////////////////////////////////////////////////////////////////////////////////////////////////////
