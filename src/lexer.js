// @flow
import type {
  LexRule,
  Lexer,
} from './types';

import { Token } from './types';

export const EOF: string = '!CMB_EOF';
export const EMPTY: string = '!CMB_EMPTY';

// Lexer functions
export const newLexer = (str: string, ignore: ?Array<LexRule>): Lexer => ({ pos: 0, input: str, ignore });
export const peek = (lexer: Lexer, rule: { [string]: LexRule }, caseInsensitive?: boolean): Token => lex(lexer, rule, caseInsensitive)[0];
export const consume = (lexer: Lexer, rule: { [string]: LexRule }, caseInsensitive?: boolean): Lexer => lex(lexer, rule, caseInsensitive)[1];
export const isEmpty = (tok: Token): boolean => tok.type === EMPTY;
export const isEOF = (tok: Token): boolean => tok.type === EOF;

// Tokenize a string and return a lexer
export const lex = ({ pos, input, ignore }: Lexer, rule: { [string]: LexRule }, caseInsensitive?: boolean): [Token, Lexer] => {
  const key = Object.keys(rule)[0];
  const thisRule = rule[key];
  let thisPos = pos;

  while (thisPos < input.length) {
    const str = input.slice(thisPos);

    if (ignore) {
      // search for an ignorable prefix
      let ignoreLength = 0;
      for (let i = 0; i < ignore.length; i++) {
        const rule = ignore[i];
        if (!rule) {
          continue;
        }
        if (typeof rule === 'string') {
          if (str.startsWith(rule)){
            ignoreLength = rule.length;
            break;
          }
        } else {
          const r = rule.exec(str);
          if (r && r.index === 0) {
            ignoreLength = r[0].length;
            break;
          }
        }
      }
      if (ignoreLength) {
        thisPos += ignoreLength;
        continue;
      }
    }

    if (typeof thisRule === 'string') {
      const comp1 = caseInsensitive ? str.toUpperCase(): str;
      const comp2 = caseInsensitive ? thisRule.toUpperCase(): thisRule;
      if (comp1.startsWith(comp2)){
        return [
          new Token(input, thisPos, thisPos + thisRule.length, key),
          { pos: thisPos + thisRule.length, input, ignore },
        ];
      }
    } else if (thisRule instanceof RegExp) {
      const r = thisRule.exec(str);
      if (r && r.index === 0) {
        return [
          new Token(input, thisPos, thisPos + r[0].length, key),
          { pos: thisPos + r[0].length, input, ignore },
        ];
      }
    }
    // No match - return empty
    return [
      new Token(input, thisPos, thisPos, EMPTY),
      { pos: thisPos, input, ignore },
    ];

  }
  // Hit the end of the string before finding a match.
  return [
    new Token(input, input.length, input.length, EOF),
    { pos: input.length, input, ignore },
  ];
};