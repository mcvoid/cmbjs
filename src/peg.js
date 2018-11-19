// @flow

// Parsing Expression Grammar

import type { Parser, TextSpec, Parselet, ProductionRules } from './types';

import { NamedProduction, ArrayProduction, Token } from './types';
import { sequence, oneOrMore, production, token, choice, orderedChoice, literal, eof, empty, not, tryRule } from './rules';
import { combinator } from './combinator';

export const pegParser = combinator({
  lexerRules: {},
  productionRules: {
      grammar: sequence(
          oneOrMore(production('rule')),
          eof(),
      ),
      rule: sequence(
          production('nonterminal'),
          '<-',
          production('expr'),
          ';'
      ),
      expr: orderedChoice(
          production('alt'),
          sequence('(', production('expr'), ')'),
      ),
      alt: orderedChoice(
          sequence(
              production('seq'),
              '/',
              production('alt'),
          ),
          production('seq'),
      ),
      seq: oneOrMore(production('match')),
      match: orderedChoice(
          production('and'),
          production('not'),
          production('terminal'),
          production('nonterminal')
      ),
      and: sequence('&', production('expr')),
      not: sequence('!', production('expr')),
      terminal: orderedChoice(
          production('token'),
          token('quotedString'),
          token('doubleQuotedString'),
          '<EOF>',
          '<e>'
      ),
      nonterminal: token('identifier'),
      token: sequence('<', token('identifier'), '>'),
  },
  ignore: [
      /#.*\n/,
      /[ \t\n]+/,
  ],
});

export const pegVisitor = {
  grammar: (node: NamedProduction): ProductionRules => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const rules = child.val[0];
      if (rules instanceof ArrayProduction) {
        let productionRules: ProductionRules = {};
        rules.val.forEach(r => {
          if (r instanceof NamedProduction) {
            const rule = pegVisitor.rule(r);
            productionRules = Object.assign({}, productionRules, rule);
          }
        });
        return productionRules;
      }
    }
    throw 'invalid production';
  },
  rule: (node: NamedProduction): ProductionRules => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const k = child.val[0];
      const v = child.val[2];
      if (k instanceof NamedProduction && v instanceof NamedProduction) {
        const key = pegVisitor.nonterminal(k);
        const val = pegVisitor.expr(v);
        return { [key]: val };
      }
    }
    throw 'invalid production';
  },
  expr: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction && child.val[1] instanceof NamedProduction) {
      return pegVisitor.expr(child.val[1]);
    }
    if (child instanceof NamedProduction) {
      return choice(...pegVisitor.alt(child));
    }
    throw 'invalid production';
  },
  alt: (node: NamedProduction): Array<Parselet> => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const f = child.val[0];
      const r = child.val[2];
      if (f instanceof NamedProduction && r instanceof NamedProduction) {
        const first = pegVisitor.seq(f);
        const rest = pegVisitor.alt(r);
        return [first, ...rest];
      }
    }
    if (child instanceof NamedProduction) {
      return [pegVisitor.seq(child)];
    }
    throw 'invalid production';
  },
  seq: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      return sequence(...child.val.map(m => {
        if (m instanceof NamedProduction) {
          return pegVisitor.match(m);
        }
        throw 'invalid production';
      }));
    }
    throw 'invalid production';
  },
  match: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof NamedProduction) {
      switch (child.name) {
        case 'and':         return tryRule(pegVisitor.and(child));
        case 'not':         return not(pegVisitor.not(child));
        case 'nonterminal': return production(pegVisitor.nonterminal(child));
        case 'terminal':    return pegVisitor.terminal(child);
      }
    }
    throw 'invalid production';
  },
  and: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction && child.val[1] instanceof NamedProduction) {
      return pegVisitor.expr(child.val[1]);
    }
    throw 'invalid production';
  },
  not: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof ArrayProduction && child.val[1] instanceof NamedProduction) {
      return pegVisitor.expr(child.val[1]);
    }
    throw 'invalid production';
  },
  nonterminal: (node: NamedProduction): string => {
    const child = node.val;
    if (child instanceof Token) {
      return child.val;
    }
    throw 'invalid production';
  },
  terminal: (node: NamedProduction): Parselet => {
    const child = node.val;
    if (child instanceof NamedProduction && child.val instanceof NamedProduction) {
      return token(pegVisitor.token(child.val));
    }
    if (child instanceof Token) {
      switch (child.type) {
        case '<e>':
          return empty();
        case '<EOF>':
          return eof();
        case 'quotedString':
        case 'doubleQuotedString':
          return literal(child.val.slice(1, -1));
      }
    }
    throw 'invalid production';
  },
  token: (node: NamedProduction): string => {
    const child = node.val;
    if (child instanceof ArrayProduction) {
      const tok = child.val[1];
      if (tok instanceof Token) {
        return tok.val;
      }
    }
    throw 'invalid production';
  },
};


export const peg: TextSpec => Parser = ({ text, ignore }) => {
  const node = pegParser.grammar(text);
  if (node instanceof NamedProduction) {
    const productionRules = pegVisitor.grammar(node);
    return combinator({
      lexerRules: {},
      productionRules,
      ignore
    });
  }
  throw 'invalid production';
};

export const pegFragment = (text: string): Parselet => {
  const node = pegParser.expr(text);
  if (node instanceof NamedProduction) {
    return sequence(...pegVisitor.expr(node));
  }
  throw 'invalid production';
}