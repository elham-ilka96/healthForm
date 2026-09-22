
function MedicalProfile({
  name,
  nationalId,
  age,
  gender,
  height,
  weight,
  diseases,
  bmi,
  diseaseDetails,
}) {
  const getBmiStatus = () => {
    if (!bmi) {
      return "محاسبه نشد";
    }

    const value = Number(bmi);

    if (value < 18.5) {
      return "کمبود وزن";
    }

    if (value < 25) {
      return "محدوده معمول";
    }

    if (value < 30) {
      return "اضافه‌وزن";
    }

    return "چاقی";
  };

  const bmiStatus = getBmiStatus();

  return (
    <div className="profile-card">
      <h2 className="section-title">
        اطلاعات فرد
      </h2>

      <div className="profile-info">
        <div className="info-item">
          <strong>نام و نام خانوادگی:</strong>{" "}
          {name}
        </div>

        <div className="info-item">
          <strong>کد ملی:</strong>{" "}
          {nationalId}
        </div>

        <div className="info-item">
          <strong>سن:</strong> {age}
        </div>

        <div className="info-item">
          <strong>جنسیت:</strong>{" "}
          {gender === "female"
            ? "زن"
            : gender === "male"
            ? "مرد"
            : "مشخص نشده"}
        </div>

        <div className="info-item">
          <strong>قد:</strong>{" "}
          {height} سانتی‌متر
        </div>

        <div className="info-item">
          <strong>وزن:</strong>{" "}
          {weight} کیلوگرم
        </div>
      </div>

      <div className="bmi-box">
        <h3>شاخص توده بدنی</h3>

        <p>
          <strong>BMI:</strong>{" "}
          {bmi || "محاسبه نشد"}
        </p>

        <p>
          <strong>وضعیت:</strong>{" "}
          {bmiStatus}
        </p>
      </div>
      <div className="medical-history-box">
  <h3>اطلاعات بیماری‌ها</h3>

  {diseases.length === 0 ? (
    <p>هیچ بیماری‌ای انتخاب نشده است.</p>
  ) : (
    diseases.map((disease) => {
      const details =
        diseaseDetails?.[disease.id] || {};

      return (
        <div
          className="medical-disease"
          key={disease.id}
        >
          <h4>{disease.title}</h4>

          <p>
            <strong>پزشک معالج:</strong>{" "}
            {details.doctor || "ثبت نشده"}
          </p>

          <p>
            <strong>سابقه بیماری:</strong>{" "}
            {details.history || "ثبت نشده"}
          </p>

          <p>
            <strong>قرص‌های مصرفی:</strong>{" "}
            {details.medications || "ثبت نشده"}
          </p>
        </div>
      );
    })
  )}
</div>
      
    </div>
  );
}

export default MedicalProfile;