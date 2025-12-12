import { useState } from 'react';

function CollapsibleSection({
  title,
  children,
  defaultExpanded = true,
  summary = null // Optional summary text shown when collapsed
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className={`collapsible-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="collapsible-title">{title}</span>
        <span className="collapsible-indicator">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="collapsible-chevron"
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {!isExpanded && summary && (
        <div className="collapsible-summary">{summary}</div>
      )}
      <div className="collapsible-content">
        <div className="collapsible-inner">
          {children}
        </div>
      </div>
    </section>
  );
}

export default CollapsibleSection;
