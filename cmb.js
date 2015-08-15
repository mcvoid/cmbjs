(function cmbjsModule(global){
  // returns its parameter
  function identity(value) {
    return value;
  }

  // matches a 0-length substring
  function empty(s) { return { value: "", rest: s }; }

  // evaluates a parselet either directly or by late-binding a name
  function evaluate(fn, s) {
    if (typeof fn === "string") {
      if (!this.symbols[fn]) {
        return { err: "invalid grammar rule: " + fn };
      }
      fn = this.symbols[fn];
    }
    var result = (this.ignore || empty).call(this, s);
    if (!result.err && result.rest) {
      s = result.rest;
    }
    return fn.call(this, s);
  }

  // memoizes a function
  function memoize(fn) {
    var cache = {};
    return function(s) {
      return cache[s] || fn.call(this, s);
    };
  }

  // decorates a parselet with a production rule name.
  function productionRule(name, fn) {
    return function(s){
      var match = this.evaluate(fn, s);
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
  //   rest: "",
  //   value: [["a", "a", "a"], ["b", "b", "b", "b", "b", ]]
  // }
  function cmb(config) {
    var grammar = config.grammar || {};
    var startRule = config.startRule || "root";
    var ignore = memoize(config.ignore || empty);
    var transforms = config.transforms || {};
    // construct the symbol table for the grammar
    // and name the production rules
    var symbols = Object.keys(grammar).reduce(function makeRules(s, key){
      s[key] = productionRule(key, memoize(grammar[key]));
      transforms[key] = transforms[key] || identity;
      return s;
    }, {});
    return function parse(s) {
      return evaluate.call({
        symbols: symbols,
        ignore: ignore,
        transforms: transforms,
        evaluate: evaluate
      }, startRule, s);
    };
  }

  // matches a 0-length substring
  cmb.empty = empty;

  // matches a regular expression or a string literal.
  // usage: cmb.term(/abc/) or cmb.term("abc")
  cmb.term = function term(param) {
    return {
      "object": function parseWithRegex(s) {
        var match = param.exec(s);
        return (match && match.index === 0) ? {
          value: match[0],
          rest: s.slice(match[0].length)
        } : {
          err: "string does not match /" + param.source + "/"
        };
      },
      "string": function parseWithString(s) {
        return s.startsWith(param) ? {
          value: param,
          rest: s.slice(param.length)
        } : {
          err: "string does not match " + param
        };
      }
    }[typeof param] || cmb.empty;
  };

  // matches whitespace
  cmb.whitespace = cmb.term(/\s+/);

  // matches any one of the provided rules.
  // usage: cmb.any(rule1, rule2[, rule3...])
  cmb.any = function any() {
    var args = [].slice.call(arguments);
    return function parseAny(s) {
      var rules = args.slice();
      var errors = [];
      while (rules.length > 0) {
        var rule = rules.shift();
        var result = this.evaluate(rule, s);
        if (!result.err) { return result; }
        errors.push(result);
      }
      errors.unshift("could not match any alternate rules");
      return {
        err: errors,
        rest: s
      };
    };
  };

  // matches each of the provided rules in sequence.
  // usage: cmb.all(rule1, rule2[, rule3...])
  cmb.all = function all() {
    var args = [].slice.call(arguments);
    return function parseAll(s) {
      var rules = args.slice();
      var results = [];
      while (rules.length > 0) {
        var rule = rules.shift();
        var result = this.evaluate(rule, s);
        if (result.err) { return result; }
        results.push(result);
        s = result.rest;
      }
      return {
        value: results,
        rest: s
      };
    };
  };

  // matches a rule 0 or more times.
  // usage: cmb.many(rule)
  cmb.many = function many(fn) {
    return function parseMany(s) {
      var results = [];
      var result = this.evaluate(fn, s);
      while (!result.err) {
        results.push(result);
        s = result.rest;
        result = this.evaluate(fn, s);
      }
      return {
        value: results,
        rest: s
      };
    };
  };

  // matches a rule 0 or 1 times.
  // usage: cmb.maybe(rule1)
  cmb.maybe = function maybe(fn) {
    return function parseMaybe(s) {
      var result = this.evaluate(fn, s);
      if (result.err) {
        return {
          value: "",
          rest: s
        };
      }
      return result;
    };
  };

  global.cmb = cmb;
}(this));
