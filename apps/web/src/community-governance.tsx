import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useRepository, useWatch } from "domain/react";
import { canChangeRole, joinStateLabels, roleLabels, type Community, type CommunityGovernance, type Member } from "domain/core";
import { ActionForm, ErrorMessage, Loading, Modal } from "./components";
import { Button } from "./ui/button";

export function CreationActions({ onCreate }: { onCreate: () => void }) {
  const { governance } = useRepository();
  return governance ? <CreationPermission governance={governance} onCreate={onCreate} /> : null;
}
function CreationPermission({ governance, onCreate }: { governance: CommunityGovernance; onCreate: () => void }) {
  const { data, error } = useWatch(useMemo(() => governance.watchCreation(), [governance]));
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  return <div className="create-community"><div><h3>Um novo espaço de cuidado.</h3><p>{!data.allowed ? "Para criar uma comunidade, fale com a administração." : data.canCreate ? "Reúna sua igreja ou seu grupo em uma comunidade." : "Você atingiu seu limite de comunidades. Fale com a administração."}</p><p className="caption">{data.allowed && `Comunidades sob sua responsabilidade: ${data.owned > 20 ? "20+" : data.owned} de ${data.limit}.`}</p></div>{data.canCreate && <Button variant="ghost" onClick={onCreate}>Criar comunidade</Button>}</div>;
}
export function MyJoinRequests() {
  const { governance } = useRepository();
  return governance ? <JoinRequests governance={governance} /> : null;
}
export function PendingJoinRequests({ governance, id }: { governance: CommunityGovernance; id: string }) {
  return <JoinRequests governance={governance} id={id} />;
}
function JoinRequests({ governance, id }: { governance: CommunityGovernance; id?: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, error } = useWatch(useMemo(() => id ? governance.watchRequests(id, cursor) : governance.watchMine(cursor), [governance, id, cursor]));
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  if (!data.items.length && !cursor && !id) return null;
  return <section className="community-section" aria-label={id ? "Pedidos para entrar" : "Suas solicitações"}>
    <h3>{id ? "Pedidos para entrar" : "Suas solicitações"}</h3>
    {!data.items.length && <p>Nenhum pedido pendente.</p>}
    <ul className="member-list">{data.items.map(request => <li key={request.id}><div><strong>{id ? request.name : request.communityName}</strong><span>{joinStateLabels[request.state]}</span></div>
      {id ? <><ActionForm label={`Aprovar ${request.name}`} onSubmit={() => governance.decide(request.id, "approve")} /><ActionForm label={`Recusar ${request.name}`} onSubmit={() => governance.decide(request.id, "reject")} /></> : request.state === "pending" && <ActionForm label={`Cancelar pedido para ${request.communityName}`} onSubmit={() => governance.cancel(request.id)} />}
    </li>)}</ul>
    {cursor && <Button variant="ghost" onClick={() => setCursor(null)}>Primeira página de pedidos</Button>}
    {data.cursor && <Button variant="ghost" onClick={() => setCursor(data.cursor)}>Próximos pedidos</Button>}
  </section>;
}
export function MemberGovernance({ governance, group, member }: { governance: CommunityGovernance; group: Community; member: Member }) {
  const [transferring, setTransferring] = useState(false);
  if (member.id === group.memberId) return null;
  const next = member.role === "member" ? "admin" : "member";
  return <>
    {canChangeRole(group.role, member.role, next) && <ActionForm label={next === "admin" ? `Tornar ${member.name} administrador` : `Remover administração de ${member.name}`} onSubmit={() => governance.setRole(group.id, member.id, next)} />}
    {group.role === "owner" && member.role !== "owner" && <Button variant="ghost" size="compact" onClick={() => setTransferring(true)}>Transferir posse para {member.name}</Button>}
    {transferring && <Modal title="Transferir a responsabilidade?" onClose={() => setTransferring(false)}><p>{member.name} se tornará responsável por {group.name}. Você passará a {roleLabels.admin.toLowerCase()}.</p><ActionForm label="Confirmar transferência" onSubmit={() => governance.transfer(group.id, member.id)} onDone={() => setTransferring(false)} /></Modal>}
  </>;
}
export function LeaveCommunity({ governance, group }: { governance: CommunityGovernance; group: Community }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (group.role === "owner") return <p className="caption">Para sair, transfira a responsabilidade para outro participante.</p>;
  return <><Button variant="ghost" onClick={() => setOpen(true)}>Sair da comunidade</Button>{open && <Modal title="Sair da comunidade?" onClose={() => setOpen(false)}><p>Você perderá acesso a {group.name}. Seu histórico será preservado.</p><ActionForm label="Confirmar saída" onSubmit={async () => { await governance.leave(group.id); await navigate({ to: "/comunidade" }); }} /></Modal>}</>;
}
