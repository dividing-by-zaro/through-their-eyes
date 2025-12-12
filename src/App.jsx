import { useEffect, useRef, useState } from 'react';
import './App.css';
import parse from 'html-react-parser';
import nlp from 'compromise';
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
  const [freqReady, setFreqReady] = useState(false);
  const [view, setView] = useState('editor'); // 'editor' or 'reader'
  const [stats, setStats] = useState(null);
  const [corpus, setCorpus] = useState('spoken'); // 'spoken' or 'written'
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [displayMode, setDisplayMode] = useState('blur'); // 'blur', 'underline', 'highlight'

  const freqWrittenRef = useRef(null);
  const freqSpokenRef = useRef(null);
  const debounceRef = useRef(null);

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

  // Debounced text processing - waits 300ms after typing stops
  const processWithDebounce = (text, thresh = threshold, corpusType = corpus) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      processTextWithThreshold(thresh, corpusType, text);
    }, 300);
  };

  const handleInputChange = (e) => {
    const newInput = e.target.value;
    setInput(newInput);
    if (newInput.trim() && freqReady) {
      processWithDebounce(newInput);
    } else {
      setOutput('');
      setStats(null);
    }
  };

  const loadSampleText = async (key) => {
    try {
      const res = await fetch(SAMPLE_TEXTS[key].file);
      const text = await res.text();
      setInput(text);
      if (freqReady) {
        // Process immediately for sample texts
        processTextWithThreshold(threshold, corpus, text);
      }
    } catch (err) {
      console.error('Failed to load sample text', err);
    }
  };

  const handleThresholdChange = (value) => {
    setThreshold(value);
    if (input.trim() && freqReady) {
      processTextWithThreshold(value, corpus, input);
    }
  };

  // Get the active frequency dictionary based on corpus selection
  const getActiveDict = (corpusType = corpus) => corpusType === 'spoken' ? freqSpokenRef.current : freqWrittenRef.current;

  const processTextWithThreshold = (thresh, corpusType = corpus, text = input) => {
    const freqDict = getActiveDict(corpusType);
    if (!freqDict || !text) return;

    // Use compromise to detect proper nouns (people, places, organizations)
    const doc = nlp(text);
    const properNouns = new Set();

    // Extract all proper nouns and normalize them for matching
    doc.people().forEach(p => {
      p.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });
    doc.places().forEach(p => {
      p.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });
    doc.organizations().forEach(o => {
      o.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });

    // Split into paragraphs to preserve line breaks
    const paragraphs = text.split(/\n/);
    const processedParagraphs = [];

    // Stats tracking
    let totalWords = 0;
    let knownWords = 0;
    let unknownWords = 0;
    let properNounCount = 0;
    const uniqueWordsSet = new Set();
    const wordRanks = [];

    for (const paragraph of paragraphs) {
      // Split on whitespace and em/en dashes, keeping the dashes as separate tokens
      const roughTokens = paragraph.split(/(\s+|(?=[—–])|(?<=[—–]))/).filter(Boolean);
      let paragraphHtml = '';

      for (const rawToken of roughTokens) {
        const lowerRaw = rawToken.toLowerCase();
        const cleanLower = lowerRaw.replace(/[^a-z]/g, '');

        // Skip non-alphabetic tokens
        if (!/[a-z]/i.test(rawToken)) {
          paragraphHtml += `${rawToken} `;
          continue;
        }

        // Skip custom words and proper nouns (don't count in stats)
        if (customWords.has(lowerRaw) || properNouns.has(cleanLower)) {
          if (properNouns.has(cleanLower)) {
            properNounCount++;
          }
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
          ? `<span class="unfamiliar unfamiliar-${displayMode}">${rawToken}</span> `
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
      avgRank,
      properNounCount
    });

    setOutput(processedParagraphs.join('<br/>'));
  };

  const handleCorpusChange = (newCorpus) => {
    setCorpus(newCorpus);
    if (input.trim() && freqReady) {
      processTextWithThreshold(threshold, newCorpus, input);
    }
  };

  const handleDisplayModeChange = (newMode) => {
    setDisplayMode(newMode);
  };

  // Re-process text when displayMode changes
  useEffect(() => {
    if (input.trim() && freqReady) {
      processTextWithThreshold(threshold, corpus, input);
    }
  }, [displayMode]);

  const switchToReader = () => {
    if (input.trim() && output) {
      setView('reader');
    }
  };
  const switchToEditor = () => setView('editor');

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
          isDisabled={!freqReady}
        />

        <div className="sidebar-buttons">
          <button className="sidebar-btn" onClick={() => setShowAdvanced(true)}>
            Advanced Settings
          </button>
          <button className="sidebar-btn" onClick={() => setShowAbout(true)}>
            About this tool
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="view-container">
          {view === 'editor' && (
            <div className="editor-view">
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
              <div className="editor-split">
                <textarea
                  placeholder="Paste or type your text here..."
                  value={input}
                  onChange={handleInputChange}
                  disabled={!freqReady}
                />
                <div className="live-preview">
                  {output ? (
                    <div className="preview-text">
                      {parse(output)}
                    </div>
                  ) : (
                    <div className="preview-placeholder">
                      Your text will appear here with difficult words blurred...
                    </div>
                  )}
                </div>
              </div>
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
                    {stats.properNounCount > 0 && (
                      <div className="stat stat-muted">
                        <span className="stat-value">{stats.properNounCount.toLocaleString()}</span>
                        <span className="stat-label">Names excluded</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                className="submit-btn"
                disabled={!freqReady || !output}
                onClick={switchToReader}
              >
                Reader View
              </button>
            </div>
          )}
          {view === 'reader' && (
            <div className="reader-view">
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
                    {stats.properNounCount > 0 && (
                      <div className="stat stat-muted">
                        <span className="stat-value">{stats.properNounCount.toLocaleString()}</span>
                        <span className="stat-label">Names excluded</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="output-text">
                {parse(output)}
              </div>
              <button
                className="edit-btn"
                onClick={switchToEditor}
              >
                Back to Editor
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Advanced Settings Modal */}
      {showAdvanced && (
        <div className="modal-overlay" onClick={() => setShowAdvanced(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Advanced Settings</h2>
              <button className="modal-close" onClick={() => setShowAdvanced(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="setting-group">
                <span className="setting-label">Display style for unfamiliar words</span>
                <p className="setting-description">
                  Choose how unfamiliar words appear. Blur simulates the reading experience.
                  Underline and highlight make words readable while still marking them.
                </p>
                <div className="display-mode-preview">
                  <span>The cat sat on the </span>
                  <span className={`unfamiliar unfamiliar-${displayMode}`}>ottoman</span>
                  <span>.</span>
                </div>
                <div className="display-mode-options">
                  <label className={`display-mode-option ${displayMode === 'blur' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="displayMode"
                      value="blur"
                      checked={displayMode === 'blur'}
                      onChange={() => handleDisplayModeChange('blur')}
                    />
                    <span>Blur</span>
                    <span className="display-mode-hint">Simulates reading</span>
                  </label>
                  <label className={`display-mode-option ${displayMode === 'underline' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="displayMode"
                      value="underline"
                      checked={displayMode === 'underline'}
                      onChange={() => handleDisplayModeChange('underline')}
                    />
                    <span>Underline</span>
                    <span className="display-mode-hint">Spell-check style</span>
                  </label>
                  <label className={`display-mode-option ${displayMode === 'highlight' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="displayMode"
                      value="highlight"
                      checked={displayMode === 'highlight'}
                      onChange={() => handleDisplayModeChange('highlight')}
                    />
                    <span>Highlight</span>
                    <span className="display-mode-hint">Highlighter style</span>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Frequency corpus</span>
                <p className="setting-description">
                  Choose the word frequency source. Spoken uses movie subtitles (everyday vocabulary).
                  Written uses web text (more formal vocabulary).
                </p>
                <div className="corpus-options">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>How It Works</h2>
              <button className="modal-close" onClick={() => setShowAbout(false)}>×</button>
            </div>
            <div className="modal-content modal-scrollable">
              <section className="about-section">
                <h3>Using This Tool</h3>
                <p>
                  Paste your text and select a vocabulary level—words are blurred instantly as you type.
                  Hover over blurred words to reveal them. Use this insight to simplify language, pre-teach
                  vocabulary, or provide glossaries for challenging terms. Click "Reader View" for a
                  distraction-free reading experience.
                </p>
                <p>
                  You can also choose between two frequency corpora: <strong><a href="https://www.kaggle.com/datasets/rtatman/english-word-frequency" target="_blank" rel="noopener noreferrer">Written</a></strong> (from Google Web Trillion Word Corpus, 307K words)
                  or <strong><a href="https://www.kaggle.com/datasets/lukevanhaezebrouck/subtlex-word-frequency" target="_blank" rel="noopener noreferrer">Spoken</a></strong> (from SUBTLEX movie subtitles, 60K words). The spoken corpus better represents
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
                  <li><strong>Domain knowledge</strong> — Specialized terms vary by reader background</li>
                </ul>
              </section>

              <section className="about-section">
                <h3>Frequently Asked Questions</h3>

                <div className="faq-item">
                  <h4>Why is a common word showing as blurred?</h4>
                  <p>
                    Word frequency is based on large text corpora, not intuition. Some words we use daily
                    in speech are rare in writing (and vice versa). Try switching between the Spoken and
                    Written corpora to see the difference. Also, technical terms common in your field may
                    be rare in general usage.
                  </p>
                </div>

                <div className="faq-item">
                  <h4>Should I aim for 100% comprehension?</h4>
                  <p>
                    Not necessarily. The 95% threshold represents comfortable independent reading, but some
                    challenge is healthy for vocabulary growth. For instructional texts where you'll provide
                    support, 90–95% is reasonable. For independent reading or assessments, aim for 95%+.
                  </p>
                </div>

                <div className="faq-item">
                  <h4>Which corpus should I use—Spoken or Written?</h4>
                  <p>
                    <strong>Spoken</strong> (from SUBTLEX movie subtitles) better reflects everyday conversational
                    vocabulary—good for dialogue, informal texts, or ESL learners focused on communication.
                    <strong> Written</strong> (from Google's web corpus) captures more formal and varied vocabulary—better
                    for textbooks, articles, or academic preparation.
                  </p>
                </div>

                <div className="faq-item">
                  <h4>How are names and places handled?</h4>
                  <p>
                    We automatically detect proper nouns (people, places, organizations) and exclude them
                    from the analysis. They appear normally and don't affect your comprehension percentage.
                    The stats panel shows how many were excluded.
                  </p>
                </div>

                <div className="faq-item">
                  <h4>How should I use this with my students?</h4>
                  <p>
                    Use it to preview texts before assigning them, identify vocabulary to pre-teach,
                    or create differentiated materials. You can also show students the blurred preview
                    to help them understand why certain texts feel harder—it validates their experience
                    and shows reading difficulty isn't about intelligence.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
