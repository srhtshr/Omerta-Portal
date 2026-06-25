# Omerta Portal v2.0

> 🇬🇧 English · 🇹🇷 Türkçe

---

## 🇬🇧 English

A Chrome/Edge extension + Node.js/Express server project for Omerta / Barafranca players to track cooldowns, manage rooms, chat, and monitor account stats — all in one dashboard.

The system does **not** perform any automated in-game actions. The extension only reads page data from the user's own open sessions and sends it to the local dashboard server.

### Features

**Dashboard**
- TR / COM / NL / PT server tabs with unified 32px toolbar (search, filters, buttons)
- Server nickname cards showing active character per server (yellow, centered)
- Header stats panel: money, bank, bullets, health — updates per selected server
- Experience stats panel (📊) with per-server data
- Player table with rank, progress, activity, cooldown status indicators
- Karakter filter: filter table to own character (clientId-based)
- Rank / level filter with normalized rank matching
- Player profile search with direct in-game link
- Obay (auction) panel with countdown timers and stale data warning (>5 min)
- Gambling quick-link button (🎲)
- Multi-language support: Turkish / English

**Rooms & Chat**
- Portal General channel per server (TR / COM / NL / PT)
- Private room creation / join system
- Owner / member / kick / pending approval flow
- Pinned messages, clickable player profile links in chat
- Quick-send templates (Heist, OC, MOC, Race, City)
- Emoji panel
- Targets & Notes panels per room
- Room admin panel (compact overlay)
- Messages (mail) shortcut with unread badge

**Security & Privacy**
- General room: other players' sensitive stats hidden (money, bank, bullets, health, progress %)
- Public fields in General: Heist, OC, MOC, Race cooldowns + Plating + Rank
- Own player data always shown uncensored (identified by clientId)
- Private rooms: all data visible to trusted members
- No passwords, cookies, PHPSESSID, JWT or sensitive auth data sent
- No full page HTML sent to server

### Folder Structure

```
extension/    Chrome / Edge extension (load unpacked)
server/       Dashboard UI + API server
icons/        Dashboard quick-link icons
```

### Requirements

- Node.js LTS
- npm
- Chrome or Edge

### Server Setup

```bash
cd server
npm install
npm start
```

Default address: `http://localhost:3000`

### Extension Setup

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder from the project root

### Usage

1. Start the server (`npm start` inside `server/`)
2. Load the extension unpacked
3. Log in to Omerta / Barafranca pages
4. Use **Connect** (Synch) from the extension popup
5. Open the dashboard at `http://localhost:3000`

### Rank Locks

Cooldown columns show a lock icon instead of ready when rank is below the requirement:

| Cooldown | Minimum Rank |
|----------|-------------|
| Heist    | Shoplifter  |
| OC       | Thief       |
| MOC      | Assassin    |
| Spots    | Soldier     |

### Development

After editing the extension source, reload it:

1. Go to `chrome://extensions` or `edge://extensions`
2. Click **Reload** on the extension card
3. Refresh open game tabs or use **Connect** from the popup again

---

## 🇹🇷 Türkçe

Omerta / Barafranca oyuncularının cooldown takibi, oda yönetimi, sohbet ve hesap istatistiklerini tek bir dashboard'da toplayan Chrome/Edge extension + Node.js/Express server projesidir.

Sistem oyun içinde otomatik aksiyon **yapmaz**. Extension yalnızca kullanıcının kendi açık oturumlarındaki sayfa verilerini okur ve local dashboard server'ına gönderir.

### Özellikler

**Dashboard**
- TR / COM / NL / PT server sekmeleri, 32px hizalanmış toolbar (arama, filtreler, butonlar)
- Her server için aktif karakteri gösteren nickname kartları (sarı, ortalı)
- Header istatistik paneli: para, banka, mermi, sağlık — seçili servera göre güncellenir
- Hesap Tecrübeleri paneli (📊) server bazlı verilerle
- Oyuncu tablosu: rütbe, ilerleme, aktivite, cooldown durum göstergeleri
- Karakter filtresi: tabloyu kendi karakterine göre filtrele (clientId bazlı)
- Rütbe / seviye filtresi
- Oyuncu profil arama ile oyun içi direkt link
- Obay (açık artırma) paneli: geri sayım ve eski veri uyarısı (>5 dk)
- Kumarhane hızlı erişim butonu (🎲)
- Çoklu dil desteği: Türkçe / İngilizce

**Odalar & Sohbet**
- Server bazlı Portal General kanalı (TR / COM / NL / PT)
- Özel oda oluşturma / katılma sistemi
- Owner / üye / kick / bekleyen onay akışı
- Sabitlenmiş mesajlar, chat içinde tıklanabilir oyuncu profil linkleri
- Hızlı mesaj şablonları (Heist, OC, MOC, Race, City)
- Emoji paneli
- Oda başına Hedefler ve Notlar panelleri
- Oda yönetim paneli (kompakt overlay)
- Mesajlar (posta) kısayolu okunmamış rozet ile

**Güvenlik & Gizlilik**
- General odada diğer oyuncuların hassas verileri gizlenir (para, banka, mermi, sağlık, ilerleme %)
- General'da herkese açık: Heist, OC, MOC, Race cooldown'ları + Plating + Rütbe
- Kendi oyuncu verisi her zaman sansürsüz gösterilir (clientId ile tanımlanır)
- Özel odalarda tüm veriler güvenilen üyelere açık
- Şifre, cookie, PHPSESSID, JWT veya hassas auth verisi gönderilmez
- Sunucuya tam sayfa HTML gönderilmez

### Klasör Yapısı

```
extension/    Chrome / Edge extension (unpacked yükle)
server/       Dashboard arayüzü + API server
icons/        Dashboard hızlı link ikonları
```

### Gereksinimler

- Node.js LTS
- npm
- Chrome veya Edge

### Server Kurulumu

```bash
cd server
npm install
npm start
```

Varsayılan adres: `http://localhost:3000`

### Extension Kurulumu

1. `chrome://extensions` veya `edge://extensions` sayfasını açın
2. **Developer mode**'u aktif edin
3. **Load unpacked** butonuna basın
4. Proje kökündeki `extension/` klasörünü seçin

Extension popup varsayılan olarak local server ile çalışacak şekilde hazırlanmıştır.

### Kullanım

1. Server'ı başlatın (`server/` içinde `npm start`)
2. Extension'ı unpacked olarak yükleyin
3. Omerta / Barafranca sayfalarında oturum açın
4. Extension popup'tan **Connect** (Synch) kullanın
5. Dashboard'ı `http://localhost:3000` adresinden açın

Dashboard:
- Açık oyun sekmelerini algılar
- Oyuncuları aktif server sekmesine göre listeler
- General chat'i seçili servera göre ayırır
- Özel odalarda üye / owner yetkilerini uygular

### Rütbe Kilitleri

Oyuncunun rütbesi yetersizse cooldown kolonunda hazır yerine kilit gösterilir:

| Cooldown | Minimum Rütbe |
|----------|--------------|
| Heist    | Shoplifter   |
| OC       | Thief        |
| MOC      | Assassin     |
| Spots    | Soldier      |

### Notlar

- `server/data/rooms.json` oda, üye ve chat durumunu saklar.
- `server/node_modules/` yeniden kurulabilir; kaynak kod değildir.
- `FAMILY_KEY` tanımlıysa korumalı endpoint'lerde `x-family-key` gerekir.

### Geliştirme

Kod değiştirdikten sonra extension'ı yeniden yüklemek için:

1. `chrome://extensions` veya `edge://extensions` sayfasına gidin
2. Yüklü extension kartında **Reload** yapın
3. Açık oyun sekmelerini yenileyin veya popup'tan tekrar **Connect** kullanın

---

## Changelog

### v2.0.0 — 2026-06-25

**UI / Layout**
- Server chips, search bar, Go button, Seviyeler, Karakter buttons unified to 32px height
- Obay / Dice (🎲) / Stats (📊) buttons: 38px circular group, Obay rightmost
- Synch + Download Extension grouped into pill container (language-switcher style)
- Nickname cards: yellow centered nicknames, left-aligned server label
- Server clock: removed "TR" prefix
- Online player count removed from header
- Table left/right edge padding removed for full-width layout
- Download Extension button moved to nickname-strip row

**Stats & Data**
- Header stats now update correctly on server switch (cache reset order fixed)
- `selfProgression`: server returns own player's data as a dedicated field
- `findSelf` no longer falls back to wrong server's entry when requested serverId has no match
- Stats panel always visible — no layout jump on connect

**Censoring**
- General room: own cooldowns and progression now shown uncensored
- General public fields: Heist, OC, MOC, Race + Plating + Rank
- Karakter filter: clientId-based, initializes from any server's first identity event (not just active)

**Obay**
- Background fetch (`loadObayItemsViaFetch`) removed — Knockout.js compatibility fix
- Absolute Unix timestamp support in `parseEndSeconds`
- `parseEndSeconds` `|| 999999` fallback removed (was causing "11D 13H 45M" parse error)
- Stale data warning shown when data age > 5 minutes
- Language: ŞİMDİ → NOW throughout Obay panel

**Chat**
- Chat bottom toolbar moved outside `private-chat-main` — no overflow past panel border
- Mesajlar / Hedefler / Notlar height normalized to 26px, vertical alignment fixed
- Chat room labels simplified: "GENERAL (COM)" → "COM", "CRIMES (TR)" → "TR"
- Admin button margin-left added for visual separation

**Extension**
- Background Obay fetch removed from `sendCooldownUpdate`
- Identity broadcast from any server tab enables early `clientId` initialization on dashboard

---

### v1.0.0 — 2026-06-13

- Initial release: cooldown dashboard, multi-room portal chat, Obay tracker, in-game chat integration
- Chrome MV3 extension for Omerta TR / COM / NL / PT servers
- Room system: invite/join, member management, targets & notes panels
- Server-side cooldown state aggregation with SSE real-time push
