import { ToolInputError, type ToolResult } from "../result";
import { randomInt } from "./random";

/** The traditional Cicero-derived word list. */
const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui",
  "officia", "deserunt", "mollit", "anim", "id", "est", "laborum", "perspiciatis",
  "unde", "omnis", "iste", "natus", "error", "voluptatem", "accusantium",
  "doloremque", "laudantium", "totam", "rem", "aperiam", "eaque", "ipsa", "quae",
  "ab", "illo", "inventore", "veritatis", "quasi", "architecto", "beatae", "vitae",
];

export const LOREM_UNITS = ["paragraphs", "sentences", "words"] as const;
export type LoremUnit = (typeof LOREM_UNITS)[number];

export type LoremOptions = {
  unit: LoremUnit;
  count: number;
  /** Begin with the traditional "Lorem ipsum dolor sit amet". */
  classic: boolean;
};

export const LOREM_DEFAULTS: LoremOptions = {
  unit: "paragraphs",
  count: 3,
  classic: true,
};

const OPENING = "lorem ipsum dolor sit amet consectetur adipiscing elit".split(" ");

function sentence(): string {
  const length = 8 + randomInt(9);
  const words = Array.from({ length }, () => WORDS[randomInt(WORDS.length)]);
  const text = words.join(" ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function paragraph(): string {
  const count = 3 + randomInt(4);
  return Array.from({ length: count }, sentence).join(" ");
}

export function generateLorem(options: LoremOptions): ToolResult {
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new ToolInputError("count must be a whole number of at least 1");
  }

  const limits: Record<LoremUnit, number> = { paragraphs: 50, sentences: 200, words: 2000 };
  if (options.count > limits[options.unit]) {
    throw new ToolInputError(`count must be ${limits[options.unit]} or fewer ${options.unit}`);
  }

  if (options.unit === "words") {
    const words = Array.from({ length: options.count }, (_, index) =>
      options.classic && index < OPENING.length ? OPENING[index] : WORDS[randomInt(WORDS.length)],
    );
    const text = words.join(" ");
    return { kind: "text", text: `${text.charAt(0).toUpperCase()}${text.slice(1)}.` };
  }

  const pieces = Array.from(
    { length: options.count },
    options.unit === "sentences" ? sentence : paragraph,
  );

  if (options.classic) {
    // Replace the opening words of the first piece, keeping the rest random.
    const opening = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    pieces[0] = options.unit === "sentences" ? opening : `${opening} ${pieces[0]}`;
  }

  return {
    kind: "text",
    text: pieces.join(options.unit === "sentences" ? " " : "\n\n"),
  };
}
