# TerraShift

Comparer des rotations de cultures avec le climat NASA POWER d’un point choisi. Cela ne remplace ni le jugement de l’agriculteur ni un conseiller local.

NASA Space Apps 2026, Field Shift.

Site : https://jmcagboh.github.io/Agro-cunasa/

Compte Supabase : e-mail, mot de passe, téléphone. La carte satellite zoome jusqu’aux rues. L’analyse lit NASA POWER, 2011–2024. Le message d’alerte reste dans l’application : aucun SMS n’est envoyé.

En local : `run.bat`, puis http://localhost:5173. Copier `frontend/.env.example` vers `frontend/.env.local`.

Données utilisées : NASA POWER (`PRECTOTCORR`, températures, `RH2M`, rayonnement, `EVPTRNS`, humidité du sol). Le bilan d’eau est Hargreaves. SMAP, GPM, NDVI, ECOSTRESS et GRACE ne sont pas branchés.

`pytest` teste le moteur de score.
