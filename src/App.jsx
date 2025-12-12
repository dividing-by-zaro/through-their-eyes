import { useEffect, useRef, useState } from 'react';
import './App.css';
import parse from 'html-react-parser';
import nlp from 'compromise';
import { jsPDF } from 'jspdf';
import ThresholdSelector, { THRESHOLDS } from './Components/ThresholdSelector.jsx';
import CollapsibleSection from './Components/CollapsibleSection.jsx';
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
  history: {
    label: 'Industrial Revolution',
    category: 'History',
    file: '/examples/history.txt'
  },
  biology: {
    label: 'Cell Energy',
    category: 'Biology',
    file: '/examples/biology.txt'
  },
  literature: {
    label: 'Short Story',
    category: 'Literature',
    file: '/examples/literature.txt'
  },
  nyt: {
    label: 'How to Store Leftovers',
    category: 'News',
    file: '/examples/nytimes.txt'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unknownWordsList, setUnknownWordsList] = useState([]); // List of unique unknown words

  const freqWrittenRef = useRef(null);
  const freqSpokenRef = useRef(null);
  const debounceRef = useRef(null);

  // Disable body scroll when modals are open
  useEffect(() => {
    if (showAdvanced || showAbout) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAdvanced, showAbout]);

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
      setUnknownWordsList([]);
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
    const unknownWordsSet = new Set(); // Track unique unknown words for export

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
          // Track the cleaned word for export (lowercase, letters only)
          const cleanWord = rawToken.toLowerCase().replace(/[^a-z]/g, '');
          if (cleanWord) unknownWordsSet.add(cleanWord);
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

    // Update unknown words list for export (sorted alphabetically)
    setUnknownWordsList(Array.from(unknownWordsSet).sort());

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

  // Export highlighted text as PDF
  const exportHighlightedPDF = () => {
    if (!input.trim() || !stats) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Get current proficiency level name
    const levelName = THRESHOLDS.find(t => t.value === threshold)?.name || 'Unknown';

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Reading Level Analysis - ${levelName}`, margin, yPosition);
    yPosition += 10;

    // Stats summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${stats.knownPercent}% comprehension | ${stats.unknownWords} vocabulary words | ${stats.totalWords} total words`, margin, yPosition);
    yPosition += 15;

    // Reset text color
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    // Detect proper nouns using compromise (same as main processing)
    const doc_nlp = nlp(input);
    const properNouns = new Set();
    doc_nlp.people().forEach(p => {
      p.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });
    doc_nlp.places().forEach(p => {
      p.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });
    doc_nlp.organizations().forEach(o => {
      o.text().toLowerCase().split(/\s+/).forEach(word => {
        properNouns.add(word.replace(/[^a-z]/g, ''));
      });
    });

    // Process text - split into paragraphs
    const paragraphs = input.split(/\n/);
    const freqDict = getActiveDict(corpus);

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        yPosition += 5;
        continue;
      }

      const tokens = paragraph.split(/(\s+)/).filter(Boolean);
      let lineText = '';
      let lineSegments = []; // Track segments with their styling

      for (const token of tokens) {
        if (/^\s+$/.test(token)) {
          lineText += ' ';
          lineSegments.push({ text: ' ', unknown: false });
          continue;
        }

        const cleanLower = token.toLowerCase().replace(/[^a-z]/g, '');
        if (!cleanLower) {
          lineText += token;
          lineSegments.push({ text: token, unknown: false });
          continue;
        }

        // Skip proper nouns and custom words (treat as known)
        if (properNouns.has(cleanLower) || customWords.has(token.toLowerCase())) {
          lineText += token;
          lineSegments.push({ text: token, unknown: false });
          continue;
        }

        // Check if word is unknown
        const lemma = getBestLemma(cleanLower, freqDict);
        const rank = freqDict[lemma];
        const isUnknown = rank === undefined || rank > threshold;

        lineText += token;
        lineSegments.push({ text: token, unknown: isUnknown });
      }

      // Render the paragraph with styling
      const words = lineSegments;
      let currentX = margin;
      let currentLine = [];

      for (const segment of words) {
        const textWidth = doc.getTextWidth(segment.text);

        // Check if we need a new line
        if (currentX + textWidth > pageWidth - margin && currentLine.length > 0) {
          // Render current line
          let renderX = margin;
          for (const seg of currentLine) {
            if (seg.unknown) {
              if (displayMode === 'highlight') {
                // Yellow highlight background
                const segWidth = doc.getTextWidth(seg.text);
                doc.setFillColor(255, 255, 0);
                doc.rect(renderX, yPosition - 3.5, segWidth, 5, 'F');
                doc.setTextColor(0, 0, 0);
              } else {
                // Underline (for blur or underline mode)
                doc.setTextColor(180, 0, 0);
              }
            } else {
              doc.setTextColor(0, 0, 0);
            }
            doc.text(seg.text, renderX, yPosition);
            if (seg.unknown && displayMode !== 'highlight') {
              // Draw underline
              const segWidth = doc.getTextWidth(seg.text);
              doc.setDrawColor(180, 0, 0);
              doc.line(renderX, yPosition + 1, renderX + segWidth, yPosition + 1);
            }
            renderX += doc.getTextWidth(seg.text);
          }
          yPosition += 6;
          currentLine = [];
          currentX = margin;

          // Check for page break
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
        }

        currentLine.push(segment);
        currentX += textWidth;
      }

      // Render remaining line
      if (currentLine.length > 0) {
        let renderX = margin;
        for (const seg of currentLine) {
          if (seg.unknown) {
            if (displayMode === 'highlight') {
              const segWidth = doc.getTextWidth(seg.text);
              doc.setFillColor(255, 255, 0);
              doc.rect(renderX, yPosition - 3.5, segWidth, 5, 'F');
              doc.setTextColor(0, 0, 0);
            } else {
              doc.setTextColor(180, 0, 0);
            }
          } else {
            doc.setTextColor(0, 0, 0);
          }
          doc.text(seg.text, renderX, yPosition);
          if (seg.unknown && displayMode !== 'highlight') {
            const segWidth = doc.getTextWidth(seg.text);
            doc.setDrawColor(180, 0, 0);
            doc.line(renderX, yPosition + 1, renderX + segWidth, yPosition + 1);
          }
          renderX += doc.getTextWidth(seg.text);
        }
        yPosition += 8;
      }

      // Check for page break
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    }

    doc.save(`reading-analysis-${levelName.toLowerCase()}.pdf`);
  };

  // Export word list as PDF
  const exportWordListPDF = () => {
    if (!unknownWordsList.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Get current proficiency level name
    const levelName = THRESHOLDS.find(t => t.value === threshold)?.name || 'Unknown';

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Vocab List - ${levelName}`, margin, yPosition);
    yPosition += 10;

    // Count
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${unknownWordsList.length} vocabulary words`, margin, yPosition);
    yPosition += 15;

    // Reset styling
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    // List words in columns
    const columnWidth = (pageWidth - margin * 2) / 3;
    let column = 0;
    const startY = yPosition;

    for (const word of unknownWordsList) {
      const xPos = margin + column * columnWidth;

      doc.text(`• ${word}`, xPos, yPosition);

      column++;
      if (column >= 3) {
        column = 0;
        yPosition += 6;

        // Check for page break
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
      }
    }

    doc.save(`vocab-list-${levelName.toLowerCase()}.pdf`);
  };

  return (
    <div className={`App ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d={sidebarCollapsed ? "M6 3L11 8L6 13" : "M10 3L5 8L10 13"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="logo-container">
              <img src="/through-their-eyes-logo.png" alt="Logo" className="logo-image" />
              <h1 className="logo">
                Through <span className="highlight">Their</span> Eyes
              </h1>
            </div>
          </div>

        <div className="proficiency-section">
          <h2 className="section-title">Proficiency level</h2>
          <ThresholdSelector
            value={threshold}
            onChange={handleThresholdChange}
            isDisabled={!freqReady}
          />
        </div>

          <div className="sidebar-buttons">
            <button className="sidebar-btn" onClick={() => setShowAdvanced(true)}>
              Advanced Settings
            </button>
            <button className="sidebar-btn" onClick={() => setShowAbout(true)}>
              About this tool
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="view-container">
          {view === 'editor' && (
            <div className="editor-view">
              <div className="stats-bar">
                <div className="stats-left">
                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-value">{stats?.totalWords?.toLocaleString() ?? 0}</span>
                      <span className="stat-label">Total words</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{stats?.uniqueWords?.toLocaleString() ?? 0}</span>
                      <span className="stat-label">Unique words</span>
                    </div>
                  </div>
                  {stats && (
                    <div className="comprehension-section">
                      <div className={`stat stat-comprehension ${stats.knownPercent >= 95 ? 'pass' : 'fail'}`}>
                        <span className="stat-value">{stats.knownPercent}%</span>
                        <span className="stat-label">comprehension{stats.knownPercent >= 95 ? ' ✓' : ''}</span>
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
                  )}
                </div>
                <div className="stats-actions">
                  <div className="view-toggle-icons">
                    <button
                      className={`view-icon-btn ${view === 'editor' ? 'active' : ''}`}
                      onClick={() => setView('editor')}
                      title="Side by side view"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="1" y="2" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="10" y="2" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                    <button
                      className={`view-icon-btn ${view === 'reader' ? 'active' : ''}`}
                      onClick={() => setView('reader')}
                      disabled={!output}
                      title="Full screen view"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="1" y="2" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                  </div>
                  <div className="export-actions">
                    <button
                      className="action-btn"
                      onClick={exportHighlightedPDF}
                      disabled={!input.trim() || !stats}
                      title="Download highlighted text PDF"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v9M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Text</span>
                    </button>
                    <button
                      className="action-btn"
                      onClick={exportWordListPDF}
                      disabled={!unknownWordsList.length}
                      title="Download vocab list PDF"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v9M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Vocab</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="editor-split">
                <div className="input-container">
                  <textarea
                    placeholder="Paste or type your text here..."
                    value={input}
                    onChange={handleInputChange}
                    disabled={!freqReady}
                  />
                  {!input && freqReady && (
                    <div className="sample-suggestions">
                      <span className="sample-label">Get started with an example</span>
                      <div className="sample-chips">
                        {Object.entries(SAMPLE_TEXTS).map(([key, { label, category }]) => (
                          <button
                            key={key}
                            className="sample-chip"
                            onClick={() => loadSampleText(key)}
                          >
                            <span className="chip-category">{category}</span>
                            <span className="chip-title">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
            </div>
          )}
          {view === 'reader' && (
            <div className="reader-view">
              <div className="stats-bar">
                <div className="stats-left">
                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-value">{stats?.totalWords?.toLocaleString() ?? 0}</span>
                      <span className="stat-label">Total words</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{stats?.uniqueWords?.toLocaleString() ?? 0}</span>
                      <span className="stat-label">Unique words</span>
                    </div>
                  </div>
                  {stats && (
                    <div className="comprehension-section">
                      <div className={`stat stat-comprehension ${stats.knownPercent >= 95 ? 'pass' : 'fail'}`}>
                        <span className="stat-value">{stats.knownPercent}%</span>
                        <span className="stat-label">comprehension{stats.knownPercent >= 95 ? ' ✓' : ''}</span>
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
                  )}
                </div>
                <div className="stats-actions">
                  <div className="view-toggle-icons">
                    <button
                      className={`view-icon-btn ${view === 'editor' ? 'active' : ''}`}
                      onClick={() => setView('editor')}
                      title="Side by side view"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="1" y="2" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="10" y="2" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                    <button
                      className={`view-icon-btn ${view === 'reader' ? 'active' : ''}`}
                      onClick={() => setView('reader')}
                      disabled={!output}
                      title="Full screen view"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="1" y="2" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                  </div>
                  <div className="export-actions">
                    <button
                      className="action-btn"
                      onClick={exportHighlightedPDF}
                      disabled={!input.trim() || !stats}
                      title="Download highlighted text PDF"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v9M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Text</span>
                    </button>
                    <button
                      className="action-btn"
                      onClick={exportWordListPDF}
                      disabled={!unknownWordsList.length}
                      title="Download vocab list PDF"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v9M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Vocab</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="output-text">
                {parse(output)}
              </div>
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
                  Blur simulates the reading experience. Underline and highlight keep words readable while marking them.
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
                <span className="setting-label">Word frequency dataset</span>
                <p className="setting-description">
                  Spoken frequencies are best for most applications, and are derived from a dataset of movie subtitles. Written frequencies may be better for academic applications.
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
