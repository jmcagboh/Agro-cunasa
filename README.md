# TerraShift

Aide à la décision pour comparer des rotations de cultures, partout dans le monde, à partir du climat NASA POWER. TerraShift ne remplace ni le jugement de l’agriculteur ni un conseiller local.

Défi NASA Space Apps 2026, « Field Shift: Adapting Farms with NASA Data ».

Site : https://jmcagboh.github.io/Agro-cunasa/

## Utiliser

Ouvrir le site, choisir un lieu sur la carte, puis « Analyser ce lieu avec NASA POWER ». L’application lit la série journalière 2011–2024 directement auprès de NASA POWER. Il n’y a pas de mode démo.

En local : `run.bat` ou `bash run.sh`, puis http://localhost:5173

L’accueil demande un compte. Le mot de passe est hashé (PBKDF2) dans `data/users.sqlite`, jamais écrit en clair. Cette base est sur la machine qui lance l’API : GitHub Pages seul ne peut pas garder les comptes.

## Sources

NASA POWER, communauté AG : `PRECTOTCORR`, `T2M`, `T2M_MIN`, `T2M_MAX`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `EVPTRNS`, `GWETROOT`, `GWETTOP`.

La recherche de lieu passe par Open-Meteo. Le sol et la pente sont saisis à la main. L’évapotranspiration du bilan hydrique est estimée par Hargreaves : `EVPTRNS` est un flux d’énergie, pas une lame d’eau.

SMAP, GPM/IMERG, NDVI, ECOSTRESS et GRACE sont seulement dans la feuille de route.

## Tests

`pytest` — moteur de score, sur données synthétiques.
