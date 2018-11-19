# cmb.js
**A parsing library for JavaScript using parser combinators**

`cmb.js` is a set of tools which can create a function that can parse a string and
output a parse tree. It basically generates a recursive descent
parser by encapsulating the boilerplate code in a way that you can combine the
parts directly into the parsing function merely by specifying the grammar.
Memoization ensures that the parsing happens in roughly `O(n)` time.

## Installation
    npm install cmbjs
## Usage
    import { cmb, combinators } from 'cmbjs';

    const parser = cmb.combinator({
      productionRules: {
        As: oneOrMore('a'),
      },
    });
    const parseTree = parser.As('aaaaa');

    console.log(parseTree);
    
    // output: {
    //   name: As,
    //   val: {
    //     val: [
    //       { type: 'a', input: 'aaaaa', start: 0, end: 1, val: 'a' },
    //       { type: 'a', input: 'aaaaa', start: 1, end: 2, val: 'a' },
    //       { type: 'a', input: 'aaaaa', start: 2, end: 3, val: 'a' },
    //       { type: 'a', input: 'aaaaa', start: 3, end: 4, val: 'a' },
    //       { type: 'a', input: 'aaaaa', start: 4, end: 5, val: 'a' }
    //     ]
    //   }
    // }

## Concepts

cmb.js is built around the idea of parser combinators. A parser combinator is a function
which controls a single aspect of the parsing algorithm. These can be combined to form
complex parsing behaviors. This combination happens through function composition.

### Low-Level Parsers

Many of the parsing functions are self-contained and do a single simple task. This includes looking for a single string match,
to match a regex, to look for the end of the string. They resemble functions like the following:

    (Lexer, Environment) => Result

These functions are not directly handled by the user, but are instead created using constructor functions and passed into the
parser generator, which will pass the lexer and environment to them. The lexer in this library is more like a cursor to the
input string to track parsing progress. Some of the lower level parsers interact with the lexer, but the only interactions
users have with it are the tokens that it produces. These tokens are the base substrings which make the chunks of text to be
translated. In the resulting parse tree, these end up being the leaves.

The following are low-level parsers:

* `empty`
* `eof`
* `literal`
* `regex`
* `unicodePoint`
* `unicodeRange`

### Higher-order Parsers

Higher-order parsers, also known as combinators, are a kind of meta-parsers. They contain the logic to combine other parsers
to be able to parse more complex structures. These combinators all have a signature similar to the following:

    ((Lexer, Environment) => Result) => (Lexer, Environment) => Result

That this means is that the result of calling a parser is another parser composed of the function's inputs. For example, look at
the following:

    sequence(literal('a'), literal('b'), eof())

This code produces a parser composed of `literal('a'), literal('b'), eof()`, and it will try to match the pattern `'ab\0'`, where
`\0` means the end of the input string. So if we already processed 8 bytes of `'qwertyuiab'`, this parser would return a match,
while it would not match `'qwertyuiab123'`. Such is the case for all higher-order parsers.

The following are higher-order parsers:

* `not`
* `tryrule`
* `optional`
* `zeroOrMore`
* `oneOrMore`
* `repetition`
* `sequence`
* `choice`
* `orderedChoice`

### The Symbol Table

These two groups of parsers alone would not be enough to express most grammars out there. Some rules need to be expressed
recursively. As such there is a symbol table that associates a name with defined parser
rules so that a rule an be defined in terms of itself. Say you have a rule defined as such:

    ruleA: sequence(literal('a'), literal('b'))

With the `production` combinator, you can reference that object.

    ruleB: oneOrMore(production('ruleA'))

Also included in the symbol table is a set of token patterns. You can define a custom token pattern in the `lexerRules` parameter,
or you can use one of the pre-canned ones. Matching a predefined token pattern is done with the `token` combinator. With those in
place you can have more complex rules like such:

    cmb.combinator({
      lexerRules: {
        number: /[1-9][0-9]*/
      },
      productionRules: {
        expression: orderedChoice(
          sequence('(', production('expression'), ')'),
          sequence(production('term'), '+', production('expression')),
          production('term')
        ),
        term: orderedChoice(
          sequence(production('factor'), '*', production('term')),
          production('factor')
        ),
        factor: choice(
          token('identifier'),
          token('number'),
        )
      },
      ignore: [ /[ \t\n]+/ ]
    })

A couple of things to note in the above example.
1. The token `identifier` is built-in, and doesn't need to be defined.
2. The token name `number` is defined in the `lexerRules` section.
3. The rules `expression` and `term` are defined in terms of themselves using the `production` combinator.
4. The tokens are accessible through the `token` combinator, and
5. The grammar is right-recursive. That's because this is a top-down parser, and cannot handle left-recursions.
6. Plain strings such as `'+'` are synonymous with calling `literal('+')`. These strings get converted automatically
at parse time.

The following token patterns are built-in:
* `letter`: `/[A-Z-a-z]/`
* `digit`: `/[0-9]/`
* `hexDigit`: `/[0-9A-Fa-f]/`
* `identifier`: `/[A-Za-z_][A-Za-z0-9_]*/`
* `jsonString`: `/("(((?=\\)\\(["\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^"\\\0-\x1F\x7F]+)*")/`
* `jsonStringSingleQuote`: `/('(((?=\\)\\(['\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^'\\\0-\x1F\x7F]+)*')/`
* `jsonNumber`: `/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/`
* `integer`: `/[1-9][0-9]*/`
* `bit`: `/[01]/`
* `cr`: `'\r'`
* `lf`: `'\n'`
* `crlf`: `'\r\n'`
* `quote`: `"'"`
* `doubleQuote`: `'"'`
* `sp`: `' '`
* `tab`: `'\t'`
* `cComment`: `/\/\*[.\r\n]*?\*\//`
* `cppComment`: `/\/\/.*\n/`
* `shComment`: `/#.*\n/`

### Other methods of defining grammar

As a matter of convenience, `cmb.js` also provides a method of defining a grammar from plain text,
rather from calling functions. This is especially handy if you have a grammar already written out
from another source. ABNF in particular is used on RFCs for defining protocols and data formats,
making it likely that a grammar already exists in ABNF form.

`cmb.js` does just that. In addition to the `cmb.combinator` parser generator, it can understand
several popular formats for defining grammars. These will actually produce function parsers just
like using combinators. The following languages are supported:

* Backus-Naur Form (BNF)
* Extended Backus-Naur Form (EBNF)
* Augmented Backus-Naur Form (ABNF)
* Parser Expression Grammar (PEG)
* Wirth Syntax Notation (WSN)

Many of these were implemented not by popular demand but as part of unit testing the parser. Don't
expect strict adherence to their definitions, complete features, or succinct output. If there is a
problem with one, or a missing feature of the language, or if one is too strict or not strict enough,
let me know (or send a pull request!) and I cann try to improve it.

ABNF itself defines a set of built-in tokens, so when using that to define grammar, the standard
builtin set is replaced with ABNF's set. They are as follows:

* `ALPHA`: `/[\x41-\x5A\x61-\x7A]/`
* `DIGIT`: `/[\x30-\x39]/`
* `HEXDIG`: `/[\x30-\x39A-Fa-f]/`
* `DQUOTE`: `'\x22'`
* `SP`: `'\x20'`
* `HTAB`: `'\x09'`
* `WSP`: `/[\x20\x09']/`
* `VCHAR`: `/[\x21-\x7e]/`
* `CHAR`: `/[\x00-\x7F]/`
* `OCTET`: `/[\x00-\xFF]/`
* `CTL`: `/[\x00-\x1F\x7F-\x9F]/`
* `CR`: `'\x0D'`
* `LF`: `'\x0A'`
* `CRLF`: `'\x0D\x0A'`
* `BIT`: `/[01]/`

### Fragments

Instead of completely replacing the frontend with BNF text, `cmb.js` also lets you just translate
some fragments of your preferred grammar into combinators to be use in conjuction with the rest of
the combinator library. One reason you might want to do this is because BNF and such don't let you
define custom lexer rules, so having a combinator of BNF logic would let you use your defined tokens
or ignore rules. It would also let you augment BNF with, say PEG's lookahead rules. These 'fragment
combinators' are as follows:

* `bnfFragment`
* `ebnfFragment`
* `abnfFragment`
* `wsnFragment`
* `pegFragment`

## API

### Functions
- `cmb`: The parser generator.
  - `combinator(lexerRules, productionRules, ignore)`: Makes a parser out of combinators.
  - `bnf(text, ignore)`: Makes a parser using the Backus-Naur Form front end.
  - `ebnf(text, ignore)`: Makes a parser using the Extended BNF front end.
  - `abnf(text, ignore)`: Makes a parser using the Augmented BNF front end.
  - `peg(text, ignore)`: Makes a parser using the Parser Expression Syntax front end.
  - `wsn(text, ignore)`: Makes a parser using the Wirth Syntax Notation front end.
- `combinators`
  - `empty()`: Reports a match while not consuming the string. The resulting token can be identified via the 
  `isEmpty` util function;
  - `eof()`: Matches if the parser has reached the end of the string. Fails if there is more to parse. The
  resulting match token can be identified via the `isEOF` util function.
  - `token(name: string)`: Matches a token in the symbol table by name.
  - `literal(text: string)`: Matches a single string. The name of the token type is the string to match. If a raw
  string is provided as a combinator instead of a function, it is implied to be a literal.
  - `regex(regex: RegExp)`: Matches a regular expression.
  - `unicodePoint(point: number)`: Matches a single character defined by its Unicode code point number.
  - `unicodeRange(start: number, end: number)`: Matches a range of Unicode code points.
  - `production(name: string)`: Matches a rule in the symbol table by name.
  - `not(rule: parseFunction)`: Matches if its composed rule rejects the match and vice versa. This is equivalent to "negative
  lookahead" (`!`) in PEG.
  - `tryRule(rule: parseFunction)`: Matches if its composed rule matches, but does not consume the string. This is equivalent
  to "positive lookahead" (`&`) in PEG.
  - `optional(rule: parseFunction)`: Matches if its composed rule matches. Otherwise returns the results of `empty`.
  - `zeroOrMore(rule: parseFunction)`: Matches its composed rule as many times as it can, returning an array of all matched
  results.
  - `oneOrMore(rule: parseFunction)`: Same as `zeroOrMore`, but rejects the match if at least one match is not found.
  - `repetition(rule: parseFunction, [min: number, max: number])`: Same as zeroOrMore, but will only look for up to `max`
  (default: `Infinity`) and fail if there are fewer matches than `min` (default `0`). Leaving off min/max gives identical behavior
  to zeroOrMore.
  - `sequence(rule1: parseFunction[, rule2, rulen...])`: Matches `rule1` followed by `rule2`, etc. returning the results in an array.
  - `choice(rule1: parseFunction[, rule2, rulen...])`: Will match one rule in the list. If more than one rule is a match, the function will reject the results for being ambiguous.
  - `orderedChoice(rule1: parseFunction[, rule2, ruleN...])`: Will match one rule in the list, in order. If more than one rule is a match, the function will return the first rule that matches. This is equivalent to `/` alternation in PEG.
  - `bnfFragment(text)`: Creates a rule by translating BNF. This only accepts the right-hand side od a rule.
  - `ebnfFragment(text)`: Creates a rule by translating EBNF. This only accepts the right-hand side od a rule.
  - `abnfFragment(text)`: Creates a rule by translating ABNF. This only accepts the right-hand side od a rule.
  - `pegFragment(text)`: Creates a rule by translating PEG. This only accepts the right-hand side od a rule.
  - `wsnFragment(text)`: Creates a rule by translating WSN. This only accepts the right-hand side od a rule.
- `util`
  - `isEmpty(Token)`: Helper function to determine if a token represents a non-match.
  - `isEOF(Token)`: Helper function to determine if a token represents the end of the string.

### Arguments
- `combinator({ lexerRules, productionRules, ignore })`:
  - `lexerRules`: *(optional)* An object representing name-value pairs of
  lexer rules. Not all tokens need to be defined beforehand. Many are builtin,
  and you have the ability to match string literals and regular expressions
  within the rules themselves.
  - `productionRules`: An object representing name-value pairs of
  production rules. Specifying names are useful for defining a recursive rule,
  naming a parse tree node, or applying a transform to the parse tree's output at
  that level.
  - `ignore`: *(optional)* An array of regular expressions describing patterns which the
  lexer should 
  - Output: An object, with one property for each given productionRule, each
  which contains a function accepting a string, parses that rule, and returns the
  resulting parse tree. In the event of a failed parse, the function throws.

## Parse Tree Format

- `Production`: A single parse tree node. A union type of `NamedProduction`, `ArrayProduction`, and `Token`.
- `NamedProduction`: Produced by the `production` rule. Each named production rule will have its result wrapped
in a `NamedProduction`.
  - `name`: (string) - The corresponding rule name.
  - `val`: (Production) - The result value.
- `ArrayProduction`: Produced by rules that return more than one match, like `zeroOrMore`, or `sequence`.
  - `val`: Array<Production>: The array of contained results.
- `Token`: Produced by the lower-level rules.
  - `type`: The type of token it found.
  - `val`: The text which matches that pattern.
  - `input`: The original string.
  - `start`: The index where the matching text was found.
  - `end`: The index where the matching text ends.

### Processing the Parse Tree

The most idiomatic way of handling parse trees is with the visitor pattern. This can be implemented
simply in Javascript using an object with names corresponding to a rule and each value being
a function to process that tree node, like so:

    cmb.combinator({
      lexerRules: {
        number: /[1-9][0-9]*/
      },
      productionRules: {
        expression: orderedChoice(
          sequence('(', production('expression'), ')'),
          sequence(production('term'), '+', production('expression')),
          production('term')
        ),
        term: orderedChoice(
          sequence(production('factor'), '*', production('term')),
          production('factor')
        ),
        factor: choice(
          token('identifier'),
          token('number'),
        )
      },
      ignore: [ /[ \t\n]+/ ]
    })

    // parse the string
    const tree = parser.expression('35 * a + 255');

    // define the visitor
    const calc = {
      expression: (node, env, visitor) => {
        const n = node.val;
        if (n instanceof NamedProduction && n.name === 'term') {
          return visitor.term(n, env, visitor);
        }
        if (n instanceof ArrayProduction) {
          const [first, second, third] = n.val;
          if (first instanceof Token && first.val === '(') {
            return visitor.expression(n.val[1], env, visitor);
          }
          return visitor.term(first, env, visitor) + visitor.expression(third, env, visitor);
        }
      },
      term: (node, env, visitor) => {
        const n = node.val;
        if (n instanceof NamedProduction && n.name === 'factor') {
          return visitor.factor(n, env, visitor);
        }
        if (n instanceof ArrayProduction) {
          const first = visitor.factor(n.val[0], env, visitor);
          const rest = visitor.term(n.val[2], env, visitor);
          return first * rest;
        }
      },
      factor: (node, env, visitor) => {
        const tok = node.val;
        if (tok.type === 'identifier') {
          return env[tok.val];
        }
        if (tok.type === 'number') {
          return Number.parseInt(tok.val);
        }
      }
    };

    // process the parse tree
    const result = calc.expression(tree, { a: 10 }, calc);
    console.log(result); // output: 585

## Changes
- `2.0.0`: Complete overhaul of the library from scratch. Completely new API.
All combinator names have changed. Added BNF, EBNF, ABNF, PEG, WSN frontends.
New engine. Added Flow types for static type analysis. Added Webpack deployment.
Added ES6 compilation via Babel.
- `1.1.0`: Added the `several` combinator.

## License
The MIT License (MIT)

Copyright (c) 2015, 2018 Sean Wolcott

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
