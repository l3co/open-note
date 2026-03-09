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
    <div
      className={className}
      role="img"
      aria-label={alt}
      style={{
        width: size,
        height: size,
        backgroundColor: "currentColor",
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        ...style,
      }}
    />
  );
}
