import { AsyncContext } from "@toolcog/util/async";

interface State {
  //
}

const State = (() => {
  const stateVariable = new AsyncContext.Variable<State>({
    name: "toolcog.State",
  });

  const get = (): State | undefined => {
    return stateVariable.get();
  };

  const run = <F extends (...args: any[]) => unknown>(
    value: State,
    func: F,
    ...args: Parameters<F>
  ): ReturnType<F> => {
    return stateVariable.run(value, func, ...args);
  };

  return {
    get,
    run,
  };
})();

export { State };
