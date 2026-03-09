import { useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { InkBlockComponent } from "@/components/ink/InkBlockComponent";
import type { Stroke } from "@/lib/ink/types";

export function InkBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const { width, height, strokes, svgCache } = node.attrs;

  const handleUpdate = useCallback(
    (newStrokes: Stroke[], newSvgCache: string | null) => {
      updateAttributes({ strokes: newStrokes, svgCache: newSvgCache });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="ink-block-wrapper" data-type="ink-block">
      <InkBlockComponent
        width={width}
        height={height}
        strokes={strokes ?? []}
        svgCache={svgCache}
        onUpdate={handleUpdate}
      />
    </NodeViewWrapper>
  );
}
