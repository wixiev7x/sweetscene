type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Shape = "circle" | "square";

const SIZE_CLASS: Record<Size, string> = {
  xs: "w-8 h-8 text-xs",
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-20 h-20 text-2xl",
  xl: "w-24 h-24 text-3xl",
};

const SHAPE_CLASS: Record<Shape, string> = {
  circle: "rounded-full",
  square: "rounded-2xl",
};

const GRADIENTS = [
  "from-brand to-crimson-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-violet-500",
  "from-rose-500 to-crimson-400",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function Avatar({
  src,
  name,
  size = "sm",
  shape = "circle",
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: Size;
  shape?: Shape;
  className?: string;
}) {
  const gradient = GRADIENTS[hashName(name) % GRADIENTS.length];
  const sizeClass = SIZE_CLASS[size];
  const shapeClass = SHAPE_CLASS[shape];

  if (src) {
    return (
      <div
        className={`${sizeClass} ${shapeClass} bg-cover bg-center shrink-0 ${className}`}
        style={{ backgroundImage: `url(${src})` }}
        aria-label={name}
        role="img"
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${shapeClass} bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 ${className}`}
      aria-label={name}
      role="img"
    >
      <span className="text-white font-bold">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}