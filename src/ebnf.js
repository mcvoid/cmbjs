// @flow

// extended BNF

import type { Parser, TextSpec, Parselet, ProductionRules, Production  } from './types';

import { NamedProduction, ArrayProduction, Token } from './types';
import { sequence, oneOrMore, production, token, choice, orderedChoice, literal, zeroOrMore, optional } from './rules';
import { combinator } from './combinator';

export const ebnfParser = combinator({
  lexerRules: {
      symbol: /[\[\]\{\}\(\)\<\>\'\"\=\|\.\,\;]/,
  },
  productionRules: {
      character: choice(token('letter'), token('digit'), token('symbol'), '_'),
      terminal: orderedChoice(
          sequence("'", oneOrMore(production('character')), "'"),
          sequence('"', oneOrMore(production('character')), '"'),
      ),
      lhs: token('identifier'),
      rightHandRule: orderedChoice(
          token('identifier'),
          production('terminal'),
          sequence('[', production('rhs'), ']'),
          sequence('{', production('rhs'), '}'),
          sequence('(', production('rhs'), ')'),
      ),
      rhs: orderedChoice(
          sequence(production('rightHandRule'), '|', production('rhs')),
          sequence(production('rightHandRule'), ',', production('rhs')),
          production('rightHandRule'),
      ),
      rule: sequence(
          production('lhs'),
          '=',
          production('rhs'),
          ';',
      ),
      grammar: zeroOrMore(production('rule')),
  },
  ignore: [/[\s\t]+/],
});

export const ebnfVisitor = {
  character: (node: NamedProduction): string => {
    const child = node.val;
    if (child instanceof Token) {
      return child.val;
    }
    throw `Invalid production: terminal ${JSON.stringify(node)}`;
  },
  terminal: (node: NamedProduction): string => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const charlist = child.val[1];
      if (charlist instanceof ArrayProduction) {
        return charlist.val.map(c => {
          if (c instanceof NamedProduction) {
            return ebnfVisitor.character(c);
          }
          throw 'invalid production';
        }).join('');
      }
    }
    throw `Invalid production: terminal ${JSON.stringify(node)}`;
  },
  rightHandRule: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const first = child.val[1];
      const op = child.val[0];
      if (op instanceof Token && first instanceof NamedProduction) {
        const func = {
          '[': optional,
          '{': zeroOrMore,
          '(': n => n,
        }[op.type] || (n => { throw `invalid grouping: ${op.val}`});
        return func(ebnfVisitor.rhs(first));
      }
    }
    if (child instanceof NamedProduction) {
      return literal(ebnfVisitor.terminal(child));
    }
    if (child instanceof Token) {
      return production(child.val);
    }
    throw `Invalid production: rightHandRule ${JSON.stringify(node)}`;
  },
  rhs: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const first = child.val[0];
      const rest = child.val[2];
      const op = child.val[1];
      if (op instanceof Token) {
        if (first instanceof NamedProduction && rest instanceof NamedProduction) {
          const func = {
            '|': choice,
            ',': sequence,
          }[op.type] || (n => { throw `invalid rhs separator: ${op.val}`});
          return func(
            ebnfVisitor.rightHandRule(first),
            ...ebnfVisitor.rhs(rest),
          );
        }
      }
    }
    if (child instanceof NamedProduction) {
      return ebnfVisitor.rightHandRule(child);
    }
    throw `Invalid production: rhs ${JSON.stringify(node)}`;
  },
  lhs: (node: NamedProduction): string => {
    const tok = node.val;
    if (tok instanceof Token) {
      return tok.val;
    }
    throw `Invalid production: lhs ${JSON.stringify(node)}`;
  },
  rule: (node: NamedProduction): ProductionRules => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const k = arr.val[0];
      const v = arr.val[2];
      if (k instanceof NamedProduction && v instanceof NamedProduction) {
        const key = ebnfVisitor.lhs(k);
        const val = ebnfVisitor.rhs(v);
        return { [key]: val };
      }
    }
    throw `Invalid production: rule ${JSON.stringify(node)}`;
  },
  grammar: (node: NamedProduction): ProductionRules => {
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      return arr.val.map(r => {
        if (r instanceof NamedProduction) {
         return ebnfVisitor.rule(r);
        }
        throw 'invalid production';
      }).reduce((o ,kv) => ({ ...o, ...kv}));
    }
    throw `Invalid production: grammar ${JSON.stringify(node)}`;
  },
};

export const ebnf: TextSpec => Parser = ({ text, ignore }) => {
  const node = ebnfParser.grammar(text);
  if (node instanceof NamedProduction) {
    const productionRules = ebnfVisitor.grammar(node);
    return combinator({ lexerRules: {}, productionRules, ignore });
  }
  throw 'invalid production';
};

export const ebnfFragment = (text: string): Parselet => {
  const node = ebnfParser.rhs(text);
  if (node instanceof NamedProduction) {
    return ebnfVisitor.rhs(node);
  }
  throw 'invalid production';
};