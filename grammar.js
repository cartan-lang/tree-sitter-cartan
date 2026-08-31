/**
 * tree-sitter-cartan — a grammar for cartan documents (`.cart`).
 *
 * **This file is generated.** `cartan grammar` prints it from
 * `crates/cartan/src/grammar.rs`, the one statement of the grammar,
 * which cartan's own parser reads directly; the conformance suite
 * holds this file to the printed one and the two parsers to one
 * tree over the corpus. Edit the Rust, run `cartan grammar >
 * editors/tree-sitter-cartan/grammar.js`, then `tree-sitter generate`.
 *
 * It follows spec §2: an item is a binding, a port, a function,
 * an agent or a use, and every composite expression reads in four
 * zones — `head(constitutive) : config { payload } with control`
 * — in that fixed order and any number of turns.
 *
 * A newline is a token here, and separates wherever a comma does,
 * at every depth. A line continues where it has not finished
 * speaking — after an operator, an opener or a keyword wanting an
 * expression, newlines are allowed — and a line opening with an
 * infix operator continues the line above: such an operator is one
 * token carrying its leading newlines, aliased to the operator, so
 * the longest match at a line end takes it over the separator.
 * `-` is not one, so `[1\n -2\n 3]` keeps its three items. A word
 * operator opening a line — `with`, `but`, `and`, `or` — takes one
 * whitespace character after the word in its token, which is what
 * keeps `without = 2` on a fresh line a binding.
 */

module.exports = grammar({
  name: "cartan",

  extras: ($) => [/[ \t\r]+/, $.comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    [$._expression, $.for_expression],
    [$._expression, $.each_expression],
    [$._expression, $.clause],
    [$._config_atom, $._expression],
    [$.port_path, $.qualified_identifier],
  ],

  rules: {
    // items separated by newlines alone; an item that does not parse becomes an error node to the end of its line, and the next item is read
    source_file: ($) =>
      seq(
        repeat($._newline),
        optional(
          seq(
            $._item_line,
            repeat(seq(repeat1($._newline), $._item_line)),
            repeat($._newline),
          ),
        ),
      ),

    _newline: (_) => /\n/,

    comment: (_) => token(seq("#", /[^\n]*/)),

    _item_line: ($) => $._item,

    _item: ($) =>
      choice(
        $.doc_declaration,
        $.use_declaration,
        $.port_declaration,
        $.fiber_declaration,
        $.agent,
        $.function_definition,
        $.binding,
      ),

    // `"""prose"""` standing alone — a doc string (spec §2.1, §10). It
    // is a declaration rather than a binding: no name, no node in the
    // graph, no part in evaluation. Standing first it is the document's
    // prose; standing above a binding it is that binding's prose. Which
    // one it is is positional, so the lowering decides it — the grammar
    // accepts the literal as an item anywhere.
    doc_declaration: ($) => field("text", $.triple_string),

    use_declaration: ($) =>
      seq(
        "use",
        field("path", $.string),
        optional(seq("as", field("alias", $.identifier))),
      ),

    // `port name = expr` / `state name = expr` — every port holds an
    // initial (axiom A2).
    port_declaration: ($) =>
      seq(
        field("kind", choice("port", "state")),
        field("name", $.identifier),
        "=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `fiber Cons = (D: Real, S: Vector<Real, 2>, tau: Real)` — a
    // product fiber declaration (R:product-fiber): the components in
    // declared order, each a name and a fiber type, inside the named
    // parens the value form already uses. At least one component, and
    // no name twice, which the lowering states.
    fiber_declaration: ($) =>
      seq(
        "fiber",
        field("name", $.identifier),
        "=",
        "(",
        repeat(choice(",", $._newline)),
        optional(
          seq(
            field("component", $.component),
            repeat(
              seq(
                repeat1(choice(",", $._newline)),
                field("component", $.component),
              ),
            ),
            repeat(choice(",", $._newline)),
          ),
        ),
        ")",
      ),

    component: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.fiber_type)),

    // A fiber type: a name with optional `<…>` arguments, types or
    // widths — `Real`, `Vector<Real, 2>`, `Site<3>` — or a product's
    // components stated in the open, which stands wherever an alias
    // does (R:product-fiber).
    fiber_type: ($) =>
      choice(
        seq(
          "(",
          repeat(choice(",", $._newline)),
          optional(
            seq(
              field("component", $.component),
              repeat(
                seq(
                  repeat1(choice(",", $._newline)),
                  field("component", $.component),
                ),
              ),
              repeat(choice(",", $._newline)),
            ),
          ),
          ")",
        ),
        seq(
          field("name", $.identifier),
          optional(
            seq(
              "<",
              repeat(choice(",", $._newline)),
              optional(
                seq(
                  choice($.fiber_type, $.number),
                  repeat(
                    seq(
                      repeat1(choice(",", $._newline)),
                      choice($.fiber_type, $.number),
                    ),
                  ),
                  repeat(choice(",", $._newline)),
                ),
              ),
              ">",
            ),
          ),
        ),
      ),

    binding: ($) =>
      seq(
        field("name", $.identifier),
        "=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `name(params) : { k: default, … } = expr` — a transparent function
    // (A9). The declaration mirrors the call: the Map gives the
    // configuration names and their defaults.
    function_definition: ($) =>
      seq(
        field("name", $.identifier),
        field("parameters", $.parameter_list),
        optional(seq(":", repeat($._newline), field("config", $.map))),
        "=",
        repeat($._newline),
        field("body", $._expression),
      ),

    parameter_list: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        optional(
          seq(
            $.parameter,
            repeat(seq(repeat1(choice(",", $._newline)), $.parameter)),
            repeat(choice(",", $._newline)),
          ),
        ),
        ")",
      ),

    // `xr: Interval`, `at: Real|None`, `color: Color = hex("#56b6c2")` —
    // a parameter states an optional type and an optional default,
    // independently of each other (wishlist item 71). That only a
    // trailing run declares defaults, and that `None` is the one
    // alternative an annotation takes, the lowering states.
    parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
        optional(seq("=", repeat($._newline), field("default", $._expression))),
      ),

    type_annotation: ($) =>
      seq($.fiber_type, optional(seq("|", field("alternative", $.fiber_type)))),

    // `every P (while G)? (: config)* { p <- e, … }` — an agent (spec §5).
    // The brace outranks the payload zone: an `every` header bars a
    // juxtaposed brace, so the brace is the agent's writes and never
    // `P`'s payload (spec §2.3), and the `:` after the header is the
    // agent's configuration, `: { precision: "f64" }`.
    agent: ($) =>
      prec.dynamic(
        1,
        seq(
          "every",
          repeat($._newline),
          field("period", $._expression_1),
          optional(
            seq(
              repeat($._newline),
              "while",
              repeat($._newline),
              field("guard", $._expression_1),
            ),
          ),
          repeat(
            seq(
              alias(token(/(\n[ \t\r]*)*:/), ":"),
              field("config", $._config_atom),
            ),
          ),
          field("body", $.body),
        ),
      ),

    // the expression, in one table: the primary forms, then every
    // operator with its precedence — tightest last
    _expression: ($) =>
      choice(
        $.call_expression,
        $.qualified_identifier,
        $.boolean,
        $.none,
        $.identifier,
        $.number,
        $.triple_string,
        $.string,
        $.list,
        $.product,
        $.site,
        $.parenthesized_expression,
        $.map,
        $.body,
        $.tap_expression,
        $.for_expression,
        $.each_expression,
        $.fold_expression,
        $.conditional_expression,
        $.unary_expression,
        $.range_expression,
        $.binary_expression,
        $.with_expression,
        $.but_expression,
        $.absent_expression,
        $.index_expression,
        $.projection_expression,
        $.config_expression,
        $.payload_expression,
      ),

    conditional_expression: ($) =>
      prec.right(
        0,
        seq(
          "if",
          repeat($._newline),
          field("condition", $._expression),
          repeat($._newline),
          "then",
          repeat($._newline),
          field("consequence", $._expression),
          repeat($._newline),
          "else",
          repeat($._newline),
          field("alternative", $._expression),
        ),
      ),

    // `not`, above the comparisons and below `and`
    // unary `+` — the mirror of `-`, returning a numeric operand unchanged.
    // It takes the binary operator's token: two tokens spelling one text
    // would leave the lexer, not the parser, to choose between them.
    unary_expression: ($) =>
      choice(
        prec(
          4,
          seq(
            field("operator", "not"),
            repeat($._newline),
            field("operand", $._expression),
          ),
        ),
        prec(
          8,
          seq(
            field("operator", "-"),
            repeat($._newline),
            field("operand", $._expression),
          ),
        ),
        prec(
          8,
          seq(
            field("operator", alias(token(/(\n[ \t\r]*)*\+/), "+")),
            repeat($._newline),
            field("operand", $._expression),
          ),
        ),
      ),

    // `a..b` / `a..=b` — the loosest operator there is, Rust's own
    // precedence, so `0..n - 1` reads `0..(n - 1)`. It groups left here,
    // and the lowering refuses `a..b..c`: a range states two endpoints.
    range_expression: ($) =>
      prec.left(
        1,
        seq(
          field("left", $._expression),
          field(
            "operator",
            choice(
              alias(token(/(\n[ \t\r]*)*\.\.=/), "..="),
              alias(token(/(\n[ \t\r]*)*\.\./), ".."),
            ),
          ),
          repeat($._newline),
          field("right", $._expression),
        ),
      ),

    // the comparisons group left here, and the lowering refuses a chain
    // — `a < b < c` is two comparisons and says so
    // `-` carries no leading newlines: a line opening with `-` is a fresh
    // signed item, so `[1\n -2\n 3]` keeps its three items (spec §2.1)
    // `@` is the action operator (R:group-fiber): infix at the
    // multiplicative level, left-associative, so `g @ a @ b` is the scalar
    // and `(R1 * R2) @ v` composes then acts
    binary_expression: ($) =>
      choice(
        prec.left(
          2,
          seq(
            field("left", $._expression),
            field(
              "operator",
              choice("or", alias(token(/(\n[ \t\r]*)+or[ \t\r\n]/), "or")),
            ),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.left(
          3,
          seq(
            field("left", $._expression),
            field(
              "operator",
              choice("and", alias(token(/(\n[ \t\r]*)+and[ \t\r\n]/), "and")),
            ),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.left(
          5,
          seq(
            field("left", $._expression),
            field(
              "operator",
              choice(
                alias(token(/(\n[ \t\r]*)*==/), "=="),
                alias(token(/(\n[ \t\r]*)*!=/), "!="),
                alias(token(/(\n[ \t\r]*)*<=/), "<="),
                alias(token(/(\n[ \t\r]*)*>=/), ">="),
                alias(token(/(\n[ \t\r]*)*</), "<"),
                alias(token(/(\n[ \t\r]*)*>/), ">"),
              ),
            ),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.left(
          6,
          seq(
            field("left", $._expression),
            field("operator", alias(token(/(\n[ \t\r]*)*\+/), "+")),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.left(
          6,
          seq(
            field("left", $._expression),
            field("operator", "-"),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.left(
          7,
          seq(
            field("left", $._expression),
            field(
              "operator",
              choice(
                alias(token(/(\n[ \t\r]*)*\*/), "*"),
                alias(token(/(\n[ \t\r]*)*\//), "/"),
                alias(token(/(\n[ \t\r]*)*@/), "@"),
              ),
            ),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
        prec.right(
          9,
          seq(
            field("left", $._expression),
            field("operator", alias(token(/(\n[ \t\r]*)*\^/), "^")),
            repeat($._newline),
            field("right", $._expression),
          ),
        ),
      ),

    // `view with control` — attachment, chainable, never a child. The
    // control takes the postfix zones of its own — `with scrub(g) : cfg { … }`
    // — and not a further `with`, so the chain stays flat.
    with_expression: ($) =>
      prec.left(
        10,
        seq(
          field("target", $._expression),
          choice("with", alias(token(/(\n[ \t\r]*)+with[ \t\r\n]/), "with")),
          repeat($._newline),
          field("control", $._expression),
        ),
      ),

    // `base but override` — the product-fiber component update
    // (R:product-fit): the value on the left with the components the
    // override names replaced, at `with`'s precedence and grouping left.
    but_expression: ($) =>
      prec.left(
        10,
        seq(
          field("target", $._expression),
          choice("but", alias(token(/(\n[ \t\r]*)+but[ \t\r\n]/), "but")),
          repeat($._newline),
          field("override", $._expression),
        ),
      ),

    // `f(x?, y)` — the argument mark (R:absence-flow): a postfix `?` says
    // the slot it stands on licenses absence. It rides the postfix chain,
    // so a call result marks too — `points(vec(x, y)?)`.
    absent_expression: ($) =>
      prec.left(11, seq(field("value", $._expression), "?")),

    index_expression: ($) =>
      prec.left(
        11,
        seq(field("target", $._expression), field("index", $.subscript)),
      ),

    // `f(x).D`, `U[i].S`, `(a + b).tau` — the projection of a product
    // fiber's component (R:product-fiber), the dot after anything but a
    // bare name: `u.D` and `ns.u.D` on a name are the one dotted run
    // `qualified_identifier` already reads, and the lowering tells a
    // projection from a namespace path by what the head names.
    projection_expression: ($) =>
      prec.left(
        11,
        seq(
          field(
            "target",
            choice(
              $.call_expression,
              $.index_expression,
              $.projection_expression,
              $.absent_expression,
              $.parenthesized_expression,
            ),
          ),
          alias(token(/(\n[ \t\r]*)*\./), "."),
          field("name", $.identifier),
        ),
      ),

    // `e : map` — configuration, ascribed against a registry signature.
    // It chains, and a later key wins (R:config-chains). A link of the chain
    // takes a dynamic precedence, so `e : a : b[i]` is two links with `b[i]`
    // the second atom rather than one link whose atom is `(a : b)[i]`.
    config_expression: ($) =>
      choice(
        prec.dynamic(
          1,
          prec.left(
            11,
            seq(
              field("target", choice($.config_expression)),
              alias(token(/(\n[ \t\r]*)*:/), ":"),
              field("config", $._config_atom),
            ),
          ),
        ),
        prec.left(
          11,
          seq(
            field("target", $._expression),
            alias(token(/(\n[ \t\r]*)*:/), ":"),
            field("config", $._config_atom),
          ),
        ),
      ),

    // `head(…) { items }` — call sugar for a trailing List argument; a
    // brace whose first item is a `path <-` write is the writes a control
    // head takes, which the lowering decides (spec §2.3)
    payload_expression: ($) =>
      prec.left(11, seq(field("target", $._expression), field("body", $.body))),

    // `_expression` without `payload_expression` and `config_expression` and `call_refusal`:
    // the rule a reference through `without` in the grammar's source
    // reads — a loop header's expression, whose brace and colon belong
    // to the header. Every node is aliased to its name in `_expression`, so
    // the tree is the same tree; the precedences are lifted to
    // `2p + 1` so the header's reading wins wherever the two could
    // take the same text.
    _expression_1: ($) =>
      prec(
        1,
        choice(
          $.call_expression,
          $.qualified_identifier,
          $.boolean,
          $.none,
          $.identifier,
          $.number,
          $.triple_string,
          $.string,
          $.list,
          $.product,
          $.site,
          $.parenthesized_expression,
          $.map,
          $.body,
          $.tap_expression,
          $.for_expression,
          $.each_expression,
          $.fold_expression,
          alias($.conditional_expression_1, $.conditional_expression),
          alias($.unary_expression_1, $.unary_expression),
          alias($.range_expression_1, $.range_expression),
          alias($.binary_expression_1, $.binary_expression),
          alias($.with_expression_1, $.with_expression),
          alias($.but_expression_1, $.but_expression),
          alias($.absent_expression_1, $.absent_expression),
          alias($.index_expression_1, $.index_expression),
          alias($.projection_expression_1, $.projection_expression),
        ),
      ),

    conditional_expression_1: ($) =>
      prec.right(
        1,
        seq(
          "if",
          repeat($._newline),
          field("condition", $._expression_1),
          repeat($._newline),
          "then",
          repeat($._newline),
          field("consequence", $._expression_1),
          repeat($._newline),
          "else",
          repeat($._newline),
          field("alternative", $._expression_1),
        ),
      ),

    unary_expression_1: ($) =>
      choice(
        prec(
          9,
          seq(
            field("operator", "not"),
            repeat($._newline),
            field("operand", $._expression_1),
          ),
        ),
        prec(
          17,
          seq(
            field("operator", "-"),
            repeat($._newline),
            field("operand", $._expression_1),
          ),
        ),
        prec(
          17,
          seq(
            field("operator", alias(token(/(\n[ \t\r]*)*\+/), "+")),
            repeat($._newline),
            field("operand", $._expression_1),
          ),
        ),
      ),

    range_expression_1: ($) =>
      prec.left(
        3,
        seq(
          field("left", $._expression_1),
          field(
            "operator",
            choice(
              alias(token(/(\n[ \t\r]*)*\.\.=/), "..="),
              alias(token(/(\n[ \t\r]*)*\.\./), ".."),
            ),
          ),
          repeat($._newline),
          field("right", $._expression_1),
        ),
      ),

    binary_expression_1: ($) =>
      choice(
        prec.left(
          5,
          seq(
            field("left", $._expression_1),
            field(
              "operator",
              choice("or", alias(token(/(\n[ \t\r]*)+or[ \t\r\n]/), "or")),
            ),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.left(
          7,
          seq(
            field("left", $._expression_1),
            field(
              "operator",
              choice("and", alias(token(/(\n[ \t\r]*)+and[ \t\r\n]/), "and")),
            ),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.left(
          11,
          seq(
            field("left", $._expression_1),
            field(
              "operator",
              choice(
                alias(token(/(\n[ \t\r]*)*==/), "=="),
                alias(token(/(\n[ \t\r]*)*!=/), "!="),
                alias(token(/(\n[ \t\r]*)*<=/), "<="),
                alias(token(/(\n[ \t\r]*)*>=/), ">="),
                alias(token(/(\n[ \t\r]*)*</), "<"),
                alias(token(/(\n[ \t\r]*)*>/), ">"),
              ),
            ),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.left(
          13,
          seq(
            field("left", $._expression_1),
            field("operator", alias(token(/(\n[ \t\r]*)*\+/), "+")),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.left(
          13,
          seq(
            field("left", $._expression_1),
            field("operator", "-"),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.left(
          15,
          seq(
            field("left", $._expression_1),
            field(
              "operator",
              choice(
                alias(token(/(\n[ \t\r]*)*\*/), "*"),
                alias(token(/(\n[ \t\r]*)*\//), "/"),
                alias(token(/(\n[ \t\r]*)*@/), "@"),
              ),
            ),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
        prec.right(
          19,
          seq(
            field("left", $._expression_1),
            field("operator", alias(token(/(\n[ \t\r]*)*\^/), "^")),
            repeat($._newline),
            field("right", $._expression_1),
          ),
        ),
      ),

    with_expression_1: ($) =>
      prec.left(
        21,
        seq(
          field("target", $._expression_1),
          choice("with", alias(token(/(\n[ \t\r]*)+with[ \t\r\n]/), "with")),
          repeat($._newline),
          field("control", $._expression_1),
        ),
      ),

    but_expression_1: ($) =>
      prec.left(
        21,
        seq(
          field("target", $._expression_1),
          choice("but", alias(token(/(\n[ \t\r]*)+but[ \t\r\n]/), "but")),
          repeat($._newline),
          field("override", $._expression_1),
        ),
      ),

    absent_expression_1: ($) =>
      prec.left(23, seq(field("value", $._expression_1), "?")),

    index_expression_1: ($) =>
      prec.left(
        23,
        seq(field("target", $._expression_1), field("index", $.subscript)),
      ),

    projection_expression_1: ($) =>
      prec.left(
        23,
        seq(
          field(
            "target",
            choice(
              $.call_expression,
              alias($.index_expression_1, $.index_expression),
              alias($.projection_expression_1, $.projection_expression),
              alias($.absent_expression_1, $.absent_expression),
              $.parenthesized_expression,
            ),
          ),
          alias(token(/(\n[ \t\r]*)*\./), "."),
          field("name", $.identifier),
        ),
      ),

    // only named functions can be called, and a used document's name is
    // reached through its namespace (spec §10). Primes ride the head —
    // `f'(x)`, the univariate derivative at the prime count's order
    // (R:diff-roster) — and a primed head is a call, so the parens
    // follow it. The precedence is what makes `f (n)` a call where
    // a name and a paren could also be a header's collection and a
    // bare body, or a configuration atom and what follows it.
    call_expression: ($) =>
      prec(
        2,
        choice(
          seq(
            field("function", choice($.qualified_identifier, $.identifier)),
            field("primes", $.primes),
            field("arguments", $.argument_list),
          ),
          seq(
            field("function", choice($.qualified_identifier, $.identifier)),
            field("arguments", $.argument_list),
          ),
        ),
      ),

    primes: (_) => token.immediate(/'+/),

    // the constitutive zone is positional; configuration rides after
    // ':'. A slot may open with a run of `:` marks — the call-site
    // derivative's slot, its colon count the order (R:diff-roster);
    // the dynamic precedence keeps `f(a : style)` an ascription on `a`
    // rather than `a` beside a marked second slot. A name inside the
    // parens is a configuration key in the wrong zone, and says so
    // (R:positional-parens).
    argument_list: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        optional(
          seq(
            choice(
              prec.dynamic(-1, seq(field("mark", $.mark), $._expression)),
              $._expression,
            ),
            repeat(
              seq(
                repeat1(choice(",", $._newline)),
                choice(
                  prec.dynamic(-1, seq(field("mark", $.mark), $._expression)),
                  $._expression,
                ),
              ),
            ),
            repeat(choice(",", $._newline)),
          ),
        ),
        ")",
      ),

    mark: (_) => /:+/,

    // immediate `[`: `wave[i]` indexes, and a `[` after a space or on a
    // fresh line opens a row. Axis selectors are comma-separated.
    subscript: ($) =>
      seq(
        token.immediate("["),
        repeat($._newline),
        $.selector,
        repeat(seq(repeat($._newline), ",", repeat($._newline), $.selector)),
        repeat($._newline),
        "]",
      ),

    // One axis selector (R:located-field): an ordinary expression — an
    // Int global coordinate, a range restriction, a `rel` mark — or an
    // open-ended range form, admitted in subscript position alone,
    // where the target's own box bounds the missing end: `a[4..]`,
    // `a[..10]`, `a[..=10]`, `a[..]`. `..=` with no end has nothing to
    // reach, which the lowering says.
    selector: ($) =>
      choice(
        seq(
          field(
            "operator",
            choice(
              alias(token(/(\n[ \t\r]*)*\.\.=/), "..="),
              alias(token(/(\n[ \t\r]*)*\.\./), ".."),
            ),
          ),
          optional(field("end", $._expression)),
        ),
        seq(
          field("start", $._expression),
          field(
            "operator",
            choice(
              alias(token(/(\n[ \t\r]*)*\.\.=/), "..="),
              alias(token(/(\n[ \t\r]*)*\.\./), ".."),
            ),
          ),
        ),
        $._expression,
      ),

    // a name, and what a name reaches: an index picks a style out of a
    // list of them and a call asks a function for one (R:config-map).
    // The chain stops before a brace, which belongs to the head, and
    // the call and the index bind to the atom rather than to the
    // ascription that holds it: `el : styles[i]` picks a style, where
    // `(el : styles)[i]` would index a dressed element.
    _config_atom: ($) =>
      choice(
        $.map,
        prec.dynamic(1, $.index_expression),
        prec.dynamic(1, $.call_expression),
        $.qualified_identifier,
        $.identifier,
        $.parenthesized_expression,
      ),

    // `fold u := u0 for x in seq while G : { max_iter } { body }` and
    // `reduce s := s0 …` — the bounded recurrence and the header that
    // answers its destination (R:fold-header, R:reduce-header). One rule,
    // because it is one header: the keyword is the whole of the
    // difference. The dynamic precedence gives the brace to the body,
    // exactly as the agent's header keeps its writes.
    fold_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          field("keyword", choice("fold", "reduce")),
          repeat($._newline),
          field("accumulator", $.identifier),
          ":=",
          repeat($._newline),
          field("seed", $._expression_1),
          optional(
            seq(
              repeat($._newline),
              "for",
              repeat($._newline),
              field("element", $.identifier),
              "in",
              repeat($._newline),
              field("driver", $._expression_1),
            ),
          ),
          optional(
            seq(
              repeat($._newline),
              "while",
              repeat($._newline),
              field("guard", $._expression_1),
            ),
          ),
          repeat(
            seq(
              alias(token(/(\n[ \t\r]*)*:/), ":"),
              field("config", $._config_atom),
            ),
          ),
          field("body", $.body),
        ),
      ),

    // `for (i, j) in space { body }` and `for I in space body` — the
    // comprehension, the header family's third member (R:located-field,
    // R:site-value). The braced body has the higher dynamic precedence,
    // which is how the grammar states the loop-header zone rule: a
    // brace after the space is the comprehension's body, never a
    // payload on the space. The brace is optional, as it is on a
    // function definition — a bare body may not open with `(`, `[` or
    // an operator, since juxtaposition is whitespace-insensitive here
    // and the space would take them.
    for_expression: ($) =>
      seq(
        "for",
        repeat($._newline),
        field("binders", $.binder_list),
        "in",
        repeat($._newline),
        field("space", $._expression_1),
        choice(
          prec.dynamic(2, field("body", $.body)),
          prec.dynamic(1, field("body", $._expression)),
        ),
      ),

    // `each x in xs { body }` and `each x in xs body` — the List
    // comprehension, `for`'s sibling (R:comprehension-kinds): it walks a
    // List or a 1-D range/box and builds a `List` of the body's results
    // where `for` builds a located field. The header shape is `for`'s
    // clause for clause.
    each_expression: ($) =>
      seq(
        "each",
        repeat($._newline),
        field("binders", $.binder_list),
        "in",
        repeat($._newline),
        field("collection", $._expression_1),
        choice(
          prec.dynamic(2, field("body", $.body)),
          prec.dynamic(1, field("body", $._expression)),
        ),
      ),

    // the punctuation means one thing in both positions: a bare name
    // binds the collection's element whole (R:site-value), a
    // parenthesized comma tuple is a site and destructures that element
    // — one binder per axis — and brackets are a list of things, here
    // one binder per collection of the lockstep walk
    // (R:lockstep-brackets). That the bracket walks at least two
    // collections, the lowering states.
    binder_list: ($) =>
      choice(
        $.identifier,
        seq("(", $.identifier, repeat(seq(",", $.identifier)), ")"),
        seq("[", $._lockstep_binder, repeat(seq(",", $._lockstep_binder)), "]"),
      ),

    _lockstep_binder: ($) => $.identifier,

    // parens with commas build a site (R:site-value, the literal): one
    // expression inside is grouping, and two or more are the
    // coordinates of a position in ℤ^k. A name before the parens is
    // still a call, by the postfix precedence that already decides
    // `f (n)`. Newline separates as comma does, as in every bracketed
    // run.
    site: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $._expression,
        repeat1(seq(repeat1(choice(",", $._newline)), $._expression)),
        repeat(choice(",", $._newline)),
        ")",
      ),

    // `(D: 1.0, S: vec(0.3, 0.4), tau: 2.5)` — a product fiber's value
    // stated component by component (R:product-fiber), and the override
    // a `but` takes (R:product-fit), one component included. A component
    // name and its colon tell it from the site literal and from grouping
    // parens, both of which hold bare expressions.
    product: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $.product_component,
        repeat(seq(repeat1(choice(",", $._newline)), $.product_component)),
        repeat(choice(",", $._newline)),
        ")",
      ),

    // the component wins over reading the name as an expression with a
    // configuration after it (R:product-fiber)
    product_component: ($) =>
      prec(
        12,
        seq(
          field("name", $.identifier),
          ":",
          repeat($._newline),
          field("value", $._expression),
        ),
      ),

    // `(3,)` refuses: a comma inside parens builds a site, and the literal
    // names two coordinates at least (R:index-table)
    parenthesized_expression: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $._expression,
        repeat(choice(",", $._newline)),
        ")",
      ),

    list: ($) =>
      seq(
        "[",
        repeat(choice(",", $._newline)),
        optional(
          seq(
            $._expression,
            repeat(seq(repeat1(choice(",", $._newline)), $._expression)),
            repeat(choice(",", $._newline)),
          ),
        ),
        "]",
      ),

    // `tap (g)? (: config)* { p <- e, … }` — the gesture-triggered writes,
    // which are the whole of the control. The config zone stands between
    // the head and its writes, as it does on a `fold`. The optional
    // binder is the form the rest of the control roster takes
    // (R:control-primitives): `g` is bound to the gesture, and the body
    // reads it by dot. `scrub(g)`, `hover(g)` and `wheel(g)` reach the
    // same reading through `call_expression` under a juxtaposed writes
    // brace, since those heads are ordinary names where `tap` is a
    // keyword.
    tap_expression: ($) =>
      seq(
        "tap",
        optional(seq("(", field("binder", $.identifier), ")")),
        repeat(
          seq(
            alias(token(/(\n[ \t\r]*)*:/), ":"),
            field("config", $._config_atom),
          ),
        ),
        field("body", $.body),
      ),

    // `{ k: v, … }` — a Map literal: keys static, values live. An empty
    // brace is an empty Map, which the precedence over `body` states.
    map: ($) =>
      prec(
        1,
        seq(
          "{",
          repeat(choice(",", $._newline)),
          optional(
            seq(
              $.map_entry,
              repeat(seq(repeat1(choice(",", $._newline)), $.map_entry)),
              repeat(choice(",", $._newline)),
            ),
          ),
          "}",
        ),
      ),

    map_entry: ($) =>
      seq(
        field("key", $.identifier),
        ":",
        repeat($._newline),
        field("value", $._expression),
      ),

    // One brace rule for three jobs, self-describing by its items: `:=`
    // locals and bare expressions make a payload or a body, `<-` writes
    // make the writes an `every`, a `tap` or a `key(name)` head takes.
    // (The node's name follows `ast::Body`, the crates' word for the
    // general brace.) A durable local refuses here, on A7's ground: a
    // body's line stands for many instances, and a durable write
    // rewrites one declaring line (R:instance-state).
    body: ($) =>
      seq(
        "{",
        repeat(choice(",", $._newline)),
        optional(
          seq(
            choice($.local, $.state_local, $.write, $.clause, $._expression),
            repeat(
              seq(
                repeat1(choice(",", $._newline)),
                choice($.local, $.state_local, $.write, $.clause, $._expression),
              ),
            ),
            repeat(choice(",", $._newline)),
          ),
        ),
        "}",
      ),

    // `in <box> { … }` and `in <box> value` — one piece of a clause
    // comprehension (R:clause-comprehension). It is a body item, and
    // the parser holds it to a brace directly under a `for` header;
    // the box is read in the header's own zone rule, so the brace
    // after it is the clause's body rather than a payload on the box.
    // The body is braced or bare under the rule the header's body
    // takes, and `in` opens the next clause.
    clause: ($) =>
      seq(
        "in",
        repeat($._newline),
        field("space", $._expression_1),
        choice(
          prec.dynamic(2, field("body", $.body)),
          prec.dynamic(1, field("body", $._expression)),
        ),
      ),

    local: ($) =>
      seq(
        field("name", $.identifier),
        ":=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `state name := init` — a local transient port, declared inside a
    // block or a function body (R:instance-state, spec §3).
    state_local: ($) =>
      seq(
        "state",
        field("name", $.identifier),
        ":=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `p <- e` — this port takes that expression's value, one batch
    write: ($) =>
      seq(
        field("target", $.port_path),
        "<-",
        repeat($._newline),
        field("value", $._expression),
      ),

    // the dot is the projection's token, so `{ a.b }` lexes one way for
    // a write's target and for a namespaced name alike
    port_path: ($) =>
      seq(
        $.identifier,
        repeat(seq(alias(token(/(\n[ \t\r]*)*\./), "."), $.identifier)),
      ),

    // `fig.panel` — one qualified identifier reaching into a used
    // document's namespace (spec §10), or `u.D`, the projection of a
    // product's component off a bare name (R:product-fiber): the
    // lowering joins the segments into one name, and elaboration reads
    // it by what the head names.
    qualified_identifier: ($) =>
      seq(
        field("namespace", $.identifier),
        repeat1(
          seq(alias(token(/(\n[ \t\r]*)*\./), "."), field("name", $.identifier)),
        ),
      ),

    identifier: (_) => /[_A-Za-z][_A-Za-z0-9]*/,

    // the fractional part takes at least one digit, so the dots of
    // `0..10` belong to the range and not to the number; `1.0` is the
    // spelling of one as a Real, and `1.` is not a literal
    number: (_) =>
      token(
        seq(
          /[0-9][_0-9]*/,
          optional(/\.[0-9][_0-9]*/),
          optional(/[eE][+\-]?[0-9]+/),
        ),
      ),

    string: (_) => token(seq("\"", repeat(choice(/[^"\\\n]/, /\\./)), "\"")),

    // `"""…"""` — the multi-line literal (spec §2.1). Three quotes win
    // over two by the lexer's longest match, so `""` keeps its meaning.
    // The contents are raw, and the content token states exactly the
    // scan: everything up to the first `"""`. Its own node carries the
    // prose, which is what `injections.scm` renders as markdown.
    triple_string: ($) =>
      seq(
        "\"\"\"",
        optional(field("text", $.triple_string_content)),
        token.immediate("\"\"\""),
      ),

    triple_string_content: (_) => token.immediate(/(([^"]|"[^"]|""[^"]))+/),

    boolean: (_) => choice("true", "false"),

    // `none` — the None unit kind's sole value (R:absence-value): the
    // literal a hover writes at the pointer's leaving, and the one a
    // durable absent port carries in its text.
    none: (_) => "none",
  },
});
