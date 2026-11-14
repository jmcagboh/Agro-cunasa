# TerraShift

Aide à la décision pour comparer des rotations de cultures, partout dans le monde, avec le climat NASA POWER d’un point choisi. TerraShift ne remplace ni le jugement de l’agriculteur ni un conseiller local.

Défi NASA Space Apps 2026, « Field Shift: Adapting Farms with NASA Data ».

Site : https://jmcagboh.github.io/Agro-cunasa/

## Parcours

1. Le logo s’affiche, puis l’accueil.
2. Créer un compte ou se connecter. Le mot de passe est hashé chez Supabase.
3. Choisir le lieu. **Satellite** montre l’image réelle Esri / Maxar. **Plan** revient aux routes.
4. Décrire la parcelle : sol vu sur place, pente, irrigation, rotation actuelle, priorités.
5. Lancer l’analyse. L’application lit la série journalière NASA POWER 2011–2024 pour ce point.
6. Sur téléphone, le bouton **Menu** ouvre Lieu, Parcelle, Résultat, Alertes, la langue et la sortie. Une barre reste en bas.

## Alertes

Le numéro se saisit sur la page de connexion, à la création du compte ou en se reconnectant. Le message préparé dit la rotation la mieux notée et le climat habituel du lieu (pluie, température, saison, jours chauds), d’après 2011–2024. Ce n’est pas la météo des prochains jours.

Le numéro est enregistré dans les métadonnées du compte Supabase. L’envoi SMS n’est pas branché : aucun texto ne part. Le texte reste dans **Alertes**.

En choisissant une ville, la carte zoome jusqu’aux rues. L’image satellite Esri / Maxar se précise avec le zoom. Ce n’est pas une caméra en direct.

Le texte à coller sur spaceappschallenge.org est dans `docs/NASA-submission.md`. La page NASA doit être en anglais. Date limite : 15 novembre 2026, 23 h 59, heure locale.

## Lancer en local

`run.bat` ou `bash run.sh`, puis http://localhost:5173

Copier `frontend/.env.example` vers `frontend/.env.local` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=la-cle-anon-publique
```

Dans Supabase, Authentication → URL Configuration : `http://localhost:5173` et `https://jmcagboh.github.io`. Pour entrer sans mail de confirmation : Authentication → Sign In / Providers → Email, décocher Confirm email.

La clé `service_role` ne va pas dans le dépôt. `frontend/.env.local` est ignoré par Git.

L’API Python (`uvicorn`) sert le cache POWER, le score testé et d’anciennes routes de compte locales. Les écrans utilisent Supabase et NASA POWER directement dans le navigateur.

## Données

NASA POWER, communauté AG : `PRECTOTCORR`, `T2M`, `T2M_MIN`, `T2M_MAX`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `EVPTRNS`, `GWETROOT`, `GWETTOP`.

La recherche de lieu passe par Open-Meteo. Le sol et la pente sont saisis à la main. Le bilan hydrique utilise Hargreaves : `EVPTRNS` est un flux d’énergie, pas une lame d’eau.

SMAP, GPM/IMERG, NDVI, ECOSTRESS et GRACE sont seulement dans la feuille de route. Aucun chiffre de l’écran ne vient d’eux.

## Tests

`pytest` — moteur de score, sur données synthétiques.

## Publier les pages

Depuis `frontend`, `npm run build`, puis copier `dist/index.html` et `dist/assets` à la racine du dépôt, avec `.nojekyll`. Le site GitHub Pages sert cette racine. La clé anon est incluse dans le JavaScript public, ce qui est prévu pour cette clé.
