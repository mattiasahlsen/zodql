import type { IsEqual } from "type-fest";

type IsAny<T> = 0 extends 1 & T ? true : false;

export function expectTypeof<TReceived>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _value: TReceived
): IsAny<TReceived> extends true
  ? never
  : {
      toBe: <TExpected>(...mockParam: IsEqual<TReceived, TExpected> extends true ? [] : ["Types do not match"]) => void;
      toExtend: <TExpected>(...mockParam: TReceived extends TExpected ? [] : ["Types do not match"]) => void;
    } {
  return {
    toBe: () => {},
    toExtend: () => {},
  } as any;
}
