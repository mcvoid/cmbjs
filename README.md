# cmb.js
The parser generator for JavaScript using parser combinators

cmb.js is a set of tools which can create a function that can parse a string and output a parse tree. It basically
generates a recursive descent parser by encapsulating the boilerplate code in a way that you can combine the parts
directly into the parsing function merely by specifying the grammar.

usage: var parse = cmb(config); var parseTree = parse("abcdefg");

config is an object which can have several optional fields:
* grammar - an object representing name-value pairs of production rules. Specifying names are useful for defining a recursive rule,
naming a parse tree node, or applying a transform to the parse tree's output at that level.
* startRule - a name or parselet which will act as the starting poing of the top-down parsing (the "top" of the grammar).
If no rule is specified, it assumes that it will start at a node named "root".
* ignore - a name or parselet that the parser will discard before trying to find a production rule. Useful for discarding whitespace, for example. It defaults it cmb.empty, which matches nothing.
* transform = an object of name-value pairs of transforms to perform on a generated parse tree of a given production rule. Useful for flattening 
a parse tree or removing noise from the output to make the output easier for processing.
