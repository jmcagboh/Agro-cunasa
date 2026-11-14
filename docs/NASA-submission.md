# Texte à coller sur spaceappschallenge.org

Le site NASA exige l’anglais. Ouvre l’onglet Project de l’équipe, Edit, et colle chaque bloc dans le champ indiqué. La limite est le 15 novembre 2026, 23 h 59, heure locale. Ajoutez les noms de l’équipe sur la page Members. Le diaporama anglais de 7 pages est `docs/TerraShift-NASA-7slides.pptx` : mettez-le en lien public (Drive) pour le champ Project Demo.

## Project Name

TerraShift

## High-Level Summary

TerraShift helps a farmer compare crop rotations for one field, anywhere on Earth, using the real climate of that point. It answers the NASA Space Apps 2026 challenge Field Shift: Adapting Farms with NASA Data. The farmer picks a place, describes the field, and sees which rotation fits the 2011–2024 NASA POWER record, and why. It is decision support. It does not replace the farmer’s judgment or a local adviser.

## Project Demo

Link a public copy of `docs/TerraShift-NASA-7slides.pptx` (7 slides, English). The live product is https://jmcagboh.github.io/Agro-cunasa/

## Final Project

https://jmcagboh.github.io/Agro-cunasa/

Source code: https://github.com/jmcagboh/Agro-cunasa

## Project Details

TerraShift is a web application. After a short logo screen, the farmer creates an account with email, password, and phone number. The password is hashed by Supabase and is never stored in the repository. On a phone, a menu and a bottom bar open Place, Field, Result, and Alerts.

The farmer searches for a town or taps the map. The map then zooms to street level. Satellite view uses Esri World Imagery (Maxar) with road and place-name overlays, so blocks, roofs, and fields become visible as the user zooms, in the same way as a satellite map. These are satellite photographs of the place, not a live camera and not a weather radar.

The farmer enters soil, slope, irrigation, the current rotation, and priorities: water, erosion, organic matter, nitrogen, income, breaking pest cycles, and fodder. The app requests the NASA POWER daily series for that latitude and longitude from 2011 through 2024. It estimates evapotranspiration with the Hargreaves method, because the POWER variable EVPTRNS is an energy flux, not a water depth in millimeters. It then scores the current rotation and alternative sequences. Each strategy shows a score, the reasons, the climate evidence, and the information that is still missing. A slider can warm or dry the historical climate. That slider is a sensitivity test, not a forecast.

Alerts prepare a message for the saved phone number: the best-scoring rotation, and the usual climate of the place (annual rain, temperature, growing-season length, hot days). The text is shown in the app. No SMS is sent, because no SMS provider is connected.

Stack: React, TypeScript, Vite, Tailwind, Leaflet, Recharts, Supabase Auth. A Python FastAPI service and pytest cover the same scoring rules for local checks. GitHub Pages serves the website.

## Use of AI

Cursor, an AI coding assistant, was used to implement the application, revise the interface, and draft this submission text. The team reviewed the data claims. Add any other AI tools the team used. If nobody used another tool, leave this paragraph as it is.

## NASA Data / Partner Data

NASA POWER, Prediction Of Worldwide Energy Resources, agroclimatology community.
https://power.larc.nasa.gov/

Daily point data, 1 January 2011 to 31 December 2024, no API key.
Parameters used: PRECTOTCORR, T2M, T2M_MIN, T2M_MAX, RH2M, ALLSKY_SFC_SW_DWN, EVPTRNS, GWETROOT, GWETTOP.
Documentation: https://power.larc.nasa.gov/docs/services/api/

POWER grid spacing is about 0.5° × 0.625°. It describes the climate of the area, not a measurement inside one square meter of the field.

SMAP, GPM/IMERG, MODIS or Landsat NDVI, ECOSTRESS, and GRACE are named only on an in-app roadmap. No number on the screen comes from them.

## References

- NASA POWER API, https://power.larc.nasa.gov/
- Open-Meteo Geocoding API, https://open-meteo.com/en/docs/geocoding-api
- Esri World Imagery, including Maxar and Earthstar Geographics imagery, https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9
- OpenStreetMap contributors, https://www.openstreetmap.org/copyright
- React, https://react.dev/
- Vite, https://vitejs.dev/
- Leaflet, https://leafletjs.com/
- Recharts, https://recharts.org/
- Supabase Auth, https://supabase.com/docs/guides/auth
- Tailwind CSS, https://tailwindcss.com/
- FastAPI, https://fastapi.tiangolo.com/
- pandas and NumPy, https://pandas.pydata.org/
- Cursor, https://cursor.com/

The project is the team’s original work. External libraries, imagery, and the AI assistant are listed above.
