import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const db = new Database("medical_history.db");

// ===============================
// جدول بیماران
// ===============================
db.prepare(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT UNIQUE NOT NULL,
    nationalId TEXT,
    name TEXT,
    age TEXT,
    gender TEXT,
    height TEXT,
    weight TEXT,
    diseases TEXT,
    diseaseDetails TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();


// ===============================
// جدول کدهای تأیید
// ===============================
db.prepare(`
  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT NOT NULL,
    code TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();


// ===============================
// تست Backend
// ===============================
app.get("/", (req, res) => {
  res.json({
    message: "Medical History API is running"
  });
});


// ===============================
// ارسال کد تأیید
// ===============================
app.post("/api/send-code", (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({
        message: "شماره موبایل معتبر نیست"
      });
    }

    // ساخت کد 6 رقمی
    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // حذف کد قبلی این شماره
    db.prepare(
      "DELETE FROM verification_codes WHERE mobile = ?"
    ).run(mobile);

    // ذخیره کد جدید
    db.prepare(`
      INSERT INTO verification_codes
      (mobile, code)
      VALUES (?, ?)
    `).run(mobile, code);

    console.log(
      `Verification code for ${mobile}: ${code}`
    );

    res.json({
      message: "کد تأیید ارسال شد",
      code: code
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "خطا در ارسال کد"
    });
  }
});


// ===============================
// بررسی کد تأیید
// ===============================
app.post("/api/verify-code", (req, res) => {
  try {
    const { mobile, code } = req.body;

    const verification = db
      .prepare(`
        SELECT *
        FROM verification_codes
        WHERE mobile = ?
        AND code = ?
      `)
      .get(mobile, code);

    if (!verification) {
      return res.status(400).json({
        message: "کد تأیید اشتباه است"
      });
    }

    // حذف کد بعد از استفاده
    db.prepare(
      "DELETE FROM verification_codes WHERE mobile = ?"
    ).run(mobile);

    res.json({
      verified: true,
      message: "شماره موبایل با موفقیت تأیید شد"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "خطا در بررسی کد"
    });
  }
});


// ===============================
// ذخیره اطلاعات بیمار
// ===============================
app.post("/api/patients", (req, res) => {
  try {
    const {
      mobile,
      nationalId,
      name,
      age,
      gender,
      height,
      weight,
      diseases,
      diseaseDetails
    } = req.body;

    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({
        message: "شماره موبایل الزامی است"
      });
    }

    // بررسی اینکه این شماره قبلاً ثبت شده یا نه
// بررسی اینکه این شماره قبلاً ثبت شده یا نه
const existingPatient = db
  .prepare(
    "SELECT * FROM patients WHERE mobile = ?"
  )
  .get(mobile);

let patient;

if (existingPatient) {
  // اگر شماره قبلاً وجود داشت، اطلاعات قبلی را به‌روزرسانی می‌کنیم

  db.prepare(`
    UPDATE patients
    SET
      nationalId = ?,
      name = ?,
      age = ?,
      gender = ?,
      height = ?,
      weight = ?,
      diseases = ?,
      diseaseDetails = ?
    WHERE mobile = ?
  `).run(
    nationalId || "",
    name || "",
    age || "",
    gender || "",
    height || "",
    weight || "",
    JSON.stringify(diseases || {}),
    JSON.stringify(diseaseDetails || {}),
    mobile
  );

  patient = db
    .prepare(
      "SELECT * FROM patients WHERE mobile = ?"
    )
    .get(mobile);

} else {
  // اگر شماره جدید بود، بیمار جدید ایجاد می‌کنیم

  const result = db
    .prepare(`
      INSERT INTO patients
      (
        mobile,
        nationalId,
        name,
        age,
        gender,
        height,
        weight,
        diseases,
        diseaseDetails
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      mobile,
      nationalId || "",
      name || "",
      age || "",
      gender || "",
      height || "",
      weight || "",
      JSON.stringify(diseases || {}),
      JSON.stringify(diseaseDetails || {})
    );

  patient = db
    .prepare(
      "SELECT * FROM patients WHERE id = ?"
    )
    .get(result.lastInsertRowid);
}

res.status(200).json({
  message: "اطلاعات با موفقیت ذخیره شد",
  patient
});




  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "خطا در ذخیره اطلاعات"
    });
  }
});


// ===============================
// دریافت اطلاعات بیمار با موبایل
// ===============================
app.get("/api/patients/:mobile", (req, res) => {
  try {
    const { mobile } = req.params;

    const patient = db
      .prepare(
        "SELECT * FROM patients WHERE mobile = ?"
      )
      .get(mobile);

    if (!patient) {
      return res.status(404).json({
        message: "پرونده‌ای با این شماره موبایل پیدا نشد"
      });
    }

    patient.diseases = JSON.parse(
      patient.diseases || "{}"
    );

    patient.diseaseDetails = JSON.parse(
      patient.diseaseDetails || "{}"
    );

    res.json(patient);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "خطا در دریافت اطلاعات"
    });
  }
});


// ===============================
// اجرای سرور
// ===============================
app.listen(PORT, () => {
  console.log(
    `Server is running on http://localhost:${PORT}`
  );
});