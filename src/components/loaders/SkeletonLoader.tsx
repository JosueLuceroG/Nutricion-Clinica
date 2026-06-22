import "./SkeletonLoader.css";

type SkeletonLoaderProps = {
  rows?: number;
  variant?: "list" | "card" | "table";
  className?: string;
};

export function SkeletonLoader({
  rows = 4,
  variant = "list",
  className = "",
}: SkeletonLoaderProps) {
  return (
    <div
      className={["skeleton-loader", `skeleton-loader--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-loader__row" key={index}>
          <span className="skeleton-loader__avatar" />
          <div className="skeleton-loader__content">
            <span className="skeleton-loader__line skeleton-loader__line--wide" />
            <span className="skeleton-loader__line skeleton-loader__line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}
