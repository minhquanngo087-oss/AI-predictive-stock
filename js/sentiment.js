/**
 * Sentiment Analysis Engine
 * Uses AFINN-165 lexicon with financial term extensions
 */
import AFINN from '../data/afinn.js';

// Negation words that flip sentiment
const NEGATIONS = new Set([
  'not', "don't", "doesn't", "didn't", "won't", "wouldn't", "shouldn't",
  "couldn't", "can't", "cannot", "never", "no", "nor", "neither', 'barely",
  "hardly", "scarcely", "seldom", "rarely"
]);

// Intensifiers that amplify sentiment
const INTENSIFIERS = {
  "very": 1.5, "extremely": 2.0, "incredibly": 2.0, "absolutely": 1.8,
  "highly": 1.5, "significantly": 1.5, "substantially": 1.5,
  "dramatically": 2.0, "sharply": 1.8, "massive": 1.8, "massively": 2.0,
  "huge": 1.5, "major": 1.3, "deeply": 1.5, "severely": 1.8,
  "strongly": 1.5, "remarkably": 1.5
};

/**
 * Analyze sentiment of a single text string
 * @param {string} text - Text to analyze
 * @returns {object} { score, comparative, positive, negative, tokens }
 */
export function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, comparative: 0, positive: [], negative: [], tokens: [] };
  }

  const tokens = text.toLowerCase()
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  let score = 0;
  const positive = [];
  const negative = [];
  let negated = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check for negation
    if (NEGATIONS.has(token)) {
      negated = true;
      continue;
    }

    // Check for intensifier
    let intensifier = 1;
    if (INTENSIFIERS[token]) {
      intensifier = INTENSIFIERS[token];
      continue;
    }

    // Look up AFINN score
    if (AFINN[token] !== undefined) {
      let wordScore = AFINN[token] * intensifier;
      if (negated) {
        wordScore *= -0.75; // Partial negation flip
        negated = false;
      }

      score += wordScore;

      if (wordScore > 0) positive.push({ word: token, score: wordScore });
      else if (wordScore < 0) negative.push({ word: token, score: wordScore });
    }

    // Reset negation after 3 words
    if (negated && i > 0) {
      const distFromNeg = tokens.slice(0, i).reverse().findIndex(t => NEGATIONS.has(t));
      if (distFromNeg > 2) negated = false;
    }
  }

  const comparative = tokens.length > 0 ? score / tokens.length : 0;

  return { score, comparative, positive, negative, tokens };
}

/**
 * Analyze an array of headlines and return aggregate statistics
 * @param {string[]} headlines - Array of headline strings
 * @returns {object} Aggregate sentiment statistics
 */
export function analyzeHeadlines(headlines) {
  if (!headlines || headlines.length === 0) {
    return null;
  }

  const results = headlines.map(h => ({
    text: h,
    ...analyzeSentiment(h)
  }));

  const scores = results.map(r => r.comparative);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Sort for median
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Standard deviation
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);

  // Categorize
  const positiveCount = scores.filter(s => s > 0.05).length;
  const negativeCount = scores.filter(s => s < -0.05).length;
  const neutralCount = scores.filter(s => s >= -0.05 && s <= 0.05).length;

  return {
    results,
    scores,
    mean,
    median,
    std,
    positiveCount,
    negativeCount,
    neutralCount,
    total: headlines.length
  };
}
