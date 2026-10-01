# Velforeningen Madlamark sør – nettside

En enkel nettside laget med [11ty](https://www.11ty.dev). Alt innhold er vanlige markdown-filer i mappen `innhold/`.

## Slik er det bygd opp

```
innhold/
  aktuelt/                 Saker på forsiden (forsvinner av seg selv når datoen er passert)
  praktisk-informasjon/    Sidene under «Praktisk informasjon til beboere»
  referater/               Sidene under «Møtereferater» (nyeste øverst)
  filer/                   PDF-er og bilder
  _data/nettsted.json      Navnet på siden og hovedmenyen
  stil/stil.css            Farger, skrift og størrelser
  skript/stemning.js       Blader, frø og blomster som driver over siden
```

Hver markdown-fil blir én side. Undermenyen til venstre lages automatisk av filene i mappen.

## Legge ut et referat

Last opp en markdown-fil til `innhold/referater/`, og gi den et navn som starter med datoen:

```
2026-04-20-styremote.md
```

Inni filen holder det å skrive tittelen som første overskrift:

```markdown
# Styremøte 20. april 2026

### Sak 1
Tekst …
```

Tittelen («Styremøte 20. april 2026») blir navnet i menyen. Datoen i filnavnet bestemmer rekkefølgen.

## Legge ut en aktuelt-sak

Lag en fil i `innhold/aktuelt/`, for eksempel `2027-05-08-vardugnad.md`:

```markdown
---
tittel: Vårdugnad
dato: 2027-05-08
---

Lørdag 8. mai fra kl. 10.00 …
```

Saken vises på forsiden til og med datoen, og forsvinner av seg selv natten etter. Teksten i filen dukker opp på forsiden når man klikker på saken. Skal den vises lenger, legg til for eksempel `vis_til: 2027-05-31`.

Med en `stemning` driver det noe over siden mens saken er åpen:

- `stemning: host` – lønneblader og bjørkeblader blåser forbi
- `stemning: var` – løvetannfrø og villblomster blåser oppover

Klikker man på et blad, et frø eller en blomst, tar et lite vindpust det med seg i en tilfeldig retning. Alt dette styres av `skript/stemning.js`.

## Ny side under «Praktisk informasjon til beboere»

Lag en fil i `innhold/praktisk-informasjon/`. Bruk `rekkefolge` for å bestemme plassen i menyen (1 er øverst):

```markdown
---
tittel: Lånesentralen
rekkefolge: 7
---

Tekst …
```

## Bilder og PDF-er

Legg filen i `innhold/filer/` og lenk til den slik:

```markdown
[Referat fra årsmøtet (PDF)](/filer/arsmote-2025-referat.pdf)

![Beskrivelse av bildet](/filer/bilde.jpg)
```

Bruk filnavn uten mellomrom og æøå, for eksempel `arsmote-2026.pdf`.

## Tre måter å redigere på

1. **Rett på GitHub:** Gå til mappen, trykk «Add file» → «Upload files» og dra inn markdown-filen. Trykk «Commit changes». Siden oppdateres etter et par minutter.
2. **Pages CMS** (enklest for de fleste): Logg inn på [app.pagescms.org](https://app.pagescms.org) med GitHub-kontoen og velg dette prosjektet. Der får du skjemaer med datovelger, tekstredigering og opplasting av bilder og PDF-er.
3. **På egen maskin:** `npm install` én gang, deretter `npm start` og åpne http://localhost:8080.

## Publisering

Siden publiseres på GitHub Pages av `.github/workflows/publiser.yml`. Den bygges på nytt hver gang noe endres, og i tillegg hver natt, slik at utløpte aktuelt-saker forsvinner.

Første gang: på GitHub, gå til **Settings → Pages** og velg **Source: GitHub Actions**.

## Skrift

Siden bruker Akkurat. Den vises bare for de som har skriften installert, alle andre ser reserveskriften Inter. For at alle skal se Akkurat, trengs en nettlisens fra Lineto. Legg da `.woff2`-filene i `innhold/stil/fonter/` og legg til en `@font-face` øverst i `stil.css`.
