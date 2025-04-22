import { useState } from 'react'
import './App.css'
import ReactHtmlParser from 'react-html-parser'; 
import { createClient } from '@supabase/supabase-js';
import ThresholdSelector from './Components/ThresholdSelector.jsx';

const supabaseUrl = import.meta.env.VITE_DATABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_DATABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const customWords = ["Biden", "Trump"];

function App() {
  const [input,setInput] = useState("");
  const [output, setOutput] = useState("");
  const [threshold, setThreshold] = useState(15000);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  const getInfo = async () => {
    setIsButtonDisabled(true);

    // get array of individual words
    const words = input.replace( /\n/g, " " ).split(" ");
    let outputStr = ``;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim().toLowerCase();
      const wordLettersOnly = word.replace(/[^a-zA-Z ]/g, "");
      const { data, } = await supabase.from('word_frequencies').select().eq("word", wordLettersOnly);
      
      // if (data.length == 0) {
      //   continue;
      // }
      if (data.length == 0) {
        outputStr += `${words[i]} `;
      } else if (/^\d+$/.test(word)) {
        outputStr += `${words[i]} `;
      } else if (data[0].id > threshold && !customWords.includes(words[i])) {
        outputStr += `<p class="blur">${words[i]}</p> `;
      } else {
        outputStr += `${words[i]} `;
      }

      setOutput(outputStr);
    }
    setIsButtonDisabled(false);
  }

  let handleChange = (e) => {
    setInput(e.target.value);
  }

  let handleRadioChange = (e) => {
    setThreshold(e.target.value);
  }

  return (
    <div className="App">
      <h1>View Text through Your Students' Eyes</h1>
      <div className="info-container">
        <p className="info">What do students see when they read a high-level text? This experimental app helps users understand 
        the experience of students with varying levels of English proficiency. The app uses a database of the 100,000 most 
        common words in the English language. When you enter text below, the app will search for the frequency of
        each word and compare its rank to the selected threshold. For example, "mayhem" is the 16,673rd most 
        common word in the database, making it a very rare word. Under assumption that the average high school
        graduate has a vocabulary of 15,000 words, they are less likely to know "mayham" than words below this threshold. 
        Words below the frequency are blurred to simulate the experience of skipping over or ignoring an unknown word.</p>
        <p className="info">This app is meant to be an <strong>approximation</strong> of what various groups of students may experience,
        but its methodology is far from perfect. I hope it can act as a thought-provoking test for teachers, parents, and
        community members to help better meet students where they are at.</p>
      </div>
      <ThresholdSelector handleChange={handleRadioChange} isDisabled={isButtonDisabled}></ThresholdSelector>
      <h2>Current frequency threshold: {threshold}</h2>
      <div className="inputContainer">
        <h2>You see...</h2>
        <textarea placeholder="Enter your text here..." onChange={handleChange}></textarea>
        <button disabled={isButtonDisabled} onClick={getInfo}>Submit</button>
      </div>
      <div className="outputContainer">
        <h2>What do they see?</h2>
        <div className="outputText"> { ReactHtmlParser (output) } </div>
      </div>
    </div>
  )
}

export default App;