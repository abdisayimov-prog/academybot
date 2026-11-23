# O‘quv Markazlari uchun To‘liq Avtomatlashtirilgan AI Boshqaruv va Sotuv Tizimi (Masterplan)

**Hujjat turi:** Loyihaning to‘liq biznes va texnik bosh rejasi (Masterplan)  
**Texnologik asos:** `n8n` (Workflow Automation) + Telegram Bot API + AI (LLM / Whisper) + Google Sheets + SMS (Eskiz.uz)  
**Maqsad:** 10 kun ichida botni to‘liq tayyorlab, birinchi o‘quv markaziga sotish darajasiga olib chiqish.

---

## 1. Loyihaning Asosiy Mohiyati va Qiymati

O‘quv markazlarida 1 ta administratorning oylik maoshi **3 000 000 – 4 500 000 so‘m** ($250–$350). Shunda ham adminlar:
* Kechqurun yoki dam olish kunlari yangi mijozlarga javob bera olmaydi (reklama byudjeti kuyadi);
* Oylik to‘lovlarni eslatishga uyaladi yoki erinadi (markazda qarzdorlik ko‘payadi);
* Davomatni qo‘lda daftarga yozadi, darsdan qochgan o‘quvchilar haqida ota-onaga xabar berilmaydi.

**Bizning tizim:** O‘quv markaziga 1 ta qo‘shimcha xodim yollash o‘rniga, uning barcha qora ishini 24/7 xatosiz bajaruvchi aqlli AI agentni o‘rnatadi.

---

## 2. Botning 3 ta Asosiy Funksional Moduli

### 1-Modul: 24/7 AI Sotuvchi va Konsultant (Yangi mijozlar uchun)
* **Vazifasi:** Instagram, Telegram yoki reklamadan kelgan qiziquvchilarga soniyalar ichida javob berish.
* **Xususiyatlari:**
  * Kurslar, narxlar, filiallar, dars vaqtlari bo‘yicha o‘zbek va rus tillarida xushmuomala maslahat beradi.
  * **Ovozli xabarlarni (audio)** matnga o‘girib tushunadi va javob qaytaradi.
  * Suhbat oxirida mijozning ismi va telefon raqamini olib, **«Sinov darsiga yozilish»** sifatida qabul qiladi.
  * Ma’lumotlarni bir zumda Google Sheets jadvaliga tushiradi va admin shaxsiy profiliga xabar beradi.

### 2-Modul: Ustozlar va Tezkor Davomat Tizimi (Ota-onalar nazorati)
* **Vazifasi:** Darsga kelmagan o‘quvchilar haqida ota-onasiga 1 daqiqada xabar berish.
* **Qanday ishlaydi:**
  1. Ustoz dars boshida botga kirib, o‘z guruhini tanlaydi (masalan: *«IELTS 18:30»*).
  2. Guruh ro‘yxatidan faqat darsga **kelmagan** o‘quvchining ustiga bitta bosadi (❌).
  3. Tizim avtomatik ravishda o‘quvchining ota-onasiga Telegram yoki SMS orqali xabar yuboradi:
     > *«Assalomu alaykum! Farzandingiz Aliyev Sardor bugun soat 18:30 dagi Ingliz tili darsiga kelmadi. — Apex Academy ma’muriyati».*

### 3-Modul: Oylik To‘lov va Qarzdorlikni Eslatish (Moliya)
* **Vazifasi:** To‘lovlarni o‘z vaqtida undirish va qarzlar yig‘ilib qolishining oldini olish.
* **Qanday ishlaydi:**
  * Har oyning 28–30-kunlari va keyingi oyning 1–2-kunlarida tizim bazani tekshiradi.
  * To‘lov vaqti kelgan ota-onalarga shaxsiy eslatma yuboradi:
    > *«Assalomu alaykum, Dilnoza opa! Farzandingiz Aliyev Sardorning Matematika kursi uchun navbatdagi oylik to‘lov vaqti keldi (600 000 so‘m).*
    > *👉 Click orqali to‘lash: [Havola]*
    > *👉 Payme orqali to‘lash: [Havola]*
    > *Rahmat! — Apex Academy».*

---

## 3. Texnologik Stek va Arxitektura

1. **Boshqaruv markazi:** `n8n` (Vizual workflow avtomatlashtirish platformasi).
2. **Interfeys:** Telegram Bot API (Mijozlar, Ustozlar va Adminlar uchun yagona qulay muhit).
3. **Sun’iy Intellekt (AI):**
   * *OpenAI GPT-4o-mini* yoki *Groq Llama-3.3-70B* (Matnli suhbat uchun).
   * *Whisper API* (Ovozli xabarlarni tanish uchun).
4. **Ma’lumotlar bazasi:** Google Sheets API (O‘quvchilar, Guruhlar, Lidlar va Davomat jadvallari).
5. **SMS provayder:** Eskiz.uz API (O‘zbekiston bo‘ylab 1 ta SMS narxi ~35–40 so‘m).

---

## 4. Xavfsizlik, Maxfiylik va Barqarorlik (AI Guardrails)

* **OpenAI API Maxfiyligi:** Rasmiy API orqali uzatilgan biznes ma’lumotlari neyrotarmoqni qayta o‘qitish uchun ishlatilmaydi (yopiq qoladi).
* **PII Masking (Shaxsiy ma’lumotlar himoyasi):** Karta raqamlari yoki pasport seriyalari yozilsa, AI ularni tashqi tarmoqqa yubormasdan niqoblaydi.
* **Prompt Injection himoyasi:** Tizim ko‘rsatmasi (System Prompt) qat’iy chegaralanadi — bot begona savollarga javob bermaydi va o‘zicha chegirma to‘qimaydi.
* **Operatorga uzatish (Human Handoff):** Istalgan paytda *«👨‍💼 Operator bilan bog‘lanish»* tugmasi orqali jonli insonga ulanish imkoniyati.
* **Spamdan himoya (Rate Limit):** 1 daqiqada 5 tadan ortiq xabar yuborilganida tizim xarajatlarni himoyalash uchun qisqa tanaffus qiladi.
* **Xotira boshqaruvi:** Tokenlar isrof bo‘lmasligi uchun faqat oxirgi 5–8 ta xabar kontekstda saqlanadi.

---

## 5. Xarajatlar va Biznes-Model

### A. Ishlab chiquvchi (siz) uchun xarajatlar:
* **Dastlabki 7–10 kun (ishlab chiqish bosqichi):** **$0** (Hammasi kompyuterda tekin xizmatlar orqali qilinadi).
* **Keyingi oylik xarajat (mijozga ko‘rsatish davri):**
  * Bulutli Server (VPS): ~$4 / oy
  * AI balansi (API): ~$5 / oy
  * **Jami xarajat: ~$9–$10 (120 000 – 130 000 so‘m)**.

### B. O‘quv markaziga sotish narxlari (Sizning daromadingiz):
* **O‘rnatish to‘lovi (Setup fee):** **$250 – $400** (bir martalik).
* **Oylik texnik xizmat (Retainer):** **$50 – $80 / oy**.
  * *Sof foyda:* Oylik $50 to‘lovning $10 i server va AI ga ketsa, **$40 (500 000 so‘m) har oy sof passiv daromad** qoladi.

---

## 6. Birinchi Mijozni Olish Strategiyasi (3 Kunlik Bepul Test)

1. **Ma’lumotlarni yig‘ish:** Tanlangan o‘quv markazining Instagram yoki Telegram kanalidan kurslari va narxlari olinadi.
2. **Demo-bot:** `@Markaz_Yordamchi_Bot` ochilib, ma’lumotlar kiritiladi.
3. **40 soniyalik video-obzor:** Botning tezkor javobi, ovozni tushunishi va Google Sheets’ga raqam tushishi video qilib olinadi.
4. **Rahbarga taklif matni:**
   > *«Assalomu alaykum! Markazingiz uchun 24/7 yangi o‘quvchilarni yozib oladigan, ustozlar davomat qilganda ota-onaga SMS yuboradigan va oy oxirida to‘lovlarni eslatadigan AI tizim namunasini tayyorladik.*
   > *Hech qanday to‘lovsiz, 3 kunga markazingizga sinovga ulab beramiz. O‘zingiz ko‘rib baho bering. Sinab ko‘ramizmi?»*
5. **Natija:** 3 kunda 5–10 ta yangi o‘quvchi yozilgach va ota-onalar tizim qulayligini maqtashgach, rahbar tizimni sotib oladi.

---

## 7. 30 Kunlik Bosqichma-Bosqich Reja

| Davr | Qilinadigan vazifa | Xarajat |
|---|---|:---:|
| **1-hafta (1–7-kun)** | Kompyuterda `n8n` orqali botning 3 ta modulini yig‘ish va testlash | **$0** |
| **2-hafta (8–14-kun)** | Botni arzon VPS serverga joylash va 1 daqiqalik video-demo tayyorlash | **~$10** |
| **3-hafta (15–21-kun)** | 20 ta o‘quv markaziga taklif yuborish, 2–3 tasiga 3 kunlik bepul test ulash | **$0** |
| **4-hafta (22–30-kun)** | Natijalar asosida birinchi shartnomani yopish va **$250–$350** daromad olish | **Foyda: +$250** |

---

*Hujjat avtomatik ravishda kompyuteringizga saqlandi va keyingi amaliy bosqichga o‘tish uchun to‘liq tayyor.*
