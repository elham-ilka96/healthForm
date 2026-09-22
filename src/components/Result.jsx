function Result({ selectedDiseases }) {
  if (selectedDiseases.length === 0) {
    return (
      <div className="result-card">
        <h2 className="section-title">نتیجه بررسی</h2>

        <p>هیچ بیماری‌ای انتخاب نشده است.</p>
      </div>
    );
  }

  return (
    <div className="result-card">
      <h2 className="section-title">نتیجه بررسی</h2>

      <p>شرایط پزشکی انتخاب‌شده:</p>

      {selectedDiseases.map((disease) => (
        <div className="disease-result" key={disease.id}>
          <h3>{disease.title}</h3>

          <p>{disease.description}</p>

          <h4>موارد مرتبط:</h4>

          <ul>
            {disease.factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default Result;