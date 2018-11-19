// @flow

export type LexRule = RegExp | string;
export type Lexer = { pos: number, input: string, ignore: ?Array<LexRule> };
export type Parselet = (Environment, Lexer) => Result;
export type Environment = {
  productions: { [string]: Parselet },
  lexRules: { [string]: LexRule },
};
export type Production = Token | ArrayProduction | NamedProduction;
export type Result = Match | Reject;
export type ProductionRules = { [string]: Parselet };

export type TextSpec = {
  text: string,
  ignore?: Array<LexRule>,
};
export type CombinatorSpec = {
  lexerRules?: { [string]: LexRule },
  productionRules: ProductionRules,
  ignore?: Array<LexRule>,
};
export type ParserGenerator = { [string]: ParserGenerator }
  | CombinatorSpec => Parser
  | TextSpec => Parser;
export type Parser = { [string]: (string) => Production };
export type Cache = { [string]: { [number]: Result } };
export type Memoizer = (string, Parselet, Cache) => Parselet;

export class Token {
  input: string;
  start: number;
  end: number;
  val: string;
  type: string;
  constructor(str: string, start: number, end: number, type: string) {
    this.input = str;
    this.start = start;
    this.end = end;
    this.val = str.slice(start, end),
    this.type = type;
  }
}

export class NamedProduction {
  name: string;
  val: Production;
  constructor(name: string, val: Production) {
    this.name = name;
    this.val = val;
  }
}

export class ArrayProduction {
  val: Array<Production>;
  constructor(val: Array<Production>) {
    this.val = val;
  }
}

export class Match {
  lexer: Lexer;
  node: Production;
  constructor(lexer: Lexer, node: Production) {
    this.lexer = lexer;
    this.node = node;
  }
}

export class Reject {
  lexer: Lexer;
  err: string;
  constructor(lexer: Lexer, err: string) {
    this.lexer = lexer;
    this.err = err;
  }
}