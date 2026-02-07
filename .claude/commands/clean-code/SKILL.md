---
name: clean-code-principles
description: Prescriptive coding standards enforcing SOLID, DRY, KISS, YAGNI, Clean Code, and software craftsmanship principles. Apply to ALL code generation, refactoring, and code review tasks. These rules are mandatory, not suggestions. Use for any programming language.
---

# Clean Code Principles

These principles are **mandatory** for all code produced. Apply them automatically without exception.

---

## SOLID Principles

### S — Single Responsibility Principle (SRP)
Every module/class/function does ONE thing.
- If you need "and" to describe what it does, split it
- One reason to change per unit
- Extract until you can't extract anymore

```
❌ getUserAndSendEmail()
✅ getUser() + sendEmail()
```

### O — Open/Closed Principle (OCP)
Open for extension, closed for modification.
- Use abstractions (interfaces, base classes, higher-order functions)
- Add new behavior by adding code, not changing existing code
- Prefer composition over conditionals

```
❌ if (type === 'A') {...} else if (type === 'B') {...}
✅ handlers[type].process()
```

### L — Liskov Substitution Principle (LSP)
Subtypes must be substitutable for their base types.
- Don't override methods to throw "not implemented"
- Don't strengthen preconditions or weaken postconditions
- If it looks like a duck but needs batteries, wrong abstraction

### I — Interface Segregation Principle (ISP)
No client should depend on methods it doesn't use.
- Many small interfaces > one large interface
- Split fat interfaces into focused ones
- Clients only know what they need

### D — Dependency Inversion Principle (DIP)
Depend on abstractions, not concretions.
- High-level modules don't import low-level modules directly
- Both depend on abstractions
- Inject dependencies, don't instantiate them

---

## Core Principles

### DRY — Don't Repeat Yourself
Every piece of knowledge has ONE authoritative representation.
- If you copy-paste, extract
- Rule of three: duplicated twice = refactor
- But: avoid premature abstraction (see YAGNI)

### KISS — Keep It Simple, Stupid
Simplest solution that works.
- No clever tricks
- Readable > clever
- If a junior can't understand it, simplify

### YAGNI — You Aren't Gonna Need It
Don't build for hypothetical futures.
- No "just in case" code
- No premature optimization
- No speculative generality
- Build for today's requirements only

---

## Clean Code Standards

### Naming
- **Intention-revealing**: name describes purpose without comments
- **Pronounceable**: can discuss verbally
- **Searchable**: avoid single letters except loop indices
- **No encodings**: no Hungarian notation, no type prefixes
- **Verb for functions**: `calculateTotal()`, `isValid()`, `hasPermission()`
- **Noun for classes/variables**: `User`, `orderItems`, `totalPrice`

### Functions
- **Small**: 5-20 lines ideal, max ~30
- **Do one thing**: SRP at function level
- **One level of abstraction**: don't mix high and low level
- **Max 3 parameters**: more = use object/struct
- **No side effects**: or name them explicitly (`saveAndNotify`)
- **Command-Query Separation**: either do something OR return something, not both

### Comments
- **Code should be self-documenting**: if you need a comment, first try renaming
- **Only comment WHY, never WHAT**: code shows what, comments explain non-obvious reasoning
- **No commented-out code**: delete it, git remembers
- **No noise comments**: `// increment i` → delete

### Error Handling
- **Fail fast**: validate early, reject invalid state immediately
- **Use exceptions for exceptional cases**: not for flow control
- **Provide context**: error messages should explain what happened and ideally how to fix
- **Don't return null**: use Optional/Maybe, empty collections, or throw
- **Don't pass null**: same reasoning

### Structure
- **Vertical proximity**: related code stays together
- **Newspaper metaphor**: high-level at top, details below
- **One concept per file**: don't hide multiple classes/modules
- **Consistent formatting**: follow language conventions

---

## Design Heuristics

### Composition Over Inheritance
- Prefer "has-a" over "is-a"
- Inheritance creates tight coupling
- Use inheritance only for true "is-a" relationships

### Law of Demeter (Minimal Knowledge)
Only talk to:
- Your own methods
- Objects you created
- Objects passed as parameters
- Direct component objects

```
❌ user.getAddress().getCity().getName()
✅ user.getCityName()
```

### Fail Fast
- Validate inputs at boundaries
- Throw early on invalid state
- Don't let bad data propagate

### Separation of Concerns
- UI logic ≠ business logic ≠ data access
- Each layer has one job
- Changes in one layer don't ripple to others

### Immutability Where Possible
- Prefer const/final/readonly
- Return new objects instead of mutating
- Immutable = thread-safe, predictable, debuggable

---

## Code Smells to Eliminate

Always refactor these:
- **Long method**: extract smaller methods
- **Large class**: split by responsibility
- **Long parameter list**: introduce parameter object
- **Divergent change**: class changes for multiple reasons → split
- **Shotgun surgery**: one change affects many classes → consolidate
- **Feature envy**: method uses another class more than its own → move it
- **Data clumps**: same data groups appear together → create class
- **Primitive obsession**: overuse of primitives → create value objects
- **Switch statements**: often violate OCP → use polymorphism
- **Parallel inheritance**: subclass A requires subclass B → merge hierarchies
- **Lazy class**: does too little → inline or merge
- **Speculative generality**: unused abstraction → delete
- **Temporary field**: sometimes-null fields → extract class
- **Message chains**: a.b().c().d() → Law of Demeter violation
- **Middle man**: class delegates everything → remove
- **Inappropriate intimacy**: classes too coupled → separate or merge
- **Comments explaining bad code**: refactor instead

---

## Pre-Commit Checklist

Before considering code complete:

1. ☐ Each function does ONE thing
2. ☐ Names are clear and intention-revealing
3. ☐ No magic numbers/strings (use constants)
4. ☐ No duplication
5. ☐ Error cases handled
6. ☐ No commented-out code
7. ☐ Functions ≤ 30 lines
8. ☐ Max 3 parameters per function
9. ☐ No deep nesting (max 2-3 levels)
10. ☐ Dependencies injected, not created
11. ☐ Would a teammate understand this immediately?

---

## Application

When writing or reviewing code:
1. Apply these principles automatically
2. If trade-offs exist, prefer: Readability > Cleverness > Performance (unless perf is critical)
3. When refactoring, fix ONE smell at a time
4. Leave code cleaner than you found it (Boy Scout Rule)
