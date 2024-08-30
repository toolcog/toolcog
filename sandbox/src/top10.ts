import { defineFunction } from "@toolcog/core";

/**
 * Make a David Letterman style top-10 list about the given subject.
 *
 * @param subject - The subject of the top-10 list.
 * @returns The top-10 list.
 */
const makeList = defineFunction<(subject: string) => string[]>();

/**
 * Give feedback on the given David Letterman style top-10 list.
 * Evaluate each item for wit, novelty, and brevity. Give critical
 * feedback, not just faint praise.
 *
 * @param list - The top-10 list to review.
 * @returns Feedback about ways to improve the top-10 list.
 */
const reviewList = defineFunction<(list: string[]) => string>();

/**
 * Improve the given David Letterman style top-10 list by incorporating
 * the provided feedback. Produce an updated top-10 list with the feedback.
 * Do not include any feedback in the new list.
 *
 * @param list - The top-10 list to improve.
 * @param feedback - The feedback to incorporate into the top-10 list.
 * @returns An improved top-10 list.
 */
const improveList =
  defineFunction<(list: string[], feedback: string) => string[]>();

/**
 * Score how well an improved David Letterman style top-10 list incorporated
 * feedback from the original top-10 list. The score should be a number
 * between 1 and 10. Assign a score of 5 or above if the improved list
 * is indisputably funnier than the origin. Penalize new lists that
 * are not concise and quippy enough.
 *
 * @param list - The original top-10 list.
 * @param feedback - The feedback on the original top-10 list.
 * @param improvedList - The new and improved top-10 list incorporating
 * the given feedback.
 * @returns A number between 1 and 10 rating the level of improvement.
 */
const scoreImprovements =
  defineFunction<
    (originalList: string[], feedback: string, improvedList: string[]) => number
  >();

export async function top10(subject: string) {
  // Generate an initial top-10 list.
  let list = await makeList(subject);

  // Run a self-critique loop to refine the list until it's good enough.
  let score: number;
  do {
    // Critique the generated list.
    const feedback = await reviewList(list);

    // Generate an improved list, incorporating the feedback.
    const improvedList = await improveList(list, feedback);

    // Score the improved list, with reference to the original.
    score = await scoreImprovements(list, feedback, improvedList);

    // Accept the improved list,
    list = improvedList;

    // Loop while the score is unsatisfactory.
  } while (score < 8);

  return list;
}
