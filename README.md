# 🇯🇵 JLPT Kotoba Master (日本語単語マスター)

> **เว็บแอปพลิเคชันฝึกทายคำศัพท์และเรียนรู้ภาษาญี่ปุ่น JLPT N5 – N1 แบบครอบคลุม 2 ภาษา (ไทย & English)**

---

### 🌐 เข้าใช้งานจริงได้ทันทีที่นี่ (Live Demo)

[![Live Web App](https://img.shields.io/badge/🚀_เปิดใช้งานเว็บไซต์-japanesevocab.vercel.app-D4AF37?style=for-the-badge&logo=vercel&logoColor=white)](https://japanesevocab.vercel.app/)

👉 **คลิกเพื่อเข้าสู่ระบบฝึกคำศัพท์:** [**https://japanesevocab.vercel.app/**](https://japanesevocab.vercel.app/)

---

## ✨ จุดเด่นและฟีเจอร์หลัก (Key Features)

- **คลังคำศัพท์ JLPT N5 ถึง N1 ครบครันกว่า 8,054 คำ**:
  - รองรับคำแปลทั้ง **ภาษาไทย** และ **ภาษาอังกฤษ** สามารถเลือกโหมดภาษาได้ตามต้องการ (ไทย, English, หรือ ไทย+EN พร้อมกัน)
  - ตัวช่วยอ่าน **Hiragana (Furigana)** และ **Romaji** เปิด-ปิดได้อย่างอิสระ
  - ฟังเสียงอ่านภาษาญี่ปุ่นด้วย Native Speech Synthesis (TTS)
- **คลังคันจิเชื่อมโยง 1,967 ตัว**:
  - ค้นหาและดูรายละเอียดคันจิแต่ละตัว (จำนวนขีด, เสียง On'yomi, เสียง Kun'yomi)
  - เชื่อมโยงไปยังคำศัพท์ทั้งหมดที่ใช้คันจิตัวนั้นได้ทันที
- **ระบบคำพ้องเสียงและกลุ่มคำเปรียบเทียบ (Confusables & Nuance Groups)**:
  - เตือนคำที่ออกเสียงเหมือนหรือคล้ายกัน (Homophones) เพื่อป้องกันการจำสับสน
  - อธิบายความแตกต่างของคำศัพท์ที่มีความหมายใกล้เคียงกัน (ความรู้สึก Nuance, บริบทการใช้งาน, ประโยคตัวอย่าง)
- **ปรับแต่งสัดส่วนการสุ่มได้อิสระ (Custom JLPT Distribution)**:
  - ลากปรับแถบสัดส่วนเปอร์เซ็นต์หรือกรอกตัวเลขโดยตรงได้ตามระดับที่ต้องการฝึกฝน
  - กรองเฉพาะประเภทของคำ (Part of Speech) ได้ เช่น คำนาม, กริยา, คุณศัพท์
- **ดีไซน์ Silent Luxury (Kuro-urushi & Champagne)**:
  - ธีมสีดำเครื่องเขิน `#0E0F12` ตัดกับเส้นสายสีทองแชมเปญ `#D4AF37`
  - ตัวอักษรสีขาวนวล `#F3F4F6` และ Furigana สีส้มอมแดงชาด `#FB6542` ถนอมสายตา โฟกัสกับการเรียนได้ยาวนาน

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Deployment**: Vercel

---

## 💻 การติดตั้งและรันในเครื่อง (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# 2. ติดตั้ง Dependencies
npm install

# 3. รันเซิร์ฟเวอร์สำหรับพัฒนา
npm run dev

# 4. ทดสอบบิลด์โปรเจกต์
npm run build
```

---

## 📄 License

โครงการนี้พัฒนาขึ้นเพื่อการศึกษาและการเรียนรู้ภาษาญี่ปุ่น (MIT License)
