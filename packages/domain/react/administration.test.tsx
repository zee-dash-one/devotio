// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { usePilotAccess } from "./administration";
import type { AccessState } from "../administration";
afterEach(cleanup);
describe("barreira reativa de entrada", () => {
  it("aguarda bootstrap, acompanha aprovação/revogação e limpa na troca de conta", async () => {
    let state: AccessState = { status: "pending", editorial: false };
    let update = () => {};
    const stop = vi.fn();
    const client = {
      mutation: vi.fn(async () => state),
      watchQuery: vi.fn(() => ({
        localQueryResult: () => state,
        onUpdate: (callback: () => void) => {
          update = callback;
          return stop;
        },
      })),
    } as unknown as ConvexReactClient;
    const hook = renderHook(({ owner }) => usePilotAccess(client, owner), {
      initialProps: { owner: "ana" as string | null },
    });
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() =>
      expect(hook.result.current.access?.status).toBe("pending"),
    );
    act(() => {
      state = { status: "approved", editorial: true };
      update();
    });
    expect(hook.result.current.access).toEqual(state);
    act(() => {
      state = { status: "disabled", editorial: true };
      update();
    });
    expect(hook.result.current.access?.status).toBe("disabled");
    hook.rerender({ owner: null });
    expect(hook.result.current.access).toBeUndefined();
    expect(stop).toHaveBeenCalled();
  });
  it("falha fechada e ignora bootstrap atrasado depois do logout", async () => {
    let resolve!: () => void;
    const client = {
      mutation: vi.fn(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      ),
      watchQuery: vi.fn(),
    } as unknown as ConvexReactClient;
    const hook = renderHook(({ owner }) => usePilotAccess(client, owner), {
      initialProps: { owner: "ana" as string | null },
    });
    hook.rerender({ owner: null });
    await act(async () => {
      resolve();
    });
    expect(client.watchQuery).not.toHaveBeenCalled();
    expect(hook.result.current.access).toBeUndefined();
  });
});
