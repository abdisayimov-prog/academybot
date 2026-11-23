# 📋 O‘quv Markazi AI & Telegram Tizimi — Master Yo‘l Xaritasi
**Sana:** 22-Noyabr, 2026-yil  
**Loyiha:** Apex Academy (O‘quv markazlari uchun avtomatlashtirilgan AI Bot & Mini App)  
**Texnologik stak:** n8n Cloud, Telegram Bot API, Google Gemini Flash, Google Sheets

---

## 🎯 Asosiy Arxitektura Qoidasi
1. **Moliyaviy, hisob-kitob, vaqt, joy sanash va ruxsatlar:** 100% sof kod (`n8n` va `Google Sheets`) orqali xatosiz va tekin (0 token) ishlaydi.
2. **Suhbat, erkin matnlarni tushunish, marketing postlari va tahliliy hisobotlar:** Sun'iy intellekt (`Google Gemini Flash`) orqali bajariladi.

---

## 📊 Bugungi Muhokamalar va Aniq Yechimlar Jadvali

| № | Yo‘nalish / Funksiya | Ko‘tarilgan muammo / Savol | Qabul qilingan aniq yechim (Qanday ishlaydi?) | Kim bajaradi? (Texnologiya) | Xarajat va Token sarfi |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Ota-onalarga xabarnomalar** (Davomat va to‘lov) | SMS yuborish uchun yuridik shaxs (MChJ/YaTT) kerak va narxi 175 so‘m. Bu loyihani o‘quv markaz uchun qimmatga tushiradi. | **SMS'dan butunlay voz kechildi.** Xabarnomalar to‘g‘ridan-to‘g‘ri Telegram bot orqali ota-onaning profiliga yuboriladi. Hech qanday hujjatbozlik va to‘lov talab qilinmaydi. | ⚙️ **Sof Kod (n8n)** | **0 so‘m** (100% bepul, 0 token) |
| **2** | **Bildirishnoma yuborish mexanizmi** | Xabarnoma jo‘natish uchun AI kerakmi yoki kod yetarlimi? | AI umuman kerak emas. n8n ichidagi taymer (Cron) va qat’iy qoidalar o‘quvchining davomati va to‘lov muddatini o‘zi tekshirib, xabarni avtomatik chiqaradi. | ⚙️ **Sof Kod (n8n)** | **0 so‘m** (0 token) |
| **3** | **To‘lov holatini ajratish** | To‘lov qilgan va qilmaganlarni jadvalda qanday ajratamiz? | Google Sheets’da alohida `To'lov holati` ustuni bo‘ladi (`To'landi`, `To'lanmadi`, `Kutilmoqda`). n8n faqat `To'lanmadi` turganlarga eslatma yuboradi. | ⚙️ **Google Sheets + n8n** | **0 so‘m** (0 token) |
| **4** | **To‘lov cheklarini tekshirish** | AI (OCR) orqali chekni o‘qitsak, AI adashib 60 000 ni 600 000 deb yuborsa, markaz katta moliyaviy zarar ko‘radi. | **Moliyada AIdan voz kechildi.** "Admin Panel" tizimi: O‘quvchi chek rasmini botga tashlaydi ➡️ Adminga rasm va ikkita tugma boradi: `[Tasdiqlash ✅]` / `[Rad etish ❌]` ➡️ Admin bossa, jadval avtomatik yangilanadi. | 👤 **Inson (Admin) +**<br>⚙️ **Sof Kod (n8n)** | **0 so‘m** (Xatolik xavfi: 0%) |
| **5** | **O‘qituvchi va Admin kirishi** | O‘qituvchi va o‘quvchi panellari qanday ajratiladi? Parol kerakmi? | Super admin o‘qituvchining telefon raqamini tizimga oldindan kiritadi. O‘qituvchi botga kirib o‘z raqamini ulashganida, bot uni darhol taniydi va o‘qituvchi panelini parolsiz ochadi. | ⚙️ **Sof Kod (Telegram API)** | **0 so‘m** (0 token) |
| **6** | **Amaldagi AI vazifalari** | Hozir botimizda AI qaysi ishlarni bajarmoqda? | 1. 24/7 Yangi mijozlarga kurslar haqida samimiy maslahat berish.<br>2. Suhbat xotirasini saqlash.<br>3. Mijoz matnidan Ism, Telefon, Kursni ajratib jadvalga (`Apex Lidlar`) yozish. | 🤖 **AI (Gemini Flash) +**<br>⚙️ **n8n Tool** | Kuniga ~100k token (Google bepul limitiga to‘liq sig‘adi) |
| **7** | **Direktor uchun oylik hisobot** (AI Executive Report) | Oylik tushum, o‘quvchilar soni va qoldirilgan darslar bo‘yicha AI orqali hisobot qilsa bo‘ladimi? | Har oyning 1-sanasida n8n barcha oylik jadvallarni Gemini AIga uzatadi. AI ularni chuqur tahlil qilib, direktor Telegramiga muammolar va yangi oy uchun tavsiyalar bilan tayyor tahliliy xulosa tashlaydi. | 🤖 **AI (Gemini) +**<br>⚙️ **n8n Cron** | Oyiga atigi **~3 000 token** |
| **8** | **Kanalga e’lon chiqarish** (Auto-SMM) | O‘qituvchilar yangi kurs ochsa, AI chiroyli post tayyorlab kanalga o‘zi joylasin. | O‘qituvchi botga qisqa qoralama tashlaydi ➡️ AI uni jozibali marketing postiga aylantiradi ➡️ Adminga `[Kanalga chiqarish 🚀]` tugmasi chiqadi ➡️ Bosilsa, post kanalga `[Kursga yozilish]` tugmasi bilan chiqadi. | 🤖 **AI (Kopirayter) +**<br>⚙️ **Sof Kod (Post qilish)** | Oyiga atigi **~6 000 token** |
| **9** | **Mock Test avtomatizatsiyasi** | Haftalik Mock imtihoniga e’lon berish, vaqtlarni band qilish va ro‘yxat tuzish. | Kanalda e'lon ➡️ O‘quvchi botda smenani tanlaydi (10:00 yoki 14:00) ➡️ Kod bo‘sh joylarni sanaydi va limit to‘lsa yopadi ➡️ O‘quvchiga `#MOCK-73` unikal chipta beriladi ➡️ Google Sheets’da tayyor ro‘yxat shakllanadi. | ⚙️ **Sof Kod (90%) +**<br>🤖 **AI (10% - savollarga)** | **~50 000 token / oyiga** (Bilet va ro‘yxatga 0 token ketadi) |
| **10** | **Umumiy Token sarfi va Xarajat** | Bularning hammasiga qancha token ketadi? Limit tugab qolmaydimi? Mutaxassislar nima deydi? | AI faqat kerakli joyda ishlatilgani (Gibrid arxitektura) sababli oylik sarf ~3M tokendan oshmaydi. Google AI Studio bepul limitining 10%iga ham yetmaydi. Pullik bo‘lsa ham oyiga **~5 000 – 10 000 so‘m**. Jahon standartlariga 100% mos. | 📊 **Xalqaro mezon** | **Deyarli 0 so‘m** |

---

## 📌 Xulosa
Ushbu arxitektura orqali o‘quv markazi:
1. SMS xarajatlaridan 100% qutuladi.
2. Moliyaviy xatolardan (AI adashib pul o‘tkazib yuborishidan) to‘liq himoyalanadi.
3. Administratorlarning haftalik 15–20 soatlik behuda vaqtini tejaydi.
4. Sun'iy intellekt xarajatlari deyarli tekinga (oyiga 0 - 10 000 so‘m) tushadi.
