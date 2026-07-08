import { Cause, Effect, Exit, type Layer } from "effect";

export const runEffectPromise = <A, E>(
  effect: Effect.Effect<A, E, never>,
): Promise<A> =>
  Effect.runPromiseExit(effect).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    const failure = Cause.failureOption(exit.cause);

    if (failure._tag === "Some") {
      throw failure.value;
    }

    throw new Error(Cause.pretty(exit.cause));
  });

export const runLayerEffect =
  <R>(layer: Layer.Layer<R, never, never>) =>
  <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> =>
    runEffectPromise(Effect.provide(effect, layer));
