const test = require("node:test");
const assert = require("node:assert/strict");

// Levenshtein typo distance
function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 0; i <= bn; ++i) matrix[i][0] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[bn][an];
}

// Jaccard similarity
function jaccardSimilarity(setA, setB) {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

// Continue watching heuristic score
function computeContinueWatchingScore(progressSeconds, totalSeconds, updatedAt, now = Date.now()) {
  const ageInHours = Math.max(0, (now - new Date(updatedAt).getTime()) / (1000 * 60 * 60));
  const recencyScore = 100 / (1 + ageInHours * 0.02);

  const ratio = totalSeconds > 0 ? progressSeconds / totalSeconds : 0;
  let engagementScore = 0;
  if (ratio >= 0.15 && ratio <= 0.85) {
    engagementScore = 30; // Active sweet-spot
  } else if (ratio > 0.85) {
    engagementScore = -20; // End credits
  } else {
    engagementScore = 10; // Starting
  }

  return recencyScore + engagementScore;
}

test("Search: Fuzzy typo tolerance handles common misspellings", () => {
  assert.equal(levenshtein("inception", "incepton"), 1); // 1 letter omitted
  assert.equal(levenshtein("stranger", "stanger"), 1);
  assert.equal(levenshtein("matrix", "matrixx"), 1);
  assert.ok(levenshtein("interstellar", "interstelar") <= 2);
});

test("Recommendations: Jaccard similarity computes genre overlap accurately", () => {
  const movieAGenres = new Set(["action", "sci-fi", "thriller"]);
  const movieBGenres = new Set(["action", "sci-fi", "adventure"]);
  const similarity = jaccardSimilarity(movieAGenres, movieBGenres);
  // Intersection = 2 (action, sci-fi), Union = 4 -> 2/4 = 0.5
  assert.equal(similarity, 0.5);

  const disjointGenres = new Set(["romance", "comedy"]);
  assert.equal(jaccardSimilarity(movieAGenres, disjointGenres), 0);
});

test("Continue Watching: Ranks engaged in-progress content higher than finished credits", () => {
  const now = Date.now();
  const yesterday = new Date(now - 24 * 3600 * 1000).toISOString();

  // Item A: 50% watched yesterday (sweet-spot)
  const scoreMidway = computeContinueWatchingScore(3600, 7200, yesterday, now);

  // Item B: 95% watched yesterday (end credits)
  const scoreCredits = computeContinueWatchingScore(6840, 7200, yesterday, now);

  assert.ok(scoreMidway > scoreCredits);
});
