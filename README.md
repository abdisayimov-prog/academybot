# 🚀 Apex Academy — AI O'quv Markazi Boshqaruv & Telegram Mini App Tizimi (Masterplan 2.0)

Ushbu loyiha zamonaviy o'quv markazlari uchun xarajatlarni 0 so'mga tushirish, SMS tizimidan voz kechish, to'lov xavfsizligini ta'minlash hamda sun'iy intellekt (Google Gemini) imkoniyatlaridan professional darajada foydalanishga mo'ljallangan.

---

## 🌟 Amalga Oshirilgan Yangiliklar (Masterplan Bo'yicha):

### 1. 0 So'mlik Telegram Xabarnomalar (SMS o'rniga)
- SMS provayderlari (175 so'm) va MChJ/YaTT talablaridan 100% voz kechildi.
- Darsga kelmagan o'quvchilar ota-onalariga bevosita Telegram bot orqali rasmiy xabarnoma yuboriladi.

### 2. Insoniy Nazoratli To'lov Cheklari (Human-in-the-loop)
- O'quvchi ilovada to'lov cheki skrinshotini (Click / Payme / Bank) yuklaydi.
- Bosh adminga Telegram bot orqali chek rasmi va ikkita tugma boradi:
  - `[Tasdiqlash ✅]`
  - `[Rad etish ❌]`
- Admin tasdiqlashi bilan jadvalda holat **"To'landi"**ga aylanadi va o'quvchiga avtomatik tabrik xabari yetib boradi. Moliyada sun'iy intellekt xatolari 0% ga tushirildi.

### 3. Kontakt Orqali Xavfsiz Kirish (Role-Based Access)
- `/start` bosilganda foydalanuvchi faqat bitta "📱 Telefon raqamni yuborish" tugmasini ko'radi.
- Tizim raqam orqali parolsiz:
  - **O'qituvchi / Adminni** — maxsus Ustoz Boshqaruv Paneliga;
  - **O'quvchini** — shaxsiy O'quvchi Ilovasiga yo'naltiradi.

### 4. Mock Test Avtomatizatsiyasi
- Bosh sahifada haftalik IELTS Mock imtihonlari banneri.
- Smenalar bo'yicha bo'sh joylar nazorati (10:00 va 14:00, har birida 20 tadan limit).
- O'quvchiga unikal chipta beriladi (masalan: `#MOCK-001`) va Google Sheets'ga yoziladi.

### 5. Auto-SMM: Kanalga Yangi Guruh E'loni
- O'qituvchi yangi guruh ma'lumotlarini kiritadi.
- Gemini AI jozibali marketing postini generatsiya qiladi.
- `[Kanalga Chiqarish 🚀]` tugmasi bosilganda rasmiy kanalga `[Kursga Yozilish]` inline tugmasi bilan e'lon chiqariladi.

### 6. Direktor uchun Oylik AI Hisoboti (Executive Report)
- Oylik tushum, faol guruhlar, lidlar konversiyasi va Mock qatnashuvchilari.
- Sun'iy intellekt tomonidan tahlil va kelgusi oy uchun strategik tavsiyalar.

---

## 🛠 Ishga Tushirish:
1. `node start_tunnel.js` — Web server va Cloudflare tunnelni ulaydi.
2. `node bot.js` — Telegram bot controllerini ishga tushiradi.
