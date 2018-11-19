// @flow
// Implements a simple parser generator from parser combinators.

import type { ParserGenerator } from './types';

import { combinator } from './combinator';
import { bnf, bnfFragment } from './bnf';
import { ebnf, ebnfFragment  } from './ebnf';
import { abnf, abnfFragment  } from './abnf';
import { wsn, wsnFragment  } from './wsn';
import { peg, pegFragment  } from './peg';
import {
  eof,
  empty,
  token,
  literal,
  regex,
  unicodePoint,
  unicodeRange,
  not,
  tryRule,
  production,
  optional,
  oneOrMore,
  zeroOrMore,
  repetition,
  sequence,
  choice,
  orderedChoice,
} from './rules';
import { isEmpty, isEOF } from './lexer';

export const cmb: ParserGenerator = {
  combinator,
  bnf,
  ebnf,
  abnf,
  wsn,
  peg,
};

export const combinators = {
  choice,
  empty,
  eof,
  literal,
  not,
  oneOrMore,
  optional,
  orderedChoice,
  production,
  regex,
  repetition,
  sequence,
  token,
  tryRule,
  unicodePoint,
  unicodeRange,
  zeroOrMore,
  bnfFragment,
  ebnfFragment,
  abnfFragment,
  wsnFragment,
  pegFragment,
};

export const util = {
  isEmpty,
  isEOF,
};
