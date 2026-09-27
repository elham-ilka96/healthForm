
import { useState } from "react";
import { diseases } from "./data/diseases";
import MedicalProfile from "./components/MedicalProfile";
import "./App.css";

function App() {
  const [step, setStep] = useState(1);

  const [mobile, setMobile] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [patient, setPatient] = useState({
    name: "",
    nationalId: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    diseases: {},
    diseaseDetails: {},
  });

  // =========================
  // شماره موبایل
  // =========================
  const handleMobileChange = (e) => {
    const value = e.target.value;

    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value.length > 11) {
      return;
    }

    setMobile(value);
    setError("");
  };

const handleMobileSubmit = async (e) => {
  e.preventDefault();

  if (!/^09\d{9}$/.test(mobile)) {
    setError(
      "لطفاً یک شماره موبایل 11 رقمی که با 09 شروع می‌شود وارد کنید."
    );
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5000/api/send-code",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobile,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "خطا در ارسال کد");
      return;
    }

    console.log("کد تأیید:", data.code);

    setError("");
    setStep(2);

  } catch (error) {
    console.error(error);

    setError(
      "ارتباط با سرور برقرار نشد. مطمئن شوید Backend روشن است."
    );
  }
};


  // =========================
  // کد تأیید
  // =========================
  const handleVerificationCodeChange = (e) => {
    const value = e.target.value;

    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value.length > 6) {
      return;
    }

    setVerificationCode(value);
    setError("");
  };

  
const handleVerificationSubmit = async () => {
  if (verificationCode.length !== 6) {
    setError("کد تأیید باید 6 رقمی باشد.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:5000/api/verify-code",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobile,
          code: verificationCode,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "کد تأیید اشتباه است.");
      return;
    }

    console.log(data.message);

    // ==========================
    // دریافت پرونده با شماره موبایل
    // ==========================

    const patientResponse = await fetch(
      `http://localhost:5000/api/patients/${mobile}`
    );

    if (patientResponse.ok) {
      const patientData = await patientResponse.json();

      console.log(
        "اطلاعات قبلی بیمار:",
        patientData
      );

      setPatient({
        name: patientData.name || "",
        nationalId: patientData.nationalId || "",
        age: patientData.age || "",
        gender: patientData.gender || "",
        height: patientData.height || "",
        weight: patientData.weight || "",
        diseases: patientData.diseases || {},
        diseaseDetails:
          patientData.diseaseDetails || {},
      });
    } else {
      // بیمار جدید است
      console.log(
        "برای این شماره موبایل پرونده‌ای وجود ندارد."
      );
    }

    setError("");
    setStep(3);

  } catch (error) {
    console.error(error);

    setError(
      "ارتباط با سرور برقرار نشد. مطمئن شوید Backend روشن است."
    );
  }
};

  // =========================
  // اطلاعات شخص
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setPatient({
      ...patient,
      [name]: value,
    });
  };

  // =========================
  // انتخاب بیماری
  // =========================
  const handleDiseaseChange = (diseaseId) => {
    setPatient({
      ...patient,
      diseases: {
        ...patient.diseases,
        [diseaseId]: !patient.diseases[diseaseId],
      },
    });
  };

  // =========================
  // اطلاعات بیماری
  // =========================
  const handleDiseaseDetailChange = (diseaseId, field, value) => {
    setPatient({
      ...patient,
      diseaseDetails: {
        ...patient.diseaseDetails,
        [diseaseId]: {
          ...patient.diseaseDetails[diseaseId],
          [field]: value,
        },
      },
    });
  };

  // =========================
  // ثبت فرم
  // =========================
  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch(
      "http://localhost:5000/api/patients",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobile,
          nationalId: patient.nationalId,
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          height: patient.height,
          weight: patient.weight,
          diseases: patient.diseases,
          diseaseDetails: patient.diseaseDetails,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 409) {
        setError(
          "این شماره موبایل قبلاً ثبت شده است."
        );
        return;
      }

      setError(
        data.message || "خطا در ذخیره اطلاعات"
      );
      return;
    }

    console.log(
      "اطلاعات با موفقیت ذخیره شد:",
      data
    );

    setError("");
    setSubmitted(true);

  } catch (error) {
    console.error(error);

    setError(
      "ارتباط با سرور برقرار نشد."
    );
  }
};
  // =========================
  // صفحه 1
  // =========================
  if (step === 1) {
    return (
      <div className="app-container">
        <div className="mobile-login">
          <h1 className="medical-title">پروفایل پزشکی</h1>

          <h2>ورود</h2>

          <p>شماره موبایل خود را وارد کنید</p>

          <form onSubmit={handleMobileSubmit}>
            <input
              type="tel"
              value={mobile}
              onChange={handleMobileChange}
              placeholder="09123456789"
              maxLength="11"
              inputMode="numeric"
              dir="ltr"
            />

            <small>
              شماره موبایل باید 11 رقم باشد و با 09 شروع شود.
            </small>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={mobile.length !== 11}
            >
              دریافت کد پیامک
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================
  // صفحه 2
  // =========================
  if (step === 2) {
    return (
      <div className="app-container">
        <div className="mobile-login">
          <h1 className="medical-title">پروفایل پزشکی</h1>

          <h2>تأیید شماره موبایل</h2>

          <p>
            کد 6 رقمی ارسال شده به شماره زیر را وارد کنید:
          </p>

          <strong>{mobile}</strong>

          <div className="verification-box">
            <input
              type="text"
              value={verificationCode}
              onChange={handleVerificationCodeChange}
              maxLength="6"
              placeholder="123456"
              inputMode="numeric"
              dir="ltr"
            />

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerificationSubmit}
              disabled={verificationCode.length !== 6}
            >
              تأیید کد
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // اگر فرم ثبت شده باشد
  // =========================
  if (submitted) {
    const selectedDiseases = diseases.filter(
      (disease) => patient.diseases[disease.id]
    );

    const heightInMeters = Number(patient.height) / 100;
    const bmi =
      patient.height && patient.weight && heightInMeters > 0
        ? (
            Number(patient.weight) /
            (heightInMeters * heightInMeters)
          ).toFixed(1)
        : "";

    return (
      <MedicalProfile
        name={patient.name}
        nationalId={patient.nationalId}
        age={patient.age}
        gender={patient.gender}
        height={patient.height}
        weight={patient.weight}
        diseases={selectedDiseases}
        bmi={bmi}
        diseaseDetails={patient.diseaseDetails}
      />
    );
  }

  // =========================
  // صفحه 3 - فرم اصلی پزشکی
  // =========================
  return (
    <div className="app-container">
      <div className="profile-card medical-form">

        <h1>ثبت اطلاعات پزشکی</h1>

        <div className="form-row">
          <label>نام و نام خانوادگی:</label>
          <input
            type="text"
            name="name"
            value={patient.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label>کد ملی:</label>
          <input
            type="text"
            name="nationalId"
            value={patient.nationalId}
            onChange={handleChange}
            maxLength="10"
            inputMode="numeric"
          />
        </div>

        <div className="form-row">
          <label>سن:</label>
          <input
            type="number"
            name="age"
            value={patient.age}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label>جنسیت:</label>

          <select
            name="gender"
            value={patient.gender}
            onChange={handleChange}
          >
            <option value="">انتخاب کنید</option>
            <option value="female">زن</option>
            <option value="male">مرد</option>
          </select>
        </div>

        <div className="form-row">
          <label>قد (سانتی‌متر):</label>
          <input
            type="number"
            name="height"
            value={patient.height}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label>وزن (کیلوگرم):</label>
          <input
            type="number"
            name="weight"
            value={patient.weight}
            onChange={handleChange}
          />
        </div>

        <h3>بیماری‌ها</h3>

        <div className="disease-list">
          {diseases.map((disease) => (
            <label key={disease.id}>
              <input
                type="checkbox"
                checked={
                  !!patient.diseases[disease.id]
                }
                onChange={() =>
                  handleDiseaseChange(disease.id)
                }
              />

              {disease.title}
            </label>
          ))}
        </div>

        {diseases
          .filter(
            (disease) =>
              patient.diseases[disease.id]
          )
          .map((disease) => {
            const details =
              patient.diseaseDetails[disease.id] || {};

            return (
              <div
                className="disease-details"
                key={disease.id}
              >
                <h3>{disease.title}</h3>

                <div className="form-row">
                  <label>اسم پزشک معالج:</label>

                  <input
                    type="text"
                    value={details.doctor || ""}
                    onChange={(e) =>
                      handleDiseaseDetailChange(
                        disease.id,
                        "doctor",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-row">
                  <label>سابقه بیماری:</label>

                  <textarea
                    value={details.history || ""}
                    onChange={(e) =>
                      handleDiseaseDetailChange(
                        disease.id,
                        "history",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-row">
                  <label>قرص‌های مصرفی:</label>

                  <textarea
                    value={details.medications || ""}
                    onChange={(e) =>
                      handleDiseaseDetailChange(
                        disease.id,
                        "medications",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            );
          })}

        <button
          type="button"
          onClick={handleSubmit}
        >
          ثبت اطلاعات
        </button>
      </div>
    </div>
  );
}

export default App;
