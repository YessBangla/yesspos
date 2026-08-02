import { cn } from "@/lib/utils";
import logoMark from "@/assets/daily-bazar-mark.png";

type Props = {
  /** pixel size of the square mark */
  size?: number;
  className?: string;
  /** show the wordmark next to the mark */
  withText?: boolean;
  /** Bengali locale => show Bengali name */
  bn?: boolean;
  tagline?: string;
  textClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = 36,
  className,
  withText = false,
  bn = false,
  tagline,
  textClassName,
  priority = false,
}: Props) {
  const name = bn ? "প্রতিদিনের বাজার" : "Daily Bazar";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoMark}
        alt={bn ? "প্রতিদিনের বাজার লোগো" : "Daily Bazar logo"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="shrink-0 rounded-xl bg-card object-contain p-0.5 ring-1 ring-border"
      />
      {withText && (
        <span className="leading-tight">
          <span className={cn("block font-display text-lg font-extrabold tracking-tight", textClassName)}>
            {name}
          </span>
          {tagline && (
            <span className="block text-[11px] font-medium text-muted-foreground">{tagline}</span>
          )}
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
