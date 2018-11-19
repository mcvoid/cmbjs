import {
  sequence,
  zeroOrMore,
  production,
  choice,
  orderedChoice,
  token,
} from '../src/rules';
import { Token, NamedProduction, ArrayProduction } from '../src/types';
import { combinator } from '../src/combinator';

const jsonParser = combinator({
  lexerRules: {
    string: /("(((?=\\)\\(["\\\/bfnrt]|u[0-9a-fA-F]{4}))|[^"\\\0-\x1F\x7F]+)*")/,
    number: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
  },
  productionRules: {
    object: orderedChoice(
      sequence(
        '{',
        production('members'),
        '}',
      ),
      sequence('{', '}'),
    ),
    members: orderedChoice(
      sequence(production('member'), ',', production('members')),
      production('member'),
    ),
    member: sequence(token('string'), ':', production('value')),
    array: orderedChoice(
      sequence(
        '[',
        production('elements'),
        ']',
      ),
      sequence('[', ']'),
    ),
    elements: orderedChoice(
      sequence(production('value'), ',', production('elements')),
      production('value'),
    ),
    value: choice(
      production('object'),
      production('array'),
      token('string'),
      token('number'),
      'true',
      'false',
      'null',
    ),
  },
  ignore: [/\s\t\n/],
});

const jsonVisitor = {
  value: (node, visitor) => {
    if (node instanceof Token) {
      switch (node.type) {
        case 'null':
          return null;
        case 'true':
          return true;
        case 'false':
          return false;
        case 'string':
          return node.val.slice(1, -1);
        case 'number':
          return Number.parseFloat(node.val);
      }
    }
    if (node instanceof NamedProduction) {
      switch (node.name) {
        case 'object':
          return visitor.object(node.val, visitor);
        case 'array':
          return visitor.array(node.val, visitor);
      }
    }
    throw 'JSON value: Unknown production';
  },
  array: (node, visitor) => {
    if (!(node instanceof ArrayProduction)) {
      throw 'Invalid production: Array expects array production ([, elements, ])';
    }
    if (node.val.length == 2) {
      return [];
    }
    const elements = node.val[1];
    return visitor.elements(elements.val, visitor);
  },
  elements: (node, visitor) => {
    if (node instanceof NamedProduction) {
      return [visitor.value(node.val, visitor)];
    }

    if (node instanceof ArrayProduction) {
      const element = node.val[0];
      const elements = node.val[2];
      return [
        visitor.value(element.val, visitor),
        ...visitor.elements(elements.val, visitor),
      ];
    }
    return [];
  },
  members: (node, visitor) => {
    if (node instanceof NamedProduction) {
      return [visitor.member(node.val, visitor)];
    }

    if (node instanceof ArrayProduction) {
      const member = node.val[0];
      const members = node.val[2];
      return [
        visitor.member(member.val, visitor),
        ...visitor.members(members.val, visitor),
      ];
    }
    throw 'Invalid production: members expects a member or array(member, :, members';
  },
  member: (node, visitor) => {
    if (!(node instanceof ArrayProduction)) {
      throw 'Invalid production: member expects array production';
    }
    const [key, _, val] = node.val;
    return { [key.val.slice(1, -1)]: visitor.value(val.val, visitor) };
  },
  object: (node, visitor) => {
    if (!(node instanceof ArrayProduction)) {
      throw 'Invalid production: Object expects array production ({, members, })';
    }
    if (node.val.length == 2) {
      return {};
    }
    const members = node.val[1].val;
    return visitor.members(members, visitor).reduce((o, kv) => ({ ...o, ...kv }), {});
  },
};


describe('json', () => {
  it('should parse null', () => {
    const expected = null;
    const parseTree = jsonParser.value(JSON.stringify(expected));
    const val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });

  it('should parse false', () => {
    const expected = false;
    const parseTree = jsonParser.value(JSON.stringify(expected));
    const val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });

  it('should parse true', () => {
    const expected = null;
    const parseTree = jsonParser.value(JSON.stringify(expected));
    const val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });
  
  it('should parse array', () => {
    let expected = [];
    let parseTree = jsonParser.value(JSON.stringify(expected));
    let val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);

    expected = [[]];
    parseTree = jsonParser.value(JSON.stringify(expected));
    val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);

    expected = [[], [], []];
    parseTree = jsonParser.value(JSON.stringify(expected));
    val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);

    expected = [null, false, true, 123.45, ['null','null',[5, {}]]];
    parseTree = jsonParser.value(JSON.stringify(expected));
    val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });
  
  it('should parse object', () => {
    let expected = {};
    let parseTree = jsonParser.value(JSON.stringify(expected));
    let val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);

    expected = { a: {} };
    parseTree = jsonParser.value(JSON.stringify(expected));
    val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);

    expected = { b: { a: {}, c: [], d: null, e: true }, c: false, d: "false", e: 123.45 };
    parseTree = jsonParser.value(JSON.stringify(expected));
    val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });
  
  it('should parse number', () => {
    const expected = 123.45;
    const parseTree = jsonParser.value(JSON.stringify(expected));
    const val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });
  
  it('should parse string', () => {
    const expected = '123.45';
    const parseTree = jsonParser.value(JSON.stringify(expected));
    const val = jsonVisitor.value(parseTree, jsonVisitor);
    expect(val).toEqual(expected);
  });
});
