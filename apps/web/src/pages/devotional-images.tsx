import { useEffect, useState } from "react";
import { imageRevision, imageSizes, imageStyles, type Devotional, type DevotionalImageManifest } from "domain/core";
import { useApp } from "../context";
import { Modal } from "../components";
import { Button } from "../ui/button";
import { canShareImages, shareImages } from "../share-images";
interface Prepared { key: string; pages: { file: File; url: string; page: number }[] }
export function DevotionalImages({ day, onClose }: { day: Devotional; onClose(): void }) {
  const { repository, pilotAccess, localProfile } = useApp();
  const [size, setSize] = useState<string>("story"), [style, setStyle] = useState<string>("paper");
  const [manifest, setManifest] = useState<DevotionalImageManifest>();
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [prepared, setPrepared] = useState<Prepared>(), [attempt, setAttempt] = useState(0), [sharing, setSharing] = useState(false);
  let revision = "";
  try { revision = imageRevision(day); } catch { /* Legacy content outside the supported image limits remains readable. */ }
  const variant = size + "-" + style, key = revision + ":" + variant;
  const files = prepared?.key === key && manifest?.status === "ready" ? prepared.pages : [];
  const editorial = pilotAccess?.editorial || localProfile?.editorial;
  useEffect(() => {
    setManifest(undefined); setError("");
    if (!revision || !repository?.watchDevotionalImages) { setError("Imagens indisponíveis para este devocional."); return; }
    return repository.watchDevotionalImages(day.id, revision)(value => { setManifest(value); setError(""); }, cause => setError(cause.message));
  }, [repository, day.id, revision, attempt]);
  const sources = JSON.stringify(manifest?.status === "ready" ? manifest.files.filter(file => file.variant === variant).sort((a,b) => a.page-b.page) : []);
  useEffect(() => {
    const controller = new AbortController(), urls: string[] = [];
    setPrepared(undefined); setNotice("");
    const selected = JSON.parse(sources) as DevotionalImageManifest["files"];
    if (!selected.length) return () => controller.abort();
    setError("");
    void (async () => {
      if (selected.length > 10 || selected.reduce((sum, file) => sum+file.bytes, 0) > 32*1024*1024) throw new Error("Esta arte excede o limite de tamanho para compartilhar.");
      const pages: Prepared["pages"] = []; let bytes = 0;
      for (const source of selected) {
        const response = await fetch(source.url, { signal: controller.signal });
        if (!response.ok) throw new Error("Não foi possível baixar a imagem. Tente novamente.");
        const blob = await response.blob(); bytes += blob.size;
        if (!blob.type.startsWith("image/png") || bytes > 32 * 1024 * 1024) throw new Error("O arquivo da imagem não está disponível neste dispositivo.");
        if (controller.signal.aborted) return;
        const file = new File([blob], "devotio-" + day.date + "-" + variant + "-" + source.page + ".png", { type: "image/png" });
        const url = URL.createObjectURL(file); urls.push(url); pages.push({ file, url, page: source.page });
      }
      if (!controller.signal.aborted) setPrepared({ key, pages });
    })().catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível preparar a imagem."); });
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [sources, key, variant, day.date, attempt]);
  async function share(selected: File[]) {
    setSharing(true); setNotice("");
    try {
      const result = await shareImages(selected);
      if (result === "unsupported") setNotice("Use Baixar imagem ou compartilhe uma página por vez.");
    } catch { setNotice("Não foi possível compartilhar. Você pode baixar a imagem e enviá-la pelo aplicativo escolhido."); }
    finally { setSharing(false); }
  }
  const all = files.map(page => page.file);
  return <Modal title="Compartilhar imagem" onClose={onClose}>
    <div className="image-share-panel">
      <p>Devocional de {day.date.split("-").reverse().join("/")}. Escolha uma arte preparada para este dia.</p>
      <div className="image-share-options">
        <label>Tamanho<select value={size} onChange={event => setSize(event.target.value)}>{imageSizes.map(item => <option key={item.id} value={item.id}>{item.label} · {item.width} × {item.height}</option>)}</select></label>
        <label>Arte<select value={style} onChange={event => setStyle(event.target.value)}>{imageStyles.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      {error ? <div role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setAttempt(value => value+1)}>Tentar baixar novamente</Button></div> : !manifest || manifest.status === "pending" || manifest.status === "rendering" ? <p role="status">As imagens estão sendo preparadas. Você pode continuar a leitura e voltar depois.</p> : manifest.status === "unavailable" ? <p role="status">As imagens estão disponíveis apenas para a edição publicada do dia. Você pode compartilhar este texto.</p> : manifest.status === "failed" ? <p role="status">Não foi possível preparar as imagens. O texto continua disponível.</p> : !files.length ? <p role="status">Preparando os arquivos para compartilhar…</p> : null}
      {editorial && repository?.retryDevotionalImages && (manifest?.status === "failed" || manifest?.status === "unavailable") && <Button variant="secondary" onClick={() => { void repository.retryDevotionalImages!(day.id, revision).catch(cause => setError(cause.message)); }}>Preparar imagens novamente</Button>}
      <Button disabled={!files.length || sharing || !canShareImages(all)} onClick={() => { void share(all); }}>{files.length > 1 ? "Compartilhar páginas" : "Compartilhar imagem"}</Button>
      {!!files.length && !canShareImages(all) && <p className="caption">Neste navegador, use o download abaixo. Se disponível, compartilhe cada página separadamente.</p>}
      {notice && <p role="status">{notice}</p>}
      {files.map(item => <figure key={item.page} className="image-share-preview">
        <a href={item.url} target="_blank" rel="noreferrer" aria-label={"Abrir prévia da página " + item.page}><img src={item.url} alt={"Devocional de " + day.date + ", " + day.reference + ", página " + item.page + " de " + files.length} /></a>
        <figcaption>Página {item.page} de {files.length}</figcaption>
        <a className="image-download" href={item.url} download={item.file.name}>Baixar imagem{files.length > 1 ? " · página " + item.page : ""}</a>
        {files.length > 1 && canShareImages([item.file]) && <Button variant="secondary" disabled={sharing} onClick={() => { void share([item.file]); }}>Compartilhar página {item.page}</Button>}
      </figure>)}
      {!!files.length && <p className="caption">Os aplicativos disponíveis são definidos pelo seu dispositivo. Você também pode abrir a prévia para salvar a imagem.</p>}
    </div>
  </Modal>;
}
