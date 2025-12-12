import { useEffect, useRef, useState } from 'react';
import './App.css';
import parse from 'html-react-parser';
import ThresholdSelector from './Components/ThresholdSelector.jsx';
import { getBestLemma, clearLemmaCache } from './utils/lemmatizer.js';

const customWords = new Set(['biden', 'trump']);

// Map contractions to their base verb for frequency lookup
const CONTRACTIONS = {
  "aren't": "are", "isn't": "is", "wasn't": "was", "weren't": "were",
  "don't": "do", "doesn't": "do", "didn't": "do",
  "won't": "will", "wouldn't": "would", "couldn't": "could", "shouldn't": "should",
  "can't": "can", "cannot": "can",
  "hasn't": "have", "haven't": "have", "hadn't": "have",
  "i'm": "be", "you're": "be", "we're": "be", "they're": "be", "he's": "be", "she's": "be", "it's": "be",
  "i've": "have", "you've": "have", "we've": "have", "they've": "have",
  "i'll": "will", "you'll": "will", "we'll": "will", "they'll": "will", "he'll": "will", "she'll": "will",
  "i'd": "would", "you'd": "would", "we'd": "would", "they'd": "would", "he'd": "would", "she'd": "would",
  "let's": "let", "that's": "that", "there's": "there", "here's": "here", "what's": "what", "who's": "who",
  "ain't": "be"
};

const SAMPLE_TEXTS = {
  science: {
    label: 'Water Cycle',
    file: '/examples/science.txt'
  },
  history: {
    label: 'Industrial Revolution',
    file: '/examples/history.txt'
  },
  biology: {
    label: 'Cell Energy',
    file: '/examples/biology.txt'
  },
  literature: {
    label: 'Short Story',
    file: '/examples/literature.txt'
  },
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
  const [stats, setStats] = useState(null);
  const [corpus, setCorpus] = useState('written'); // 'written' or 'spoken'

  const freqWrittenRef = useRef(null);
  const freqSpokenRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [writtenRes, spokenRes] = await Promise.all([
          fetch('/words-lemmatized.json'),
          fetch('/words-subtlex.json')
        ]);
        const [writtenData, spokenData] = await Promise.all([
          writtenRes.json(),
          spokenRes.json()
        ]);
        freqWrittenRef.current = writtenData;
        freqSpokenRef.current = spokenData;
        setFreqReady(true);
        console.log('Loaded corpora:', {
          written: Object.keys(writtenData).length,
          spoken: Object.keys(spokenData).length
        });
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

  // Get the active frequency dictionary based on corpus selection
  const getActiveDict = (corpusType = corpus) => corpusType === 'spoken' ? freqSpokenRef.current : freqWrittenRef.current;

  const processTextWithThreshold = (thresh, corpusType = corpus) => {
    const freqDict = getActiveDict(corpusType);
    if (!freqDict) return;

    // Split into paragraphs to preserve line breaks
    const paragraphs = (input || '').split(/\n/);
    const processedParagraphs = [];

    // Stats tracking
    let totalWords = 0;
    let knownWords = 0;
    let unknownWords = 0;
    const uniqueWordsSet = new Set();
    const wordRanks = [];

    for (const paragraph of paragraphs) {
      const roughTokens = paragraph.split(/\s+/).filter(Boolean);
      let paragraphHtml = '';

      for (const rawToken of roughTokens) {
        const lowerRaw = rawToken.toLowerCase();

        if (customWords.has(lowerRaw) || !/[a-z]/i.test(rawToken)) {
          paragraphHtml += `${rawToken} `;
          continue;
        }

        totalWords++;

        // Check if token is a contraction (normalize apostrophe types)
        const normalizedToken = lowerRaw.replace(/['']/g, "'");
        const contractionBase = CONTRACTIONS[normalizedToken];
        if (contractionBase) {
          // Handle contraction as its base word
          uniqueWordsSet.add(contractionBase);
          const rank = freqDict[contractionBase];
          if (rank !== undefined) {
            wordRanks.push(rank);
          }
          // Contractions of common verbs are always known
          paragraphHtml += `${rawToken} `;
          continue;
        }

        const subTokens = rawToken.split(/[-–—'']/);
        let blur = false;
        let tokenRank = null;

        for (const sub of subTokens) {
          const clean = sub.toLowerCase().replace(/[^a-z]/g, '');
          if (!clean) continue;

          // Get the best lemma form (e.g., "running" → "run")
          const lemma = getBestLemma(clean, freqDict);
          uniqueWordsSet.add(lemma);

          const rank = freqDict[lemma];
          if (rank !== undefined) {
            wordRanks.push(rank);
            if (tokenRank === null || rank > tokenRank) tokenRank = rank;
          }
          if (rank === undefined || rank > thresh) {
            blur = true;
          }
        }

        if (blur) {
          unknownWords++;
        } else {
          knownWords++;
        }

        paragraphHtml += blur
          ? `<span class="blur">${rawToken}</span> `
          : `${rawToken} `;
      }

      processedParagraphs.push(paragraphHtml.trim());
    }

    // Calculate stats
    const knownPercent = totalWords > 0 ? Math.round((knownWords / totalWords) * 100) : 0;
    const avgRank = wordRanks.length > 0 ? Math.round(wordRanks.reduce((a, b) => a + b, 0) / wordRanks.length) : 0;

    setStats({
      totalWords,
      uniqueWords: uniqueWordsSet.size,
      knownWords,
      unknownWords,
      knownPercent,
      avgRank
    });

    setOutput(processedParagraphs.join('<br/>'));
  };

  const handleCorpusChange = (newCorpus) => {
    setCorpus(newCorpus);
    if (hasSubmitted && input.trim()) {
      processTextWithThreshold(threshold, newCorpus);
    }
  };

  const processText = () => {
    if (!getActiveDict()) return;
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
        <div className="logo-container">
          <img src="/through-their-eyes-logo.png" alt="Logo" className="logo-image" />
          <h1 className="logo">
            Through <span className="highlight">Their</span> Eyes
          </h1>
        </div>

        <ThresholdSelector
          value={threshold}
          onChange={handleThresholdChange}
          isDisabled={isBusy || !freqReady}
        />

        {/* Corpus selector */}
        <div className="corpus-toggle">
          <span className="corpus-label">Frequency corpus</span>
          <div className="corpus-options">
            <label className={`corpus-option ${corpus === 'written' ? 'active' : ''}`}>
              <input
                type="radio"
                name="corpus"
                value="written"
                checked={corpus === 'written'}
                onChange={() => handleCorpusChange('written')}
                disabled={!freqReady}
              />
              <span>Written</span>
              <span className="corpus-hint">307K words</span>
            </label>
            <label className={`corpus-option ${corpus === 'spoken' ? 'active' : ''}`}>
              <input
                type="radio"
                name="corpus"
                value="spoken"
                checked={corpus === 'spoken'}
                onChange={() => handleCorpusChange('spoken')}
                disabled={!freqReady}
              />
              <span>Spoken</span>
              <span className="corpus-hint">60K words</span>
            </label>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="view-tabs">
          <button
            className={`view-tab ${view === 'teacher' ? 'active' : ''}`}
            onClick={switchToTeacher}
          >
            <span className="tab-icon teacher">T</span>
            Text View
          </button>
          <button
            className={`view-tab ${view === 'student' ? 'active' : ''} ${!hasSubmitted ? 'disabled' : ''}`}
            onClick={switchToStudent}
            disabled={!hasSubmitted}
          >
            <span className="tab-icon student">M</span>
            Meaning View
          </button>
          <button
            className={`view-tab tab-right ${view === 'about' ? 'active' : ''}`}
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
                {isBusy ? 'Processing...' : 'Show Meaning View'}
              </button>
            </div>
          )}
          {view === 'student' && (
            <div className="student-view">
              {stats && (
                <div className="stats-panel">
                  <div className="comprehension-bar-container">
                    <div className="comprehension-label">
                      <span>Comprehension: <strong>{stats.knownPercent}%</strong> known</span>
                      <span className={`comprehension-status ${stats.knownPercent >= 95 ? 'pass' : 'fail'}`}>
                        {stats.knownPercent >= 95 ? '✓ Meets 95% threshold' : '✗ Below 95% threshold'}
                      </span>
                    </div>
                    <div className="comprehension-bar">
                      <div
                        className="comprehension-known"
                        style={{ width: `${stats.knownPercent}%` }}
                      />
                      <div
                        className="comprehension-unknown"
                        style={{ width: `${100 - stats.knownPercent}%` }}
                      />
                      <div className="comprehension-threshold" style={{ left: '95%' }} />
                    </div>
                  </div>
                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-value">{stats.totalWords.toLocaleString()}</span>
                      <span className="stat-label">Total words</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{stats.uniqueWords.toLocaleString()}</span>
                      <span className="stat-label">Unique words</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{stats.avgRank.toLocaleString()}</span>
                      <span className="stat-label">Avg. word rank</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="output-text">
                {parse(output)}
              </div>
              <button
                className="edit-btn"
                onClick={switchToTeacher}
              >
                Back to Text
              </button>
            </div>
          )}
          {view === 'about' && (
            <div className="about-view">
              <h2>How It Works</h2>

              <section className="about-section">
                <h3>Using This Tool</h3>
                <p>
                  Paste your text, select a vocabulary level, and click "Show Meaning View"
                  to see which words might cause difficulty. Hover over blurred words to reveal them. Use this insight
                  to simplify language, pre-teach vocabulary, or provide glossaries for challenging terms.
                </p>
                <p>
                  You can also choose between two frequency corpora: <strong>Written</strong> (based on web text, 307K words)
                  or <strong>Spoken</strong> (based on movie subtitles, 60K words). The spoken corpus better represents
                  everyday conversational vocabulary.
                </p>
              </section>

              <section className="about-section">
                <h3>The 95% Rule</h3>
                <p>
                  Research shows that readers need to understand approximately <strong>95% of words</strong> in a text
                  to comprehend it without assistance. When too many words are unfamiliar, the reading experience
                  becomes fragmented and frustrating—exactly what this tool helps you visualize.
                </p>
              </section>

              <section className="about-section">
                <h3>Lemmatization</h3>
                <p>
                  We group inflected forms under their base lemma. For example, "run," "runs," "running," and "ran"
                  are all counted as knowing "run." This better reflects how vocabulary knowledge works—if you know
                  a base word, you typically recognize its variations.
                </p>
              </section>

              <section className="about-section">
                <h3>Vocabulary Thresholds</h3>
                <p>
                  Our thresholds come from <a href="https://www.myvocab.info/en" target="_blank" rel="noopener noreferrer">myvocab.info</a>,
                  where users self-report their CEFR level and take a vocabulary test:
                </p>
                <ul>
                  <li><strong>A1</strong> — ~1,750 words</li>
                  <li><strong>A2</strong> — ~2,650 words</li>
                  <li><strong>B1</strong> — ~4,150 words</li>
                  <li><strong>B2</strong> — ~6,050 words</li>
                  <li><strong>C1</strong> — ~8,950 words</li>
                  <li><strong>C2</strong> — ~12,150 words</li>
                  <li><strong>Native</strong> — ~17,000 words</li>
                </ul>
              </section>

              <section className="about-section">
                <h3>Limitations</h3>
                <ul>
                  <li><strong>Derivational forms</strong> — "happy" and "happiness" are separate word families</li>
                  <li><strong>Context</strong> — "bank" has different difficulty depending on meaning</li>
                  <li><strong>Proper nouns</strong> — Names and places may blur unexpectedly</li>
                  <li><strong>Domain knowledge</strong> — Specialized terms vary by reader background</li>
                </ul>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
