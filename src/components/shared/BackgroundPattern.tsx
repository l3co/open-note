import backgroundSvg from "@/assets/background.svg?raw";

const scaledSvg = backgroundSvg
  .replace('width="1024"', 'width="100%"')
  .replace('height="1024"', 'height="100%"')
  .replace("fill=\"none\">", 'fill="none" preserveAspectRatio="xMidYMid slice">');

export function BackgroundPattern() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ color: "var(--bg-pattern)", zIndex: 0 }}
      dangerouslySetInnerHTML={{ __html: scaledSvg }}
    />
  );
}
