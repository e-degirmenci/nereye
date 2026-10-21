# Nereye?

Yakındaki mekanları Tinder gibi swipe'layarak seçmek için bir web uygulaması.

- **Konum:** "Konumumu kullan" ile GPS'ten, ya da Münih'te sabit bir başlangıç noktasından.
- **Filtreler:** mesafe, kategori (yemek, bar, kafe), fiyat, saat, sadece açık olanlar.
- **Favoriler:** sağa kaydırdıkların birikir, istediğini çıkarırsın.
- **Grup modu:** herkes aynı 12 mekanı tek telefonda sırayla swipe'lar, sonunda eşleşmeler çıkar.
- **Gece akışı:** bir restoran seçince yakındaki, o saatte açık barlarla akşamın rotası kurulur.

## Veri

Varsayılan olarak mekanlar ve açılış saatleri **OpenStreetMap**'ten (Overpass API) canlı gelir: ücretsiz, anahtar ve kart gerektirmez. Veri © OpenStreetMap katkıcıları, ODbL lisansı.
OpenStreetMap'e ulaşılamazsa uygulama `data.js`'teki örnek Münih verisine geçebilir.

İsteğe bağlı: `config.js` içine bir Google Maps anahtarı girilirse kaynak Google Places olur (puanlar dahil).

Google içeriği kalıcı olarak saklanmaz: sonuçlar sadece açık oturum boyunca bellekte tutulur, favorilerde yalnızca mekan kimliği, adı ve Google Maps linki kalır.

## Google anahtarı nasıl alınır

1. [console.cloud.google.com](https://console.cloud.google.com) → yeni proje oluştur (ör. `nereye`).
2. Faturalandırmayı (billing) etkinleştir. Ücretsiz kota içinde kaldıkça ücret çıkmaz, aşağıdaki limitler de bunu garantiler.
3. **APIs & Services → Library**: `Maps JavaScript API` ve `Places API (New)` servislerini etkinleştir.
4. **APIs & Services → Credentials → Create credentials → API key.**
5. Anahtarı düzenle:
   - **Application restrictions:** *Websites* → `https://e-degirmenci.github.io/*`
   - **API restrictions:** sadece `Maps JavaScript API` ve `Places API (New)`
6. **Quotas:** `Places API (New)` için günlük istek limitini düşük tut (ör. günde 30).
7. Anahtarı `config.js` dosyasına yapıştır ve kaydet.

Her mekan listesi, seçili kategori başına bir istek atar (en fazla 3). Aynı yer ve filtre için oturum içinde tekrar istek atılmaz.

## Yayın

Repo GitHub Pages ile yayınlanır: **Settings → Pages → Branch: `main` / `(root)`**.
Adres: `https://e-degirmenci.github.io/nereye/`

Konum izni sadece HTTPS adreslerde çalışır; GitHub Pages bunu otomatik sağlar.

## Saat düzeltmeleri

OpenStreetMap'teki saatler bazen eskidir. Yanlış olduğu bilinen mekanlar `data/overrides.json` dosyasında düzeltilir:

```json
{ "o_n7027262421": { "opening_hours": null, "note": "Saatler güncel değil" } }
```

`opening_hours` OSM biçiminde bir metin olabilir (`"Mo-Sa 11:00-23:00; Su off"`) ya da `null` (saat bilinmiyor; "sadece açık" filtresinde gizlenir).
Uygulamadaki "Bu saatler yanlış" butonu aynı şeyi sadece o telefonda yapar.
