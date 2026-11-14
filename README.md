# RotaSol

Aide à la décision pour comparer des rotations de cultures, partout dans le monde, à partir du climat NASA POWER. RotaSol ne remplace ni le jugement de l’agriculteur ni un conseiller local.

Défi NASA Space Apps 2026, « Field Shift: Adapting Farms with NASA Data ».

## Lancer

Windows : `run.bat`  
macOS / Linux : `bash run.sh`

Puis ouvrir http://localhost:5173  
API : http://localhost:8000/docs

Le parcours démo (Lomé) s’affiche tout de suite, sans appel NASA. Déplacer la carte ou chercher un lieu interroge NASA POWER (la première fois peut prendre une minute ; le fichier est ensuite en cache).

## Tests

```bash
pytest
```

Uniquement le moteur de score et le calcul climatique sur données synthétiques.

## Sources

- NASA POWER, communauté AG, série journalière, sans clé : `PRECTOTCORR`, `T2M`, `T2M_MIN`, `T2M_MAX`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `EVPTRNS`, `GWETROOT`, `GWETTOP`.
- Recherche de lieu : Nominatim (OpenStreetMap).
- Sol et pente : saisie manuelle.

SMAP, GPM/IMERG, NDVI, ECOSTRESS et GRACE sont décrits dans l’écran Feuille de route. Ils ne fournissent aucun chiffre.

## Hypothèses

- Fenêtre par défaut : 2011–2024.
- Le bilan hydrique utilise l’ETP de Hargreaves (températures + latitude). `EVPTRNS` est un flux d’énergie en MJ/m²/jour ; à Lomé il correspond à environ 1 mm/jour, ce qui n’est pas une ETP culturale crédible. Il est archivé et affiché, pas converti en lame d’eau.
- Jour de chaleur : Tmax > 35 °C. Jour de gel : Tmin ≤ 0 °C. Pluie extrême : ≥ 50 mm/jour. Un indicateur interne de « risque de froid » utilise aussi ≤ 2 °C.
- Mois sec / humide : pluie − ETP en dessous de −20 mm ou au-dessus de +20 mm. Saison de croissance : mois où la pluie atteint au moins la moitié de l’ETP.
- Les traits des cultures (`data/crops.json`) sont indicatifs (0–1), pas des normes variétales.
- Le scénario ± pluie / ± température est un test de sensibilité, pas une projection.
- Les textes de l’interface sont en français et en anglais. Les notes agronomiques des cultures restent en français.
- Toute réponse de démo porte `is_demo: true`. Sans cache NASA, les chiffres de Lomé sont synthétiques et la source le dit explicitement.

## Limites

Grille POWER d’environ 50 km, pas la parcelle. Pas de sol ni de relief mesurés. Pas de prix de marché locaux. À confronter à un expert du territoire.
