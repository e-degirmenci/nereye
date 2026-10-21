// Örnek veri: Münih'te gerçek ve köklü mekanlar. Açılış saatleri tahmini.
// Google anahtarı yoksa ya da Google'a ulaşılamazsa uygulama bu listeyle çalışır.
(function(){
const ALL="0123456", WD="01234", SA="012345";
// h: [günler (0=Pzt), açılış, kapanış]; kapanış gece yarısını geçebilir
const VENUES = [
 {id:"r1",n:"Hofbräuhaus",c:"food",k:"Bavyera mutfağı",p:2,lat:48.1376,lon:11.5799,a:"Altstadt",h:[[ALL,"11:00","24:00"]],t:"Turistik ama bir kez görülmeli. Uzun masalar, bando, litrelik bira."},
 {id:"r2",n:"Augustiner Klosterwirt",c:"food",k:"Bavyera mutfağı",p:2,lat:48.1386,lon:11.5733,a:"Altstadt",h:[[ALL,"11:00","24:00"]],t:"Frauenkirche'nin dibinde, fıçıdan Augustiner."},
 {id:"r3",n:"Weisses Brauhaus",c:"food",k:"Bavyera · Weißwurst",p:2,lat:48.1356,lon:11.5793,a:"Tal",h:[[ALL,"10:00","23:30"]],t:"Schneider Weisse'nin evi. Öğlene kadar beyaz sosis klasiği."},
 {id:"r4",n:"Zum Franziskaner",c:"food",k:"Bavyera mutfağı",p:3,lat:48.1400,lon:11.5768,a:"Residenzstraße",h:[[ALL,"11:00","24:00"]],t:"Ahşap kaplı klasik salonlar, Leberkäs'i meşhur."},
 {id:"r5",n:"Wirtshaus in der Au",c:"food",k:"Bavyera · Knödel",p:2,lat:48.1302,lon:11.5855,a:"Au",h:[[WD,"17:00","24:00"],["56","10:00","24:00"]],t:"Knödel uzmanı; Isar'ın öbür yakasında yerel bir lokanta."},
 {id:"r6",n:"Andechser am Dom",c:"food",k:"Bavyera mutfağı",p:2,lat:48.1384,lon:11.5740,a:"Altstadt",h:[[ALL,"11:00","24:00"]],t:"Andechs manastır birası, katedral manzaralı teras."},
 {id:"r7",n:"Riva Tal",c:"food",k:"İtalyan · pizza",p:2,lat:48.1357,lon:11.5808,a:"Tal",h:[[ALL,"11:30","24:00"]],t:"Taş fırın pizza, Isartor'a iki adım."},
 {id:"r8",n:"Max Pett",c:"food",k:"Vegan",p:2,lat:48.1356,lon:11.5648,a:"Ludwigsvorstadt",h:[[WD,"11:30","23:00"],["56","09:30","23:00"]],t:"Tamamen vegan; Bavyera klasiklerinin bitkisel halleri."},
 {id:"r9",n:"Bodhi",c:"food",k:"Vegan · Wirtshaus",p:2,lat:48.1352,lon:11.5440,a:"Westend",h:[[ALL,"11:30","23:00"]],t:"Westend'de vegan bir Bavyera lokantası."},
 {id:"r10",n:"Sasou",c:"food",k:"Asya · sokak lezzetleri",p:2,lat:48.1370,lon:11.5762,a:"Marienplatz",h:[[SA,"11:30","22:00"]],t:"Hızlı ve merkezde: ramen, curry, sushi."},
 {id:"r11",n:"Sushi + Soul",c:"food",k:"Japon · sushi",p:3,lat:48.1293,lon:11.5737,a:"Glockenbach",h:[[ALL,"18:00","01:00"]],t:"Akşamları kalabalık, yanında kokteyl de var."},
 {id:"r12",n:"Brenner",c:"food",k:"Izgara · İtalyan",p:3,lat:48.1393,lon:11.5814,a:"Maximilianstraße",h:[[ALL,"11:30","24:00"]],t:"Eski saray ahırında açık ızgara, yüksek tavanlar."},
 {id:"r13",n:"Tantris",c:"food",k:"Fine dining",p:4,lat:48.1727,lon:11.5893,a:"Schwabing",h:[["2345","18:30","24:00"]],t:"Michelin yıldızlı efsane. Özel gün için, rezervasyon şart."},
 {id:"r14",n:"Mangostin",c:"food",k:"Asya füzyon",p:3,lat:48.1063,lon:11.5490,a:"Thalkirchen",h:[[ALL,"12:00","23:00"]],t:"Bahçeli büyük Asya restoranı, grup yemeği için iyi."},
 {id:"r15",n:"Ratskeller",c:"food",k:"Bavyera mutfağı",p:2,lat:48.1373,lon:11.5756,a:"Marienplatz",h:[[ALL,"11:00","23:00"]],t:"Yeni Belediye Sarayı'nın altında tonozlu salonlar."},
 {id:"r16",n:"Paulaner am Nockherberg",c:"food",k:"Bavyera · bira evi",p:2,lat:48.1236,lon:11.5880,a:"Au",h:[[ALL,"11:00","23:00"]],t:"Kendi bira fabrikası, Salvator'un evi."},
 {id:"b1",n:"Schumann's",c:"bar",k:"Kokteyl",p:3,lat:48.1426,lon:11.5786,a:"Odeonsplatz",h:[[SA,"17:00","03:00"]],t:"Münih kokteyl kültürünün ikonu, Hofgarten'in karşısı."},
 {id:"b2",n:"Zephyr Bar",c:"bar",k:"Kokteyl",p:3,lat:48.1303,lon:11.5776,a:"Gärtnerplatz",h:[["12345","20:00","02:00"]],t:"Küçük ve yaratıcı; mevsimlik kokteyl menüsü."},
 {id:"b3",n:"Bar Gabányi",c:"bar",k:"Klasik kokteyl",p:3,lat:48.1327,lon:11.5577,a:"Beethovenplatz",h:[[SA,"19:00","01:00"]],t:"Sakin, ustalıklı bir klasik bar."},
 {id:"b4",n:"Pusser's",c:"bar",k:"Rom · piyano bar",p:3,lat:48.1396,lon:11.5797,a:"Altstadt",h:[[ALL,"18:00","02:00"]],t:"Rom kokteylleri ve canlı piyano."},
 {id:"b5",n:"Trader Vic's",c:"bar",k:"Tiki bar",p:3,lat:48.1393,lon:11.5734,a:"Bayerischer Hof",h:[[ALL,"17:00","03:00"]],t:"Otelin bodrumunda tiki klasiği, gece geç saate kadar."},
 {id:"b6",n:"Café Kosmos",c:"bar",k:"Bar · rahat",p:1,lat:48.1437,lon:11.5615,a:"Hauptbahnhof Nord",h:[["0123","18:00","01:00"],["45","18:00","03:00"],["6","18:00","01:00"]],t:"Öğrenci dostu, ucuz ve samimi."},
 {id:"b7",n:"Bar Centrale",c:"bar",k:"İtalyan bar",p:2,lat:48.1374,lon:11.5786,a:"Altstadt",h:[[ALL,"09:00","01:00"]],t:"Gündüz espresso, akşam aperitivo."},
 {id:"b8",n:"Baader Café",c:"bar",k:"Bar · kafe",p:2,lat:48.1306,lon:11.5786,a:"Gärtnerplatz",h:[[ALL,"09:30","01:00"]],t:"Mahalle klasiği; gündüz kahve, gece bira."},
 {id:"g1",n:"Augustiner-Keller",c:"beer",k:"Biergarten · Bavyera",p:2,lat:48.1436,lon:11.5520,a:"Maxvorstadt",h:[[ALL,"10:00","24:00"]],t:"Dev kestane bahçesi; kışın içerideki salonlar açık."},
 {id:"g2",n:"Chinesischer Turm",c:"beer",k:"Biergarten",p:1,lat:48.1530,lon:11.5921,a:"Englischer Garten",h:[[ALL,"10:00","23:00"]],t:"Pagodanın etrafında bahçe. Hava kötüyse kapalı olabilir."},
 {id:"g3",n:"Seehaus",c:"beer",k:"Göl kenarı",p:3,lat:48.1632,lon:11.5926,a:"Englischer Garten",h:[[ALL,"11:00","23:00"]],t:"Kleinhesseloher See kenarında, içeride restoran da var."},
 {id:"g4",n:"Königlicher Hirschgarten",c:"beer",k:"Biergarten",p:1,lat:48.1500,lon:11.5133,a:"Nymphenburg",h:[[ALL,"11:00","23:00"]],t:"Münih'in en büyük biergartenı, yanında geyik parkı."},
 {id:"g5",n:"Viktualienmarkt Biergarten",c:"beer",k:"Biergarten · pazar",p:1,lat:48.1350,lon:11.5765,a:"Viktualienmarkt",h:[[SA,"09:00","22:00"]],t:"Pazarın ortasında; tezgahlardan al, masada ye."},
 {id:"c1",n:"Café Frischhut",c:"cafe",k:"Schmalznudel",p:1,lat:48.1349,lon:11.5753,a:"Viktualienmarkt",h:[[SA,"08:00","18:00"]],t:"Sabah sıcacık Schmalznudel. Kuyruk normal."},
 {id:"c2",n:"Café Luitpold",c:"cafe",k:"Pastane",p:2,lat:48.1432,lon:11.5753,a:"Brienner Straße",h:[[SA,"08:00","19:00"],["6","09:00","19:00"]],t:"1888'den beri klasik Münih pastanesi."},
 {id:"c3",n:"Man versus Machine",c:"cafe",k:"Nitelikli kahve",p:1,lat:48.1310,lon:11.5703,a:"Glockenbach",h:[[ALL,"08:00","18:00"]],t:"Kendi kavurdukları kahve, ders arası için ideal."},
 {id:"c4",n:"Vits der Kaffee",c:"cafe",k:"Kahve",p:1,lat:48.1323,lon:11.5792,a:"Gärtnerplatz",h:[[SA,"08:00","19:00"]],t:"Küçük kavurma evi, Gärtnerplatz'ın köşesinde."}
];
window.NEREYE_SAMPLE = VENUES;
})();
