# 🌸 JLPT Kotoba Master (日本語マスター)

[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0)
[![Offline](https://img.shields.io/badge/Offline-100%25-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)]()
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-blueviolet.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

แอปพลิเคชันคลังคำศัพท์และคันจิภาษาญี่ปุ่นครบวงจร ครอบคลุมระดับ **JLPT N5 ถึง N1** พร้อมคำแปลภาษาไทย 100%, เสียงอ่านฮิรางานะ, โรมาจิ, คันจิที่เกี่ยวข้อง, คำศัพท์ที่มีความหมายใกล้เคียงหรือสับสนบ่อย, 100 หมวดหมู่คำศัพท์ (Semantic Themes) และระบบแบบทดสอบ (Quiz) ที่ปรับแต่งได้อย่างอิสระ

รองรับการใช้งาน **100% Offline** บนทุกอุปกรณ์ ไม่ต้องเชื่อมต่ออินเทอร์เน็ตหลังจากดาวน์โหลดหรือเปิดใช้งานครั้งแรก

---

## 📥 ดาวน์โหลดเวอร์ชันล่าสุด (GitHub Releases)

ไปที่หน้า [**GitHub Releases v1.0.0**](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0) หรือดาวน์โหลดไฟล์สำหรับเดสก์ท็อปได้โดยตรง:

| แพลตฟอร์ม | รูปแบบไฟล์ | ลิงก์ดาวน์โหลดโดยตรง | หมายเหตุ |
| :--- | :--- | :--- | :--- |
| 🍏 **macOS** | `.dmg` Installer | [**JLPT_Kotoba_Master_1.0.0_aarch64.dmg**](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg) (~5.8 MB) | Apple Silicon (M1 / M2 / M3 / M4) ติดตั้งง่ายลากลง Applications |
| 🍏 **macOS** | `.zip` (Standalone .app) | [**JLPT_Kotoba_Master_1.0.0_macOS.zip**](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_macOS.zip) (~4.8 MB) | แตกไฟล์แล้วเปิดใช้งาน `JLPT Kotoba Master.app` ได้ทันที |
| 📱 **iOS** | PWA (Web App) | ติดตั้งผ่าน Safari (ดูวิธีด้านล่าง) | ไม่ต้องดาวน์โหลดไฟล์ ใช้งานแบบ Fullscreen App และ Offline 100% |
| 🤖 **Android** | PWA (WebAPK) | ติดตั้งผ่าน Chrome (ดูวิธีด้านล่าง) | ติดตั้งเป็นแอปบนเครื่องผ่านเบราว์เซอร์ ใช้งาน Offline 100% |
| 🪟 **Windows** | PWA / Native | ติดตั้งผ่าน Edge/Chrome หรือคอมไพล์ด้วย Tauri | ใช้งานแบบหน้าต่างแอปเดสก์ท็อปแยก |

---

## 🚀 คู่มือการใช้งานและติดตั้งในแต่ละระบบ (Platform Guides)

### 🍏 1. macOS (Apple Silicon / Intel)

#### วิธีติดตั้งผ่านไฟล์ `.dmg`:
1. ดาวน์โหลดไฟล์ [**JLPT_Kotoba_Master_1.0.0_aarch64.dmg**](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg)
2. ดับเบิลคลิกเปิดไฟล์ `.dmg`
3. ลากไอคอน **JLPT Kotoba Master** ไปวางในโฟลเดอร์ **Applications**
4. เปิดแอปจาก Launchpad หรือโฟลเดอร์ Applications เพื่อเริ่มใช้งานได้ทันที

> **หมายเหตุสำหรับ macOS Security (Gatekeeper):**
> หากเปิดแอปครั้งแรกแล้ว macOS แจ้งเตือนเรื่องความปลอดภัยของแอปที่ไม่ได้มาจาก App Store ให้ทำอย่างใดอย่างหนึ่งดังนี้:
> - คลิกขวา (หรือกด Control ค้างไว้แล้วคลิก) ที่ไอคอนแอปในโฟลเดอร์ Applications แล้วเลือก **Open (เปิด)** จากนั้นกดยืนยัน **Open**
> - หรือเปิด Terminal แล้วรันคำสั่ง:
>   ```bash
>   xattr -cr "/Applications/JLPT Kotoba Master.app"
>   ```

---

### 📱 2. iOS (iPhone และ iPad)

แอปนี้รองรับ **Progressive Web App (PWA)** อย่างเต็มรูปแบบ สามารถติดตั้งเป็นแอปจริงบนหน้าจอโฮมและใช้งาน Offline 100%:

1. เปิดเบราว์เซอร์ **Safari** บน iPhone หรือ iPad แล้วเข้าไปที่ URL ของแอป (เช่น เซิร์ฟเวอร์ภายในเครือข่าย หรือ URL บนคลาวด์/GitHub Pages)
2. แตะปุ่ม **แชร์ (Share)** (ไอคอนสี่เหลี่ยมที่มีลูกศรชี้ขึ้นที่แถบด้านล่าง)
3. เลื่อนลงมาแล้วเลือก **"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)**
4. ตั้งชื่อ (หรือใช้ชื่อเริ่มต้น) แล้วแตะ **"เพิ่ม" (Add)** ที่มุมขวาบน
5. ไอคอน **JLPT Kotoba Master** จะปรากฏบนหน้าจอโฮมของคุณเหมือนแอปทั่วไป
6. เมื่อเปิดขึ้นมา แอปจะแสดงผลแบบ **เต็มจอ (Fullscreen Standalone)** ไม่มีแถบ URL ของ Safari และสามารถเปิดใช้งานแบบ **Offline ได้ทันที แม้ไม่มีสัญญาณอินเทอร์เน็ตหรือเปิด Airplane Mode**

---

### 🤖 3. Android (สมาร์ตโฟนและแท็บเล็ต)

1. เปิดเบราว์เซอร์ **Google Chrome** บนเครื่อง Android ของคุณ แล้วเข้าไปที่ URL ของแอป
2. แตะปุ่มเมนู **จุด 3 จุด (⋮)** ที่มุมขวาบน
3. เลือก **"ติดตั้งแอป" (Install app)** หรือ **"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)** (หรือแตะแถบแนะนำการติดตั้งที่ด้านล่างหน้าจอ)
4. กดยืนยัน **ติดตั้ง (Install)**
5. ตัวเครื่องจะสร้างแอปพลิเคชัน (WebAPK) พร้อมไอคอนในหน้ารวมแอปและหน้าจอหลัก สามารถเปิดใช้งานแบบ Standalone และ Offline 100% ได้ทันที

---

### 🪟 4. Windows & Linux

#### ตัวเลือกที่ 1: ติดตั้งเป็น Desktop Web App (PWA) — *แนะนำ สะดวกที่สุด*
1. เปิดเบราว์เซอร์ **Google Chrome** หรือ **Microsoft Edge** เข้าไปที่ URL ของแอป
2. สังเกตไอคอนรูปคอมพิวเตอร์เล็กๆ ที่แถบกรอก URL ด้านขวา (หรือเปิดเมนู 3 จุด แล้วเลือก **Apps > Install JLPT Kotoba Master**)
3. กดยืนยันการติดตั้ง แอปจะเปิดขึ้นมาในหน้าต่างเดสก์ท็อปแยกเดี่ยว และสร้าง Shortcut ที่ Start Menu หรือ Desktop ให้ใช้งานออฟไลน์ได้ตลอดเวลา

#### ตัวเลือกที่ 2: คอมไพล์เป็นไฟล์ Native Application (`.exe`) ผ่าน Tauri
หากต้องการ build เป็นไฟล์ `.exe` หรือ `.msi` ติดตั้งบน Windows:
1. ติดตั้ง [Node.js](https://nodejs.org/) และ [Rust toolchain](https://www.rust-lang.org/)
2. รันคำสั่ง:
   ```powershell
   git clone https://github.com/JetsadaJan/japanese_vocab.git
   cd japanese_vocab
   npm install
   npm run tauri build
   ```
3. ไฟล์ตัวติดตั้ง `.msi` และ `.exe` จะถูกสร้างในโฟลเดอร์ `src-tauri/target/release/bundle/`

---

## 🛠️ การพัฒนาและการรันในเครื่อง (Local Development)

### 1. ความต้องการของระบบ (Prerequisites)
- **Node.js**: เวอร์ชัน 18 ขึ้นไป
- **npm**: เวอร์ชัน 9 ขึ้นไป
- **Rust**: (เฉพาะเมื่อต้องการคอมไพล์หรือรันเดสก์ท็อปผ่าน Tauri)

### 2. คำสั่งพื้นฐาน

```bash
# โคลนโปรเจกต์
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# ติดตั้งแพ็กเกจ
npm install

# รัน Development Server (Web + PWA)
npm run dev
# เปิดเบราว์เซอร์ที่ http://localhost:5173/

# ตรวจสอบโค้ดและ Type-checking
npm run build

# พรีวิว Production Build ในเครื่อง
npm run preview
```

### 3. รันหรือคอมไพล์ Desktop App (Tauri v2)

```bash
# รัน Desktop ในโหมด Development
npm run tauri dev

# คอมไพล์เป็น Production Application (.dmg สำหรับ Mac หรือ .exe สำหรับ Windows)
npm run tauri build
```

---

## 🧑‍💻 ระบบตรวจทานคำศัพท์ (Local Human Recheck Studio)

โปรเจกต์นี้มีระบบ Web Studio สำหรับให้ผู้พัฒนาหรือผู้เชี่ยวชาญตรวจสอบ, แก้ไข, และปรับปรุงคำแปลภาษาไทยและคันจิในเครื่อง Local อย่างเป็นระบบ โดยไม่กระทบกับไฟล์เผยแพร่:

```bash
npm run recheck
```
- ระบบจะเปิดเซิร์ฟเวอร์ตรวจสอบคำศัพท์ที่ **`http://localhost:5174/`**
- ข้อมูลที่ทำการ Recheck และประวัติการบันทึกจะถูกเก็บแยกไว้ในโฟลเดอร์ `backend_data/` ภายในเครื่องอย่างปลอดภัย

---

## 📊 ข้อมูลภายในระบบ (Dataset Overview)

| หมวดหมู่ | จำนวน | คำอธิบาย |
| :--- | :--- | :--- |
| 🇯🇵 **JLPT N5 Vocabulary** | 664 คำ | คำศัพท์ระดับพื้นฐานเริ่มต้น แปลไทยพร้อมตัวอย่างการอ่าน |
| 🇯🇵 **JLPT N4 Vocabulary** | 634 คำ | คำศัพท์ระดับต้น |
| 🇯🇵 **JLPT N3 Vocabulary** | 1,818 คำ | คำศัพท์ระดับกลางตอนต้น |
| 🇯🇵 **JLPT N2 Vocabulary** | 1,833 คำ | คำศัพท์ระดับกลางตอนปลายสำหรับการทำงานและการใช้ชีวิต |
| 🇯🇵 **JLPT N1 Vocabulary** | 5,804 คำ | คำศัพท์ระดับสูง ข่าว วรรณกรรม และเอกสารวิชาการ |
| 🈸 **Jōyō Kanji** | 2,136 ตัว | คันจิใช้ทั่วไป แปลไทย ลำดับขีด (Strokes) เสียงอง/คุน และระดับ JLPT |
| 🗂️ **Semantic Categories** | 100 หมวด | จัดกลุ่มคำศัพท์จำง่ายตามบริบทชีวิตประจำวันกว่า 2,900+ รายการ |

---

## 📜 แหล่งที่มาของข้อมูลและลิขสิทธิ์ (Attribution & License)

- **Source Code**: [MIT License](LICENSE)
- **Data Sets**: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](public/data/LICENSE)
  - **JLPT Word List**: [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT) อิงจากรายชื่อของ Jonathan Waller ([tanos.co.uk](http://www.tanos.co.uk/jlpt/))
  - **JMdict & KANJIDIC**: Electronic Dictionary Research and Development Group ([EDRDG](https://www.edrdg.org/)) ภายใต้ [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html)
  - **Jiten**: ลำดับความถี่ของคำศัพท์และคันจิจาก [Jiten](https://jiten.moe/frequency-dictionaries) (CC BY-SA 4.0)
- คำแปลภาษาไทย, การวิเคราะห์ความหมาย, คำสับสน, และการจัดหมวดหมู่คำศัพท์ จัดทำและรวบรวมโดยโครงการนี้
