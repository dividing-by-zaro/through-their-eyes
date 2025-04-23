// App.jsx
import { useEffect, useRef, useState } from 'react';
import './App.css';
import parse from 'html-react-parser';
import ThresholdSelector from './Components/ThresholdSelector.jsx';

/* ---------- constants ---------- */
const customWords = new Set(['biden', 'trump']);   // case-insensitive

function App() {
  /* ---------- state ---------- */
  const [input, setInput]         = useState('');
  const [output, setOutput]       = useState('');
  const [threshold, setThreshold] = useState(15000);
  const [isBusy, setIsBusy]       = useState(false);
  const [freqReady, setFreqReady] = useState(false);

  /* ---------- frequency map ---------- */
  const freqRef = useRef(null);   // { word: rank }

  /* ---------- load JSON once ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/words.json');   // static asset in /public
        const data = await res.json();
        freqRef.current = data;
        setFreqReady(true);
      } catch (err) {
        console.error('Failed to load frequency list', err);
      }
    })();
  }, []);

  /* ---------- handlers ---------- */
  const handleChange     = e => setInput(e.target.value);
  const handleThreshold  = e => setThreshold(Number(e.target.value));

  const getInfo = () => {
    if (!freqRef.current) return;
    setIsBusy(true);

    /* --- 1 · primary tokenisation on whitespace --- */
    const roughTokens = (input || '')
      .replace(/\n/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    let html = '';

    for (const rawToken of roughTokens) {
      const lowerRaw = rawToken.toLowerCase();

      /* Skip immediate cases: custom words or pure numbers */
      if (customWords.has(lowerRaw) || /^\d+$/.test(lowerRaw.replace(/[^0-9]/g, ''))) {
        html += `${rawToken} `;
        continue;
      }

      /* --- 1a · secondary split on hyphens & apostrophes --- */
      const subTokens = rawToken.split(/[-–—'’]/);      // keeps punctuation in rawToken

      /* --- 2 · determine if any sub-token is outside threshold --- */
      let blur = false;

      for (const sub of subTokens) {
        const clean = sub.toLowerCase().replace(/[^a-z]/g, '');
        if (!clean) continue;                           // empty after cleanup
        const rank = freqRef.current[clean];
        if (rank === undefined || rank > threshold) {
          blur = true;
          break;
        }
      }

      /* --- 3 · build HTML --- */
      html += blur
        ? `<span class="blur">${rawToken}</span> `
        : `${rawToken} `;
    }

    setOutput(html.trim());
    setIsBusy(false);
  };

  /* ---------- render ---------- */
  return (
    <div className="App">
      <h1>View Text through Your Students' Eyes</h1>

      {/* -- rest of your explanatory text / intro panel here -- */}

      <ThresholdSelector
        handleChange={handleThreshold}
        isDisabled={isBusy || !freqReady}
      />

      <h2>Current frequency threshold: {threshold}</h2>

      <div className="inputContainer">
        <h2>You see…</h2>
        <textarea
          placeholder="Enter your text here…"
          onChange={handleChange}
          disabled={!freqReady}
        />
        <button disabled={isBusy || !freqReady} onClick={getInfo}>
          {isBusy ? 'Working…' : 'Submit'}
        </button>
      </div>

      <div className="outputContainer">
        <h2>What do they see?</h2>
        <div className="outputText">
          {parse(output)}
        </div>
      </div>
    </div>
  );
}

export default App;
