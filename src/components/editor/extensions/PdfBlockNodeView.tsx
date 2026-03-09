import { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { PdfBlockComponent } from "@/components/pdf/PdfBlockComponent";

export function PdfBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const { src, totalPages, displayMode, currentPage, scale } = node.attrs;

  const handleUpdate = useCallback(
    (data: { displayMode?: string; currentPage?: number; scale?: number }) => {
      updateAttributes(data);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="pdf-block-wrapper" data-type="pdf-block">
      <PdfBlockComponent
        src={src}
        totalPages={totalPages}
        displayMode={displayMode}
        currentPage={currentPage}
        scale={scale}
        onUpdate={handleUpdate}
      />
    </NodeViewWrapper>
  );
}
