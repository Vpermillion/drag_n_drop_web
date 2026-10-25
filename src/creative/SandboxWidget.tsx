import React, { useEffect, useMemo, useRef } from "react";
import { isPages } from "../paths";
import { sandboxDocument } from "../shared/creative";
export type WidgetCode = { html: string; css: string; js: string };
export default function SandboxWidget({
  code,
  title,
  className,
  editing = false,
  height,
}: {
  code: WidgetCode;
  title: string;
  className?: string;
  editing?: boolean;
  height?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const document = useMemo(
    () => sandboxDocument(code, !editing),
    [code.html, code.css, code.js, editing],
  );
  const useSourceDocument = isPages || editing;
  const send = () => {
    if (!useSourceDocument)
      frame.current?.contentWindow?.postMessage(
        { type: "uru:creative-document", document },
        "*",
      );
  };
  useEffect(send, [document, useSourceDocument]);
  return (
    <iframe
      key={document}
      ref={frame}
      className={className ?? "creative-embed"}
      title={title}
      sandbox={editing ? "" : "allow-scripts"}
      referrerPolicy="no-referrer"
      srcDoc={useSourceDocument ? document : undefined}
      src={useSourceDocument ? undefined : "/creative-sandbox"}
      onLoad={send}
      style={{
        border: 0,
        display: "block",
        pointerEvents: editing ? "none" : undefined,
        ...(height ? { height } : {}),
      }}
    />
  );
}
