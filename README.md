# cmb.js
**A parsing library for JavaScript using parser combinators**

cmb.js is a set of tools which can create a function that can parse a string and output a parse tree. It basically generates a recursive descent parser by encapsulating the boilerplate code in a way that you can combine the parts directly into the parsing function merely by specifying the grammar.

## Usage

    var parse = cmb(config);
    var parseTree = parse("abcdefg");

## Example

    // Produces a parser that recognizes 0 or more a's
    // followed by 1 or more b's
    var parse = cmb({
      grammar: {
        "sentence": cmb.all("a's", "b's"),
        "a's": cmb.many(cmb.term("a")),
        "b's": cmb.all(cmb.term("b"), cmb.many(cmb.term("b")))
      },
      startRule: "sentence",
      ignore: cmb.empty,
      transforms: {
        "sentence": function(value) {
          return value.map(function(node) {
	          return node.value;
          });
        },
        "a's": function(value) {
          return value.map(function(node) {
	          return node.value;
          });
        },
        "b's": function(value) {
          var b = value[1].value.slice();
          b.unshift(value[0]);
          return b.map(function(node) { return node.value; });
        }
      }
    });
    var result = parse("aaabbbbb");
    // output:
    // {
    //   value: [["a", "a", "a"], ["b", "b", "b", "b", "b"]],
    //   rest: "",
    //   name: "sentence"
    // }
## API

 - `cmb`: The parser generator.  config -> (string -> parseTree)
	 - `term`:  produces a parselet that matches a string literal or a regular expression.
	 - `empty`: a parselet that does nothing and produces an empty parse tree.
	 - `whitespace`: a parselet that matches a string of contiguous whitespace. Shorthand for `cmb.term(/\s+/)`.
	 - `maybe`: a combinator that takes a parselet and returns its result on a match, or the resukt of `cmb.empty` otherwise. Analogous to the `?` operator in regular expressions.
	 - `many`: a combinator that takes a parselet and returns 0 or more consecutive matches in an array. Analogous to the `*` operator in regular expressions.
	 - `any`: a combinator that takes a number of parselets in order and returns the results of the first one that matches or an error if none match. Analogous to the `|` operator in regular expressions.
	 - `all`: a combinator that takes a number of parselets and matches them in sequence, returning an array of results on success and the first error it encounters otherwise. Analogous to adjacent rules in regular expressions.
 - `config`: The language grammar specification fed to `cmb()` to produce a parsing function. `config` is an object which can have several optional fields:
	 - `grammar`: *(optional)* an object representing name-value pairs of production rules. Specifying names are useful for defining a recursive rule,
naming a parse tree node, or applying a transform to the parse tree's output at that level.
	 - `startRule`: *(optional)* a name or parselet which will act as the starting poing of the top-down parsing (the "top" of the grammar). If no rule is specified, it assumes that it will start at a node named "root".
	 - `ignore`: *(optional)* a name or parselet that the parser will discard before trying to find a production rule. Useful for discarding whitespace, for example. It defaults it cmb.empty, which matches nothing.
	 - `transforms`: *(optional)* an object of name-value pairs of transforms to perform on a generated parse tree of a given production rule. Useful for flattening
a parse tree or removing noise from the output to make the output easier for processing.

## Parse Tree Format

    {
    	value: <any value>,
    	rest: <string>,
    	err: <string or array>,
    	name: <string>
    }

 - `value`: *(optional)* The value found parsing the text. Can contain text, other parse tree nodes, an array of results, or anything a transform function puts in the node.
 - `rest`: A substring of the original parse string showing what yet needs to be parsed.
 - `err`: *(optional)* An error or array of errors produced when a parselet cannot parse the given string.
 - `name`: *(optional)* A string representing the name of a production rule. This is included in all production rule output, but not in the intermediate parselets.

## Transforms
The default parse tree format is designed to be generic and informative in the cmb.js internals and therefore it can be a bit noisy. To make them easier to work with, each named production rule can optionally come with a helper function to keep just the bare essentials in the tree structure.

Each transform is a function which takes a node's old `value` as its parameter, and its output is set as the node's new `value`.  Note that only the node's `value` gets modified, resulting in a parse tree node like so:

    {
	    value: transforms[originalName](originalValue),
	    rest: originalRest,
	    err: originalErr,
	    name: originalName
    }
One last thing to note is that while parsing is done top-down, transforms are done bottom-up, meaning that any child nodes (contained in the `value` field) have already been subjected to transforms. This also makes possible any bottom-up syntax analysis before the value is returned.

## License
The MIT License (MIT)

Copyright (c) 2015 Sean Wolcott

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
