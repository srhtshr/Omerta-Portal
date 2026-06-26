# Omerta Portal — Chrome Extension

**Versiyon:** 1.0.4  
**Manifest:** MV3  
**Son güncelleme:** 2026-06-26

---

## Genel Bakış

Omerta Portal extension'ı; açık oyun sekmeleri (TR/COM/NL/PT) ile `localhost:3000` / `omertaportal.com` dashboard'u arasında köprü görevi görür. Soğuma sürelerini (cooldown) senkronize eder, karakterleri arkaplanda aktif tutar ve oyun penceresi yönetimi sağlar.

---

## Dosya Yapısı

```
extension local/
├── manifest.json        — MV3 manifest, izinler, content script tanımları
├── background.js        — Service worker: mesaj yönetimi, popup pencere kontrolü, keep-alive alarm
├── content.js           — Oyun sekmelerine inject edilir; cooldown verisi toplar, SEND_NOW gönderir
├── popup-bridge.js      — Dashboard'a inject edilir; window.postMessage ↔ chrome.runtime.sendMessage köprüsü
├── popup.html/js        — Extension toolbar popup'ı (dashboard aç / durum göster)
├── rules.json           — declarativeNetRequest kuralları (header düzenleme)
└── icon16/48/128.png    — Extension ikonları
```

---

## Temel Özellikler

### 1. Keep-Alive (Arkaplanda Online Kalma)
- `bgKeepAlive` alarm: her **2 dakikada** tetiklenir
- Açık tüm oyun sekmelerine `SEND_NOW` mesajı gönderir
- Oyun sekmesi yoksa sekme yenilenir
- Popup pencere de oyun URL'ine sahip olduğundan aynı keep-alive kapsamına girer

### 2. Oyun Popup Penceresi (Game Popup)
Quick link'e tıklandığında oyun ayrı bir Chrome popup penceresinde açılır (adres çubuğu gizli):

**Akış:**
```
Quick link tıkla
  → server.js: openGamePopup(url)
  → window.postMessage(OMERTA_OPEN_POPUP)
  → popup-bridge.js: chrome.runtime.sendMessage(OPEN_GAME_POPUP)
  → background.js: chrome.windows.create/update
```

**Tek instance:** Popup açıkken başka bir quick link'e tıklamak yeni pencere açmaz; mevcut pencereyi o URL'e yönlendirir ve öne getirir.

**Pencere kapatma:** Dashboard'da boş bir alana tıklamak popup'ı kapatır.

**Pencere boyutu / konumu** (`background.js` > `TARGET`):
```js
const TARGET = { width: 828, height: 671, left: 436, top: 302 };
```
Bu değerleri değiştirmek için `background.js` dosyasını düzenle, extension'ı yeniden yükle.

### 3. Cooldown Senkronizasyonu
- `content.js` oyun sayfasından DOM verisi okur → background'a gönderir → dashboard WebSocket/polling ile alır
- TR / COM / NL / PT sunucuları desteklenir

---

## Mesaj Tipleri

| Mesaj | Yön | Açıklama |
|---|---|---|
| `OPEN_GAME_POPUP` | dashboard → background | Popup aç veya mevcut popup'ı yönlendir |
| `CLOSE_GAME_POPUP` | dashboard → background | Popup'ı kapat |
| `GET_POPUP_INFO` | dashboard → background | Popup'ın konum/boyut bilgisini döndür |
| `SEND_NOW` | background → content | Anında cooldown verisi gönder |
| `FETCH_GAME_MODULE` | dashboard → background → content | Oyun modülü HTML'ini getir |
| `OMERTA_CONNECT_ALL` | dashboard → background | Tüm oyun sekmelerini yenile |

---

## Kurulum (Geliştirici Modu)

1. Chrome'da `chrome://extensions` aç
2. **Geliştirici modu**nu aç (sağ üst toggle)
3. **Paketlenmemiş öğe yükle** → `chromestore/extension local/` klasörünü seç
4. Dashboard: `localhost:3000` veya `omertaportal.com`

---

## Chrome Web Store'a Yükleme

1. `chromestore/extension local/` içeriğini ZIP'le (klasörün kendisini değil içini)
2. `chromestore/extension.zip` olarak kaydet
3. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)'a yükle
4. Versiyon numarasını `manifest.json` > `"version"` alanından artır

> **Not:** `chromestore/extension.zip` her zaman son Chrome Web Store submission'ını temsil eder. Geliştirme dosyaları `extension local/` altındadır.

---

## Önemli Notlar

- **MV3 Service Worker:** `setTimeout` güvenilir değil — async işlemler için `await` veya `chrome.alarms` kullan
- **DPI Scaling:** Chrome popup pencere koordinatları CSS (logical) piksel cinsindendir. Windows ekran ölçeklendirmesi %100 dışındaysa görsel konum farklı görünebilir
- **SameSite=Lax:** Oyun sunucuları cross-site iframe login'e izin vermez; popup (top-level window) bu sorunu çözer
- **Popup type:** `chrome.windows.create({ type: "popup" })` adres çubuğunu gizler ama başlık çubuğu (title bar) kaldırılamaz — bu Chrome güvenlik kısıtlamasıdır
