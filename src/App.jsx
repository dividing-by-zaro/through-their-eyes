import { useEffect, useRef, useState } from 'react';
import './App.css';
import parse from 'html-react-parser';
import ThresholdSelector from './Components/ThresholdSelector.jsx';

const customWords = new Set(['biden', 'trump']);

const SAMPLE_TEXTS = {
  nyt: {
    label: 'NYT Article',
    file: '/examples/nytimes.txt'
  },
  minecraft: {
    label: 'Minecraft News',
    file: '/examples/minecraft.txt'
  }
};

function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [threshold, setThreshold] = useState(4150); // B1 default
  const [isBusy, setIsBusy] = useState(false);
  const [freqReady, setFreqReady] = useState(false);
  const [view, setView] = useState('teacher'); // 'teacher', 'student', or 'about'
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const freqRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/words.json');
        const data = await res.json();
        freqRef.current = data;
        setFreqReady(true);
      } catch (err) {
        console.error('Failed to load frequency list', err);
      }
    })();
  }, []);

  const handleInputChange = (e) => setInput(e.target.value);
  const loadSampleText = async (key) => {
    try {
      const res = await fetch(SAMPLE_TEXTS[key].file);
      const text = await res.text();
      setInput(text);
    } catch (err) {
      console.error('Failed to load sample text', err);
    }
  };
  const handleThresholdChange = (value) => {
    setThreshold(value);
    // Re-process if we've already submitted
    if (hasSubmitted && input.trim()) {
      processTextWithThreshold(value);
    }
  };

  const processTextWithThreshold = (thresh) => {
    if (!freqRef.current) return;

    // Split into paragraphs to preserve line breaks
    const paragraphs = (input || '').split(/\n/);
    const processedParagraphs = [];

    for (const paragraph of paragraphs) {
      const roughTokens = paragraph.split(/\s+/).filter(Boolean);
      let paragraphHtml = '';

      for (const rawToken of roughTokens) {
        const lowerRaw = rawToken.toLowerCase();

        if (customWords.has(lowerRaw) || !/[a-z]/i.test(rawToken)) {
          paragraphHtml += `${rawToken} `;
          continue;
        }

        const subTokens = rawToken.split(/[-–—'']/);
        let blur = false;

        for (const sub of subTokens) {
          const clean = sub.toLowerCase().replace(/[^a-z]/g, '');
          if (!clean) continue;
          const rank = freqRef.current[clean];
          if (rank === undefined || rank > thresh) {
            blur = true;
            break;
          }
        }

        paragraphHtml += blur
          ? `<span class="blur">${rawToken}</span> `
          : `${rawToken} `;
      }

      processedParagraphs.push(paragraphHtml.trim());
    }

    setOutput(processedParagraphs.join('<br/>'));
  };

  const processText = () => {
    if (!freqRef.current) return;
    setIsBusy(true);
    processTextWithThreshold(threshold);
    setHasSubmitted(true);
    setView('student');
    setIsBusy(false);
  };

  const switchToTeacher = () => setView('teacher');
  const switchToStudent = () => {
    if (hasSubmitted) setView('student');
  };
  const switchToAbout = () => setView('about');

  return (
    <div className="App">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">
            Through <span className="highlight">Their</span> Eyes
          </h1>
        </div>

        <ThresholdSelector
          value={threshold}
          onChange={handleThresholdChange}
          isDisabled={isBusy || !freqReady}
        />

        <div className="sidebar-footer">
          <p>Words beyond vocabulary appear blurred. Hover to reveal.</p>
        </div>
      </aside>

      <main className="main-content">
        <div className="view-tabs">
          <button
            className={`view-tab ${view === 'teacher' ? 'active' : ''}`}
            onClick={switchToTeacher}
          >
            <span className="tab-icon teacher">T</span>
            You see
          </button>
          <button
            className={`view-tab ${view === 'student' ? 'active' : ''} ${!hasSubmitted ? 'disabled' : ''}`}
            onClick={switchToStudent}
            disabled={!hasSubmitted}
          >
            <span className="tab-icon student">S</span>
            They see
          </button>
          <button
            className={`view-tab ${view === 'about' ? 'active' : ''}`}
            onClick={switchToAbout}
          >
            <span className="tab-icon about">?</span>
            About
          </button>
        </div>

        <div className="view-container">
          {view === 'teacher' && (
            <div className="teacher-view">
              <div className="sample-buttons">
                <span className="sample-label">Try a sample:</span>
                {Object.entries(SAMPLE_TEXTS).map(([key, { label }]) => (
                  <button
                    key={key}
                    className="sample-btn"
                    onClick={() => loadSampleText(key)}
                    disabled={!freqReady}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Paste or type your text here..."
                value={input}
                onChange={handleInputChange}
                disabled={!freqReady}
              />
              <button
                className="submit-btn"
                disabled={isBusy || !freqReady || !input.trim()}
                onClick={processText}
              >
                {isBusy ? 'Processing...' : 'Show Their View'}
              </button>
            </div>
          )}
          {view === 'student' && (
            <div className="student-view">
              <div className="output-text">
                {parse(output)}
              </div>
              <button
                className="edit-btn"
                onClick={switchToTeacher}
              >
                Edit Text
              </button>
            </div>
          )}
          {view === 'about' && (
            <div className="about-view">
              <h2>How It Works</h2>

              <section className="about-section">
                <h3>The 95% Rule</h3>
                <p>
                  Research shows that readers need to understand approximately <strong>95% of words</strong> in a text
                  to comprehend it without assistance. When too many words are unfamiliar, the reading experience
                  becomes fragmented and frustrating—exactly what this tool helps you visualize.
                </p>
              </section>

              <section className="about-section">
                <h3>Word Frequency</h3>
                <p>
                  We use a corpus of word frequencies to estimate which words a reader at each level would know.
                  Words are ranked by how commonly they appear in English text. A "Newcomer" with 500 words knows
                  only the most frequent words, while an "Advanced" reader with 15,000 words recognizes far more
                  vocabulary.
                </p>
              </section>

              <section className="about-section">
                <h3>Limitations</h3>
                <p>
                  This is an approximation, not a precise measurement. The model doesn't account for:
                </p>
                <ul>
                  <li><strong>Word families</strong> — "happy," "unhappy," and "happiness" are treated separately,
                    though learners often recognize related forms</li>
                  <li><strong>Context</strong> — A word like "bank" has different difficulty depending on meaning</li>
                  <li><strong>Proper nouns</strong> — Names and places may blur even though readers handle them differently</li>
                  <li><strong>Domain knowledge</strong> — A biology student knows "mitochondria" even if it's rare overall</li>
                </ul>
              </section>

              <section className="about-section">
                <h3>Using This Tool</h3>
                <p>
                  Paste your text, select a vocabulary level that matches your students, and see which words
                  might cause difficulty. Hover over blurred words to reveal them. Use this insight to simplify
                  language, pre-teach vocabulary, or provide glossaries for challenging terms.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
