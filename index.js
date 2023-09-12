/**
 * TODO: Make this script converge on a specific region of pathways where there are very low results
 * to hopefully save time in a greedy manner.
 *
 * Use a priority queue to re prioritize the pathways with lower result counts.
 *
 * Run `node index.js > log.csv` to generate a csv (separated by ~) file
 */

const axios = require("axios");
const axiosRetry = require("axios-retry");

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const QUIZ_ID = process.env.QUIZ_ID;
const BASE_URL = "http://localhost:3000";
const AC_KEY = process.env.AC_KEY;
const REQUEST_DELAY = 20;

/**
 * Generate combinations for AND type multi-select questions.
 */
function generateCombinations(arr) {
  const result = [];

  function backtrack(startIndex, currentCombination) {
    result.push(currentCombination.slice());

    for (let i = startIndex; i < arr.length; i++) {
      currentCombination.push(arr[i]);
      backtrack(i + 1, currentCombination);
      currentCombination.pop();
    }
  }

  backtrack(0, []);
  return result;
}

async function answerQuiz(url, answers, answerValues) {
  const { data } = await axios.get(url);
  if (data.next_question === null) {
    // End of path
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
    const { data } = await axios.get(
      `${BASE_URL}/v1/quizzes/${QUIZ_ID}/results?key=${AC_KEY}&a=${answers.join(
        "&a="
      )}`
    );
    console.log(
      `"${answers.join(", ")}"~"${answerValues.join(", ")}"~${
        data.response.total_num_results
      }`
    );
    return;
  }

  if (data.next_question.type === "cover") {
    await answerQuiz(
      `${url}&a=seen`,
      [...answers, "seen"],
      [...answerValues, "seen"]
    );
  }
  if (data.next_question.type === "single") {
    const options = data.next_question.options.map((option) => option.id);
    for (const optionId of options) {
      await answerQuiz(
        `${url}&a=${optionId}`,
        [...answers, `${optionId}`],
        [
          ...answerValues,
          data.next_question.options.find((option) => option.id === optionId)
            .value,
        ]
      );
    }
  }
  if (data.next_question.type === "multiple") {
    const options = data.next_question.options.map((option) => option.id);
    let combinations = [];

    combinations = options.map((option) => [option]);

    for (const combination of combinations) {
      await answerQuiz(
        `${url}&a=${combination.join(",")}`,
        [...answers, combination.join(",")],
        [
          ...answerValues,
          combination
            .map(
              (optionId) =>
                data.next_question.options.find(
                  (option) => option.id === optionId
                ).value
            )
            .join("|"),
        ]
      );
    }
  }
  if (data.next_question.type === "open") {
    await answerQuiz(`${url}&a=true`, [...answers, "true"]);
  }
}

answerQuiz(`${BASE_URL}/v1/quizzes/${QUIZ_ID}/next?key=${AC_KEY}`, [], []);
