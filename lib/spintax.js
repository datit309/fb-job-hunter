/**
 * Spintax Parser
 * Parses nested spintax format e.g. "{Chào {bạn|fen}|Hello bro}"
 */

export function parseSpintax(template, randomFn = Math.random) {
  if (typeof template !== 'string' || !template.includes('{')) {
    return template || '';
  }

  // Regex matching innermost spintax: {something without nested { or }}
  const innerPattern = /\{([^{}]+)\}/g;

  let current = template;
  let iterations = 0;
  const maxIterations = 50; // prevent runaway loops

  while (innerPattern.test(current) && iterations < maxIterations) {
    current = current.replace(innerPattern, (_, choices) => {
      const options = choices.split('|');
      const randVal = randomFn();
      // Ensure index is within 0 .. options.length - 1
      const index = Math.min(Math.floor(randVal * options.length), options.length - 1);
      return options[index];
    });
    iterations++;
  }

  return current;
}
