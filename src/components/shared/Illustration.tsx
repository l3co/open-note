interface IllustrationProps {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  adaptive?: boolean;
}

export function Illustration({
  src,
  alt,
  size = 96,
  className = "",
  style,
  adaptive = false,
}: IllustrationProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={[adaptive ? "illustration-adaptive" : "", className]
        .filter(Boolean)
        .join(" ")}
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
