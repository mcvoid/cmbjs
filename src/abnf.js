// @flow

// Augmented BNF
// https://tools.ietf.org/html/rfc5234


import type { LexRule, Parser, TextSpec, Parselet, ProductionRules } from './types';

import { NamedProduction, ArrayProduction, Token } from './types';
import {
  sequence,
  oneOrMore,
  production,
  token,
  choice,
  zeroOrMore,
  orderedChoice,
  optional,
  eof,
  literal,
  regex,
  empty,
  repetition,
} from './rules';
import { combinator } from './combinator';
import { isEmpty } from './lexer';

export const abnfTokens = {
  ALPHA: /[\x41-\x5A\x61-\x7A]/,
  DIGIT: /[\x30-\x39]/,
  HEXDIG: /[\x30-\x39A-Fa-f]/,
  DQUOTE: '\x22',
  SP: '\x20',
  HTAB: '\x09',
  WSP: /[\x20\x09']/,
  VCHAR: /[\x21-\x7e]/,
  CHAR: /[\x00-\x7F]/,
  OCTET: /[\x00-\xFF]/,
  CTL: /[\x00-\x1F\x7F-\x9F]/,
  CR: '\x0D',
  LF: '\x0A',
  CRLF: '\x0D\x0A',
  BIT: /[01]/,
};

export const abnfParser = combinator({
  lexerRules: abnfTokens,
  productionRules:{
    rulelist: oneOrMore(production('rule')),
    rule: sequence(
      production('rulename'), 
      orderedChoice('=/', '='), 
      production('elements'),
    ),
    rulename: regex('rulename', /[A-Za-z][A-Za-z0-9\-]*/),
    elements: production('alternation'),
    alternation: orderedChoice(
      sequence(
        production('concatenation'),
        '/',
        production('alternation'),
      ),
      production('concatenation'),
    ),
    concatenation: orderedChoice(
      sequence(
        production('repetition'),
        production('concatenation'),
      ),
      production('repetition'),
    ),
    repetition: sequence(
      production('repeat'),
      production('element'),
    ),
    repeat: orderedChoice(
      regex('digits_start_end', /[0-9]+\*[0-9]+/),
      regex('digits_start', /[0-9]+\*/),
      regex('digits_end', /\*[0-9]+/),
      regex('digits_num', /[0-9]+/),
      '*',
      empty(),
    ),
    element: choice(
      production('rulename'),
      production('group'),
      production('option'),
      regex('char-val', /"[\x20\x21\x23-\x7e]*"/),
      regex('bin-val', /b[01]+(((\.[01]+)+)|(\-[01]+))?/),
      regex('dec-val', /d[\x30-\x39]+(((\.[\x30-\x39]+)+)|(\-[\x30-\x39]+))?/),
      regex('hex-val', /x[\x30-\x39A-Fa-f]+(((\.[\x30-\x39A-Fa-f]+)+)|(\-[\x30-\x39A-Fa-f]+))?/),
      regex('prose-val', /<[\x20-\x3D\x3F-\x7E]*>/),
    ),
    group: sequence("(", production('alternation'), ")"),
    option: sequence("[", production('alternation'), "]"),
  },
  ignore: [
    / \t\n/,
    /;.*\n/,
  ],
});

const numRangeToRegex = (pattern) => {
  const base = { x: 16, d: 10, b: 2 }[pattern[0]];
  return pattern.slice(1).split('.').map(range => {
    return range.split('-').map(n => {
      return `\\x${Number.parseInt(n, base).toString(16)}`
    }).join('-');
  }).join('');
};

const merge = (a: ProductionRules, b: ProductionRules): ProductionRules => {
  const merged = Object.keys(a).map(k => ({ [k]: [a[k]] })).reduce((o, kv) => ({ ...o, ...kv}));
  Object.keys(b).forEach(k => {
    merged[k] = [...merged[k], b[k]];
  });
  return Object.keys(merged).map(k => ({ [k]: choice(...merged[k]) })).reduce((o, kv) => ({ ...o, ...kv}));
};

export const abnfVisitor = {
  rulelist: (node: NamedProduction): ProductionRules => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      let rules: ProductionRules = {};
      arr.val.forEach(r => {
        if (r instanceof NamedProduction) {
          const rule = abnfVisitor.rule(r);
          rules = merge(rules, rule);
        }
        throw 'invalid production';
      });
      return rules;
    }
    throw `Bad production: rulelist ${JSON.stringify(node)}`;
  },
  rule: (node: NamedProduction): ProductionRules => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const k = arr.val[0];
      const v = arr.val[2];
      if (k instanceof NamedProduction && v instanceof NamedProduction) {
        const key = abnfVisitor.rulename(k);
        const val = abnfVisitor.elements(v);
        return { [key]: val };
      }
    }
    throw `Bad production: rule ${JSON.stringify(node)}`;
  },
  rulename: (node: NamedProduction): string => {
    const tok = node.val;
    if (tok instanceof Token) {
      return tok.val;
    }
    throw 'invalid production';
  },
  elements: (node: NamedProduction): Parselet => {
    const el = node.val;
    if (el instanceof NamedProduction) {
      return choice(...abnfVisitor.alternation(el));
    }
    throw `Bad production: elements ${JSON.stringify(node)}`;
  },
  alternation: (node: NamedProduction): Array<Parselet> => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const f = arr.val[0];
      const r = arr.val[2];
      if (f instanceof NamedProduction && r instanceof NamedProduction) {
        const first = sequence(...abnfVisitor.concatenation(f));
        const rest = abnfVisitor.alternation(r);
        return [first, ...rest];
      }
    }
    if (arr instanceof NamedProduction) {
      return [sequence(...abnfVisitor.concatenation(arr))];
    }
    throw `Bad production: alternation ${JSON.stringify(node)}`;
  },
  concatenation: (node: NamedProduction): Array<Parselet> => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const f = arr.val[0];
      const r = arr.val[2];
      if (f instanceof NamedProduction && r instanceof NamedProduction) {
        const first = abnfVisitor.repetition(f);
        const rest = abnfVisitor.concatenation(r);
        return [first, ...rest];
      }
    }
    if (arr instanceof NamedProduction) {
      return [abnfVisitor.repetition(arr)];
    }
    throw `Bad production: concatenation ${JSON.stringify(node)}`;
  },
  repetition: (node: NamedProduction): Parselet => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const r = arr.val[0];
      const e = arr.val[1];
      if (r instanceof NamedProduction && e instanceof NamedProduction) {
        const [start, end] = abnfVisitor.repeat(r);
        const el = abnfVisitor.element(e);
        if (start === undefined && end === undefined) {
          return el;
        }
        return repetition(el, start, end);
      }
    }
    throw `Bad production: repetition ${JSON.stringify(node)}`;
  },
  repeat: (node: NamedProduction): Array<number> => {
    const tok = node.val;
    if (tok instanceof Token) {
      if (isEmpty(tok)) {
        return [];
      }
      switch (tok.type) {
        case 'digits_start_end':
          return tok.val.split("*").map(x => Number.parseInt(x));
        case 'digits_end':
          return [0, Number.parseInt(tok.val.slice(1))];
        case 'digits_start':
          return [Number.parseInt(tok.val.slice(0, -1)), Infinity];
        case 'digits_num':
          const num = Number.parseInt(tok.val);
          return [num, num];
        case '*':
          return [0, Infinity];
      }
    }
    throw `Bad production: repeat ${JSON.stringify(node)}`;
  },
  element: (node: NamedProduction): Parselet => {
    const prod = node.val;
    if (prod instanceof NamedProduction) {
      switch (prod.name) {
        case 'rulename':
          return production(abnfVisitor.rulename(prod));
        case 'group':
        case 'option':
          const func = abnfVisitor[prod.name];
          return func(prod);
      }
    }
    if (prod instanceof Token) {
      switch (prod.type) {
        case 'char-val':
          return literal(prod.val.slice(0, -1));
        case 'bin-val':
        case 'dec-val':
        case 'hex-val':
          return regex(prod.type, new RegExp(numRangeToRegex(prod.val)));
        case 'prose-val':
          throw 'ABNF Prose rules cannot be supported';
      }
    }
    throw `Bad production: element ${JSON.stringify(node)}`;
  },
  group: (node: NamedProduction): Parselet => {
    const arr = node.val;
    if (arr instanceof ArrayProduction && arr.val[2] instanceof NamedProduction) {
      return choice(...abnfVisitor.alternation(arr.val[2]));
    }
    throw `Bad production: group ${JSON.stringify(node)}`;
  },
  option: (node: NamedProduction): Parselet => {
    const arr = node.val;
    if (arr instanceof ArrayProduction && arr.val[2] instanceof NamedProduction) {
      return optional(choice(...abnfVisitor.alternation(arr.val[2])));
    }
    throw `Bad production: option ${JSON.stringify(node)}`;
  },
};

export const abnf: TextSpec => Parser = ({ text, ignore }) => {
  const node = abnfParser.ruleList(text);
  if (node instanceof NamedProduction) {
    const productionRules = abnfVisitor.rulelist(node);
    return combinator({ lexerRules: {}, productionRules, ignore });
  }
  throw 'invalid production';
};

export const abnfFragment = (text: string): Parselet => {
  const node = abnfParser.elements(text);
  if (node instanceof NamedProduction) {
    return abnfVisitor.elements(node);
  }
  throw 'invalid production';
}