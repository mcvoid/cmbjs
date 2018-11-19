import {
  eof,
  empty,
  token,
  literal,
  not,
  tryRule,
  production,
  optional,
  oneOrMore,
  zeroOrMore,
  sequence,
  choice,
  orderedChoice,
} from '../src/rules';
import { peek, consume, newLexer, EOF, EMPTY } from '../src/lexer';
import { Token, Match, Reject, NamedProduction, ArrayProduction } from '../src/types';

const mockRule = {
  PASS: (l, v) => () => new Match(l, v),
  FAIL: (l, v) => () => new Reject(l, v),
  TIMES: (list) => () => {
    const [first, ...rest] = list;
    list = rest;
    return first();
  },
};

describe('parselets', () => {
  it('should recognize EOF', () => {
    const parselet = eof();

    let lexer = newLexer('', []);
    expect(parselet({}, lexer)).toEqual(new Match(lexer, new Token('', 0, 0, EOF)));

    lexer = newLexer('a', []);
    expect(parselet({}, lexer)).toEqual(new Reject(lexer, `Could not match EOF at 0`));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({}, lexer)).toEqual(new Match(lexer, new Token('a', 1, 1, EOF)));
  });

  it('should recognize empty', () => {
    const parselet = empty();

    let lexer = newLexer('', []);
    expect(parselet({}, lexer)).toEqual(new Match(lexer, new Token('', 0, 0, EMPTY)));

    lexer = newLexer('a', []);
    expect(parselet({}, lexer)).toEqual(new Match(lexer, new Token('a', 0, 0, EMPTY)));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({}, lexer)).toEqual(new Match(lexer, new Token('a', 1, 1, EMPTY)));
  });

  it('should recognize a token', () => {
    const parselet = token('a');

    let lexer = newLexer('', []);
    expect(parselet({ lexRules: { a: 'a', b: 'b' } }, lexer)).toEqual(new Reject(lexer, `Could not match token ${'a'}: found ${EOF}(${''}) at ${0}`));

    lexer = newLexer('baa', []);
    expect(parselet({ lexRules: { a: 'a', b: 'b' } }, lexer)).toEqual(new Reject(
      lexer,
      `Could not match token ${'a'}: found ${EMPTY}(${''}) at ${0}`,
    ));

    lexer = consume(lexer, { b: 'b' });
    expect(parselet({ lexRules: { a: 'a', b: 'b' } }, lexer)).toEqual(new Match(consume(lexer, { a: 'a' }), peek(lexer, { a: 'a' })));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({ lexRules: { a: 'a', b: 'b' } }, lexer)).toEqual(new Match(consume(lexer, { a: 'a' }), peek(lexer, { a: 'a' })));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({ lexRules: { a: 'a', b: 'b' } }, lexer)).toEqual(new Reject(lexer, `Could not match token ${'a'}: found ${EOF}(${''}) at ${3}`));
  });

  it('should recognize a literal', () => {
    const parselet = literal('a');

    let lexer = newLexer('', []);
    expect(parselet({}, lexer)).toEqual(new Reject(lexer, `Could not match token ${'a'}: found ${EOF}(${''}) at ${0}`));

    lexer = newLexer('baa', []);
    expect(parselet({}, lexer)).toEqual(new Reject(
      lexer,
      `Could not match token ${'a'}: found ${EMPTY}(${''}) at ${0}`,
    ));

    lexer = consume(lexer, { b: 'b' });
    expect(parselet({}, lexer)).toEqual(new Match(consume(lexer, { a: 'a' }), peek(lexer, { a: 'a' })));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({}, lexer)).toEqual(new Match(consume(lexer, { a: 'a' }), peek(lexer, { a: 'a' })));

    lexer = consume(lexer, { a: 'a' });
    expect(parselet({}, lexer)).toEqual(new Reject(lexer, `Could not match token ${'a'}: found ${EOF}(${''}) at ${3}`));
  });

  it('should recognize a production rule', () => {
    let parselet = production('c');
    const lexer = newLexer('aaa', []);
    let env = {
      productions: {
        a: mockRule.PASS(consume(lexer, { a: 'a' }), peek(lexer, { a: 'a' })),
        b: mockRule.PASS(lexer, new Token(lexer.input, 0, 0, EMPTY)),
      },
    };

    expect(parselet(env, lexer)).toEqual(new Reject(lexer, `Production rule "${'c'}" does not exist`));

    parselet = production('a');
    expect(parselet(env, lexer)).toEqual(new Match(
      consume(lexer, { a: 'a' }),
      new NamedProduction('a', peek(lexer, { a: 'a' })),
    ));

    parselet = production('b');
    expect(parselet(env, lexer)).toEqual(new Match(
      lexer,
      new NamedProduction('b', new Token(lexer.input, 0, 0, EMPTY)),
    ));

    env = { productions: { a: mockRule.FAIL(lexer, `Could not match token ${'a'}: found ${'b'}(${'b'}) at ${0}`) } };
    parselet = production('a');
    expect(parselet(env, lexer)).toEqual(new Reject(lexer, `Could not match token ${'a'}: found ${'b'}(${'b'}) at ${0}`));
  });

  it('should recognize a tried rule', () => {
    let lexer = newLexer('abba', []);
    let parselet = tryRule(mockRule.PASS(consume(lexer, { a: 'a' }), { a: 1 }));
    expect(parselet({}, lexer)).toEqual(new Match(lexer, { a: 1 }));

    parselet = tryRule(mockRule.FAIL(consume(lexer, { a: 'a' }), 'error'));
    expect(parselet({}, lexer)).toEqual(new Reject(lexer, 'Lookahead failed'));
  });

  it('should recognize a negative rule', () => {
    let l = newLexer('aabb', []);
    let parselet = not(mockRule.FAIL(l, 'aaaa'));
    expect(parselet({}, l)).toEqual(new Match(l, new Token(l.input, 0, 0, EMPTY)));

    parselet = not(mockRule.PASS(consume(l, { a: 'a' }), { a: 1 }));
    expect(parselet({}, l)).toEqual(new Reject(l, 'Not expecting to match rule'));
  });

  it('should recognize an optional rule', () => {
    let l = newLexer('aabb', []);
    let parselet = optional(mockRule.PASS(consume(l, { a: 'a' }), 'aaaa'));
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), 'aaaa'));

    parselet = optional(mockRule.FAIL(l, 'aaaa'));
    expect(parselet({}, l)).toEqual(new Match(l, new Token(l.input, 0, 0, EMPTY)));
  });

  it('should recognize one or more rules', () => {
    let l = newLexer('aabb', []);
    let parselet = oneOrMore(mockRule.FAIL(l, 'abc'));
    expect(parselet({}, l)).toEqual(new Reject(l, 'abc'));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), new ArrayProduction(['abc'])));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), 'bcd'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(consume(l, { a: 'a' }), { a: 'a' }), new ArrayProduction(['abc', 'bcd'])));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), 'bcd'),
      mockRule.PASS(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), 'cde'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), new ArrayProduction(['abc', 'bcd', 'cde'])));
  });

  it('should recognize zero or more rules', () => {
    let l = newLexer('aabb', []);
    let parselet = zeroOrMore(mockRule.FAIL(l, 'abc'));
    expect(parselet({}, l)).toEqual(new Match(l, new ArrayProduction([])));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), new ArrayProduction(['abc'])));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), 'bcd'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(consume(l, { a: 'a' }), { a: 'a' }), new ArrayProduction(['abc', 'bcd'])));

    parselet = oneOrMore(mockRule.TIMES([
      mockRule.PASS(consume(l, { a: 'a' }), 'abc'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), 'bcd'),
      mockRule.PASS(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), 'cde'),
      mockRule.FAIL(l, 'abc'),
    ]));
    expect(parselet({}, l)).toEqual(new Match(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), new ArrayProduction(['abc', 'bcd', 'cde'])));
  });

  it('should recognize a sequence of rules', () => {
    let l = newLexer('aabb', []);

    expect(() => sequence()).toThrow();
    expect(() => sequence(mockRule.PASS(l, 'a'))).toThrow();

    let parselet = sequence(
      mockRule.PASS(consume(l, { a: 'a' }), '1'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), '2'),
      mockRule.PASS(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), '3'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), new ArrayProduction(['1', '2', '3'])));

    parselet = sequence(
      mockRule.PASS(consume(l, { a: 'a' }), '1'),
      mockRule.PASS(consume(consume(l, { a: 'a' }), { a: 'a' }), '2'),
      mockRule.FAIL(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), '3'),
    );
    expect(parselet({}, l)).toEqual(new Reject(consume(consume(consume(l, { a: 'a' }), { a: 'a' }), { b: 'b' }), '3'));
  });

  it('should recognize alternate rules', () => {
    let l = newLexer('aabb', []);

    expect(() => choice()).toThrow();
    expect(() => choice(mockRule.PASS(l, 'a'))).toThrow();

    let parselet = choice(
      mockRule.FAIL(l, '1'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
      mockRule.FAIL(l, '3'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = choice(
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = choice(
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = choice(
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
      mockRule.FAIL(l, '2'),
    );
    expect(parselet({}, l)).toEqual(new Reject(l, 'No matched rules at location'));

    parselet = choice(
      mockRule.FAIL(l, '1'),
      mockRule.PASS(consume(l, { a: 'a' }), '3'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
    );
    expect(parselet({}, l)).toEqual(new Reject(l, `Ambiguous match: ${JSON.stringify([
      new Match(consume(l, { a: 'a' }), '3'),
      new Match(consume(l, { a: 'a' }), '2'),
    ])}`));
  });

  it('should recognize ordered choice rules', () => {
    let l = newLexer('aabb', []);

    expect(() => orderedChoice()).toThrow();
    expect(() => orderedChoice(mockRule.PASS(l, 'a'))).toThrow();

    let parselet = orderedChoice(
      mockRule.FAIL(l, '1'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
      mockRule.FAIL(l, '3'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = orderedChoice(
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = orderedChoice(
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '2'));

    parselet = orderedChoice(
      mockRule.FAIL(l, '1'),
      mockRule.FAIL(l, '3'),
      mockRule.FAIL(l, '2'),
    );
    expect(parselet({}, l)).toEqual(new Reject(l, 'No matched rules at location'));

    parselet = orderedChoice(
      mockRule.FAIL(l, '1'),
      mockRule.PASS(consume(l, { a: 'a' }), '3'),
      mockRule.PASS(consume(l, { a: 'a' }), '2'),
    );
    expect(parselet({}, l)).toEqual(new Match(consume(l, { a: 'a' }), '3'));
  });
});