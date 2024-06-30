import { generate } from "toolcog";

export async function top10(subject: string) {
  // Make a David Letterman style top-10 list about the given subject.
  let list = await generate<string[]>({
    // The subject of the top-10 list.
    subject,
  });

  // Refine the top-10 list until it's good enough.
  let score: number;
  do {
    // Give feedback on the given David Letterman style top-10 list.
    // Evaluate each item for wit, novelty, and brevity. Give critical
    // feedback, not just faint praise.
    const feedback = await generate({
      // The top-10 list to review.
      list,
    });

    // Improve the given David Letterman style top-10 list by incorporating
    // the provided feedback. Produce an updated top-10 list with the feedback.
    // Do not include any feedback in the new list.
    const improvedList = await generate<string[]>({
      // The top-10 list to improve.
      list,
      // The feedback to incorporate into the top-10 list.
      feedback,
    });

    // Score how well an improved David Letterman style top-10 list incorporated
    // feedback from an original top-10 list. The score should be a number
    // between 1 and 10. Assign a score of 5 or above if the improved list
    // is indisputably funnier than the origin. Penalize new lists that
    // are not concise and quippy enough.
    score = await generate({
      // The original top-10 list.
      list,
      // The feedback on the original top-10 list.
      feedback,
      // The new and improved top-10 list, incorporating the given feedback.
      improvedList,
    });

    list = improvedList;
  } while (score < 8);

  return list;
}

console.log(await top10("Llamas"));
