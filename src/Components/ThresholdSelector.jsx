const THRESHOLDS = [
  {
    value: 1750,
    name: 'A1 – Beginner',
    description: '~1,750 words',
    tooltip: 'Can introduce themselves, ask and answer basic questions about personal details, interact in a simple way if the other person speaks slowly.'
  },
  {
    value: 2650,
    name: 'A2 – Elementary',
    description: '~2,650 words',
    tooltip: 'Can describe their background, immediate environment, and matters of immediate need. Handles routine tasks and direct exchanges of information.'
  },
  {
    value: 4150,
    name: 'B1 – Intermediate',
    description: '~4,150 words',
    tooltip: 'Can deal with most travel situations, describe experiences and events, give reasons and explanations for opinions and plans.'
  },
  {
    value: 6050,
    name: 'B2 – Upper Intermediate',
    description: '~6,050 words',
    tooltip: 'Can interact with native speakers fluently, produce clear detailed text on many subjects, explain viewpoints on topical issues.'
  },
  {
    value: 8950,
    name: 'C1 – Advanced',
    description: '~8,950 words',
    tooltip: 'Can express ideas fluently and spontaneously, use language flexibly for social, academic, and professional purposes with precision.'
  },
  {
    value: 12150,
    name: 'C2 – Proficient',
    description: '~12,150 words',
    tooltip: 'Can understand virtually everything heard or read, summarize information from different sources, express themselves spontaneously with precision.'
  },
  {
    value: 17000,
    name: 'Native Speaker',
    description: '~17,000 words',
    tooltip: null
  },
];

function ThresholdSelector({ value, onChange, isDisabled }) {
  return (
    <section className="threshold-section">
      <span className="threshold-label">CEFR Level</span>
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
            <label htmlFor={`thresh-${t.value}`} title={t.tooltip || ''}>
              <span className="threshold-name">{t.name}</span>
              <span className="threshold-words">{t.description}</span>
              {t.tooltip && <span className="threshold-hint">ⓘ</span>}
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ThresholdSelector;
