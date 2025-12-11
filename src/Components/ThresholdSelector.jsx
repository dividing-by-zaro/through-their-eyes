const THRESHOLDS = [
  { value: 500, name: 'Newcomer', description: '500 most common words' },
  { value: 3000, name: 'Conversational', description: '3,000 words' },
  { value: 10000, name: 'Native Speaker', description: '10,000 words' },
  { value: 15000, name: 'Advanced', description: '15,000 words' },
];

function ThresholdSelector({ value, onChange, isDisabled }) {
  return (
    <section className="threshold-section">
      <span className="threshold-label">Vocabulary Level</span>
      <div className="threshold-options">
        {THRESHOLDS.map((t) => (
          <div key={t.value} className="threshold-option">
            <input
              type="radio"
              id={`thresh-${t.value}`}
              name="threshold"
              value={t.value}
              checked={value === t.value}
              onChange={() => onChange(t.value)}
              disabled={isDisabled}
            />
            <label htmlFor={`thresh-${t.value}`}>
              <span className="threshold-name">{t.name}</span>
              <span className="threshold-words">{t.description}</span>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ThresholdSelector;
