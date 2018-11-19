// @flow

import type {
  Lexer,
  Environment,
  Result,
  Memoizer,
  CombinatorSpec,
  Parser,
  Cache,
} from './types';
import { Reject } from './types';

import { newLexer } from './lexer';
import { token } from './rules';

// Types
// helper functions
const objectMap = <T, U>(obj: { [string]: T }, fn: string => U): { [string]: U } => Object.keys(obj)
  .map(k => ({ [k]: fn(k) }))
  .reduce((obj, kv) => ({ ...obj, ...kv}));
const memoize: Memoizer = (name, rule, cache) => (env, lexer) => {
  const key = lexer.pos;
  const val: Result = cache[name][lexer.pos];
  if (val !== undefined) {
    return val;
  }
  cache[name][lexer.pos] = rule(env, lexer);
  return cache[name][lexer.pos];
};

export const standardTokens = {
  letter: /[A-Z-a-z]/,
  digit: /[0-9]/,
  hexDigit: /[0-9A-Fa-f]/,
  identifier: /[A-Za-z_][A-Za-z0-9_]*/,
  jsonString: /("(((?=\\)\\(["\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^"\\\0-\x1F\x7F]+)*")/,
  jsonStringSingleQuote: /('(((?=\\)\\(['\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^'\\\0-\x1F\x7F]+)*')/,
  jsonNumber: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  integer: /[1-9][0-9]*/,
  bit: /[01]/,
  cr: '\r',
  lf: '\n',
  crlf: '\r\n',
  quote: "'",
  doubleQuote: '"',
  sp: ' ',
  tab: '\t',
  cComment: /\/\*[.\r\n]*?\*\//,
  cppComment: /\/\/.*\n/,
  shComment: /#.*\n/,
};

export const combinator: CombinatorSpec => Parser  = ({ lexerRules = {}, productionRules = {}, ignore = [] }) => {
  // return a parser for every production rule
  // so productionRules { expr: ..., sum: ... } produces
  // parser.expr(), parser.sum()
  return objectMap(productionRules, name => input => {

    // new cache each parse (frees old caches)
    const cache: Cache = objectMap(productionRules, () => ({}));

    // combine lexer and production rules into one symbol table.
    const env: Environment = {
      // memoize production rules
      productions: objectMap(productionRules, k => memoize(k, productionRules[k], cache)),
      // no need to memoize terminals (max 1 peek)
      lexRules: { ...standardTokens, ...lexerRules },
    };
    
    const lexer = newLexer(input, ignore);

    // parse!
    const result = env.productions[name](env, lexer);

    // Check for valid parse
    if (result instanceof Reject) { throw JSON.stringify(result); }

    return result.node;
  });
};
