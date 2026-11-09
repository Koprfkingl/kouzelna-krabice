# Ikona aplikace

1. `python3 -m http.server 8123 -d www` a v jiném okně z této složky
   `node vyrenderovat.cjs '[2]' '{"pos":[0,1.75,2.4],"look":[0,0.95,-1.05],"fov":46}'`
   vykreslí krabici se slizovou příšerkou (seed 2) do `shots/icon_2.png`.
2. `python3 ikony_android.py 2 ../..` z toho složí pozadí s paprsky a hvězdičkami a zapíše
   ikony pro Android (i adaptivní), `assets/icon-only.png`, `www/ikona.png`
   a ikonu zkušební verze s pruhem TEST do `android/test-ikony/`.
