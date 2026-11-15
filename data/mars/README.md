# Mars scientific sources

The game uses historical records, never current Mars weather. UI resource percentages are simulation points.

- Mars Trek WMTS: controlled MRO HiRISE Jezero mosaic `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`. Original `WMTSCapabilities.xml`, z12/z13 tile copies and SHA-256 values are included. The grid is geographic, EPSG:104905; tile placement uses its actual matrix dimensions, origin and a local Mars projection.
- Elevation: USGS CTX Jezero DTM, 20 m/pixel, DOI [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8). The source URL/hash and bilinear samples are in `routes.json`. WMTS imagery is not treated as an elevation raster. Base and routes are fictional.
- MEDA RDS: calibrated `RDS_TOP_7` irradiance in W/m² from sols 310, 313 and 320, 12:40–12:49 LTST. Positive readings with `ROVER_STILL=1` are retained. Missing antenna-still flags remain explicitly unknown. The extract contains original field values and source line numbers; XML labels are unmodified.
- MOXIE: derived products from sols 60 and 535. `F_O2_I_G_HR` is oxygen flow inferred from SOXE current. Trapezoidal integration gives approximately 5.396 g and 9.103 g; `E_TOT_W_HR` gives 626.13 Wh and 682.4 Wh for the complete cycles. Original labels and full selected-column time series are included.
- PDS Search: original bundle metadata query responses are saved with retrieval time, HTTP status and SHA-256 in `science.json`. The browser attempts metadata requests once per instrument; failed/CORS-blocked requests are labeled as unavailable, with the cached reference clearly identified. Scientific measurements are local historical extracts, not live API responses.

`mars-science.js` contains adjustable simulation parameters. Dust opacity and deposition, cleaning probability, crew requirements, vehicle speed/energy and accumulated radiation points are model assumptions. Cleaning improves power available during the oxygen cycle. MOXIE output remains at its original gram scale and cannot sustain five people. All Mars crew oxygen calculations use 175 g/hour and 60 g per resource point; operation-specific energy costs and radiation rates are documented in the in-game technical panel.

Regenerate with Python 3 and Pillow:

```sh
python3 scripts/prepare-mars.py /absolute/path/to/download-cache
```

The script downloads the originals, verifies parsed fields, samples the numeric DTM, computes derived quantities and writes reference metadata. It does not rewrite gameplay configuration.
