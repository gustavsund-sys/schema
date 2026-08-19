# Mitt skolschema

En liten, statisk webbapp för Sixtens och Ilses skolscheman. Den behöver ingen server och kan publiceras direkt med GitHub Pages.

## Publicera på GitHub Pages

1. Skapa ett nytt GitHub-repository och lägg in dessa filer.
2. Öppna **Settings → Pages** i repositoryt.
3. Välj **Deploy from a branch**, välj `main` och mappen `/(root)`.
4. Spara. GitHub visar sedan webbadressen till appen.

## Ny termin

I appen: välj kugghjulet och importera en PDF. Den läses lokalt i webbläsaren och ger ett granskningsbart schemaförslag. Inskannade PDF:er tolkas med lokal OCR; första gången hämtas OCR-motorn och språkstödet, men själva PDF:en laddas inte upp.

Schemat sparas i webbläsaren på den enhet där det importeras. För att uppdatera appens startinnehåll för alla, ersätt schemadatan i `app.js` och publicera ändringen på GitHub.
