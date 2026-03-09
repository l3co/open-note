interface IllustrationProps {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Illustration({
  src,
  alt,
  size = 96,
  className = "",
  style,
}: IllustrationProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={size}
      height={size}
      draggable={false}
      style={{
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
