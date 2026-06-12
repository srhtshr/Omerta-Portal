# Omerta Family Cooldown Room v1.0

Omerta/Barafranca oyuncularinin ayni odada cooldown bilgilerini ve room chat mesajlarini paylasmasi icin hazirlanmis bir Chrome/Edge extension + Node.js/Express server projesidir.

Sistem oyun icinde otomatik aksiyon yapmaz. Extension sadece kullanicinin kendi acik oturumundaki canli sayfa DOM'unu okur ve gerekli cooldown / karakter bilgilerini server'a gonderir.

## Icerik

- `extension/`
  Chrome/Edge Manifest V3 extension
- `server/`
  Express tabanli dashboard ve API server
- `README.md`
  Kurulum ve kullanim notlari

## Server baslatma

Gereksinim:

- Node.js LTS
- npm

Adimlar:

1. `server/` klasorune girin.
2. Gerekirse `.env.example` dosyasini `.env` olarak kopyalayin.
3. `npm install` calistirin.
4. `npm start` ile server'i baslatin.

Varsayilan adres:

- `http://localhost:3000`

Dashboard acilis adresi:

- `http://localhost:3000/?room=TestRoom`

## Extension kurulumu

Chrome veya Edge icin:

1. `chrome://extensions` veya `edge://extensions` sayfasini acin.
2. `Developer mode` secenegini aktif edin.
3. `Load unpacked` butonuna basin.
4. Proje icindeki `extension/` klasorunu secin.

Extension yuklendikten sonra popup acilir ve varsayilan olarak bu ayarlarla calisir:

- Enabled: acik
- API URL: `http://localhost:3000`
- Room: `TestRoom`

## Extension guncelleme sonrasi reload

Kod degistirdikten sonra:

1. `chrome://extensions` veya `edge://extensions` sayfasina gidin.
2. Yuku olan extension kartini bulun.
3. `Reload` butonuna basin.
4. Barafranca sekmesini yenileyin.

Bu adim, yeni `content.js`, popup ve manifest degisikliklerinin aktif olmasi icin gereklidir.

## TestRoom kullanimi

Bu build sabit room ile calisir:

- `TestRoom`

Beklenen akıs:

1. Server'i baslatin.
2. Extension'i yukleyin.
3. Barafranca sayfasinda oturum acik olsun.
4. Popup'ta `Send Now` kullanin veya otomatik polling'i bekleyin.
5. Dashboard'i `http://localhost:3000/?room=TestRoom` adresinden acin.

Ayni `TestRoom` kullanan extension yuklu oyuncular birbirini dashboard'da gorebilir.

Extension'i kurmayan oyuncularin bilgisi gorunmez.

## Family Key

Server tarafinda `.env` icinde `FAMILY_KEY` tanimlanirsa:

- `POST /api/update`
- `POST /api/chat`

isteklerinde `x-family-key` header'i zorunlu olur.

`FAMILY_KEY` bos ise sistem keysiz calisir.

## Guvenlik notlari

- Password, cookie, PHPSESSID, CSRF token, JWT veya chat token gonderilmez.
- Full HTML server'a gonderilmez.
- Server'a sadece gerekli alanlar gider:
  - update icin `room`, `player`, `game`, `updatedAt`, `progression`, `cooldowns`
  - chat icin `room`, `player`, `message`

## Dagitim paketi

Hazir production arsivi:

- `Omerta-Family-Cooldown-Room-v1.0.zip`

Bu arsiv sunlari icerir:

- `extension/`
- `server/`
- `README.md`
