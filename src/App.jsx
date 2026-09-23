import { useState } from "react";
import { diseases } from "./data/diseases";
import MedicalProfile from "./components/MedicalProfile";
import "./App.css";

function App() {
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

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setError("");

    setPatient({
      ...patient,
      [field]: value,
    });
  };

  const handleDiseaseChange = (diseaseId) => {
    setPatient({
      ...patient,
      diseases: {
        ...patient.diseases,
        [diseaseId]: !patient.diseases[diseaseId],
      },
    });
  };

  const handleDiseaseDetailChange = (
    diseaseId,
    field,
    value
  ) => {
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

  // ذخیره اطلاعات در دیتابیس
  const savePatient = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/patients",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patient),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "این کد ملی قبلاً در دیتابیس ثبت شده است."
          );
        } else {
          setError(
            data.message || "خطا در ذخیره اطلاعات"
          );
        }

        return false;
      }

      return true;
    } catch (error) {
      console.error(error);

      setError(
        "ارتباط با سرور برقرار نشد. مطمئن شوید Backend در حال اجراست."
      );

      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    // بررسی نام
    if (!patient.name.trim()) {
      setError(
        "لطفاً نام و نام خانوادگی را وارد کنید."
      );
      return;
    }

    // بررسی کد ملی
    if (!patient.nationalId) {
      setError("لطفاً کد ملی را وارد کنید.");
      return;
    }

    if (!/^\d{10}$/.test(patient.nationalId)) {
      setError(
        "کد ملی باید دقیقاً ۱۰ رقم باشد."
      );
      return;
    }

    // بررسی سن
    if (!patient.age) {
      setError("لطفاً سن فرد را وارد کنید.");
      return;
    }

    if (Number(patient.age) <= 0) {
      setError("سن وارد شده صحیح نیست.");
      return;
    }

    // بررسی جنسیت
    if (!patient.gender) {
      setError("لطفاً جنسیت را انتخاب کنید.");
      return;
    }

    // بررسی قد
    if (!patient.height) {
      setError("لطفاً قد فرد را وارد کنید.");
      return;
    }

    if (Number(patient.height) <= 0) {
      setError("قد وارد شده صحیح نیست.");
      return;
    }

    // بررسی وزن
    if (!patient.weight) {
      setError("لطفاً وزن فرد را وارد کنید.");
      return;
    }

    if (Number(patient.weight) <= 0) {
      setError("وزن وارد شده صحیح نیست.");
      return;
    }

    // ذخیره در دیتابیس
    const saved = await savePatient();

    if (saved) {
      setSubmitted(true);
    }
  };

  const selectedDiseaseList = diseases.filter(
    (disease) => patient.diseases[disease.id]
  );

  // جستجوی اطلاعات با کد ملی از دیتابیس
  const handleNationalIdChange = async (value) => {
    const nationalId = value.replace(/\D/g, "");

    setError("");

    // اگر کمتر از 10 رقم باشد
    if (nationalId.length < 10) {
      setPatient((prev) => ({
        ...prev,
        nationalId,
      }));

      return;
    }

    // قرار دادن کد ملی در فرم
    setPatient((prev) => ({
      ...prev,
      nationalId,
    }));

    try {
      setLoading(true);

      const response = await fetch(
        `http://localhost:5000/api/patients/${nationalId}`
      );

      if (response.status === 404) {
        // فرد جدید است
        setPatient((prev) => ({
          ...prev,
          nationalId,
        }));

        return;
      }

      if (!response.ok) {
        throw new Error("خطا در دریافت اطلاعات");
      }

      const oldPatient = await response.json();

      // اطلاعات دریافت شده از دیتابیس
      setPatient({
        name: oldPatient.name || "",
        nationalId: oldPatient.nationalId || "",
        age: oldPatient.age || "",
        gender: oldPatient.gender || "",
        height: oldPatient.height || "",
        weight: oldPatient.weight || "",
        diseases: oldPatient.diseases || {},
        diseaseDetails:
          oldPatient.diseaseDetails || {},
      });

      setError(
        "اطلاعات این کد ملی از دیتابیس دریافت شد."
      );

    } catch (error) {
      console.error(error);

      setError(
        "ارتباط با دیتابیس برقرار نشد."
      );
    } finally {
      setLoading(false);
    }
  };

  const heightInMeter =
    Number(patient.height) / 100;

  const bmi =
    patient.height && patient.weight
      ? (
          Number(patient.weight) /
          (heightInMeter * heightInMeter)
        ).toFixed(1)
      : null;

  return (
    <div className="app-container">
      {!submitted ? (
        <>
          <h1 className="page-title">
            پروفایل پزشکی
          </h1>

          {/* اطلاعات هویتی */}
          <div className="form-card">
            <h2 className="section-title">
              اطلاعات هویتی
            </h2>

            <div className="form-group">
              <label>نام و نام خانوادگی:</label>

              <input
                type="text"
                value={patient.name}
                onChange={(e) =>
                  handleChange(
                    "name",
                    e.target.value
                  )
                }
                placeholder="مثلاً: علی رضایی"
              />
            </div>

            <div className="form-group">
              <label>کد ملی:</label>

              <input
                type="text"
                inputMode="numeric"
                maxLength="10"
                value={patient.nationalId}
                onChange={(e) =>
                  handleNationalIdChange(
                    e.target.value
                  )
                }
                placeholder="کد ملی ۱۰ رقمی"
              />
            </div>

            <div className="form-group">
              <label>جنسیت:</label>

              <select
                value={patient.gender}
                onChange={(e) =>
                  handleChange(
                    "gender",
                    e.target.value
                  )
                }
              >
                <option value="">
                  انتخاب کنید
                </option>

                <option value="female">
                  زن
                </option>

                <option value="male">
                  مرد
                </option>
              </select>
            </div>
          </div>

          {/* اطلاعات جسمانی */}
          <div className="form-card">
            <h2 className="section-title">
              اطلاعات جسمانی
            </h2>

            <div className="form-group">
              <label>سن:</label>

              <input
                type="number"
                min="1"
                value={patient.age}
                onChange={(e) =>
                  handleChange(
                    "age",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>قد (سانتی‌متر):</label>

              <input
                type="number"
                min="1"
                value={patient.height}
                onChange={(e) =>
                  handleChange(
                    "height",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>وزن (کیلوگرم):</label>

              <input
                type="number"
                min="1"
                value={patient.weight}
                onChange={(e) =>
                  handleChange(
                    "weight",
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          {/* شرایط پزشکی */}
          <div className="form-card">
            <h2 className="section-title">
              شرایط پزشکی
            </h2>

            <div className="disease-list">
              {diseases.map((disease) => (
                <div
                  className="disease-item"
                  key={disease.id}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        patient.diseases[
                          disease.id
                        ] || false
                      }
                      onChange={() =>
                        handleDiseaseChange(
                          disease.id
                        )
                      }
                    />

                    {disease.title}
                  </label>

                  {patient.diseases[
                    disease.id
                  ] && (
                    <div className="disease-details">
                      <div className="detail-group">
                        <label>
                          نام پزشک معالج:
                        </label>

                        <input
                          type="text"
                          value={
                            patient
                              .diseaseDetails[
                              disease.id
                            ]?.doctor || ""
                          }
                          onChange={(e) =>
                            handleDiseaseDetailChange(
                              disease.id,
                              "doctor",
                              e.target.value
                            )
                          }
                          placeholder="مثلاً: دکتر احمدی"
                        />
                      </div>

                      <div className="detail-group">
                        <label>
                          سابقه بیماری:
                        </label>

                        <textarea
                          value={
                            patient
                              .diseaseDetails[
                              disease.id
                            ]?.history || ""
                          }
                          onChange={(e) =>
                            handleDiseaseDetailChange(
                              disease.id,
                              "history",
                              e.target.value
                            )
                          }
                          placeholder="سابقه بیماری را وارد کنید"
                        />
                      </div>

                      <div className="detail-group">
                        <label>
                          قرص‌های مصرفی:
                        </label>

                        <textarea
                          value={
                            patient
                              .diseaseDetails[
                              disease.id
                            ]?.medications || ""
                          }
                          onChange={(e) =>
                            handleDiseaseDetailChange(
                              disease.id,
                              "medications",
                              e.target.value
                            )
                          }
                          placeholder="نام داروها را وارد کنید"
                        />
                      </div>

                      <div className="detail-group">
                        <label>
                          توضیحات:
                        </label>

                        <textarea
                          value={
                            patient
                              .diseaseDetails[
                              disease.id
                            ]?.description || ""
                          }
                          onChange={(e) =>
                            handleDiseaseDetailChange(
                              disease.id,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="مثلاً تعداد عمل‌های جراحی انجام شده را وارد کنید"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              className="primary-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? "در حال پردازش..."
                : "ادامه"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="page-title">
            نتیجه اطلاعات پزشکی
          </h1>

          <MedicalProfile
            name={patient.name}
            nationalId={patient.nationalId}
            age={patient.age}
            gender={patient.gender}
            height={patient.height}
            weight={patient.weight}
            diseases={selectedDiseaseList}
            bmi={bmi}
            diseaseDetails={
              patient.diseaseDetails
            }
          />

          <button
            className="secondary-button"
            onClick={() => {
              setSubmitted(false);
              setError("");
            }}
          >
            ویرایش اطلاعات
          </button>
        </>
      )}
    </div>
  );
}

export default App;