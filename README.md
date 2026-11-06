# Kouzelná krabice ✨📦

Hra pro Marušku. Kouzelná krabice stojí v dětském pokojíčku a laserem promění cokoliv na cokoliv jiného.

Každý krok kouzla je jedno tlačítko: **otevřít krabici → dát věc dovnitř → zavřít víko → LASER** (paprsky prosvítají škvírou pod víkem) **→ otevřít**. Uvnitř v lehké mlze čeká výsledek.

- **Živé bytosti** (liška, ryba, kytka, příšerky a vyfocená zvířátka) krabice promění vždycky na **náhodnou roztomilou příšerku**. Každá je jiná: kulatá, vajíčková, hruškovitá, vysoká nebo placatá; chlupatá, pruhovaná, šupinatá, puntíkatá, perleťová nebo želatinová; s jedním až pěti očima (nebo očima na stopkách), s rohy, oušky, tykadly, chapadly, křidýlky, ocáskem, motýlkem nebo čepičkou.
- **Věci a stroje** se dají proměnit na cokoliv: jinou věc, stroj, zvířátko, příšerku, fotku, nebo na „Překvapení“.
- **Fotky**: tlačítkem 📸 vyfotíš cokoliv doma, řekneš, jestli je to živé, věc, nebo stroj, a dáš to před krabici.
- **Každý krok jde udělat prstem**: víko se otevře tahem nahoru a zavře tahem dolů, věci se přetahují do krabice i ven a laser spustíš přetažením blesku (nebo obrázku, na co se má věc proměnit) na krabici. Tlačítka fungují pořád taky.
- **Sbírka příšerek** (📖): každá nová příšerka se uloží, nejvýš 21. Když je sbírka plná, můžeš některou pustit na svobodu.
- **Péče o příšerky**: příšerku ze sbírky můžeš nakrmit, napojit, uspat, pomazlit (i hlazením prstem), hrát si s ní a utěšit ji, když ji něco bolí. Potřeby jí pomalu ubývají i když hra neběží.
- **Čtení s příšerkou** (🔤 u příšerky ze sbírky): čtyři úrovně podle systematické foniky, jak se čtení učí v první třídě: písmenko, slabika, slovo a vzkaz od příšerky. Slabiky jsou barevné jako ve slabikáři a klepnutím se přečtou nahlas. Vzkazy typu „MÁM HLAD.“ se splní péčí o příšerku. Za každý úkol vyřešený napoprvé bez nápovědy je hvězdička. Přepínač ABC/abc mění velká a malá písmena.
- Klepnutí na věc před krabicí ji rozpohybuje: rádio hraje, lampa svítí, fotoaparát blýskne, autíčko se otočí, příšerka se zachichotá. Kdo kliká jako o závod, dočká se sedmi různých legračních reakcí.
- Hra mluví česky (hlasem telefonu) a funguje bez internetu.
- Aplikace si při spuštění zkontroluje, jestli na GitHubu není novější verze, a nabídne její stažení.

Hra jde hrát i v prohlížeči: https://koprfkingl.github.io/kouzelna-krabice/ (v repu musí být zapnuté GitHub Pages z větve `gh-pages`).

## Ke stažení

V sekci **Releases** je `kouzelna-krabice-<verze>.apk`. Stáhni ho do telefonu s Androidem a otevři. Poprvé je potřeba povolit instalaci z neznámých zdrojů. Pro mluvení je dobré mít v nastavení převodu textu na řeč nainstalovanou češtinu.

## Jak to vypadá tak skutečně

Hra kreslí 3D scénu přes WebGL (three.js) s fyzikálně založenými materiály (PBR): odrazy prostředí z HDR fotografie skutečné místnosti, měkké stíny, lakované dřevo, kartáčovaná mosaz, sklo, samet a srst.
Předměty a stroje jsou skutečné naskenované nebo profesionálně vymodelované 3D modely (sada Khronos glTF Sample Assets).
Fotky z fotoaparátu jsou ze své podstaty fotorealistické.

Kompromisy: liška je nízkopolygonový model (realistické volně licencované 3D zvíře se nepodařilo najít), příšerky jsou generované kódem, takže vypadají spíš jako realistické plyšáky než jako fotografie.

## Nová verze

1. Uprav hru ve složce `www/` (obyčejná webová stránka). Pro zkoušení v počítači: `npm install`, `npm run vendor` a pak třeba `python3 -m http.server -d www` a otevři http://localhost:8000.
2. Zvyš `version` v `package.json` a pushni do `main`.

GitHub Actions sestaví APK a protože je verze nová, samo vytvoří vydání. Aplikace v telefonu ho při dalším spuštění najde a nabídne.

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
- `www/js/monster.js`, `www/js/monster2.js`: generátory příšerek (první generace zůstává kvůli uloženým příšerkám)
- `www/js/dissolve.js`: efekt rozpouštění laserem
- `www/js/catalog.js`: seznam věcí, zvířat a strojů
- `www/js/cteni.js`: slova s obrázky rozdělená na slabiky a vzkazy pro čtení
- `www/js/audio.js`: zvuky (syntetizované, bez souborů)
- `www/modely/`: 3D modely, `www/nahledy/`: obrázky do nabídky, `www/textury/`: dřevo a HDR prostředí
- `android/`: Android projekt (Capacitor)

Autorství modelů a textur je v [CREDITS.md](CREDITS.md).
