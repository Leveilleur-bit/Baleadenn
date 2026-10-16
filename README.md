# Baleadenn ⚘

Carnet de sorties en famille en Cornouaille : lieux adaptés aux petits, trajet depuis la maison, carte, météo avec idées pour les jours de pluie, souvenirs avec notes et photos.

Toutes les données (sorties, notes, photos) restent **sur le téléphone**. Pensez à faire une sauvegarde de temps en temps (Réglages → Sauvegarder).

## Mettre en ligne sur GitHub Pages

1. Créer un dépôt public, par exemple `baleadenn`.
2. **Add file → Upload files** : déposer **tous les fichiers directement à la racine** (pas dans un sous-dossier) :
   `index.html`, `app.js`, `places.js`, `sw.js`, `manifest.webmanifest`, `leaflet.js`, `leaflet.css`, `icon-192.png`, `icon-512.png`, `README.md`.
3. **Commit changes**.
4. **Settings → Pages** → Source : **Deploy from a branch** → branche **main**, dossier **/ (root)** → **Save**.
5. Après 1–2 minutes : `https://<pseudo>.github.io/baleadenn/`
6. Sur Android, dans Chrome : menu ⋮ → **Ajouter à l'écran d'accueil** (ou « Installer l'application »).

Pas de compilation, pas de GitHub Actions nécessaires.

## Mettre à jour

Re-déposer les fichiers modifiés, puis dans `sw.js` changer `VERSION` (ex. `baleadenn-v2`) pour que le téléphone récupère la nouvelle version. Les données du téléphone ne sont pas touchées.

## Ajouter des lieux de départ

Dans l'appli : bouton **＋ Lieu**. Pour les intégrer de façon permanente au code, les ajouter dans `places.js`.
