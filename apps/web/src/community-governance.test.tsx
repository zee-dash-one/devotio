import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepositoryProvider } from "domain/react";
import type { Repository, CommunityGovernance, Watch, JoinRequestPage, CreationPermission } from "domain/core";
import { CreationActions, PendingJoinRequests, MemberGovernance } from "./community-governance";
afterEach(cleanup);
function once<T>(value: T): Watch<T> { return next => { next(value); return () => {}; }; }
function governance(allowed: boolean): CommunityGovernance {
  return { watchCreation: () => once<CreationPermission>({ allowed, limit: 1, owned: 0, canCreate: allowed }), watchMine: () => once({ items: [], cursor: null }), watchRequests: () => once<JoinRequestPage>({ items: [{ id: "request", communityId: "group", communityName: "Esperança", userId: "applicant", name: "Ana", state: "pending", requestedAt: 1 }], cursor: null }), cancel: vi.fn(), decide: vi.fn(), setRole: vi.fn(), leave: vi.fn(), transfer: vi.fn() };
}
describe("community governance presentation", () => {
  it("hides creation without permission and shows the approved action", async () => {
    // Only the governance boundary is exercised by this component.
    const repo = { governance: governance(false) } as Repository;
    const result = render(<RepositoryProvider repository={repo}><CreationActions onCreate={() => {}} /></RepositoryProvider>);
    expect(await screen.findByText("Para criar uma comunidade, fale com a administração.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Criar comunidade" })).toBeNull();
    const onCreate = vi.fn();
    result.rerender(<RepositoryProvider repository={{ ...repo, governance: governance(true) }}><CreationActions onCreate={onCreate} /></RepositoryProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Criar comunidade" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
  it("shows requests to managers and sends the selected decision", async () => {
    const repo = governance(true);
    render(<PendingJoinRequests governance={repo} id="group" />);
    fireEvent.click(await screen.findByRole("button", { name: "Aprovar Ana" }));
    await waitFor(() => expect(repo.decide).toHaveBeenCalledWith("request", "approve"));
  });
  it("does not offer owner changes or admin peer demotion", () => {
    const repo = governance(true);
    const group = { id: "group", name: "Esperança", description: "", scripture: "", role: "admin" as const, memberId: "self" };
    const result = render(<MemberGovernance governance={repo} group={group} member={{ id: "other", userId: "other", name: "Ana", role: "owner" }} />);
    expect(screen.queryByRole("button")).toBeNull();
    result.rerender(<MemberGovernance governance={repo} group={group} member={{ id: "other", userId: "other", name: "Ana", role: "admin" }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
