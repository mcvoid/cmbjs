var cmb = require("../cmb");

describe("Builtin parselets", function() {
  it("Check Empty parselet", function() {
    var result = cmb.empty("abcd", { start:0, len: 0 });
    expect(result.err).toBeUndefined();
    expect(result.value).toEqual("");
  });

  it("Check Whitespace parselet", function() {
    var result = cmb.whitespace("abcd", { start:0, len: 0 });
    expect(result.err).toBeDefined();

    result = cmb.whitespace("   abcd", { start:0, len: 0 });
    expect(result.err).toBeUndefined();
    expect(result.value).toEqual("   ");
  });
});

describe("terminal parselets", function() {
  it("Check string literals", function() {
    var parse = cmb({ startRule: cmb.term("a") });
    var result = parse("a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value:"a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      }
    });

    result = parse(" a");
    expect(result.err).toBeDefined();
  });

  it("Check regex", function() {
    var parse = cmb({ startRule: cmb.term(/a/) });
    var result = parse("a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value: "a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      }
    });

    result = parse(" a");
    expect(result.err).toBeDefined();
  });

  it("Check string literals ignoring whitespace", function() {
    var parse = cmb({
      grammar: { a: cmb.term("a") },
      startRule: "a",
      ignore: cmb.whitespace
    });
    var result = parse("a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value: "a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      },
      name: "a"
    });

    result = parse(" a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value: "a",
      state: {
        start: 1,
        len: 1,
        string: "a"
      },
      name: "a"
    });
  });

  it("Check regex ignoring whitespace", function() {
    var parse = cmb({
      grammar: { a: cmb.term(/a/) },
      startRule: "a",
      ignore: cmb.whitespace
    });
    var result = parse("a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value: "a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      },
      name: "a"
    });

    result = parse(" a");
    expect(result.err).toBeUndefined();
    expect(result).toEqual({
      value: "a",
      state: {
        start: 1,
        len: 1,
        string: "a"
      },
      name: "a"
    });
  });
});

describe("combinators", function() {
  it("Check maybe combinator", function() {
    var parse = cmb({ startRule: cmb.maybe(cmb.term("a")) });
    var result = parse("a");
    expect(result).toEqual({
      value: "a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      }
    });

    result = parse("b");
    expect(result).toEqual({
      value: "",
      state: {
        start: 0,
        len: 0,
        string: ""
      }
    });
  });

  it("Check many combinator", function() {
    var parse = cmb({ startRule: cmb.many(cmb.term("a")) });
    var result = parse("b");
    expect(result).toEqual({
      value: [],
      state: {
        start: 0,
        len: 0,
        string: ""
      }
    });

    result = parse("aaaaab");
    var val = result.value.map(function(v) { return v.value; });
    expect(val).toEqual(["a", "a", "a", "a", "a"]);
    expect(result.state).toEqual({
      start: 0,
      len: 5,
      string: "aaaaa"
    });
  });

  it("Check all combinator", function() {
    var parse = cmb({ startRule: cmb.all(cmb.term("a"), cmb.term("b")) });
    var result = parse("ab");
    var val = result.value.map(function(v) { return v.value; });
    expect(val).toEqual(["a", "b"]);
    expect(result.state).toEqual({
      start: 0,
      len: 2,
      string: "ab"
    });
  });

  it("Check any combinator", function() {
    var parse = cmb({ startRule: cmb.any(cmb.term("a"), cmb.term("b")) });
    var result = parse("abc");
    expect(result).toEqual({
      value: "a",
      state: {
        start: 0,
        len: 1,
        string: "a"
      }
    });

    result = parse("bc");
    expect(result).toEqual({
      value: "b",
      state: {
        start: 0,
        len: 1,
        string: "b"
      }
    });

    result = parse("c");
    expect(result.err).toBeDefined();
  });

  it("Check several combinator", function() {
    var parse = cmb({ startRule: cmb.several(cmb.term("a")) });
    var result = parse("b");
    expect(result.err).toBeDefined();

    result = parse("aaaaab");
    var val = result.value.map(function(v) { return v.value; });
    expect(val).toEqual(["a", "a", "a", "a", "a"]);
    expect(result.state).toEqual({
      start: 0,
      len: 5,
      string: "aaaaa"
    });
  });

});

describe("transforms", function() {
  // it("Check transforms", function() {
  //   var parse = cmb({
  //     grammar: {
  //       "sentence": cmb.all("a", "b"),
  //       "a": cmb.many(cmb.term("a")),
  //       "b": cmb.all(cmb.term("b"), cmb.many(cmb.term("b")))
  //     },
  //     startRule: "sentence",
  //     ignore: cmb.empty,
  //     transforms: {
  //       "sentence": function(value) {
  //         return value.map(function(node) { return node.value; });
  //       },
  //       "a": function(value) {
  //         return value.map(function(node) { return node.value; });
  //       },
  //       "b": function(value) {
  //         var b = value[1].value.slice();
  //         b.unshift(value[0]);
  //         return b.map(function(node) { return node.value; });
  //       }
  //     }
  //   });
  //   var result = parse("aaabbbbb");
  //   expect(result.value).toEqual([["a", "a", "a"], ["b", "b", "b", "b", "b"]]);
  // });

  it("JSON test", function() {
    var parse = cmb({
      // grammar adapted from json.org
      grammar: {
        "null": cmb.term("null"),
        "true": cmb.term("true"),
        "false": cmb.term("false"),
        "object": cmb.any(
          cmb.all(cmb.term("{"), cmb.term("}")),
          cmb.all(cmb.term("{"), "members", cmb.term("}"))
        ),
        "members": cmb.any(
          cmb.all("pair", cmb.term(","), "members"),
          "pair"
        ),
        "pair": cmb.all("string", cmb.term(":"), "value"),
        "array": cmb.any(
          cmb.all(cmb.term("["), cmb.term("]")),
          cmb.all(cmb.term("["), "elements", cmb.term("]"))
        ),
        "elements": cmb.any(
          cmb.all("value", cmb.term(","), "elements"),
          "value"
        ),
        "value": cmb.any(
          "string",
          "number",
          "object",
          "array",
          "true",
          "false",
          "null"
        ),
        "string": cmb.term(/\"([^\"\\]*|\\(["\\\/bfnrt]{1}|u[a-f0-9]{4}))*\"/),
        "number": cmb.term(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      },
      startRule: "value",
      ignore: cmb.whitespace,
      transforms: { // turns the parse tree into data
        "true": function() { return true; },
        "false": function() { return false; },
        "null": function() { return null; },
        "object": function(v) {
          if (v.length === 2) { return {}; }
          var val = v[1].value.reduce(function(obj, pair) {
            obj[pair[0]] = pair[1];
            return obj;
          }, {});
          return val;
        },
        "members": function(v) {
          if (v.length && v.length === 3) {
            var val = [v[0].value].concat(v[2].value);
            return val;
          }
          return [v];
        },
        "pair": function(v) {
          var key = v[0].value;
          var val = v[2].value;
          return [key, val];
        },
        "array": function(v) { return (v.length === 2) ? [] : v[1].value; },
        "elements": function(v) {
          if (v === null) { return [v]; }
          if (v.length && v.length === 3) {
            var val = [v[0].value].concat(v[2].value);
            return val;
          }
          return [v];
        },
        "string": function(v) {
          return v.substr(1, v.length - 2);
        },
        "number": function(v) { return parseFloat(v); }
      }
    });

    var match = parse("true");
    expect(match).toEqual({
      value: true,
      state: {
        start: 0,
        len: 4,
        string: "true"
      },
      name: "value"
    });

    match = parse("false");
    expect(match).toEqual({
      value: false,
      state: {
        start: 0,
        len: 5,
        string: "false"
      },
      name: "value"
    });

    match = parse("null");
    expect(match).toEqual({
      value: null,
      state: {
        start: 0,
        len: 4,
        string: "null"
      },
      name: "value"
    });

    match = parse("123");
    expect(match).toEqual({
      value: 123,
      state: {
        start: 0,
        len: 3,
        string: "123"
      },
      name: "value"
    });

    match = parse("\"\"");
    expect(match).toEqual({
      value: "",
      state: {
        start: 0,
        len: 2,
        string: "\"\""
      },
      name: "value"
    });

    match = parse("\"abc\"");
    expect(match).toEqual({
      value: "abc",
      state: {
        start: 0,
        len: 5,
        string: "\"abc\""
      },
      name: "value"
    });

    match = parse("[]");
    expect(match).toEqual({
      value: [],
      state: {
        start: 0,
        len: 2,
        string: "[]"
      },
      name: "value"
    });

    match = parse("{}");
    expect(match).toEqual({
      value: {},
      state: {
        start: 0,
        len: 2,
        string: "{}"
      },
      name: "value"
    });

    match = parse("[1]");
    expect(match).toEqual({
      value: [1],
      state: {
        start: 0,
        len: 3,
        string: "[1]"
      },
      name: "value"
    });

    match = parse("[1, 1]");
    expect(match).toEqual({
      value: [1, 1],
      state: {
        start: 0,
        len: 6,
        string: "[1, 1]"
      },
      name: "value"
    });

    match = parse("{\"1\": 1}");
    expect(match).toEqual({
      value: { "1": 1 },
      state: {
        start: 0,
        len: 8,
        string: "{\"1\": 1}"
      },
      name: "value"
    });

    match = parse("{\"1\": 1, \"2\": 2}");
    expect(match).toEqual({
      value: { "1": 1 , "2": 2 },
      state: {
        start: 0,
        len: 16,
        string: "{\"1\": 1, \"2\": 2}"
      },
      name: "value"
    });

    match = parse("{\"abc\":[1, true, false, null, {}, \"\", []]}");
    expect(match.value).toEqual({ "abc": [1, true, false, null, {}, "", []] });
  });
});
