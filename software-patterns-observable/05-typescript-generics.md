# 05 · Generics — the `<T>` that makes a pattern reusable

Every store and hook in this folder is written **once** but works for **any state shape**: `ObservableStore<T>`, `createStore<T>`, `useStore<T, S>`. That `<T>` is a **generic type parameter**, and it's the language feature that lets a *pattern* (a reusable shape) survive contact with a *type system* without collapsing into either `any` or a hundred copy-pasted variants.

This file explains generics from the ground up, using code you've already seen.

## The problem generics solve

You have one piece of logic that should work for many types. Without generics you have three bad options:

```ts
// 1. Duplicate it per type — the logic is identical, only the type differs.
function firstTodo(arr: Todo[]): Todo { return arr[0]; }
function firstUser(arr: User[]): User { return arr[0]; }

// 2. Use `any` — works, but throws away every guarantee.
function first(arr: any[]): any { return arr[0]; } // result is `any`, no autocomplete, no safety

// 3. Use `unknown` — safe but useless; you must cast at every call site.
function first(arr: unknown[]): unknown { return arr[0]; }
```

A **generic** is the fourth option: write the logic once and let the *caller's* type flow through it.

```ts
function first<T>(arr: T[]): T {
  return arr[0];
}

first([todo1, todo2]); // T inferred as Todo  → returns Todo
first(["a", "b"]);     // T inferred as string → returns string
```

`<T>` is a **type variable**. It is not a concrete type; it's a placeholder that gets *filled in* — usually inferred automatically — when the function is called. The return type `T` is tied to the input `T`, so the relationship "you get back the same type you put in" is encoded in the signature.

> Mental model: a generic function is to *types* what a normal function is to *values*. A normal function takes value arguments; a generic takes type arguments. `<T>` is a parameter; `first<Todo>(...)` (or the inferred equivalent) is the argument.

## Reading `request<T>` from the manual Todos page

Here is the helper that prompted this file:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```

What `<T>` buys here:

- **One function, every endpoint.** The fetch/error/JSON plumbing is written once. `T` describes *what this particular call returns*.
- **The caller names the payload, the body inherits it.** `fetch().json()` is typed `Promise<any>` by design — the runtime can't know the shape. The generic lets the *caller* assert it once, and the return type `Promise<T>` carries it everywhere downstream:

```ts
const todosApi = {
  list:   (signal?: AbortSignal) => request<Todo[]>("/todos", { signal }),
  create: (body: TodoCreate)     => request<Todo>("/todos", { method: "POST", body: JSON.stringify(body) }),
  remove: (id: number)           => request<void>(`/todos/${id}`, { method: "DELETE" }),
};
```

`list` is `Promise<Todo[]>`, `create` is `Promise<Todo>`, `remove` is `Promise<void>` — all from one `request`. There is no inference here; the type can't come from the arguments (a URL string tells you nothing about the response), so we supply it **explicitly**: `request<Todo[]>(...)`.

This is the same trade the generated Orval hooks make internally — `customInstance<Todo[]>(...)` — except here we wrote it by hand. The generic is exactly what turns "a fetch wrapper" into "a typed API client."

## Inferred vs. explicit type arguments

Two ways `T` gets its value:

```ts
first([todo]);            // INFERRED — T comes from the argument's type
request<Todo[]>("/todos") // EXPLICIT — the argument can't reveal T, so you state it
```

Rule of thumb: **let inference work whenever the type is recoverable from the arguments.** Only annotate explicitly when it isn't — as with `request`, where the argument (a path string) carries no information about the result.

## Constraints — `T extends …`

A bare `<T>` means "literally any type," so inside the function you can only do things valid for *all* types (basically: pass it around). When the logic needs `T` to have certain capabilities, **constrain** it:

```ts
export function createStore<T extends object>(initial: T): ObservableStore<T> { … }
```

`T extends object` says "T can be any type *that is an object*." That constraint is what makes `state = { ...state, ...partial }` legal — you can only spread objects. Try `createStore(5)` and the compiler rejects it *at the call site*, before any code runs.

Constraints narrow the input while keeping the output precise: `createStore({ items: 0 })` still returns the exact `ObservableStore<{ items: number }>`, not a widened `ObservableStore<object>`.

## Multiple type parameters — `useStore<T, S>`

A generic can have several parameters that relate inputs to each other:

```ts
export function useStore<T extends object, S>(
  store: ObservableStore<T>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()));
}
```

- `T` — the full state shape held by the store.
- `S` — the **slice** the selector returns.

The signature wires them together: the selector receives `T` and produces `S`, and the hook returns that same `S`. So:

```ts
const items = useStore(cartStore, (s) => s.items); // T = {items,lastAction}, S = number → items: number
```

Both are inferred — `T` from `cartStore`, `S` from the selector's return — so the call site stays clean while the result is exactly typed.

## Generic types (not just functions)

The same `<T>` annotates `interface`/`type` declarations, which is how the store's *shape* stays reusable:

```ts
export interface ObservableStore<T> {
  getSnapshot: () => T;
  setState: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
}
```

`ObservableStore` isn't a usable type on its own — it's a **type constructor**. You apply it to get a concrete type: `ObservableStore<{ items: number }>`. `Partial<T>` in there is itself a generic type from the standard library ("all properties of `T`, optional"), composed with our `T`. Generics compose like functions do.

## Why this belongs in a patterns folder

A design pattern is a **reusable shape** (file 01). A generic is how you express "reusable shape" *to the type system* — without it, the Observer store would either be untyped (`any`, no safety) or duplicated per state shape (no reuse). `<T>` is what lets the ~30-line store in [file 04](./04-build-an-observable-store.md) be genuinely one implementation that serves Zustand-style carts, React Query caches, and your own app state alike.

The pattern says "a subject notifies its observers." The generic says "…for whatever type the subject happens to hold." Together they give you reuse that the compiler still checks.

## TL;DR

- `<T>` is a **type parameter** — a placeholder filled in (usually inferred) per call, tying outputs to inputs.
- Reach for it when one piece of logic should serve many types; it beats `any` (unsafe) and duplication (unmaintainable).
- **Infer** when the type is recoverable from arguments; **annotate explicitly** (`request<Todo[]>`) when it isn't.
- **Constrain** with `T extends …` when the body needs guarantees about `T`.
- Generic *types* (`ObservableStore<T>`, `Partial<T>`) make data shapes reusable the same way generic functions make logic reusable.

← Back to the [README](./README.md) · Build the store in [file 04](./04-build-an-observable-store.md).
