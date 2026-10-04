import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import multer from "multer";
import { mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  randomInt,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
const app = express();
const PORT = Number(process.env.PORT || 5000);
const serverDirectory = dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = join(serverDirectory, "uploads");
mkdirSync(uploadsDirectory, { recursive: true });

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

const patientColumns = db.prepare("PRAGMA table_info(patients)").all();
if (!patientColumns.some((column) => column.name === "passwordHash")) {
  db.exec("ALTER TABLE patients ADD COLUMN passwordHash TEXT");
}

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (typeof storedHash !== "string") {
    return false;
  }

  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash || !/^[\da-f]{128}$/i.test(hash)) {
    return false;
  }

  const submittedHash = scryptSync(password, salt, 64);
  return timingSafeEqual(submittedHash, Buffer.from(hash, "hex"));
};


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

db.prepare(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    tokenHash TEXT PRIMARY KEY,
    mobile TEXT NOT NULL,
    mode TEXT NOT NULL,
    expiresAt INTEGER NOT NULL
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS verification_rate_limits (
    mobile TEXT PRIMARY KEY,
    sentAt INTEGER NOT NULL
  )
`).run();

const createSession = (mobile, mode) => {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM auth_sessions WHERE expiresAt <= ?").run(Date.now());
  db.prepare(`
    INSERT INTO auth_sessions (tokenHash, mobile, mode, expiresAt)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, mobile, mode, Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

const verificationCodeLifetimeMs = 3 * 60 * 1000;

const requireAuth = (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!/^[\da-f]{64}$/i.test(token)) {
    return res.status(401).json({ message: "ابتدا وارد حساب خود شوید." });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.prepare(`
    SELECT mobile, mode
    FROM auth_sessions
    WHERE tokenHash = ? AND expiresAt > ?
  `).get(tokenHash, Date.now());

  if (!session) {
    return res.status(401).json({ message: "نشست ورود معتبر نیست؛ دوباره وارد شوید." });
  }

  req.auth = session;
  next();
};

const allowedFileTypes = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${allowedFileTypes[file.mimetype]}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedFileTypes[file.mimetype]) {
      callback(new Error("فرمت فایل مجاز نیست."));
      return;
    }

    callback(null, true);
  },
});

db.prepare(`
  CREATE TABLE IF NOT EXISTS patient_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT NOT NULL,
    diseaseId TEXT NOT NULL,
    originalName TEXT NOT NULL,
    storedName TEXT NOT NULL UNIQUE,
    mimeType TEXT NOT NULL,
    size INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

const removeUploadedFiles = (files = []) => {
  for (const file of files) {
    try {
      unlinkSync(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("خطا در پاک‌سازی فایل آپلود ناموفق:", error);
      }
    }
  }
};

const patientUploadMiddleware = (req, res, next) => {
  upload.array("documents", 10)(req, res, (error) => {
    if (error) {
      const status = error instanceof multer.MulterError
        && error.code === "LIMIT_FILE_SIZE"
        ? 413
        : 400;

      res.status(status).json({
        message: error.message || "آپلود فایل ناموفق بود.",
      });
      return;
    }

    next();
  });
};



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
    const { mobile, mode } = req.body;

    if (!mobile || !/^09\d{9}$/.test(mobile) || !["signup", "login"].includes(mode)) {
      return res.status(400).json({
        message: "شماره موبایل یا نوع ورود معتبر نیست"
      });
    }

    const existingPatient = db
      .prepare("SELECT id FROM patients WHERE mobile = ?")
      .get(mobile);

    if (mode === "signup" && existingPatient) {
      return res.status(409).json({
        message: "این شماره موبایل قبلاً ثبت‌نام کرده است."
      });
    }

    if (mode === "login" && !existingPatient) {
      return res.status(404).json({
        message: "حسابی با این شماره موبایل پیدا نشد."
      });
    }

    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        message: "سرویس ارسال پیامک پیکربندی نشده است."
      });
    }

    const rateLimit = db.prepare(`
      SELECT sentAt
      FROM verification_rate_limits
      WHERE mobile = ?
    `).get(mobile);
    const resendAfter = rateLimit
      ? Math.ceil((rateLimit.sentAt + verificationCodeLifetimeMs - Date.now()) / 1000)
      : 0;

    if (resendAfter > 0) {
      return res.status(429).json({
        message: "برای ارسال دوباره کد، لطفاً کمی صبر کنید.",
        retryAfter: resendAfter,
      });
    }

    // ساخت کد 6 رقمی
    const code = randomInt(100000, 1000000).toString();
    const codeHash = createHash("sha256").update(code).digest("hex");

    // حذف کد قبلی این شماره
    db.prepare(
      "DELETE FROM verification_codes WHERE mobile = ?"
    ).run(mobile);

    // ذخیره کد جدید
    db.prepare(`
      INSERT INTO verification_codes
      (mobile, code)
      VALUES (?, ?)
    `).run(mobile, codeHash);
    db.prepare(`
      INSERT INTO verification_rate_limits (mobile, sentAt)
      VALUES (?, ?)
      ON CONFLICT(mobile) DO UPDATE SET sentAt = excluded.sentAt
    `).run(mobile, Date.now());

    console.log("Development verification code:", code);

    res.json({ message: "کد تأیید ارسال شد" });

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
    const { mobile, code, mode } = req.body;

    if (
      !mobile
      || !/^09\d{9}$/.test(mobile)
      || !/^\d{6}$/.test(code)
      || !["signup", "login"].includes(mode)
    ) {
      return res.status(400).json({
        message: "شماره موبایل یا نوع ورود معتبر نیست"
      });
    }

    const existingPatient = db
      .prepare("SELECT id FROM patients WHERE mobile = ?")
      .get(mobile);

    if (mode === "signup" && existingPatient) {
      return res.status(409).json({
        message: "این شماره موبایل قبلاً ثبت‌نام کرده است."
      });
    }

    if (mode === "login" && !existingPatient) {
      return res.status(404).json({
        message: "حسابی با این شماره موبایل پیدا نشد."
      });
    }

    const verification = db
      .prepare("SELECT * FROM verification_codes WHERE mobile = ?")
      .get(mobile);

    if (!verification) {
      return res.status(400).json({
        message: "کد تأیید اشتباه است"
      });
    }

    const createdAt = Date.parse(`${verification.createdAt.replace(" ", "T")}Z`);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt >= verificationCodeLifetimeMs) {
      db.prepare("DELETE FROM verification_codes WHERE mobile = ?").run(mobile);
      return res.status(410).json({
        message: "کد منقضی شده؛ یک کد تازه دریافت کنید."
      });
    }

    const submittedCodeHash = createHash("sha256").update(code).digest("hex");
    if (verification.code !== submittedCodeHash) {
      return res.status(400).json({
        message: "کد تأیید اشتباه است"
      });
    }

    // حذف کد بعد از استفاده
    db.prepare(
      "DELETE FROM verification_codes WHERE mobile = ?"
    ).run(mobile);

    const token = createSession(mobile, mode);
    res.json({
      verified: true,
      message: "شماره موبایل با موفقیت تأیید شد",
      token
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
app.post("/api/patients", requireAuth, patientUploadMiddleware, (req, res) => {
  const files = req.files || [];
  let patientSaved = false;

  try {
    const {
      mobile,
      password,
      nationalId,
      name,
      age,
      gender,
      height,
      weight,
      diseases: diseasesValue,
      diseaseDetails: diseaseDetailsValue,
      documentDiseaseIds: documentDiseaseIdsValue,
    } = req.body;

    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      removeUploadedFiles(files);
      return res.status(400).json({
        message: "شماره موبایل الزامی است"
      });
    }

    if (req.auth.mobile !== mobile) {
      removeUploadedFiles(files);
      return res.status(403).json({
        message: "اجازه ثبت اطلاعات برای این شماره موبایل را ندارید."
      });
    }

    if (password !== undefined && req.auth.mode !== "signup") {
      removeUploadedFiles(files);
      return res.status(403).json({
        message: "تغییر رمز عبور از این مسیر مجاز نیست."
      });
    }

    if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
      removeUploadedFiles(files);
      return res.status(400).json({
        message: "رمز عبور باید حداقل ۸ نویسه باشد."
      });
    }

    const registeredPatient = db
      .prepare("SELECT id FROM patients WHERE mobile = ?")
      .get(mobile);

    if (req.auth.mode === "signup" && registeredPatient) {
      removeUploadedFiles(files);
      return res.status(409).json({
        message: "این شماره موبایل قبلاً ثبت‌نام کرده است."
      });
    }

    if (req.auth.mode === "login" && !registeredPatient) {
      removeUploadedFiles(files);
      return res.status(404).json({
        message: "حسابی با این شماره موبایل پیدا نشد."
      });
    }

    if (!registeredPatient && !password) {
      removeUploadedFiles(files);
      return res.status(400).json({
        message: "برای ثبت‌نام، رمز عبور الزامی است."
      });
    }

    let diseases;
    let diseaseDetails;
    let documentDiseaseIds;

    try {
      diseases = typeof diseasesValue === "string"
        ? JSON.parse(diseasesValue)
        : diseasesValue || {};
      diseaseDetails = typeof diseaseDetailsValue === "string"
        ? JSON.parse(diseaseDetailsValue)
        : diseaseDetailsValue || {};
      documentDiseaseIds = typeof documentDiseaseIdsValue === "string"
        ? JSON.parse(documentDiseaseIdsValue)
        : documentDiseaseIdsValue || [];
    } catch {
      removeUploadedFiles(files);
      return res.status(400).json({
        message: "اطلاعات ارسالی معتبر نیست."
      });
    }

    if (
      !diseases
      || typeof diseases !== "object"
      || Array.isArray(diseases)
      || !diseaseDetails
      || typeof diseaseDetails !== "object"
      || Array.isArray(diseaseDetails)
      || !Array.isArray(documentDiseaseIds)
      || documentDiseaseIds.length !== files.length
      || documentDiseaseIds.some((diseaseId) =>
        !Number.isInteger(Number(diseaseId))
        || Number(diseaseId) < 1
        || !diseases[diseaseId]
      )
    ) {
      removeUploadedFiles(files);
      return res.status(400).json({
        message: "ارتباط فایل با بیماری معتبر نیست."
      });
    }

    const savePatient = db.transaction(() => {
      const existingPatient = db
        .prepare("SELECT id FROM patients WHERE mobile = ?")
        .get(mobile);

      const passwordHash = password ? hashPassword(password) : null;

      if (existingPatient) {
        db.prepare(`
          UPDATE patients
          SET
            nationalId = ?,
            name = ?,
            age = ?,
            gender = ?,
            height = CASE WHEN ? THEN ? ELSE height END,
            weight = CASE WHEN ? THEN ? ELSE weight END,
            diseases = CASE WHEN ? THEN ? ELSE diseases END,
            diseaseDetails = CASE WHEN ? THEN ? ELSE diseaseDetails END,
            passwordHash = COALESCE(?, passwordHash)
          WHERE mobile = ?
        `).run(
          nationalId || "",
          name || "",
          age || "",
          gender || "",
          height !== undefined ? 1 : 0,
          height || "",
          weight !== undefined ? 1 : 0,
          weight || "",
          diseasesValue !== undefined ? 1 : 0,
          JSON.stringify(diseases),
          diseaseDetailsValue !== undefined ? 1 : 0,
          JSON.stringify(diseaseDetails),
          passwordHash,
          mobile
        );
      } else {
        db.prepare(`
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
            diseaseDetails,
            passwordHash
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mobile,
          nationalId || "",
          name || "",
          age || "",
          gender || "",
          height || "",
          weight || "",
          JSON.stringify(diseases),
          JSON.stringify(diseaseDetails),
          passwordHash
        );
      }

      const insertDocument = db.prepare(`
        INSERT INTO patient_documents
        (mobile, diseaseId, originalName, storedName, mimeType, size)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      files.forEach((file, index) => {
        insertDocument.run(
          mobile,
          String(documentDiseaseIds[index]),
          file.originalname.replace(/[\\/]/g, ""),
          file.filename,
          file.mimetype,
          file.size
        );
      });

      return db
        .prepare("SELECT * FROM patients WHERE mobile = ?")
        .get(mobile);
    });

    const patient = savePatient();
    patientSaved = true;
    patient.diseases = JSON.parse(patient.diseases || "{}");
    patient.diseaseDetails = JSON.parse(patient.diseaseDetails || "{}");
    delete patient.passwordHash;
    patient.documents = db.prepare(`
      SELECT id, diseaseId, originalName, mimeType, size, createdAt
      FROM patient_documents
      WHERE mobile = ?
      ORDER BY id
    `).all(mobile);

    res.status(200).json({
      message: "اطلاعات با موفقیت ذخیره شد",
      patient
    });
  } catch (error) {
    if (!patientSaved) {
      removeUploadedFiles(files);
    }
    console.error(error);

    res.status(500).json({
      message: "خطا در ذخیره اطلاعات"
    });
  }
});


// ===============================
// دریافت اطلاعات بیمار با موبایل
// ===============================
app.get("/api/patients/:mobile", requireAuth, (req, res) => {
  try {
    const { mobile } = req.params;

    if (req.auth.mobile !== mobile) {
      return res.status(403).json({
        message: "اجازه مشاهده اطلاعات این حساب را ندارید."
      });
    }

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
    delete patient.passwordHash;
    patient.documents = db.prepare(`
      SELECT id, diseaseId, originalName, mimeType, size, createdAt
      FROM patient_documents
      WHERE mobile = ?
      ORDER BY id
    `).all(mobile);

    res.json(patient);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "خطا در دریافت اطلاعات"
    });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !/^09\d{9}$/.test(mobile) || typeof password !== "string") {
      return res.status(400).json({
        message: "شماره موبایل یا رمز عبور معتبر نیست."
      });
    }

    const patient = db
      .prepare("SELECT * FROM patients WHERE mobile = ?")
      .get(mobile);

    if (!patient || !verifyPassword(password, patient.passwordHash)) {
      return res.status(401).json({
        message: "شماره موبایل یا رمز عبور اشتباه است."
      });
    }

    patient.diseases = JSON.parse(patient.diseases || "{}");
    patient.diseaseDetails = JSON.parse(patient.diseaseDetails || "{}");
    patient.documents = db.prepare(`
      SELECT id, diseaseId, originalName, mimeType, size, createdAt
      FROM patient_documents
      WHERE mobile = ?
      ORDER BY id
    `).all(mobile);
    delete patient.passwordHash;
    const token = createSession(mobile, "login");

    res.json({ ...patient, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "خطا در ورود به حساب."
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