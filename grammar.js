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
    [$._expression, $._pattern],
    [$._expression, $.component_key],
    [$.fiber_type, $._pattern],
    [$.fiber_type, $._expression],
    [$.fiber_type, $._expression, $._pattern],
    [$.component, $.variant],
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
        $.pattern_binding,
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
    // initial (axiom A2). A port states an optional fiber after `:`,
    // `port x: Vector<Real, 2>|None = vec(0, 0)`, and the initial is
    // held to it (R:stated-fiber).
    port_declaration: ($) =>
      seq(
        field("kind", choice("port", "state")),
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
        "=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `fiber Cons = (D: Real, S: Vector<Real, 2>, tau: Real)` and
    // `fiber Shape = (A: Real | B: Vector<Real, 3>)` — a fiber
    // declaration: a product's components separated by `,`
    // (R:product-fiber) or a sum's variants separated by `|`
    // (R:sum-fiber), each a name and a fiber type, inside the named
    // parens the value form already uses. A product states at least
    // one component and a sum at least two variants, and no name
    // twice, which the lowering states.
    fiber_declaration: ($) =>
      seq(
        "fiber",
        field("name", $.identifier),
        "=",
        choice(
          seq(
            "(",
            field("variant", $.variant),
            repeat1(
              seq(
                repeat($._newline),
                "|",
                repeat($._newline),
                field("variant", $.variant),
              ),
            ),
            ")",
          ),
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
        ),
      ),

    component: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.fiber_type)),

    // `A: Real` — one variant of a sum fiber (R:sum-fiber): its name
    // and the fiber its payload takes. Every variant states a
    // payload.
    variant: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.fiber_type)),

    // A fiber type: a name with optional `<…>` arguments, types or
    // widths — `Real`, `Vector<Real, 2>`, `Site<3>` — or a product's
    // components or a sum's variants stated in the open, either of
    // which stands wherever an alias does (R:product-fiber,
    // R:sum-fiber). The lookahead before the components is the
    // interpreter's alone, as `described_head`'s is: a `component`
    // states its own sentence for a missing `:`, and the parenthesized
    // description is one of three readings of a paren, so the sentence
    // waits until the colon says the reading is this one.
    fiber_type: ($) =>
      choice(
        seq(
          "(",
          field("variant", $.variant),
          repeat1(
            seq(
              repeat($._newline),
              "|",
              repeat($._newline),
              field("variant", $.variant),
            ),
          ),
          ")",
        ),
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

    // `name = expr`, and `name: Real = expr` where the binding states
    // the fiber its value takes (R:stated-fiber).
    binding: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
        "=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `(D: D) = U` and `(i, j) = s` — a top-level pattern item
    // (spec §4, §2.10): each name the pattern binds is a document name
    // holding that component, and a field of products binds its
    // component fields. The parenthesized patterns open where no other
    // item does. The constructor form `Cons(D, S, tau) = U` is written
    // the way a function definition is, and elaboration tells the two
    // apart by what the head names.
    pattern_binding: ($) =>
      seq(
        field("pattern", choice($.named_pattern, $.site_pattern)),
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

    // `xr: Interval`, `at: Real|None`, `color: Color = hex("#56b6c2")`,
    // `Cons(d, s, _)` — a parameter binds a pattern and states an
    // optional type and an optional default, independently of each
    // other (wishlist item 71). The annotation and the default stand on
    // the whole slot. That only a trailing run declares defaults, that a
    // default stands on a bare name, and that `None` is the one
    // alternative an annotation takes, the lowering states.
    parameter: ($) =>
      seq(
        field("name", $._pattern),
        optional(seq(":", field("type", $.type_annotation))),
        optional(seq("=", repeat($._newline), field("default", $._expression))),
      ),

    type_annotation: ($) =>
      seq($.fiber_type, optional(seq("|", field("alternative", $.fiber_type)))),

    // `every P (while G)? (: config)* { p <- e, … }` and
    // `while G (: config)* { p <- e, … }` — an agent in its four
    // forms (spec §5): paced and unguarded, paced and guarded,
    // free-running and guarded, and `while true`, free-running and
    // unguarded. The brace outranks the payload zone: an agent
    // header bars a juxtaposed brace, so the brace is the agent's
    // writes and never `P`'s or `G`'s payload (spec §2.3), and the
    // `:` after the header is the agent's configuration,
    // `: { precision: "f64" }`.
    agent: ($) =>
      prec.dynamic(
        1,
        choice(
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
          seq(
            "while",
            repeat($._newline),
            field("guard", $._expression_1),
            repeat(
              seq(
                alias(token(/(\n[ \t\r]*)*:/), ":"),
                field("config", $._config_atom),
              ),
            ),
            field("body", $.body),
          ),
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
        $.match_expression,
        $.conditional_expression,
        $.unary_expression,
        $.range_expression,
        $.binary_expression,
        $.with_expression,
        $.but_expression,
        $.absent_expression,
        $.index_expression,
        $.component_expression,
        $.config_expression,
        $.payload_expression,
      ),

    // `if c then a else b` — `then` is required and the `else`
    // clause is optional, the two alternatives standing here in that
    // order. `else` is a continuation word (spec §2.1), so it may
    // open a line of its own, and a next line beginning with any
    // other word closes the conditional at its consequence.
    // `if c then a` — the lowering supplies `none` for the
    // alternative (spec §2.3). Reading the clause above first is
    // what binds the `else` of `if a then if b then x else y` to
    // the inner `if`.
    conditional_expression: ($) =>
      choice(
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
            choice("else", alias(token(/(\n[ \t\r]*)+else[ \t\r\n]/), "else")),
            repeat($._newline),
            field("alternative", $._expression),
          ),
        ),
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
          ),
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
      prec.left(12, seq(field("value", $._expression), "?")),

    index_expression: ($) =>
      prec.left(
        12,
        seq(field("target", $._expression), field("index", $.subscript)),
      ),

    // `S of u`, `0 of v`, `a of c`, `(i, j) of m` — the component read
    // (spec §2.10, R:component-key). It stands above every arithmetic and
    // comparison operator and above unary minus, so `0 of v + 1` adds one
    // to the component and `-0 of v` negates it, and its operand is a
    // postfix-level expression, so `0 of f(x)` and `0 of v[s]` read as
    // written. It groups right, so `0 of S of u` reads the product's
    // component and then that value's.
    component_expression: ($) =>
      prec.right(
        11,
        seq(
          field("key", $.component_key),
          "of",
          repeat($._newline),
          field("value", $._expression),
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
            12,
            seq(
              field("target", choice($.config_expression)),
              alias(token(/(\n[ \t\r]*)*:/), ":"),
              field("config", $._config_atom),
            ),
          ),
        ),
        prec.left(
          12,
          seq(
            field("target", $._expression),
            alias(token(/(\n[ \t\r]*)*:/), ":"),
            field("config", $._config_atom),
          ),
        ),
      ),

    // `head(…) { items }` — call sugar for a trailing List argument; a
    // brace whose first item is a `port <-` write is the writes a control
    // head takes, which the lowering decides (spec §2.3)
    payload_expression: ($) =>
      prec.left(12, seq(field("target", $._expression), field("body", $.body))),

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
          $.match_expression,
          alias($.conditional_expression_1, $.conditional_expression),
          alias($.unary_expression_1, $.unary_expression),
          alias($.range_expression_1, $.range_expression),
          alias($.binary_expression_1, $.binary_expression),
          alias($.with_expression_1, $.with_expression),
          alias($.but_expression_1, $.but_expression),
          alias($.absent_expression_1, $.absent_expression),
          alias($.index_expression_1, $.index_expression),
          alias($.component_expression_1, $.component_expression),
        ),
      ),

    conditional_expression_1: ($) =>
      choice(
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
            choice("else", alias(token(/(\n[ \t\r]*)+else[ \t\r\n]/), "else")),
            repeat($._newline),
            field("alternative", $._expression_1),
          ),
        ),
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
          ),
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
      prec.left(25, seq(field("value", $._expression_1), "?")),

    index_expression_1: ($) =>
      prec.left(
        25,
        seq(field("target", $._expression_1), field("index", $.subscript)),
      ),

    component_expression_1: ($) =>
      prec.right(
        23,
        seq(
          field("key", $.component_key),
          "of",
          repeat($._newline),
          field("value", $._expression_1),
        ),
      ),

    // only named functions can be called, and a used document's name is
    // reached through its namespace (spec §10). Primes ride the head —
    // `f'(x)`, the univariate derivative at the prime count's order
    // (R:diff-roster) — and a primed head is a call, so the parens
    // follow it. The precedence is what makes `f (n)` a call where
    // a name and a paren could also be a header's collection and a
    // bare body, or a configuration atom and what follows it. A
    // parenthesized fiber description heads a call too,
    // `(D: Real, E: Real)(1, 0)`, which is the anonymous spelling of a
    // declared product's constructor (R:product-fiber, R:stated-fiber):
    // in head position the parens can hold nothing else, since neither
    // a product value nor a site literal takes arguments.
    call_expression: ($) =>
      prec(
        2,
        choice(
          prec.dynamic(
            3,
            seq(
              field("function", choice($.qualified_identifier, $.identifier)),
              field("variants", $.variant_arguments),
            ),
          ),
          prec.dynamic(
            3,
            seq(
              field("described", $.described_head),
              field("variants", $.variant_arguments),
            ),
          ),
          seq(
            field("function", choice($.qualified_identifier, $.identifier)),
            field("primes", $.primes),
            field("arguments", $.argument_list),
          ),
          seq(
            field("function", choice($.qualified_identifier, $.identifier)),
            field("arguments", $.argument_list),
          ),
          prec.dynamic(
            2,
            seq(
              field("described", $.described_head),
              field("arguments", $.argument_list),
            ),
          ),
        ),
      ),

    // `(D: Real, E: Real)` standing where a constructor's name stands —
    // in `(D: Real, E: Real)(1, 0)` and in the pattern
    // `(D: Real, E: Real)(D, E) := u`. It is the description R:product-fiber
    // rules names one fiber with its alias, written where no `fiber`
    // item declares one, and each component states the fiber that
    // component takes (R:stated-fiber). The lookahead is the
    // interpreter's alone — a `component` states its own sentence for a
    // missing `:`, and that sentence belongs to the declaration rather
    // than to a paren the parser is still choosing between three
    // readings of; tree-sitter, which is GLR, prints without it. A
    // sum's variants stand here too, `(A: Real | B: Real)(A: 1.0)`
    // (R:sum-fiber).
    described_head: ($) =>
      choice(
        seq(
          "(",
          field("variant", $.variant),
          repeat1(
            seq(
              repeat($._newline),
              "|",
              repeat($._newline),
              field("variant", $.variant),
            ),
          ),
          ")",
        ),
        seq(
          "(",
          repeat(choice(",", $._newline)),
          field("component", $.component),
          repeat(
            seq(
              repeat1(choice(",", $._newline)),
              field("component", $.component),
            ),
          ),
          repeat(choice(",", $._newline)),
          ")",
        ),
      ),

    // `(A: 1.0)` — the argument a sum fiber's constructor takes
    // (R:sum-fiber): the variant it names and the payload it holds.
    // The rule takes a run of them so that a call naming none or
    // several is refused at elaboration, against the roster the
    // declaration states, rather than by the parser.
    variant_arguments: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $.variant_argument,
        repeat(seq(repeat1(choice(",", $._newline)), $.variant_argument)),
        repeat(choice(",", $._newline)),
        ")",
      ),

    variant_argument: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        repeat($._newline),
        field("value", $._expression),
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

    // `match s { A(x) then x  B(v) then norm(v) }` — the sum fiber's
    // reader (R:sum-fiber), the header family's fourth member beside
    // `if` and `for`. The scrutinee stands in the header's own zone,
    // so the brace after it holds the arms rather than a payload on
    // the scrutinee, and the arms separate as body items do, one per
    // line or by commas. A trailing `else` arm stands where no
    // variant's arm did; that every variant has an arm or an `else`
    // stands, elaboration states against the declared roster.
    match_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          "match",
          repeat($._newline),
          field("scrutinee", $._expression_1),
          "{",
          repeat(choice(",", $._newline)),
          optional(
            seq(
              choice($.match_arm, $.else_arm),
              repeat(
                seq(
                  repeat1(choice(",", $._newline)),
                  choice($.match_arm, $.else_arm),
                ),
              ),
              repeat(choice(",", $._newline)),
            ),
          ),
          "}",
        ),
      ),

    // `A(x) then x` and `B(X: x, Y: y) then x + y` — one arm of a
    // `match` (R:sum-fiber, spec §2.10): the variant's name, one
    // sub-pattern for its payload, `then`, and the expression the arm
    // takes. Since a variant holds exactly one payload, the parens may
    // hold the items of the payload's named-parens pattern directly,
    // `B(X: x, Y: y)` standing for `B((X: x, Y: y))`; the colons tell
    // that spelling from the positional one, and both are admitted.
    match_arm: ($) =>
      seq(
        field("variant", $.identifier),
        "(",
        choice(
          seq(
            repeat(choice(",", $._newline)),
            $.named_sub_pattern,
            repeat(seq(repeat1(choice(",", $._newline)), $.named_sub_pattern)),
            repeat(choice(",", $._newline)),
          ),
          field("pattern", $._pattern),
        ),
        ")",
        "then",
        repeat($._newline),
        field("body", $._expression),
      ),

    // `else e` — the arm a `match` takes where no variant's arm stood
    // (R:sum-fiber). One of these stands in place of the arms the
    // roster is missing.
    else_arm: ($) =>
      seq("else", repeat($._newline), field("body", $._expression)),

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

    // the punctuation means one thing in both positions: one pattern
    // binds the collection's element (R:site-value) — a name takes it
    // whole, a parenthesized comma tuple is a site and destructures it
    // one sub-pattern per axis, a constructor pattern reads its
    // components — and brackets are a list of things, here one pattern
    // per collection of the lockstep walk (R:lockstep-brackets). That
    // the bracket walks at least two collections, the lowering states.
    binder_list: ($) =>
      choice(
        seq(
          "[",
          $._lockstep_binder,
          repeat(
            seq(repeat($._newline), ",", repeat($._newline), $._lockstep_binder),
          ),
          "]",
        ),
        $._pattern,
      ),

    _lockstep_binder: ($) => $._pattern,

    // A pattern — what stands wherever a name is bound (spec §2.10): a
    // local, a `for` binder, a parameter, a control binder and a
    // top-level item. A name binds the value whole, `_` binds nothing,
    // `(i, j)` is the site tuple, `Cons(d, s, tau)` reads a declared
    // product's components in the declared order, and `(at: p)` reads
    // components by name (R:product-fiber). Every sub-pattern position
    // takes any pattern, so the form nests. The three parenthesized
    // forms begin the way an expression does, and the token after the
    // first name decides between them.
    _pattern: ($) =>
      choice(
        $.constructor_pattern,
        $.named_pattern,
        $.site_pattern,
        $.identifier,
      ),

    // `Cons(d, vec(sx, sy), _)` — the components of `vec` or of a
    // declared product fiber, positional in the declared order, one
    // sub-pattern each. It mirrors the constructor literal
    // (R:product-fiber), and the arity is checked against the
    // declaration at elaboration. A fiber description heads it too,
    // `(D: Real, E: Real)(D, E) := u`, which states the fiber the
    // value takes and reads its components (R:stated-fiber).
    constructor_pattern: ($) =>
      choice(
        seq(
          field("head", $.identifier),
          "(",
          repeat(choice(",", $._newline)),
          $._pattern,
          repeat(seq(repeat1(choice(",", $._newline)), $._pattern)),
          repeat(choice(",", $._newline)),
          ")",
        ),
        prec.dynamic(
          2,
          seq(
            field("described", $.described_head),
            "(",
            repeat(choice(",", $._newline)),
            $._pattern,
            repeat(seq(repeat1(choice(",", $._newline)), $._pattern)),
            repeat(choice(",", $._newline)),
            ")",
          ),
        ),
      ),

    // `(at: p, grab: q)`, `(0: x, 2: z)` — components by key, any subset
    // in any order. It mirrors the value form a readout writes for an
    // unnamed product (R:product-fiber), it is the form the gesture
    // products take, and an integer key reads a `vec`, a site or a
    // `Complex` by position (R:component-key).
    named_pattern: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $.named_sub_pattern,
        repeat(seq(repeat1(choice(",", $._newline)), $.named_sub_pattern)),
        repeat(choice(",", $._newline)),
        ")",
      ),

    named_sub_pattern: ($) =>
      seq(
        field("name", choice($.identifier, $.number)),
        ":",
        repeat($._newline),
        field("pattern", $._pattern),
      ),

    // `(i, j)` — a site tuple, one sub-pattern per axis
    // (R:site-value). A rank-1 box destructures into one axis, so
    // `(i)` states the one-wide tuple where the site literal `(3)` is
    // grouping: parens hold a pattern where they hold no expression.
    site_pattern: ($) =>
      seq(
        "(",
        $._pattern,
        repeat(seq(repeat($._newline), ",", repeat($._newline), $._pattern)),
        ")",
      ),

    // The key of a component read (R:component-key): a name for a
    // declared product fiber's component and for a `Color`'s channel,
    // an integer for a `vec`, a site or a `Complex`, and a
    // parenthesized pair for a `Mat` or a `Metric`. Nothing else
    // stands before `of`, so the key is read at elaboration rather
    // than computed.
    component_key: ($) =>
      choice(
        $.identifier,
        $.number,
        seq(
          "(",
          $.number,
          repeat1(seq(repeat($._newline), ",", repeat($._newline), $.number)),
          ")",
        ),
      ),

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
    // key and its colon tell it from the site literal and from grouping
    // parens, both of which hold bare expressions. An integer key names
    // a component by position, so `v but (0: e)` updates a `vec`
    // (R:component-key).
    product: ($) =>
      seq(
        "(",
        repeat(choice(",", $._newline)),
        $.product_component,
        repeat(seq(repeat1(choice(",", $._newline)), $.product_component)),
        repeat(choice(",", $._newline)),
        ")",
      ),

    // the component wins over reading the key as an expression with a
    // configuration after it (R:product-fiber). A parenthesized run of
    // coordinates in key position is the site key, so
    // `A but ((i, j): 20.0)` writes one site of a field and
    // `m but ((0, 1): 1.0)` one entry of a `Mat` — the base's rank
    // decides which (R:component-key, R:product-fit).
    product_component: ($) =>
      prec(
        13,
        seq(
          field("name", choice($.identifier, $.number, $.site)),
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
        optional(seq("(", field("binder", $._pattern), ")")),
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

    // `x := e` and `Cons(d, s, _) := u` — a local, whose left side is a
    // pattern (spec §2.10). The parenthesized patterns begin the way an
    // expression does, and the `:=` is what tells a local from a bare
    // item. A local states an optional fiber after `:`, `a: Real := 3`,
    // and the value it binds is held to it (R:stated-fiber); the
    // lowering states that the annotation stands on a bare name, since
    // a pattern already states what the value is.
    local: ($) =>
      seq(
        field("pattern", $._pattern),
        optional(
          seq(
            alias(token(/(\n[ \t\r]*)*:/), ":"),
            field("type", $.type_annotation),
          ),
        ),
        ":=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `state name := init` — a local transient port, declared inside a
    // block or a function body (R:instance-state, spec §3). It states an
    // optional fiber after `:` as every other binding site does
    // (R:stated-fiber).
    state_local: ($) =>
      seq(
        "state",
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
        ":=",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `p <- e` — this port takes that expression's value, one batch
    write: ($) =>
      seq(
        field("target", $.identifier),
        "<-",
        repeat($._newline),
        field("value", $._expression),
      ),

    // `fig.panel` — one qualified identifier reaching into a used
    // document's namespace (spec §10). A dot on a value, `u.D`, is the
    // same lexical run: the lowering joins the segments into one name,
    // elaboration reads it by what the head names, and a head naming no
    // namespace refuses with the redirect to `of` (R:component-key).
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
