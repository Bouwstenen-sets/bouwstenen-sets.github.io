# Bouwstenen — klantensite

Leest live de productlijst uit jullie voorraad-app. Bevat geen namen, inkoop of verkopen.

## Online zetten (± 10 min)
1. GitHub → rechtsboven + → **New organization** → kies **Free**.
   Naam bijv. `bouwstenen` (als die bezet is: `bouwstenen-nl`, `bouwstenen-sets`).
   Contact-e-mail mag je eigen adres zijn; dat is niet openbaar.
2. In die organisatie: **New repository** → naam precies `<organisatienaam>.github.io`
   (bijv. `bouwstenen-nl.github.io`) → **Public** → Create.
3. **Upload files** → sleep alle bestanden uit deze zip erin → Commit.
4. **Settings → Pages** → Branch: main, / (root) → Save.
5. Na 1–2 minuten: `https://<organisatienaam>.github.io`

## Firestore-regels
Plak de nieuwe `firestore.rules` uit de app-zip in Firebase → Firestore → Regels → Publiceren.
Zonder die stap blijft de site op "laden" staan.
