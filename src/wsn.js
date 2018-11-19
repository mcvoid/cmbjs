// @flow

// Wirth syntax notation

import type { Parser, TextSpec, Parselet, ProductionRules } from './types';

import { NamedProduction, ArrayProduction, Token } from './types';
import { sequence, zeroOrMore, oneOrMore, production, token, choice, orderedChoice, literal, optional } from './rules';
import { combinator } from './combinator';

export const wsnParser = combinator({
  lexerRules: {
    identifier: /[A-Za-z]+/,
  },
  productionRules: {
    syntax: zeroOrMore(production('production')),
    production: sequence(
      token('identifier'),
      '=',
      production('expression'),
      '.'
    ),
    expression: orderedChoice(
      sequence(production('term'), '|', production('expression')),
      production('term'),
    ),
    term: orderedChoice(
      sequence(production('factor'), production('term')),
      production('factor'),
    ),
    factor: orderedChoice(
      token('identifier'),
      token('jsonString'),
      sequence('[', production('expression'),']'),
      sequence('(', production('expression'),')'),
      sequence('{', production('expression'),'}'),
    ),
  },
  ignore: [/[\s\t]+/],
});

export const wsnVisitor = {
    syntax: (node: NamedProduction): ProductionRules => {
      const child = node.val;
      if (child instanceof ArrayProduction) {
        let rules: ProductionRules = {};
        child.val.forEach(r => {
          if (r instanceof NamedProduction) {
            rules = Object.assign({}, rules, wsnVisitor.production(r));
          }
          throw 'invalid production';
        });
        return rules;
      }
      throw 'invalid production';
    },
    production: (node: NamedProduction): ProductionRules => {
      const child = node.val;
      if (child instanceof ArrayProduction) {
        const key = child.val[0];
        const val = child.val[2];
        if (key instanceof Token && val instanceof NamedProduction) {
          return { [key.val]: choice(...wsnVisitor.expression(val)) };
        }
      }
      throw 'invalid production';
    },
    expression: (node: NamedProduction): Array<Parselet> => {
      const child = node.val;
      if (child instanceof NamedProduction) {
        return [sequence(...wsnVisitor.term(child))];
      }
      if (child instanceof ArrayProduction) {
        const first = child.val[0];
        const rest = child.val[1];
        if (first instanceof NamedProduction && rest instanceof NamedProduction) {
          return [sequence(...wsnVisitor.term(first)), ...wsnVisitor.expression(rest)];
        }
      }
      throw 'invalid production';
    },
    term: (node: NamedProduction): Array<Parselet> => {
      const child = node.val;
      if (child instanceof NamedProduction) {
        return [wsnVisitor.factor(child)];
      }
      if (child instanceof ArrayProduction) {
        const first = child.val[0];
        const rest = child.val[1];
        if (first instanceof NamedProduction && rest instanceof NamedProduction) {
          return [wsnVisitor.factor(first), ...wsnVisitor.term(rest)];
        }
      }
      throw 'invalid production';
    },
    factor: (node: NamedProduction): Parselet => {
      const child = node.val;
      if (child instanceof Token) {
        return child.type === 'identifier' ? production(child.val) : literal(child.val.slice(1, -1));
      }
      if (child instanceof ArrayProduction) {
        const first = child.val[1];
        const op = child.val[0];
        if (op instanceof Token && first instanceof NamedProduction) {
          const func = {
            '[': optional,
            '{': zeroOrMore,
            '(': n => n,
          }[op.type] || (n => { throw `invalid grouping: ${op.val}`});
          return func(wsnVisitor.expression(first));
        }
      }
      throw 'invalid production';
    },
};

export const wsn: TextSpec => Parser = ({ text, ignore }) => {
  const node = wsnParser.grammar(text);
  if (node instanceof NamedProduction) {
    const productionRules = wsnVisitor.syntax(node);
    return combinator({ lexerRules: {}, productionRules, ignore });
  }
  throw 'invalid production';
};

export const wsnFragment = (text: string): Parselet => {
  const node = wsnParser.expression(text);
  if (node instanceof NamedProduction) {
    return choice(...wsnVisitor.expression(node));
  }
  throw 'invalid production';
};
