import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = 5000;

// اجازه ارتباط React با Backend
app.use(cors());

// دریافت اطلاعات JSON
app.use(express.json());

// ساخت یا باز کردن دیتابیس
const db = new Database("medical_history.db");

// ساخت جدول بیماران
db.prepare(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nationalId TEXT UNIQUE NOT NULL,
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

// تست Backend
app.get("/", (req, res) => {
  res.json({
    message: "Medical History API is running"
  });
});

// ذخیره اطلاعات بیمار
app.post("/api/patients", (req, res) => {
  try {
    const {
      nationalId,
      name,
      age,
      gender,
      height,
      weight,
      diseases,
      diseaseDetails
    } = req.body;

    if (!nationalId) {
      return res.status(400).json({
        message: "کد ملی الزامی است"
      });
    }

    const existingPatient = db
      .prepare("SELECT * FROM patients WHERE nationalId = ?")
      .get(nationalId);

    if (existingPatient) {
      return res.status(409).json({
        message: "این کد ملی قبلاً ثبت شده است",
        patient: existingPatient
      });
    }

    const result = db
      .prepare(`
        INSERT INTO patients
        (
          nationalId,
          name,
          age,
          gender,
          height,
          weight,
          diseases,
          diseaseDetails
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        nationalId,
        name || "",
        age || "",
        gender || "",
        height || "",
        weight || "",
        JSON.stringify(diseases || {}),
        JSON.stringify(diseaseDetails || {})
      );

    const patient = db
      .prepare("SELECT * FROM patients WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({
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


// دریافت اطلاعات بیمار با کد ملی
app.get("/api/patients/:nationalId", (req, res) => {
  try {
    const { nationalId } = req.params;

    const patient = db
      .prepare("SELECT * FROM patients WHERE nationalId = ?")
      .get(nationalId);

    if (!patient) {
      return res.status(404).json({
        message: "بیماری با این کد ملی پیدا نشد"
      });
    }

    patient.diseases = JSON.parse(patient.diseases || "{}");
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

// اجرای سرور
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
