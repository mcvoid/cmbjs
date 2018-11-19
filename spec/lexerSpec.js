import { lex, newLexer, EOF, EMPTY } from '../src/lexer';
import { Token } from '../src/types';

describe('lex', () => {
  it('ignores whitespace', () => {
    const l = newLexer('   \t\n', [/[\s\t\n]+/]);
    const [token, lexer] = lex(l, { '': '' });

    expect(token.type).toEqual(EOF);
    expect(lexer.pos).toEqual(5);
  });

  it('can read a basic token from a regex', () => {
    const str = 'aaa';
    let [token, lexer] = lex(newLexer(str, []), { a: /a/ });
    expect(token).toEqual(new Token(str, 0, 1, 'a'));
    expect(lexer.pos).toEqual(1);

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 1, 2, 'a'));
    expect(lexer.pos).toEqual(2);

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 2, 3, 'a'));
    expect(lexer.pos).toEqual(3);

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 3, 3, EOF));
    expect(lexer.pos).toEqual(3);
  });

  it('can read a basic multi-char token from a regex', () => {
    const str = 'aaaaaa';
    let [token, lexer] = lex(newLexer(str, []), { a: /aaa/ });
    expect(token).toEqual(new Token(str, 0, 3, 'a'));
    expect(lexer.pos).toEqual(3);

    [token, lexer] = lex(lexer, { a: /aaa/ });
    expect(token).toEqual(new Token(str, 3, 6, 'a'));
    expect(lexer.pos).toEqual(6);

    [token, lexer] = lex(lexer, { a: /aaa/ });
    expect(token).toEqual(new Token(str, 6, 6, EOF));
    expect(lexer.pos).toEqual(6);
  });

  it('can read tokens interspersed with whitespace', () => {
    const str = '  aa    \na';
    let [token, lexer] = lex(newLexer(str, [/[\s\t\n]+/]), { a: /a/ });
    expect(token).toEqual(new Token(str, 2, 3, 'a'));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 3, 4, 'a'));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 9, 10, 'a'));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 10, 10, EOF));
  });

  it('can read multiple token types', () => {
    const str = 'abcba';
    let [token, lexer] = lex(newLexer(str, []), { a: /a/ });
    expect(token).toEqual(new Token(str, 0, 1, 'a'));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 1, 1, EMPTY));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 1, 2, 'b'));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 2, 2, EMPTY));

    [token, lexer] = lex(lexer, { c: /c/ });
    expect(token).toEqual(new Token(str, 2, 3, 'c'));

    [token, lexer] = lex(lexer, { c: /c/ });
    expect(token).toEqual(new Token(str, 3, 3, EMPTY));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 3, 4, 'b'));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 4, 4, EMPTY));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 4, 5, 'a'));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 5, 5, EOF));
  });

  it('can read multiple ignore types', () => {
    const str = `a  b//
c    b /* abcabc */  a    `;

    let [token, lexer] = lex(newLexer(str, [
      /\s/,
      /\/\/.*\n/,
      /\/\*.*\*\//,
    ]), { a: /a/ });
    expect(token).toEqual(new Token(str, 0, 1, 'a'));

    [token] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 3, 3, EMPTY));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 3, 4, 'b'));

    [token] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 7, 7, EMPTY));

    [token, lexer] = lex(lexer, { c: /c/ });
    expect(token).toEqual(new Token(str, 7, 8, 'c'));

    [token] = lex(lexer, { c: /c/ });
    expect(token).toEqual(new Token(str, 12, 12, EMPTY));

    [token, lexer] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 12, 13, 'b'));

    [token] = lex(lexer, { b: /b/ });
    expect(token).toEqual(new Token(str, 28, 28, EMPTY));

    [token, lexer] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 28, 29, 'a'));

    [token] = lex(lexer, { a: /a/ });
    expect(token).toEqual(new Token(str, 33, 33, EOF));
  });

  it('can recognize string literals', () => {
    const str = 'aabaab';
    let [token, lexer] = lex(newLexer(str, []), { a: 'aab' });
    expect(token).toEqual(new Token(str, 0, 3, 'a'));

    [token, lexer] = lex(lexer, { a: 'aab' });
    expect(token).toEqual(new Token(str, 3, 6, 'a'));

    [token, lexer] = lex(lexer, { a: 'aab' });
    expect(token).toEqual(new Token(str, 6, 6, EOF));
  });
});
