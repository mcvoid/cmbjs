// returns its parameter
function identity(value) {
  return value;
}

// generates a new state object.
function newState(s, start, len) {
  return {
    start: start,
    len: len,
    string: s.substr(start, len)
  };
}

// matches a 0-length substring
function empty(s, state) {
  var start = state.start + state.len;
  return {
    value: "",
    state: newState(s, start, 0)
  };
}

// evaluates a parselet either directly or by late-binding a name
function evaluate(fn, s, state) {
  if (typeof fn === "string") {
    if (!this.symbols[fn]) {
      return { err: "invalid grammar rule: " + fn };
    }
    fn = this.symbols[fn];
  }
  return fn.call(this, s, state);
}

// memoizes a function
function memoize(fn) {
  var cache = {};
  return function runMemoizedRule(s, state) {
    var start = state.start + state.len;
    if (!cache[s]) { cache[s] = {}; }
    if (!cache[s][start]) {
      cache[s][start] = fn.call(this, s, state);
    }
    // always return a copy!
    var v = cache[s][start];
    return Object.keys(v).reduce(function(obj, key) {
      return obj[key] = v[key], obj;
    }, {});
  };
}

// decorates a parselet with a production rule name.
function productionRule(name, fn) {
  return function parseRule(s, state){
    var currentState = state;
    var ignored = this.evaluate(this.ignore || empty, s, currentState);
    if (!ignored.err && ignored.state) {
      currentState = ignored.state;
    }
    var match = this.evaluate(fn, s, currentState);
    match.name = name;
    if (!match.err) {
      match.value = this.transforms[name](match.value);
    }
    return match;
  };
}

// The parser generator
// grammar: an object representing the grammar production rules
// The rule to start parsing (the top of the grammar)
// ignore: a parselet defining what kind of things to ignore
// example:
// language: 0 or more a's followed by 1 or more b's
// var parse = cmb({
//   grammar: {
//     "sentence": cmb.all("a's", "b's"),
//     "a's": cmb.many(cmb.term("a")),
//     "b's": cmb.all(cmb.term("b"), cmb.many(cmb.term("b")))
//   },
//   startRule: "sentence",
//   ignore: cmb.empty,
//   transforms: {
//     "sentence": function(value) {
//       return value.map(function(node) { return node.value; });
//     },
//     "a's": function(value) {
//       return value.map(function(node) { return node.value; });
//     },
//     "b's": function(value) {
//       var b = value[1].value.slice();
//       b.shift(value[0]);
//       return b.map(function(node) { return node.value; });
//     }
//   }
// });
// parse("aaabbbbb");
// output:
// {
//   name: "sentence",
//   state: {
//     start: 0,
//     len: 8,
//     string: "aaabbbbb"
//   },
//   value: [["a", "a", "a"], ["b", "b", "b", "b", "b", ]]
// }
function cmb(config) {
  var grammar = config.grammar || {};
  var startRule = config.startRule || "root";
  var ignore = config.ignore || empty;
  var transforms = config.transforms || {};
  // construct the symbol table for the grammar
  // and name the production rules
  var symbols = Object.keys(grammar).reduce(function makeRules(s, key){
    s[key] = productionRule(key, memoize(grammar[key]));
    transforms[key] = transforms[key] || identity;
    return s;
  }, {});
  return function parse(s) {
    var state = newState(s, 0, 0);
    return evaluate.call({
      symbols: symbols,
      ignore: ignore,
      transforms: transforms,
      evaluate: evaluate
    }, startRule, s, state);
  };
}

// matches a 0-length substring
cmb.empty = empty;

// matches a regular expression or a string literal.
// usage: cmb.term(/abc/) or cmb.term("abc")
cmb.term = function term(param) {
  return {
    "object": function parseWithRegex(s, state) {
      var start = state.start + state.len;
      var match = param.exec(s.substr(start));
      return (match && match.index === 0) ? {
        value: match[0],
        state: newState(s, start, match[0].length)
      } : {
        err: "string does not match /" + param.source + "/"
      };
    },
    "string": function parseWithString(s, state) {
      var start = state.start + state.len;
      return (s.substr(start, param.length) === param) ? {
        value: param,
        state: newState(s, start, param.length)
      } : {
        err: "string does not match " + param
      };
    }
  }[typeof param] || cmb.empty;
};

// matches whitespace
cmb.whitespace = cmb.term(/\s+/);

// matches a base-10 floating point or integer
cmb.base10Float = cmb.term(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);

// matches any one of the provided rules.
// usage: cmb.any(rule1, rule2[, rule3...])
cmb.any = function any() {
  var args = [].slice.call(arguments);
  return function parseAny(s, state) {
    var start = state.start + state.len;
    var rules = args.slice();
    var errors = [];
    while (rules.length > 0) {
      var rule = rules.shift();
      var result = this.evaluate(rule, s, state);
      if (!result.err) { return result; }
      errors.push(result);
    }
    errors.unshift("could not match any alternate rules");
    return {
      err: errors,
      state: newState(s, start, 0)
    };
  };
};

// matches each of the provided rules in sequence.
// usage: cmb.all(rule1, rule2[, rule3...])
cmb.all = function all() {
  var args = [].slice.call(arguments);
  return function parseAll(s, state) {
    var rules = args.slice();
    var results = [];
    var currentState = state;
    while (rules.length > 0) {
      var rule = rules.shift();
      var result = this.evaluate(rule, s, currentState);
      if (result.err) { return result; }
      results.push(result);
      currentState = result.state;
    }
    var start = state.start + state.len;
    var end = currentState.start + currentState.len;
    var len = end - start;
    return {
      value: results,
      state: newState(s, start, len)
    };
  };
};

// matches a rule 0 or more times.
// usage: cmb.many(rule)
cmb.many = function many(fn) {
  return function parseMany(s, state) {
    var results = [];
    var currentState = state;
    var result = this.evaluate(fn, s, currentState);
    while (!result.err) {
      results.push(result);
      currentState = result.state;
      result = this.evaluate(fn, s, currentState);
    }
    var start = state.start + state.len;
    var end = currentState.start + currentState.len;
    var len = end - start;
    if (results.length === 0) {
      return {
        value: [],
        state: newState(s, start, 0)
      };
    }
    return {
      value: results,
      state: newState(s, start, len)
    };
  };
};

// matches a rule 0 or 1 times.
// usage: cmb.maybe(rule1)
cmb.maybe = function maybe(fn) {
  return function parseMaybe(s, state) {
    var result = this.evaluate(fn, s, state);
    if (result.err) {
      return empty(s, state);
    }
    return result;
  };
};

module.exports = cmb;
