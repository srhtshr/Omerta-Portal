# Omerta Family Cooldown Room v1.0

Omerta / Barafranca oyuncularinin cooldown, room chat ve dashboard bilgilerini ayni yerde toplamak icin hazirlanmis Chrome/Edge extension + Node.js/Express server projesidir.

Sistem oyun icinde otomatik aksiyon yapmaz. Extension sadece kullanicinin kendi acik oturumundaki sayfa verilerini okur ve gerekli bilgileri local dashboard server'ina yollar.

## Klasor yapisi

- `extension/`
  Unpacked olarak yuklenecek Chrome / Edge extension kaynaklari
- `server/`
  Dashboard arayuzu ve API server
- `icons/`
  Dashboard quick link ikonlari
- `build/`
  Istenirse dagitim icin kullanilabilecek paket / cikti klasoru

## Ozellikler

- TR / COM / NL / PT server sekmeleri
- Server bazli General chat kanallari
- Ozel room olusturma / join sistemi
- Owner / admin / kick / pending onay akisi
- Chat icinde tiklanabilir oyuncu profilleri
- Hazir chat mesajlari
- Rank bazli cooldown kilit gostergeleri
- Obay paneli
- Dashboard ustunde karakter nickname kartlari
- Extension popup icinden tum acik oyun sayfalarina baglanma / refresh tetikleme

## Gereksinimler

- Node.js LTS
- npm
- Chrome veya Edge

## Server kurulumu

1. `server/` klasorune girin.
2. Gerekirse `.env.example` dosyasini `.env` olarak kopyalayin.
3. `npm install` calistirin.
4. `npm start` ile server'i baslatin.

Varsayilan adres:

- `http://localhost:3000`

Dashboard:

- `http://localhost:3000`

## Extension kurulumu

1. `chrome://extensions` veya `edge://extensions` sayfasini acin.
2. `Developer mode` secenegini aktif edin.
3. `Load unpacked` butonuna basin.
4. Proje icindeki `extension/` klasorunu secin.

Extension popup varsayilan olarak local server ile calisacak sekilde hazirlanmistir.

## Kullanim

1. Server'i baslatin.
2. Extension'i unpacked olarak yukleyin.
3. Omerta / Barafranca sayfalarinda oturum acin.
4. Extension popup'tan `Connect` kullanin.
5. Dashboard'i `http://localhost:3000` adresinden acin.

Dashboard:

- acik olan server sayfalarini algilar
- oyunculari aktif server sekmesine gore listeler
- General chat'i secili servera gore ayirir
- ozel room'larda uye / owner yetkilerini uygular

## Chat ve room mantigi

- `General` kanali server bazlidir:
  - `General (TR)`
  - `General (COM)`
  - `General (NL)`
  - `General (PT)`
- Ozel room'lar ortak isimle calisir.
- Room sahibi ayni oyuncu adi ile geri donerse ownerligini tekrar alabilir.
- Owner offline kalirsa room kilidi sonsuza kadar takili kalmaz.

## Rank kilitleri

Su kolonlarda rank yetersizse `ready` yerine kilit gosterilir:

- Heist: `Shoplifter`
- OC: `Thief`
- MOC: `Assassin`
- Spots: `Soldier`

## Guvenlik notlari

- Password, cookie, PHPSESSID, JWT veya benzeri hassas alanlar gonderilmez.
- Full page HTML server'a gonderilmez.
- Sadece gerekli cooldown / progression / chat verileri gonderilir.
- `FAMILY_KEY` tanimliysa korumali endpoint'lerde `x-family-key` gerekir.

## Notlar

- `server/data/rooms.json` room, uye ve chat durumunu saklar.
- `scratch/` gibi gecici test klasorleri repo icin gerekli degildir.
- `server/node_modules/` yeniden kurulabilir; kaynak kod degildir.

## Gelistirme

Kod degistirdikten sonra extension'i yeniden yuklemek icin:

1. `chrome://extensions` veya `edge://extensions` sayfasina gidin.
2. Yuklu extension kartinda `Reload` yapin.
3. Acik oyun sekmelerini yenileyin veya popup'tan tekrar `Connect` kullanin.
