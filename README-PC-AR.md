# QG14 CARDCLASH — نسخة Windows PC

هذه الحزمة تحول نفس مشروع الويب الحالي إلى برنامج Windows باستخدام Electron **من دون تضمين مكتبة الكروت الضخمة داخل ملف EXE**.

## ما الذي تغير؟

- يبقى `npm start` كما هو لتشغيل نسخة الويب / Render.
- تمت إضافة `npm run desktop` لتشغيل نسخة الكمبيوتر.
- تمت إضافة `npm run build:win` لإنشاء Setup لويندوز.
- مجلدات الكروت الثقيلة `normal / legendary / fullscreen` لا تدخل داخل البرنامج عند البناء.
- البرنامج ينشئ مكتبة كروت خارجية افتراضيًا داخل Documents.
- يمكن تغيير موقع مكتبة الكروت من قائمة QG14 داخل البرنامج.
- يمكن اختيار مجلد المشروع نفسه كمكتبة أثناء التجربة، فلا تحتاج لنسخ 2GB من الكروت.
- السيرفر المحلي يستمع على الشبكة، وروابط اللاعبين المنسوخة تتحول تلقائيًا إلى IP الجهاز على الـLAN.
- واجهة الهوست تفتح على `127.0.0.1:38414` حتى تبقى localStorage وRotation على Origin ثابت حتى لو تغير IP الشبكة.
- `abilities.json` و`leaderboard.json` في نسخة PC يتم حفظهما داخل بيانات مستخدم Windows، وليس داخل مجلد Program Files.

## بنية مكتبة الكروت الخارجية

المجلد الذي تختاره كمكتبة يجب أن يحتوي على البنية التالية:

```text
QG14 CARDCLASH Library/
└─ public/
   ├─ images/
   │  ├─ normal/
   │  ├─ legendary/
   │  └─ fullscreen/
   └─ anime/
      └─ images/
         ├─ normal/
         ├─ legendary/
         └─ fullscreen/
```

البرنامج ينشئ هذه المجلدات تلقائيًا إذا لم تكن موجودة.

## أسرع طريقة للتجربة بدون نسخ ملفات الصور

إذا كان مشروعك موجودًا مثلًا هنا:

```text
D:\QG14-CARDCLASH\
```

وكان بداخله:

```text
D:\QG14-CARDCLASH\public\images\normal
D:\QG14-CARDCLASH\public\images\legendary
D:\QG14-CARDCLASH\public\anime\images\normal
D:\QG14-CARDCLASH\public\anime\images\legendary
```

فداخل البرنامج اختر:

`QG14 > تغيير مجلد الكروت`

ثم اختر مجلد المشروع الرئيسي:

```text
D:\QG14-CARDCLASH
```

بعد إعادة تشغيل البرنامج سيقرأ الكروت مباشرة من المشروع، ولا يتم نسخ 2GB إضافية.

## تثبيت متطلبات التطوير

على Windows ثبّت Node.js LTS، ثم افتح CMD أو PowerShell في مجلد المشروع:

```bash
npm install
```

## تشغيل نسخة PC أثناء التطوير

```bash
npm run desktop
```

سيتم فتح QG14 CARDCLASH كبرنامج مستقل.

بيانات الدخول الافتراضية في أول تشغيل:

```text
Username: qg14
Password: qg14
```

يمكن تغييرها من:

`QG14 > فتح ملف إعدادات البرنامج`

ثم عدّل:

```json
{
  "adminUsername": "qg14",
  "adminPassword": "qg14"
}
```

وأعد تشغيل البرنامج.

## بناء ملف Setup.exe

بعد التأكد أن البرنامج يعمل:

```bash
npm run build:win
```

ستجد الناتج داخل:

```text
dist\QG14-CARDCLASH-Setup-1.0.0.exe
```

ملفات `normal / legendary / fullscreen` مستبعدة من الـSetup، لذلك لن يصبح ملف التثبيت بحجم 2GB+ بسبب الكروت.

## نسخة Portable

إذا أردت EXE محمولًا بدل Setup:

```bash
npm run build:portable
```

## إضافة كرت جديد مستقبلًا

لا تعيد بناء EXE.

فقط ضع الكرت في المجلد المناسب، مثل:

```text
...\public\images\normal\NewCard.webp
...\public\images\legendary\NewLegend.webm
...\public\anime\images\normal\AnimeCard.png
```

وعند فتح صفحة الاختيار التالية سيقوم السيرفر بقراءة قائمة الملفات من جديد. نظام Rotation الدائم يتعامل مع الكروت الجديدة ضمن الدورة بدل الحاجة لإعادة تثبيت البرنامج.

## روابط اللاعبين

نسخة PC تشغل السيرفر على الشبكة المحلية. البرنامج نفسه يستخدم `127.0.0.1:38414` داخليًا، لكن عند نسخ رابط اللاعب يتم تحويله إلى IP الجهاز، مثل:

```text
http://192.168.1.25:38414/host-strategic/order.html?...
```

لكي يعمل الرابط:

1. جهاز الهوست واللاعب يجب أن يكونا على نفس Wi‑Fi/LAN.
2. عند ظهور Windows Firewall لأول مرة، اسمح للبرنامج بالوصول إلى **Private networks**.
3. إذا كان اللاعب خارج نفس الشبكة، نسخة PC المحلية وحدها لا تكفي؛ استخدم نسخة Render أو حل Tunnel/VPN مناسب.

## Firebase

البرنامج يعمل محليًا حتى بدون Firebase لأن المشروع لديه ملفات محلية للـLeaderboard والقدرات.

إذا أردت Firebase في نسخة PC، لا تضع Service Account داخل EXE. ضع ملف JSON في مكان آمن ثم افتح:

`QG14 > فتح ملف إعدادات البرنامج`

وأضف مساره:

```json
{
  "firebaseServiceAccountPath": "C:\\QG14-Secrets\\service-account.json"
}
```

ثم أعد تشغيل البرنامج.

## Render / GitHub

إضافة Electron لا تلغي نسخة Render:

```bash
npm start
```

ما زال يشغل:

```bash
node index.js
```

لذلك يمكنك إبقاء نفس GitHub Repository متصلًا بـRender وفي نفس الوقت بناء نسخة Windows منه.

## أين تحفظ بيانات نسخة PC؟

- Rotation وlocalStorage: داخل بيانات Electron للمستخدم، على Origin محلي ثابت.
- Leaderboard وAbilities: داخل مجلد بيانات QG14 في AppData.
- الكروت: في مكتبة الكروت الخارجية التي تختارها.

بهذا تحديث البرنامج أو تغيير Render لا يحتاج إلى تغيير مكتبة الكروت.
