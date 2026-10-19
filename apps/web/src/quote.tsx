import { Link } from "@tanstack/react-router";
import type { BibleQuote } from "domain/core";
export function Quote({ quote, onOpen }: { quote: BibleQuote; onOpen?: () => void }) {
  return (
    <blockquote className="community-quote">
      <p>{quote.text}</p>
      <footer>
        {quote.reference} · {quote.versionName}
      </footer>
      <Link
        onClick={onOpen}
        to="/biblia"
        search={{
          book: quote.book,
          chapter: quote.chapter,
          verse: quote.first,
          version: quote.version,
        }}
      >
        Ler na Bíblia
      </Link>
    </blockquote>
  );
}
