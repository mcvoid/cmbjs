// @flow

// Backus-Naur form

import type { Parser, TextSpec, Parselet, ProductionRules } from './types';

import { NamedProduction, ArrayProduction, Token } from './types';
import { sequence, oneOrMore, production, token, choice, orderedChoice, literal } from './rules';
import { combinator } from './combinator';
 
export const bnfParser = combinator({
  lexerRules: {
    letter: /[A-Za-z]/,
    digit: /[0-9]/,
    text1: /("(((?=\\)\\(["\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^"\\\0-\x1F\x7F]+)*")/,
    text2: /('(((?=\\)\\(['\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^'\\\0-\x1F\x7F]+)*')/,
    'line-end': '\n',
    'rule-char': /[A-Za-z0-9\-][A-Za-z0-9\-]+/
  },
  productionRules:{
    syntax: oneOrMore(production('rule')),
    rule: sequence('<', production('ruleName'), '>', '::=', production('expression'), token('line-end')),
    expression: orderedChoice(
        sequence(production('list'), '|', production('expression')),
        production('list'),
    ),
    list: orderedChoice(
        sequence(production('term'), production('list')),
        production('term'),
    ),
    term: orderedChoice(
        sequence('<', production('ruleName'), '>'),
        production('literal'),
    ),
    literal: orderedChoice(token('text1'), token('text2')),
    ruleName: orderedChoice(token('rule-char'), token('letter')),
  },
  ignore: [ /[\s\t]+/ ],
});

export const bnfVisitor = {
  syntax: (node: NamedProduction): ProductionRules => {
    // parse node: { name: syntax, val: ArrayProduction }
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      return arr.val.map(o => {
        if (o instanceof NamedProduction) {
          return bnfVisitor.rule(o);
        }
        throw 'bad production';
      }).reduce((o, kv) => ({ ...o, ...kv }), {});
    }
    throw `Bad production: syntax ${JSON.stringify(node)}`;
  },
  rule: (node: NamedProduction): ProductionRules => {
    // parse node: { name: rule, val: ArrayProduction{ <, rulename, >, ::=, expression, \n } }
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const key = arr.val[1];
      const val = arr.val[4];
      if (key instanceof NamedProduction && val instanceof NamedProduction) {
        const k = bnfVisitor.ruleName(key);
        const v = bnfVisitor.expression(val);
        return { [k]: choice(...v) };
      }
    }
    throw `Bad production: rule ${JSON.stringify(node)}`;
  },
  expression: (node: NamedProduction): Array<Parselet> => {
    // parse node: { name: expression, val: ArrayProduction{list, |, expression} }
    // parse node: { name: expression, val: NamedProduction{list} }
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const f = arr.val[0];
      const r = arr.val[2];
      if (f instanceof NamedProduction && r instanceof NamedProduction) {
        const first = bnfVisitor.list(f);
        const rest = bnfVisitor.expression(r);
        return [sequence(...first), ...rest];
      }
    }
    if (arr instanceof NamedProduction) {
      const list = bnfVisitor.list(arr);
      return [sequence(...list)];
    }
    throw `Bad production: expression ${JSON.stringify(node)}`;
  },
  list: (node: NamedProduction): Array<Parselet> => {
    // parse node: { name: list, val: ArrayProduction{term, list} }
    // parse node: { name: list, val: NamedProduction{term} }
    const arr = node.val;
    if (arr instanceof ArrayProduction) {
      const f = arr.val[0];
      const r = arr.val[1];
      if (f instanceof NamedProduction && r instanceof NamedProduction) {
        const first = bnfVisitor.term(f);
        const rest = bnfVisitor.list(r);
        return [first, ...rest];
      }
    }
    if (arr instanceof NamedProduction) {
      return [bnfVisitor.term(arr)];
    }
    throw `Bad production: list ${JSON.stringify(node)}`;
  },
  term: (node: NamedProduction): Parselet => {
    // parse node: { name: term, val: ArrayProduction{<, rulename, >} }
    // parse node: { name: term, val: NamedProduction{literal} }
    const arr = node.val;
    if (arr instanceof ArrayProduction && arr.val[1] instanceof NamedProduction) {
      const str = bnfVisitor.ruleName(arr.val[1]);
      return production(str);
    }
    if (arr instanceof NamedProduction && arr.val instanceof NamedProduction) {
      const str = bnfVisitor.literal(arr.val);
      return literal(str);
    }
    throw `Bad production: term ${JSON.stringify(node)}`;
  },
  literal: (node: NamedProduction): string => {
    // parse node: { name: literal, val: { type: 'textN', val: "str" } }
    const tok = node.val;
    if (tok instanceof Token) {
      return tok.val.slice(1, -1);
    }
    throw `Bad production: literal ${JSON.stringify(node)}`
  },
  ruleName: (node: NamedProduction): string => {
    // parse node: { name: ruleName, val: { type: 'textN', val: "str" } }
    const tok = node.val;
    if (tok instanceof Token) {
      return tok.val;
    }
    throw `Bad production: rulename ${JSON.stringify(node)}`
  },
};

export const bnf: TextSpec => Parser = ({ text, ignore }) => {
  const node = bnfParser.ruleList(text);
  if (node instanceof NamedProduction) {
    const productionRules = bnfVisitor.syntax(node);
    return combinator({
      lexerRules: {},
      productionRules,
      ignore
    });
  }
  throw 'invalid production';
};

export const bnfFragment = (text: string): Parselet => {
  const node = bnfParser.expression(text);
  if (node instanceof NamedProduction) {
    return sequence(...bnfVisitor.expression(node));
  }
  throw 'invalid production';
}