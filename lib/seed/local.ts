/**
 * Local mode profile (Vetlanda): from Linnea's Swedish CV (pasted 23 Nov 2026).
 * Kept in Swedish. Norwegian and Danish are left out under the language rule.
 */
export const LOCAL_FACTS: { id: string; text: string; tags: string[] }[] = [
  { id: "S-HB-1", text: "Lagermedarbetare i försorteringen på Human Bridge i Vetlanda, 13 maj 2026 till 31 oktober 2026: sorterade insamlade kläder och textilier till bistånd, second hand-försäljning och återvinning.", tags: ["lager", "fysiskt arbete", "vetlanda"] },
  { id: "S-HB-2", text: "Utförde fysiskt krävande arbete i högt tempo och under tidspress på Human Bridge och nådde dagliga prestationsmål.", tags: ["lager", "tempo", "industri"] },
  { id: "S-SFW-1", text: "Arbetar deltid för Soil Food Web Foundation sedan september 2026 med sociala medier, webbdesign och bidragsansökningar.", tags: ["sociala medier", "webb"] },
  { id: "S-CH-1", text: "Granskade Trust & Safety-ärenden för Clubhouse inom samtliga 16 överträdelsekategorier, april 2021 till januari 2022, och var ensam ansvarig för den skandinaviska marknaden.", tags: ["noggrannhet", "ansvar"] },
  { id: "S-CH-2", text: "Ökade produktiviteten med 98 % och nådde dagligen 95 % på tjänstenivåavtal och kvalitetssäkring på Clubhouse.", tags: ["tempo", "kvalitet"] },
  { id: "S-SACC-1", text: "Organiserade ett nätverksevenemang för 80 skandinaver och amerikaner i samarbete med Norwegian Club, och ökade Svensk-amerikanska handelskammarens nätverk med 20 %.", tags: ["service", "evenemang"] },
  { id: "S-GT-1", text: "Granskade i genomsnitt 100+ svenska annonser per dag som svensk innehållsanalytiker för Google gTech, maj 2018 till april 2019, och teamet nådde 100 % av målen.", tags: ["noggrannhet", "tempo"] },
  { id: "S-MIN-1", text: "Vägledde 45 yngre studenter i deras examensarbeten på Minerva University: gav feedback, läste inlämningar och stöttade dem.", tags: ["skola", "lärare", "handledning"] },
  { id: "S-DOC-1", text: "Utvecklade kurspaketet Dimensions of Care inom sjukvård och ekonomi och analyserade 150+ forskningsrapporter.", tags: ["vård", "pedagogik"] },
  { id: "S-RSP-1", text: "Startade The Right Solution Project vid 15 års ålder och skickade 400+ omsorgspaket med värktabletter och hygienprodukter till skolor i Etiopien.", tags: ["omsorg", "engagemang"] },
  { id: "S-EDU-1", text: "Kandidatexamen i samhällsvetenskap, ekonomi och företagsekonomi från Minerva University, GPA 3,6. Studerade i fem länder.", tags: ["utbildning"] },
  { id: "S-EDU-2", text: "IB tvåspråkigt diplom på engelska och svenska från United World College Red Cross Nordic, GPA 3,85, med 100+ timmar volontärarbete.", tags: ["utbildning", "volontär"] },
  { id: "S-LANG", text: "Svenska och engelska på modersmålsnivå, mandarin HSK 3.", tags: ["språk"] },
];

export const LOCAL_CV = {
  lead: "Pålitlig, snabblärd och van vid högt tempo. Bor i Vetlanda och kan börja direkt.",
  experiences: [
    { org: "Soil Food Web Foundation", title: "Sociala medier, webbdesign och bidragsansökningar (deltid)", dates: "september 2026 – pågående", bullets: ["Ansvarar för organisationens sociala medier", "Bygger och designar organisationens nya hemsida", "Skriver bidragsansökningar"] },
    { org: "Human Bridge, Vetlanda", title: "Lagermedarbetare, försorteringen", dates: "13 maj 2026 – 31 oktober 2026", bullets: ["Sorterade insamlade kläder och textilier till bistånd, second hand-försäljning och återvinning", "Utförde fysiskt krävande arbete i högt tempo och under tidspress", "Nådde dagliga prestationsmål"] },
    { org: "Clubhouse (uppdrag via Vaco), Walnut Creek, CA", title: "Innehållsgranskning, skandinaviska och amerikanska marknaden", dates: "april 2021 – januari 2022", bullets: ["Granskade Trust & Safety-ärenden inom samtliga 16 överträdelsekategorier", "Ensam ansvarig för gemenskapsregler och riktlinjer för hela den skandinaviska marknaden", "Ökade produktiviteten med 98 % och nådde dagligen 95 % på tjänstenivåavtal och kvalitetssäkring"] },
    { org: "Svensk-amerikanska handelskammaren, San Francisco", title: "Marknadsföring och försäljningsutveckling", dates: "juni 2021 – september 2021", bullets: ["Ökade handelskammarens nätverk med 20 %", "Byggde en databas med 120 försäljningskontakter för två svenska kunder", "Organiserade ett nätverksevenemang för 80 skandinaver och amerikaner"] },
    { org: "Vaco för Google gTech, Sunnyvale, Seoul och Hyderabad", title: "Svensk innehållsanalytiker", dates: "maj 2018 – april 2019", bullets: ["Granskade i genomsnitt 100+ annonser per dag", "Teamet uppfyllde 100 % av tjänstenivåavtalets mål"] },
  ],
  education: [
    "Minerva University, San Francisco: kandidatexamen i samhällsvetenskap, ekonomi och företagsekonomi (GPA 3,6), maj 2021. Studerade i USA, Sydkorea, Indien, Tyskland och Argentina. Handledde 45 yngre studenter i deras examensarbeten.",
    "United World College Red Cross Nordic, Flekke: IB tvåspråkigt diplom, engelska och svenska (GPA 3,85), maj 2017. Röda korset-diplom med guldutmärkelse för lagarbete, volontärarbete och ledarskap.",
  ],
  extras: [
    "Projekt- och produktansvarig, Dimensions of Care (examensarbete), 2020 – 2021: kurspaket inom sjukvård och ekonomi, 150+ forskningsrapporter analyserade.",
    "Vinnare, Global Startup Weekend Stockholm, augusti 2019 (Terra Finance, Techstars och Google for Startups).",
    "Grundare, The Right Solution Project, 2013 – 2015: 400+ omsorgspaket till skolor i Etiopien.",
  ],
  skills: ["Python", "SQL", "Google Drive (Dokument, Kalkylark, Formulär)", "Tableau", "Google Ads", "Canva", "CRM", "Sociala medier", "Webbdesign"],
  languages: "Svenska (modersmål), engelska (modersmål), mandarin (HSK 3)",
};
