(function IIFE(cmb) {
  var tests = {
    "Check Empty parselet": function(t) {
      var result = cmb.empty("abcd");
      if (result.err || result.value !== "" || result.rest !== "abcd") {
        t.error({ value: "", rest: "abcd"}, result);
      }
    },
    "Check Whitespace parselet": function(t) {
      var result = cmb.whitespace("abcd");
      if (!result.err) {
        t.error({ err: "string does not match /[ \\t\\n]+/" }, result);
      }
      result = cmb.whitespace("   abcd");
      if (result.err || result.value !== "   " || result.rest !== "abcd") {
        t.error({ value: "   ", rest: "abcd"}, result);
      }
    },
    "Check terminals": function(t) {
      // ignoring nothing
      // check string literals
      var parse = cmb({ startRule: cmb.term("a") });
      var result = parse("a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      result = parse(" a");
      if (!result.err) {
        t.error({ err: "string does not match a", rest: " a"}, result);
      }
      // check regex
      parse = cmb({ startRule: cmb.term(/a/) });
      result = parse("a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      result = parse(" a");
      if (!result.err) {
        t.error({ err: "string does not match /a/", rest: " a"}, result);
      }

      // ignoring whitespace
      // check string literals
      parse = cmb({
        startRule: cmb.term("a"),
        ignore: cmb.whitespace
      });
      result = parse("a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      result = parse(" a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      // check regex
      parse = cmb({
        startRule: cmb.term(/a/),
        ignore: cmb.whitespace
      });
      result = parse("a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      result = parse(" a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
    },
    "Check maybe combinator": function(t) {
      var parse = cmb({ startRule: cmb.maybe(cmb.term("a")) });
      var result = parse("a");
      if (result.err || result.value !== "a" || result.rest !== "") {
        t.error({ value: "a", rest: ""}, result);
      }
      result = parse("b");
      if (result.err || result.value !== "" || result.rest !== "b") {
        t.error({ value: "", rest: "b"}, result);
      }
    },
    "Check many combinator": function(t) {
      var parse = cmb({ startRule: cmb.many(cmb.term("a")) });
      var result = parse("b");
      if (result.err || result.value.length !== 0 || result.rest !== "b") {
        t.error({ value: [], rest: "b"}, result);
      }
      result = parse("aaaaab");
      if (result.err || result.value.length !== 5 || result.rest !== "b") {
        t.error({
          "value": [
            { "value": "a", "rest": "aaaab" },
            { "value": "a", "rest": "aaab" },
            { "value": "a", "rest": "aab" },
            { "value": "a", "rest": "ab" },
            { "value": "a", "rest": "b" }
          ],
          "rest": "b"
        }, result);
      }
    },
    "Check all combinator": function(t) {
      var parse = cmb({ startRule: cmb.all(cmb.term("a"), cmb.term("b")) });
      var result = parse("ab");
      if (result.err || result.value.length !== 2 || result.rest !== "") {
        t.error({
          "value": [
            { "value": "a", "rest": "b" },
            { "value": "b", "rest": "" }
          ],
          "rest": ""
        }, result);
      }
    },
    "Check any combinator": function(t) {
      var parse = cmb({ startRule: cmb.any(cmb.term("a"), cmb.term("b")) });
      var result = parse("abc");
      if (result.err || result.value !== "a" || result.rest !== "bc") {
        t.error({ value: "a", rest: "bc"}, result);
      }
      result = parse("bc");
      if (result.err || result.value !== "b" || result.rest !== "c") {
        t.error({ value: "b", rest: "c"}, result);
      }
      result = parse("c");
      if (! result.err) {
        t.error({
          err: [
            "could not match any alternate rules",
            {
              "err": "string does not match a"
            },
            {
              "err": "string does not match b"
            }
          ],
          rest: "c"
        }, result);
      }
    },
    "Check transforms": function(t) {
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
            return value.map(function(node) { return node.value; });
          },
          "a's": function(value) {
            return value.map(function(node) { return node.value; });
          },
          "b's": function(value) {
            var b = value[1].value.slice();
            b.unshift(value[0]);
            return b.map(function(node) { return node.value; });
          }
        }
      });
      var result = parse("aaabbbbb");
      if (result.err || result.value.length != 2 || result.value[0].length != 3 || result.value[1].length != 5) {
        t.error({
          "value": [["a", "a", "a"], ["b", "b", "b", "b", "b"]],
          "rest": "",
          "name": "sentence"
        }, result);
      }
    }
  };

  var t = {
    error: function(expected, got) {
      throw JSON.stringify({
        expected: expected,
        got: got
      }, null, "  ");
    }
  };

  var passed = 0;
  Object.keys(tests).forEach(function testLoop(testName) {
    var test = tests[testName];

    try {
      test(t);
    } catch (failureMessage) {
      console.error("Test " + testName + " FAILED: " + failureMessage);
      return;
    }
    passed++;
  });
  console.log(passed + " of " + Object.keys(tests).length + " passed.");
}(this.cmb));
