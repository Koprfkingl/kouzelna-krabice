# Kouzelná krabice ✨📦

Hra pro Marušku. Před kouzelnou krabici postavíš cokoliv a krabice to laserem promění na cokoliv jiného.

- **Živé bytosti** (liška, ryba, kytka, příšerky a vyfocená zvířátka) krabice promění vždycky na **náhodnou roztomilou příšerku**. Každá je jiná: chlupatá, sametová, želatinová nebo puntíkatá, s jedním až třemi očima, růžky, oušky nebo tykadly.
- **Věci a stroje** se dají proměnit na cokoliv: jinou věc, stroj, zvířátko, příšerku, fotku, nebo na „Překvapení“.
- **Fotky**: tlačítkem 📸 vyfotíš cokoliv doma, řekneš, jestli je to živé, věc, nebo stroj, a dáš to před krabici.
- **Sbírka příšerek** (📖): každá nová příšerka se uloží. Klepnutím ji zase postavíš před krabici.
- Klepnutí na věc před krabicí ji rozpohybuje: rádio hraje, lampa svítí, fotoaparát blýskne, autíčko se otočí, příšerka se zachichotá.
- Hra mluví česky (hlasem telefonu) a funguje bez internetu.

## Ke stažení

V sekci **Releases** je `kouzelna-krabice-<verze>.apk`. Stáhni ho do telefonu s Androidem a otevři. Poprvé je potřeba povolit instalaci z neznámých zdrojů. Pro mluvení je dobré mít v nastavení převodu textu na řeč nainstalovanou češtinu.

## Jak to vypadá tak skutečně

Hra kreslí 3D scénu přes WebGL (three.js) s fyzikálně založenými materiály (PBR): odrazy prostředí z HDR fotografie skutečné místnosti, měkké stíny, lakované dřevo, kartáčovaná mosaz, sklo, samet a srst.
Předměty a stroje jsou skutečné naskenované nebo profesionálně vymodelované 3D modely (sada Khronos glTF Sample Assets).
Fotky z fotoaparátu jsou ze své podstaty fotorealistické.

Kompromisy: liška je nízkopolygonový model (realistické volně licencované 3D zvíře se nepodařilo najít), příšerky jsou generované kódem, takže vypadají spíš jako realistické plyšáky než jako fotografie.

## Nová verze

1. Uprav hru ve složce `www/` (obyčejná webová stránka). Pro zkoušení v počítači: `npm install`, `npm run vendor` a pak třeba `python3 -m http.server -d www` a otevři http://localhost:8000.
2. Zvyš `version` v `package.json`.
3. Pushni tag, třeba `git tag v1.0.1 && git push --tags`, nebo v GitHubu otevři Actions → „Sestavení APK“ → Run workflow.

GitHub Actions sestaví APK a přiloží ho k vydání.

## Podpis pro Android

Bez nastavení se sestaví ladicí (debug) APK. Funguje normálně, jen se další verze nenainstaluje přes tu starou (starou je potřeba odinstalovat a tím se smaže sbírka příšerek).

Aby šly aktualizace instalovat přes sebe, vytvoř si jednou podpisový klíč a ulož ho do Settings → Secrets and variables → Actions:

```bash
keytool -genkeypair -keystore release.jks -alias hra -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks   # výstup vlož jako ANDROID_KEYSTORE_BASE64
```

Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (tady `hra`). Soubor `release.jks` si schovej a nedávej ho do repozitáře.

## Struktura

- `www/index.html`, `www/styles.css`: obrazovka a ovládání
- `www/js/main.js`: scéna, světla, průběh proměny, ovládání, sbírka, fotky
- `www/js/box.js`: kouzelná krabice, laserový paprsek a jiskry
- `www/js/monster.js`: generátor příšerek
- `www/js/dissolve.js`: efekt rozpouštění laserem
- `www/js/catalog.js`: seznam věcí, zvířat a strojů
- `www/js/audio.js`: zvuky (syntetizované, bez souborů)
- `www/modely/`: 3D modely, `www/nahledy/`: obrázky do nabídky, `www/textury/`: dřevo a HDR prostředí
- `android/`: Android projekt (Capacitor)

Autorství modelů a textur je v [CREDITS.md](CREDITS.md).
