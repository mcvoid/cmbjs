// @flow

import type {
  Lexer,
  LexRule,
  Production,
  Result,
  Parselet,
} from './types';
import {
  Token,
  Match,
  Reject,
  NamedProduction,
  ArrayProduction,
} from './types';
import { newLexer, peek, consume, EMPTY, EOF } from './lexer';

const convertLiterals = (rule: Parselet | string): Parselet => {
  if (typeof rule === 'string') {
    return literal(rule);
  } else {
    return rule;
  }
};

export const eof = (): Parselet => (env, lexer) => {
  if (lexer.pos >= lexer.input.length) {
    return new Match(lexer, new Token(lexer.input, lexer.pos, lexer.pos, EOF));
  }
  return new Reject(lexer, `Could not match EOF at ${lexer.pos}`);
};

export const empty = (): Parselet => (env, lexer) => new Match(lexer, new Token(lexer.input, lexer.pos, lexer.pos, EMPTY));

export const token = (type: string): Parselet => {
  if (!type) {
    throw 'Invaid token type name';
  }
  return (env, lexer) => {
    const next = peek(lexer, { [type]: env.lexRules[type] });
    if (next.type == type) {
      return new Match(consume(lexer, { [type]: env.lexRules[type] }), next);
    }
    return new Reject(lexer, `Could not match token ${type}: `
      + `found ${next.type}(${next.val}) at ${next.start}`);
  };
};

export const literal = (type: string, caseInsensitive?: boolean): Parselet => {
  if (!type) {
    throw 'Invaid  token type name';
  }
  return (env, lexer) => {
    const next = peek(lexer, { [type]: type }, caseInsensitive);
    if (next.type == type) {
      return new Match(consume(lexer, { [type]: type }), next);
    }
    return new Reject(lexer, `Could not match token ${type}: `
      + `found ${next.type}(${next.val}) at ${next.start}`);
  };
};

export const regex = (type: string, pattern: RegExp): Parselet => {
  if (!type) {
    throw 'Invaid  token type name';
  }
  return (env, lexer) => {
    const next = peek(lexer, { [type]: pattern });
    if (next.type == type) {
      return new Match(consume(lexer, { [type]: pattern }), next);
    }
    return new Reject(lexer, `Could not match token ${type}: `
      + `found ${next.type}(${next.val}) at ${next.start}`);
  };
};

export const unicodePoint = (point: number): Parselet => {
  if (point < 0) {
    throw 'Invaid unicode point';
  }
  const type = `%d${point}`;
  const str = String.fromCodePoint(point);

  return (env, lexer) => {
    const next = peek(lexer, { [type]: str });
    if (next.type == type) {
      return new Match(consume(lexer, { [type]: str }), next);
    }
    return new Reject(lexer, `Could not match token ${type}: `
      + `found ${next.type}(${next.val}) at ${next.start}`);
  };
};

export const unicodeRange = (start: number, stop: number): Parselet => {
  if (start < 0 || stop < 0 || start > stop) {
    throw 'Invaid unicode range';
  }
  const type = `%d${start}-${stop}`;
  const reg = new RegExp(`[\\u{${start}}-\\u{${stop}}]`, 'u');
  return (env, lexer) => {
    const next = peek(lexer, { [type]: reg });
    if (next.type == type) {
      return new Match(consume(lexer, { [type]: reg }), next);
    }
    return new Reject(lexer, `Could not match token ${type}: `
      + `found ${next.type}(${next.val}) at ${next.start}`);
  };
};

export const not = (rule: Parselet | string): Parselet => {
  if (!rule) {
    throw 'Invaid rule';
  }
  const convertedRule = convertLiterals(rule);
  return (env, lexer) => {
    const result = convertedRule(env, lexer);
    if (result instanceof Reject) {
      return empty()(env, lexer);
    }
    return new Reject(lexer, 'Not expecting to match rule');
  };
};

export const tryRule = (rule: Parselet | string) : Parselet => {
  if (!rule) {
    throw 'Invaid rule';
  }
  const convertedRule = convertLiterals(rule);
  return (env, lexer) => {
    const result = convertedRule(env, lexer);
    if (result instanceof Reject) {
      return new Reject(lexer, 'Lookahead failed');
    }
    return new Match(lexer, result.node);
  };
};

// Matches a named production rule
export const production = (name: string): Parselet => {
  if (!name) {
    throw 'Invaid name'
  }
  return (env, lexer) => {
    const rule = env.productions[name];
    if (!rule) {
      return new Reject(lexer, `Production rule "${name}" does not exist`);
    }
    const result = rule(env, lexer);
    if (result instanceof Reject) {
      return result;
    }
    return new Match(result.lexer, new NamedProduction(name, result.node));
  };
};

// Higher order rules
export const optional = (rule: Parselet | string): Parselet => {
  if (!rule) {
    throw 'Invaid rule'
  }
  const convertedRule = convertLiterals(rule);
  const nothing = empty();
  return (env, lexer) => {
    const result = convertedRule(env, lexer);
    if (result instanceof Reject) {
      return nothing(env, lexer);
    }
    return new Match(result.lexer, result.node);
  };
};

export const oneOrMore = (rule: Parselet | string): Parselet  => {
  if (!rule) {
    throw 'Invaid rule'
  }
  const convertedRule = convertLiterals(rule);
  return (env, lexer) => {
    const matches: Array<Production> = [];
    let lexerState: Lexer = lexer;
    let err: string = '';
    while (true) {
      const result = convertedRule(env, lexerState);
      if (result instanceof Reject) {
        err = result.err;
        break;
      }
      lexerState = result.lexer;
      matches.push(result.node);
    }
    if (!matches.length) {
      return new Reject(lexer, err);
    }
    return new Match(lexerState, new ArrayProduction(matches));
  };
};

export const repetition = (rule: Parselet | string, start?: number = 0, end?: number = Infinity): Parselet  => {
  if (!rule) {
    throw 'Invaid rule'
  }
  const convertedRule = convertLiterals(rule);
  return (env, lexer) => {
    const matches: Array<Production> = [];
    let lexerState: Lexer = lexer;
    let err: string = '';
    for (let i = 0; end < 0 || i < end; i++) {
      const result = convertedRule(env, lexerState);
      if (result instanceof Reject) {
        err = result.err;
        break;
      }
      lexerState = result.lexer;
      matches.push(result.node);
    }
    if (matches.length < start) {
      return new Reject(lexer, err);
    }
    return new Match(lexerState, new ArrayProduction(matches));
  };
};

export const zeroOrMore = (rule: Parselet | string): Parselet  => {
  if (!rule) {
    throw 'Invaid rule'
  }
  return (env, lexer) => {
    const matches: Array<Production> = [];
    let lexerState: Lexer = lexer;
    while (true) {
      const result = convertLiterals(rule)(env, lexerState);
      if (result instanceof Reject) {
        break;
      }
      lexerState = result.lexer;
      matches.push(result.node);
    }
    return new Match(lexerState, new ArrayProduction(matches));
  };
};

export const sequence = (...rules: Array<Parselet | string>): Parselet => {
  if (rules.length < 2) {
    throw 'Invalid: sequence length < 2';
  }
  return (env, lexer) => {
    const matches: Array<Production> = [];
    let lexerState = lexer;
    for (let i = 0; i < rules.length; i++) {
      const rule = convertLiterals(rules[i]);
      const result = rule(env, lexerState);
      if (result instanceof Reject) {
        return result;
      }
      lexerState = result.lexer;
      matches.push(result.node);
    }
    return new Match(lexerState, new ArrayProduction(matches));
  };
};

export const choice = (...rules: Array<Parselet | string>): Parselet => {
  if (rules.length < 2) {
    throw 'Invalid: choice length < 2';
  }
  return (env, lexer) => {
    const matches = [];
    for (let i = 0; i < rules.length; i++) {
      const rule = convertLiterals(rules[i]);
      const result = rule(env, lexer);
      if (result instanceof Reject) {
        continue;
      }
      matches.push(result);
    }
    if (!matches.length) {
      return new Reject(lexer, 'No matched rules at location');
    }
    if (matches.length > 1) {
      return new Reject(lexer, `Ambiguous match: ${JSON.stringify(matches)}`);
    }
    return matches[0];
  };
};

export const orderedChoice = (...rules: Array<Parselet | string>): Parselet => {
  if (rules.length < 2) {
    throw 'Invalid: choice length < 2';
  }
  return (env, lexer) => {
    lexer;
    for (let i = 0; i < rules.length; i++) {
      const rule = convertLiterals(rules[i]);
      const result = rule(env, lexer);
      if (result instanceof Reject) {
        continue;
      }
      return new Match(result.lexer, result.node);
    }
    return new Reject(lexer, "No matched rules at location");
  };
};
